# Colo Contract Execution Intelligence MVP

[Chinese README](README-CN.md)

## Runtime Environment

Docker Compose is the recommended runtime. The included containers use the following environment:

| Component | Runtime / image | Default port |
| --- | --- | --- |
| Backend | Python 3.12, FastAPI, Uvicorn | `8000` |
| Frontend | Node.js 22, Next.js 15, React 19 | `3000` |
| Primary database | PostgreSQL 16 | `5432` |
| Queue / cache | Redis 7 | `6379` |
| Optional object storage | MinIO | `9000` (API), `9001` (console) |

For local development without Docker, use Python 3.12 and Node.js 22. SQLite can replace PostgreSQL for backend smoke tests. Docker Engine with the Docker Compose plugin is required for the recommended setup. The default local embedding model is `Qwen/Qwen3-Embedding-0.6B`. You can also set `EMBEDDING_PROVIDER=openai` and use an OpenAI-compatible model such as `text-embedding-3-small` or `text-embedding-3-large`. Document chunks are vectorized during processing and stored with their embeddings for vector retrieval/RAG.

## Overview

Colo is an evidence-first, AI-assisted contract execution intelligence MVP designed for enterprise-network deployment. It connects vendors, projects, sites, contracts, and source documents; retrieves supporting contract evidence; detects gaps and risks; and prepares reviewable outputs for operators, legal teams, and executives.

AI-generated results are constrained to retrieved evidence. When evidence cannot be found, the system returns `evidence_not_found`. Risk issues and executive briefs remain drafts until a human reviews them.

## Current Capabilities

- JWT authentication and a seeded administrator account.
- Vendor, project, site, and contract records with contract-related documents, chunks, obligations, and risks.
- Document upload, processing, inspection, and deletion for text, DOCX, XLSX, and text-based PDF files.
- Chunk metadata such as page number, sheet name, section title, and clause reference.
- Vector-first RAG search over processed document chunks, using generated embeddings and persisted vectors.
- Topic evidence retrieval that embeds topic label/description/keywords as the semantic query scoped to a selected contract.
- Evidence-backed AI operations for document classification, sourced chat, obligation extraction, topic comparison, risk issue drafting, and CEO brief generation.
- Rule-based gap analysis for one topic or an entire contract.
- Risk review actions: confirm, reject, or request legal review.
- Dashboard summaries, vendor risk views, high-risk issue views, expiring-contract views, AI output logs, and audit logs.
- Docker Compose services for the frontend, backend, PostgreSQL, Redis, and MinIO.
- Demo data covering P1 response weakening, Smart Hands time limits, CPI plus 5% escalation, expansion-right gaps, SLA credits, and billing anomalies.

## Architecture

```text
Next.js frontend (3000)
        |
        v
FastAPI backend (8000) ---- OpenAI-compatible internal LLM gateway
        |
        +---- PostgreSQL 16 (primary persistence)
        +---- SQLite (optional local smoke-test persistence)
        +---- Redis 7
        +---- Local document storage / MinIO service
        +---- Embedding provider (local Qwen3 or OpenAI text-embedding-3)
```

The LLM gateway is configurable and no public commercial model endpoint is hard-coded. The model receives retrieved evidence chunks rather than complete contracts.

## Quick Start with Docker Compose

1. Create the runtime environment file:

   ```bash
   cp .env.example .env
   ```

2. Review `.env`, especially `SECRET_KEY` and the internal LLM gateway settings.

3. Build and start the stack:

   ```bash
   docker compose up --build
   ```

4. Open the services:

   - Frontend: <http://localhost:3000>
   - Backend: <http://localhost:8000>
   - Interactive API documentation: <http://localhost:8000/docs>
   - Health check: <http://localhost:8000/health>
   - MinIO console: <http://localhost:9001>

The backend container seeds demo data each time it starts.

### Demo Login

```text
Email: admin@example.com
Password: admin123
```

## Local Development

### Backend with SQLite

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
DATABASE_URL=sqlite:///./colo_mvp.db python -m app.seed
DATABASE_URL=sqlite:///./colo_mvp.db uvicorn app.main:app --reload --port 8000
```

Run backend tests from the `backend` directory:

```bash
python -m unittest discover -s tests -v
```

### Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Other frontend commands:

```bash
npm run build
npm run lint
```

## Configuration

The project reads backend settings from environment variables. Start with `.env.example`.

| Variable | Purpose | Default / example |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy database connection | `postgresql+psycopg://colo:colo@postgres:5432/colo` |
| `SECRET_KEY` | JWT signing secret | Change before deployment |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access-token lifetime | `720` |
| `STORAGE_DIR` | Uploaded-document storage directory | `/app/storage` |
| `BACKEND_CORS_ORIGINS` | Comma-separated allowed frontend origins | `http://localhost:3000` |
| `LLM_BASE_URL` | Internal OpenAI-compatible API base URL | `http://internal-llm.company.local/v1` |
| `LLM_API_KEY` | Internal LLM gateway credential | `changeme` |
| `LLM_SMALL_MODEL` | Model used for smaller AI tasks | `internal-9b` |
| `LLM_MEDIUM_MODEL` | Model used for larger AI tasks | `internal-14b` |
| `LLM_TIMEOUT_SECONDS` | LLM request timeout | `120` |
| `EMBEDDING_PROVIDER` | Embedding backend: `local` or `openai` | `local` |
| `EMBEDDING_MODEL` | Local sentence-transformers model/path or OpenAI-compatible embedding model | `Qwen/Qwen3-Embedding-0.6B` |
| `EMBEDDING_DIM` | Expected embedding dimension | `1024` |
| `EMBEDDING_ENABLED` | Enables local semantic scoring in hybrid search | `true` |
| `EMBEDDING_LOCAL_FILES_ONLY` | Prevents downloading embedding model files from remote hubs during document processing | `true` |

Embedding generation is local inference: document chunks and query text are not uploaded to Hugging Face for embedding. The Hugging Face URL you may see, such as `BAAI/bge-m3/resolve/main/adapter_config.json`, is a model-file lookup/download made by `sentence-transformers`, not a document upload. For firewalled deployments, pre-download or mount the embedding model locally, set `EMBEDDING_MODEL` to that local path or cache id, and keep `EMBEDDING_LOCAL_FILES_ONLY=true`. Set `EMBEDDING_LOCAL_FILES_ONLY=false` only in an environment where model downloads are allowed; set `EMBEDDING_ENABLED=false` when semantic scoring should be disabled.

## Main Workflows

### Process and Search Documents

1. Log in and create or select a contract.
2. Upload a supported document from the Documents page or `POST /documents/upload`.
3. Process it with `POST /documents/{document_id}/process` to parse, chunk, and embed its content.
4. Search processed chunks through Topic Search or the search API.
5. Delete a document with `DELETE /documents/{document_id}` when it and its related evidence should be removed.

### Run Gap Analysis

1. Open `POST /gap-analysis/run-topic` in the API documentation.
2. Submit a contract and topic:

   ```json
   {
     "contract_id": 1,
     "topic_key": "p1_response_time"
   }
   ```

3. Review the evidence-backed draft risk. With the seeded demo data, this request is expected to identify a high-risk `COMMITMENT_WEAKENED` issue using cited RFP, proposal, and contract chunks.
4. Confirm, reject, or request legal review for the draft issue.

Use `POST /gap-analysis/run-contract` to evaluate every configured topic for a contract.

## Frontend Areas

The current frontend includes Dashboard, Vendors, Projects, Sites, Contracts, Documents, Topic Search, Gap Analysis, Risk Issues, CEO Briefs, AI Chat, AI Output Logs, Audit Logs, and Admin Settings.

## Supported Documents and MVP Boundaries

- Supported parsers: plain text, DOCX, XLSX, and text-based PDF.
- OCR and scanned PDFs are not supported. A PDF with too little extractable text returns `OCR_NOT_SUPPORTED_IN_MVP`.
- Topic Search is vector-first: configured topic text and custom queries are embedded, then matched against persisted chunk vectors for RAG evidence retrieval.
- Embeddings are stored as JSON-compatible arrays for SQLite compatibility; this MVP does not use a dedicated vector database.
- The rule engine and AI create draft findings, not final legal conclusions.
- All high-risk findings and briefs require human review before action.
- The included credentials and service settings are for local demonstration only and must be changed before deployment.

## Windows Notes

Use PowerShell to create and activate the backend environment:

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Start the frontend in a second PowerShell window:

```powershell
cd frontend
npm install
npm run dev
```

Keep `.env` encoded as UTF-8. If Git line-ending conversion causes script or Python issues, configure the repository to preserve LF endings:

```bash
git config core.autocrlf false
```
