from pathlib import Path
from uuid import uuid4

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.domain import Document, DocumentChunk, Obligation, TopicEvidence, User
from app.schemas.domain import DocumentRead
from app.services.audit import audit
from app.services.embedding import generate_embedding
from app.services.parser import UnsupportedOCR, file_sha256, parse_document, split_into_chunks


router = APIRouter(tags=["Documents"])

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/plain",
    "text/csv",
}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/documents/upload", response_model=DocumentRead)
async def upload_document(
    title: str = Form(...),
    document_type: str = Form(...),
    contract_id: int | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}",
        )
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size {len(content) // 1024} KB exceeds the 10 MB limit.",
        )
    storage = Path(get_settings().storage_dir)
    storage.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}_{file.filename}"
    path = storage / filename
    path.write_bytes(content)
    row = Document(
        title=title,
        document_type=document_type,
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
def list_documents(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(Document).order_by(Document.id).offset(skip).limit(limit).all()


@router.get("/documents/{document_id}", response_model=DocumentRead)
def get_document(document_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    row = db.get(Document, document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    return row


@router.delete("/documents/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.get(Document, document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = Path(row.file_path) if row.file_path else None
    db.query(Obligation).filter(Obligation.source_document_id == document_id).update(
        {Obligation.source_document_id: None, Obligation.source_chunk_id: None},
        synchronize_session=False,
    )
    db.query(TopicEvidence).filter(TopicEvidence.document_id == document_id).delete(synchronize_session=False)
    db.delete(row)
    db.commit()

    file_deleted = False
    if file_path and file_path.is_file():
        try:
            file_path.unlink()
            file_deleted = True
        except OSError:
            # The database entry is already deleted; expose the cleanup result for operators.
            file_deleted = False
    audit(db, user.id, "delete", "document", document_id, {"file_deleted": file_deleted})
    return {"status": "deleted", "document_id": document_id, "file_deleted": file_deleted}


def _run_processing(document_id: int, user_id: int) -> None:
    """Background task: parse, chunk, and embed a document. Runs in a thread pool."""
    from app.db.session import SessionLocal  # local import to avoid circular deps

    db = SessionLocal()
    try:
        row = db.get(Document, document_id)
        if not row or not row.file_path:
            logger.error("process_document: document %d not found in background task", document_id)
            return
        db.query(DocumentChunk).filter(DocumentChunk.document_id == row.id).delete()
        row.processing_status = "processing"
        db.commit()
        logger.info("process_document: started document_id=%d", document_id)
        try:
            blocks = parse_document(Path(row.file_path))
            chunks = split_into_chunks(blocks)
        except UnsupportedOCR:
            row.processing_status = "OCR_NOT_SUPPORTED_IN_MVP"
            db.commit()
            logger.warning("process_document: OCR not supported document_id=%d", document_id)
            return
        except Exception as exc:
            row.processing_status = "failed"
            db.commit()
            logger.exception("process_document: parse failed document_id=%d: %s", document_id, exc)
            return
        try:
            row.text_content = "\n\n".join(block.text for block in blocks)
            settings = get_settings()
            for index, chunk in enumerate(chunks):
                embedding = generate_embedding(chunk.text) if settings.embedding_enabled else None
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
            logger.info("process_document: completed document_id=%d chunks=%d", document_id, len(chunks))
        except Exception as exc:
            row.processing_status = "failed"
            db.commit()
            logger.exception("process_document: indexing failed document_id=%d: %s", document_id, exc)
            return
        audit(db, user_id, "process", "document", row.id, {"chunks": len(chunks)})
    finally:
        db.close()


@router.post("/documents/{document_id}/process")
def process_document(
    document_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.get(Document, document_id)
    if not row or not row.file_path:
        raise HTTPException(status_code=404, detail="Document not found")
    if row.processing_status in ("queued", "processing"):
        raise HTTPException(status_code=409, detail="Document is already being processed.")
    # Mark queued immediately so callers can poll the status
    row.processing_status = "queued"
    db.commit()
    background_tasks.add_task(_run_processing, document_id, user.id)
    logger.info("process_document: queued document_id=%d by user_id=%d", document_id, user.id)
    return {"status": "queued", "document_id": document_id}


@router.get("/documents/{document_id}/chunks")
def document_chunks(document_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index).all()


@router.get("/chunks/{chunk_id}")
def get_chunk(chunk_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    chunk = db.get(DocumentChunk, chunk_id)
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")
    doc = db.get(Document, chunk.document_id)
    return {
        "id": chunk.id,
        "document_id": chunk.document_id,
        "document_title": doc.title if doc else None,
        "document_type": doc.document_type if doc else None,
        "chunk_index": chunk.chunk_index,
        "section_title": chunk.section_title,
        "clause_reference": chunk.clause_reference,
        "page_number": chunk.page_number,
        "sheet_name": chunk.sheet_name,
        "text": chunk.text,
    }
