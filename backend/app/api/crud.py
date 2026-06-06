from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.domain import Contract, Document, DocumentChunk, Obligation, Project, RiskIssue, Site, User, Vendor
from app.schemas.domain import ContractCreate, ContractRead, ProjectCreate, ProjectRead, SiteCreate, SiteRead, VendorCreate, VendorRead
from app.services.audit import audit


router = APIRouter(tags=["CRUD"])


def get_or_404(db: Session, model, item_id: int):
    item = db.get(model, item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return item


@router.get("/vendors", response_model=list[VendorRead])
def list_vendors(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(Vendor).order_by(Vendor.id).offset(skip).limit(limit).all()


@router.post("/vendors", response_model=VendorRead)
def create_vendor(payload: VendorCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = Vendor(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    audit(db, user.id, "create", "vendor", row.id, payload.model_dump())
    return row


@router.get("/vendors/{item_id}", response_model=VendorRead)
def get_vendor(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_or_404(db, Vendor, item_id)


@router.put("/vendors/{item_id}", response_model=VendorRead)
def update_vendor(item_id: int, payload: VendorCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = get_or_404(db, Vendor, item_id)
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    audit(db, user.id, "update", "vendor", row.id, payload.model_dump())
    return row


@router.delete("/vendors/{item_id}")
def delete_vendor(item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = get_or_404(db, Vendor, item_id)
    db.delete(row)
    db.commit()
    audit(db, user.id, "delete", "vendor", item_id, {})
    return {"status": "deleted"}


@router.get("/projects", response_model=list[ProjectRead])
def list_projects(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(Project).order_by(Project.id).offset(skip).limit(limit).all()


@router.post("/projects", response_model=ProjectRead)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = Project(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    audit(db, user.id, "create", "project", row.id, payload.model_dump())
    return row


@router.get("/projects/{item_id}", response_model=ProjectRead)
def get_project(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_or_404(db, Project, item_id)


@router.put("/projects/{item_id}", response_model=ProjectRead)
def update_project(item_id: int, payload: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = get_or_404(db, Project, item_id)
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    audit(db, user.id, "update", "project", row.id, payload.model_dump())
    return row


@router.delete("/projects/{item_id}")
def delete_project(item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = get_or_404(db, Project, item_id)
    db.delete(row)
    db.commit()
    audit(db, user.id, "delete", "project", item_id, {})
    return {"status": "deleted"}


@router.get("/sites", response_model=list[SiteRead])
def list_sites(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(Site).order_by(Site.id).offset(skip).limit(limit).all()


@router.post("/sites", response_model=SiteRead)
def create_site(payload: SiteCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = Site(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    audit(db, user.id, "create", "site", row.id, payload.model_dump())
    return row


@router.get("/sites/{item_id}", response_model=SiteRead)
def get_site(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_or_404(db, Site, item_id)


@router.put("/sites/{item_id}", response_model=SiteRead)
def update_site(item_id: int, payload: SiteCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = get_or_404(db, Site, item_id)
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    audit(db, user.id, "update", "site", row.id, payload.model_dump())
    return row


@router.delete("/sites/{item_id}")
def delete_site(item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = get_or_404(db, Site, item_id)
    db.delete(row)
    db.commit()
    audit(db, user.id, "delete", "site", item_id, {})
    return {"status": "deleted"}


@router.get("/contracts", response_model=list[ContractRead])
def list_contracts(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(Contract).order_by(Contract.id).offset(skip).limit(limit).all()


@router.post("/contracts", response_model=ContractRead)
def create_contract(payload: ContractCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = Contract(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    audit(db, user.id, "create", "contract", row.id, payload.model_dump(mode="json"))
    return row


@router.get("/contracts/{item_id}", response_model=ContractRead)
def get_contract(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_or_404(db, Contract, item_id)


@router.put("/contracts/{item_id}", response_model=ContractRead)
def update_contract(item_id: int, payload: ContractCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = get_or_404(db, Contract, item_id)
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    audit(db, user.id, "update", "contract", row.id, payload.model_dump(mode="json"))
    return row


@router.delete("/contracts/{item_id}")
def delete_contract(item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = get_or_404(db, Contract, item_id)
    db.delete(row)
    db.commit()
    audit(db, user.id, "delete", "contract", item_id, {})
    return {"status": "deleted"}


@router.get("/contracts/{item_id}/documents")
def contract_documents(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Document).filter(Document.contract_id == item_id).order_by(Document.id).all()


@router.get("/contracts/{item_id}/chunks")
def contract_chunks(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(DocumentChunk).join(Document).filter(Document.contract_id == item_id).order_by(DocumentChunk.id).all()


@router.get("/contracts/{item_id}/obligations")
def contract_obligations(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Obligation).filter(Obligation.contract_id == item_id).order_by(Obligation.id).all()


@router.get("/contracts/{item_id}/risk-issues")
def contract_risks(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(RiskIssue).filter(RiskIssue.contract_id == item_id).order_by(RiskIssue.id).all()


@router.get("/admin/settings")
def admin_settings(_: User = Depends(get_current_user)):
    s = get_settings()
    return {
        "llm": {
            "base_url": s.llm_base_url,
            "api_key_set": bool(s.llm_api_key and s.llm_api_key != "changeme"),
            "small_model": s.llm_small_model,
            "medium_model": s.llm_medium_model,
            "timeout_seconds": s.llm_timeout_seconds,
        },
        "database": {
            "url": s.database_url,
        },
        "storage": {
            "dir": s.storage_dir,
        },
        "cors": {
            "origins": s.cors_origins,
        },
        "embedding": {
            "model": s.embedding_model,
            "dim": s.embedding_dim,
            "enabled": s.embedding_enabled,
        },
        "search": {
            "candidate_limit": s.search_candidate_limit,
        },
        "auth": {
            "access_token_expire_minutes": s.access_token_expire_minutes,
        },
    }
