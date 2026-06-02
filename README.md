# Colo Contract Execution Intelligence MVP

Colo 合同执行智能中台 MVP，用于企业内网部署的 AI-assisted contract review。系统坚持 evidence first：所有 AI 输出必须基于检索证据，找不到证据时返回 `evidence_not_found`，高风险输出必须人工复核。

## What Is Included

- FastAPI backend with JWT auth, CRUD APIs, document upload, parsing, chunking, topic retrieval, no-vector evidence packs, rule engine, gap analysis, risk issues, CEO brief drafts, AI output logs, and audit logs.
- PostgreSQL-first persistence with SQLite fallback for local smoke tests.
- OpenAI-compatible internal LLM gateway. No public model endpoint is hard-coded.
- Next.js frontend scaffold with pages for dashboard, entities, documents, topic search, gap analysis, risk issues, CEO briefs, logs, and settings.
- Docker Compose for backend, frontend, postgres, redis, and optional MinIO.
- Demo seed data covering P1 response weakening, Smart Hands time limits, CPI + 5% escalation, expansion right gap, SLA credit, and billing anomaly examples.

## Quick Start

```bash
cp .env.example .env
docker compose up --build
```

Backend: `http://localhost:8000`

Frontend: `http://localhost:3000`

API docs: `http://localhost:8000/docs`

Demo login:

```text
email: admin@example.com
password: admin123
```

## Local Backend Smoke Test Without Docker

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
DATABASE_URL=sqlite:///./colo_mvp.db python -m app.seed
DATABASE_URL=sqlite:///./colo_mvp.db uvicorn app.main:app --reload
```

## Environment

`LLM_BASE_URL` must point to an enterprise internal OpenAI-compatible API. Public commercial AI APIs are intentionally not configured.

```text
LLM_BASE_URL=http://internal-llm.company.local/v1
LLM_API_KEY=changeme
LLM_SMALL_MODEL=internal-9b
LLM_MEDIUM_MODEL=internal-14b
LLM_TIMEOUT_SECONDS=120
```

## Verification Flow

1. Start the stack.
2. Login as `admin@example.com`.
3. Open `POST /gap-analysis/run-topic` in API docs.
4. Submit:

```json
{
  "contract_id": 1,
  "topic_key": "p1_response_time"
}
```

Expected result: a HIGH risk draft for `COMMITMENT_WEAKENED` with cited RFP, Proposal, and Contract chunks.

## MVP Boundaries

- OCR and scanned PDFs are not supported. If PDF text extraction is too short, processing returns `OCR_NOT_SUPPORTED_IN_MVP`.
- The model receives only retrieved evidence chunks, never full contracts.
- The rule engine creates draft issues; it does not make final legal conclusions.
- Every risk and brief is designed for human review before action.

## Windows Setup Notes

### Python Virtual Environment

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows 激活命令（不同于 macOS 的 source .venv/bin/activate）
pip install -r requirements.txt
```

### Node.js / npm

- 确保 Node.js ≥ 18
- 首次 `npm install` 可能需要安装 **Visual Studio Build Tools**（编译原生模块）
- 如果遇到 `node-gyp` 报错：`npm install --global windows-build-tools`

### .env File Encoding

- 确保 `.env` 文件编码为 **UTF-8**（避免中文注释乱码）
- VS Code 右下角可确认/切换编码

### Git Line Endings

Windows Git 默认将 LF 转为 CRLF，可能导致 Python 缩进错误：

```bash
git config core.autocrlf false
```

### Port Conflicts

- 前端默认 `3000`，后端默认 `8000`
- 检查端口占用：`netstat -ano | findstr :3000`

### Firewall

- Windows Defender 防火墙可能阻止本地端口
- 确保允许 Node.js 和 Python 通过，或临时关闭防火墙测试

### Full Startup Steps (Windows)

```powershell
# 1. Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev

# 3. Visit http://localhost:3000
```

### Bilingual Documents (Chinese + English)

- Parser handles both languages transparently
- Topic dictionary currently uses English keywords only — Chinese content won't match topic search
- Direct keyword search (Topic Search page) works for both languages
- For best results: configure LLM to enable semantic understanding of mixed-language queries
