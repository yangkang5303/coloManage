import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.documents import delete_document
from app.db.session import Base
from app.models.domain import Contract, Document, DocumentChunk, Obligation, TopicEvidence, User
from app.services.retrieval import get_keyword_evidence_pack, search_chunks


class SearchAndDocumentTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.user = User(email="test@example.com", password_hash="x", full_name="Test", role="admin")
        self.contract = Contract(title="Test contract", status="draft")
        self.db.add_all([self.user, self.contract])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_custom_keyword_search_combines_keyword_and_cosine_scores(self):
        document = Document(title="SLA", document_type="SLA", contract_id=self.contract.id)
        self.db.add(document)
        self.db.commit()
        exact = DocumentChunk(
            document_id=document.id,
            chunk_index=0,
            text="SLA response must be 15 minutes",
            search_text="",
            embedding=[0.8, 0.2],
        )
        semantic = DocumentChunk(
            document_id=document.id,
            chunk_index=1,
            text="Urgent incident handling",
            search_text="",
            embedding=[1.0, 0.0],
        )
        unrelated = DocumentChunk(
            document_id=document.id,
            chunk_index=2,
            text="Office address",
            search_text="",
            embedding=[0.0, 1.0],
        )
        self.db.add_all([exact, semantic, unrelated])
        self.db.commit()

        with patch("app.services.retrieval.get_settings", return_value=SimpleNamespace(embedding_enabled=True)), patch(
            "app.services.retrieval.generate_embedding", return_value=[1.0, 0.0]
        ):
            results = search_chunks(self.db, "SLA response", contract_id=self.contract.id, limit=10)
            pack = get_keyword_evidence_pack(self.db, "SLA response", self.contract.id)

        self.assertEqual(results[0]["chunk_id"], exact.id)
        self.assertNotIn(unrelated.id, [item["chunk_id"] for item in results])
        self.assertTrue(all("keyword_score" in item and "cosine_score" in item and "combined_score" in item for item in results))
        self.assertEqual(pack["sla_evidence"][0]["chunk_id"], exact.id)

    def test_delete_document_removes_file_chunks_and_topic_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "document.txt"
            path.write_text("SLA response")
            document = Document(
                title="SLA",
                document_type="SLA",
                contract_id=self.contract.id,
                file_path=str(path),
                processing_status="processed",
            )
            self.db.add(document)
            self.db.commit()
            chunk = DocumentChunk(document_id=document.id, chunk_index=0, text="SLA response", search_text="")
            self.db.add(chunk)
            self.db.commit()
            obligation = Obligation(
                contract_id=self.contract.id,
                description="Respond quickly",
                source_document_id=document.id,
                source_chunk_id=chunk.id,
                confidence_score=1,
                human_review_status="pending",
            )
            evidence = TopicEvidence(
                topic_key="sla",
                contract_id=self.contract.id,
                document_id=document.id,
                chunk_id=chunk.id,
                evidence_text="SLA response",
                document_role="SLA",
                score=1,
            )
            self.db.add_all([obligation, evidence])
            self.db.commit()

            response = delete_document(document.id, self.db, self.user)

            self.assertEqual(response, {"status": "deleted", "document_id": document.id, "file_deleted": True})
            self.assertIsNone(self.db.get(Document, document.id))
            self.assertEqual(self.db.query(TopicEvidence).count(), 0)
            self.db.refresh(obligation)
            self.assertIsNone(obligation.source_document_id)
            self.assertIsNone(obligation.source_chunk_id)
            self.assertFalse(path.exists())


if __name__ == "__main__":
    unittest.main()
