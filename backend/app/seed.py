from pathlib import Path

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.session import Base, SessionLocal, engine
from app.models.domain import Contract, Document, DocumentChunk, Project, Site, User, Vendor
from app.services.embedding import generate_embedding
from app.services.parser import split_into_chunks, ParsedBlock


DEMO_DOCS = [
    (
        "RFP Requirements",
        "RFP",
        """1.1 P1 Response Time
The provider must provide P1 / Priority 1 critical incident response time within 15 minutes.

2.1 Future Expansion
The provider must reserve future expansion capacity including additional rack and additional power for the customer.""",
    ),
    (
        "Vendor Proposal",
        "PROPOSAL",
        """1.1 P1 Response Time
Vendor confirms comply. P1 critical incident response time is included and committed within 15 minutes.

3.1 Smart Hands
Smart Hands onsite support is included for rack and stack and device installation.""",
    ),
    (
        "Executed Contract",
        "CONTRACT",
        """1.1 Support Standard
Supplier will use commercially reasonable effort to respond to critical incidents.

4.2 Smart Hands
Smart Hands is available on business days from 09:00-18:00 only.

7.3 Price Adjustment
Supplier may apply annual increase equal to CPI + 5%.

9.1 General
No reserved capacity or expansion right is stated in this agreement.""",
    ),
    (
        "SLA Schedule",
        "SLA",
        """2.1 Cooling SLA
Temperature excursion beyond agreed environmental condition for 30 minutes triggers a service credit.

2.2 Availability
Monthly availability target is 99.99%.""",
    ),
    (
        "Rate Card",
        "RATE_CARD",
        """| Item | Unit Price |
| --- | --- |
| Remote Hands Standard | 100 USD/hour |
| Smart Hands Business Hours | 150 USD/hour |""",
    ),
    (
        "Invoice March",
        "INVOICE",
        """| Item | Quantity | Amount |
| --- | --- | --- |
| Emergency Remote Hands | 3 | 900 USD |""",
    ),
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == "admin@example.com").first():
            db.add(User(email="admin@example.com", password_hash=get_password_hash("admin123"), full_name="Demo Admin", role="admin"))
        if db.query(Vendor).count() == 0:
            vendors = [
                Vendor(name="Vendor Alpha Data Center", description="Demo colo provider", country="TH"),
                Vendor(name="Vendor Bangkok Colo", description="Bangkok colo provider", country="TH"),
                Vendor(name="Vendor Chonburi IX", description="Chonburi IX provider", country="TH"),
            ]
            db.add_all(vendors)
            db.flush()
            project = Project(name="Colo Contract Review MVP", description="Demo project")
            db.add(project)
            db.flush()
            sites = [
                Site(name="Bangkok Site A", location="Bangkok", vendor_id=vendors[0].id, project_id=project.id),
                Site(name="Bangkok Site B", location="Bangkok", vendor_id=vendors[1].id, project_id=project.id),
                Site(name="Chonburi Site C", location="Chonburi", vendor_id=vendors[2].id, project_id=project.id),
            ]
            db.add_all(sites)
            db.flush()
            contract = Contract(title="Vendor Alpha Colo MSA", vendor_id=vendors[0].id, project_id=project.id, site_id=sites[0].id, status="active")
            db.add(contract)
            db.flush()
            storage = Path("./storage")
            storage.mkdir(exist_ok=True)
            settings = get_settings()
            for title, doc_type, text in DEMO_DOCS:
                doc = Document(
                    title=title,
                    document_type=doc_type,
                    vendor_id=vendors[0].id,
                    project_id=project.id,
                    site_id=sites[0].id,
                    contract_id=contract.id,
                    original_filename=f"{title.lower().replace(' ', '_')}.txt",
                    file_path=str(storage / f"{title.lower().replace(' ', '_')}.txt"),
                    file_hash="seed",
                    mime_type="text/plain",
                    text_content=text,
                    processing_status="processed",
                )
                Path(doc.file_path).write_text(text, encoding="utf-8")
                db.add(doc)
                db.flush()
                for index, chunk in enumerate(split_into_chunks([ParsedBlock(text=text)])):
                    # Generate embedding if enabled
                    embedding = None
                    if settings.embedding_enabled:
                        embedding = generate_embedding(chunk.text)
                    db.add(DocumentChunk(
                        document_id=doc.id,
                        chunk_index=index,
                        text=chunk.text,
                        search_text=chunk.text.lower(),
                        section_title=chunk.section_title,
                        clause_reference=chunk.clause_reference,
                        embedding=embedding,
                    ))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
