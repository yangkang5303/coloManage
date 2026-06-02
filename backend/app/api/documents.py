from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.domain import Document, DocumentChunk, User
from app.schemas.domain import DocumentRead
from app.core.config import get_settings
from app.services.audit import audit
from app.services.embedding import generate_embedding
from app.services.parser import UnsupportedOCR, file_sha256, parse_document, split_into_chunks


router = APIRouter(tags=["Documents"])


@router.post("/documents/upload", response_model=DocumentRead)
async def upload_document(
    title: str = Form(...),
    document_type: str = Form(...),
    vendor_id: int | None = Form(None),
    project_id: int | None = Form(None),
    site_id: int | None = Form(None),
    contract_id: int | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    storage = Path(get_settings().storage_dir)
    storage.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}_{file.filename}"
    path = storage / filename
    path.write_bytes(await file.read())
    row = Document(
        title=title,
        document_type=document_type,
        vendor_id=vendor_id,
        project_id=project_id,
        site_id=site_id,
        contract_id=contract_id,
        original_filename=file.filename,
        file_path=str(path),
        file_hash=file_sha256(path),
        mime_type=file.content_type,
        uploaded_by=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    audit(db, user.id, "upload", "document", row.id, {"filename": file.filename, "document_type": document_type})
    return row


@router.get("/documents", response_model=list[DocumentRead])
def list_documents(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Document).order_by(Document.id).all()


@router.get("/documents/{document_id}", response_model=DocumentRead)
def get_document(document_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    row = db.get(Document, document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    return row


@router.post("/documents/{document_id}/process")
def process_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.get(Document, document_id)
    if not row or not row.file_path:
        raise HTTPException(status_code=404, detail="Document not found")
    db.query(DocumentChunk).filter(DocumentChunk.document_id == row.id).delete()
    try:
        blocks = parse_document(Path(row.file_path))
        chunks = split_into_chunks(blocks)
    except UnsupportedOCR:
        row.processing_status = "OCR_NOT_SUPPORTED_IN_MVP"
        db.commit()
        return {"status": "OCR_NOT_SUPPORTED_IN_MVP", "document_id": row.id}
    row.text_content = "\n\n".join(block.text for block in blocks)
    settings = get_settings()
    for index, chunk in enumerate(chunks):
        # Generate embedding if enabled
        embedding = None
        if settings.embedding_enabled:
            embedding = generate_embedding(chunk.text)
        db.add(
            DocumentChunk(
                document_id=row.id,
                chunk_index=index,
                page_number=chunk.page_number,
                sheet_name=chunk.sheet_name,
                section_title=chunk.section_title,
                clause_reference=chunk.clause_reference,
                text=chunk.text,
                search_text=chunk.text.lower(),
                embedding=embedding,
            )
        )
    row.processing_status = "processed"
    db.commit()
    audit(db, user.id, "process", "document", row.id, {"chunks": len(chunks)})
    return {"status": "processed", "document_id": row.id, "chunk_count": len(chunks)}


@router.get("/documents/{document_id}/chunks")
def document_chunks(document_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index).all()
