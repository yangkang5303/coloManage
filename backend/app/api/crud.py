from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
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
def list_vendors(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Vendor).order_by(Vendor.id).all()


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


@router.get("/projects", response_model=list[ProjectRead])
def list_projects(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Project).order_by(Project.id).all()


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


@router.get("/sites", response_model=list[SiteRead])
def list_sites(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Site).order_by(Site.id).all()


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


@router.get("/contracts", response_model=list[ContractRead])
def list_contracts(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Contract).order_by(Contract.id).all()


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
