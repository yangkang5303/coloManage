# Colo 合同执行智能中台 MVP

[English README](README.md)

## 运行环境

推荐使用 Docker Compose 运行项目。仓库内置容器使用以下环境：

| 组件 | 运行时 / 镜像 | 默认端口 |
| --- | --- | --- |
| 后端 | Python 3.12、FastAPI、Uvicorn | `8000` |
| 前端 | Node.js 22、Next.js 15、React 19 | `3000` |
| 主数据库 | PostgreSQL 16 | `5432` |
| 队列 / 缓存 | Redis 7 | `6379` |
| 可选对象存储 | MinIO | `9000`（API）、`9001`（控制台） |

不使用 Docker 进行本地开发时，建议安装 Python 3.12 和 Node.js 22；后端冒烟测试可使用 SQLite 替代 PostgreSQL。推荐启动方式需要 Docker Engine 和 Docker Compose 插件。默认嵌入模型 `BAAI/bge-m3` 由 `sentence-transformers` 在本地执行嵌入推理。上传的文档文本会在后端进程内本地生成嵌入，不会发送到 Hugging Face 或云端 embedding API。防火墙环境应先离线下载或挂载模型，再处理文档。

## 项目简介

Colo 是面向企业内网部署的、证据优先的 AI 辅助合同执行智能中台 MVP。系统关联供应商、项目、站点、合同和源文档，检索合同证据，识别执行差距与风险，并为业务人员、法务和管理层生成可复核的结果。

所有 AI 输出都必须基于检索到的证据；找不到证据时返回 `evidence_not_found`。风险问题和管理层简报在人工复核前始终是草稿。

## 当前功能

- JWT 登录认证和预置管理员账号。
- 供应商、项目、站点、合同管理，以及合同关联的文档、文本块、义务和风险查看。
- 支持纯文本、DOCX、XLSX 和文本型 PDF 的上传、处理、查看与删除。
- 文本块保留页码、工作表名称、章节标题和条款编号等元数据。
- 将关键词匹配与本地计算的多语言嵌入相似度结合的混合搜索。
- 按指定合同范围执行主题词典证据检索。
- 基于证据的文档分类、带来源问答、义务抽取、主题证据对比、风险草稿和 CEO 简报生成。
- 支持单个主题或整份合同的规则化差距分析。
- 支持确认风险、驳回风险和请求法务复核。
- 提供仪表盘摘要、供应商风险、高风险问题、即将到期合同、AI 输出日志和审计日志。
- 使用 Docker Compose 编排前端、后端、PostgreSQL、Redis 和 MinIO。
- 预置 P1 响应承诺弱化、Smart Hands 时间限制、CPI 加 5% 涨价、扩容权缺失、SLA 抵扣和账单异常等演示数据。

## 系统架构

```text
Next.js 前端（3000）
        |
        v
FastAPI 后端（8000） ---- 企业内部 OpenAI 兼容 LLM 网关
        |
        +---- PostgreSQL 16（主要持久化）
        +---- SQLite（可选本地冒烟测试）
        +---- Redis 7
        +---- 本地文档存储 / MinIO 服务
        +---- 本地 sentence-transformers 多语言嵌入
```

LLM 网关可通过环境变量配置，项目没有硬编码任何公共商业模型接口。模型只接收检索出的证据文本块，不接收完整合同。

## 使用 Docker Compose 快速启动

1. 创建运行环境文件：

   ```bash
   cp .env.example .env
   ```

2. 检查 `.env`，尤其是 `SECRET_KEY` 和内部 LLM 网关配置。

3. 构建并启动全部服务：

   ```bash
   docker compose up --build
   ```

4. 访问服务：

   - 前端：<http://localhost:3000>
   - 后端：<http://localhost:8000>
   - 交互式 API 文档：<http://localhost:8000/docs>
   - 健康检查：<http://localhost:8000/health>
   - MinIO 控制台：<http://localhost:9001>

后端容器每次启动时都会写入演示数据。

### 演示账号

```text
邮箱：admin@example.com
密码：admin123
```

## 本地开发

### 使用 SQLite 启动后端

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
DATABASE_URL=sqlite:///./colo_mvp.db python -m app.seed
DATABASE_URL=sqlite:///./colo_mvp.db uvicorn app.main:app --reload --port 8000
```

在 `backend` 目录运行后端测试：

```bash
python -m unittest discover -s tests -v
```

### 启动前端

在另一个终端中执行：

```bash
cd frontend
npm install
npm run dev
```

其他前端命令：

```bash
npm run build
npm run lint
```

## 配置说明

后端通过环境变量读取配置，可从 `.env.example` 开始设置。

| 变量 | 用途 | 默认值 / 示例 |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy 数据库连接 | `postgresql+psycopg://colo:colo@postgres:5432/colo` |
| `SECRET_KEY` | JWT 签名密钥 | 部署前必须修改 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 访问令牌有效期 | `720` |
| `STORAGE_DIR` | 上传文档保存目录 | `/app/storage` |
| `BACKEND_CORS_ORIGINS` | 允许访问后端的前端来源，逗号分隔 | `http://localhost:3000` |
| `LLM_BASE_URL` | 企业内部 OpenAI 兼容 API 地址 | `http://internal-llm.company.local/v1` |
| `LLM_API_KEY` | 内部 LLM 网关凭据 | `changeme` |
| `LLM_SMALL_MODEL` | 小型 AI 任务所用模型 | `internal-9b` |
| `LLM_MEDIUM_MODEL` | 较大型 AI 任务所用模型 | `internal-14b` |
| `LLM_TIMEOUT_SECONDS` | LLM 请求超时时间 | `120` |
| `EMBEDDING_MODEL` | sentence-transformers 模型 ID、本地路径或缓存模型 ID | `BAAI/bge-m3` |
| `EMBEDDING_DIM` | 预期嵌入维度 | `1024` |
| `EMBEDDING_ENABLED` | 是否在混合搜索中启用本地语义评分 | `true` |
| `EMBEDDING_LOCAL_FILES_ONLY` | 是否禁止文档处理期间从远程 Hub 下载嵌入模型文件 | `true` |

嵌入生成是本地推理：文档块和查询文本不会上传到 Hugging Face 进行 embedding。你看到的 Hugging Face URL（例如 `BAAI/bge-m3/resolve/main/adapter_config.json`）是 `sentence-transformers` 在查找/下载模型文件，不是上传文档。若部署在防火墙或无公网环境，请先离线下载或挂载嵌入模型，将 `EMBEDDING_MODEL` 指向本地路径或本地缓存 ID，并保持 `EMBEDDING_LOCAL_FILES_ONLY=true`。仅在允许联网下载模型的环境中，才设置 `EMBEDDING_LOCAL_FILES_ONLY=false`；仅当需要关闭语义评分时，才设置 `EMBEDDING_ENABLED=false`。

## 主要使用流程

### 处理和搜索文档

1. 登录并创建或选择合同。
2. 在文档页面或通过 `POST /documents/upload` 上传支持的文档。
3. 调用 `POST /documents/{document_id}/process` 解析、切分并生成文档嵌入。
4. 通过主题搜索页面或搜索 API 检索处理后的文本块。
5. 需要移除文档及其关联证据时，调用 `DELETE /documents/{document_id}`。

### 执行差距分析

1. 在 API 文档中打开 `POST /gap-analysis/run-topic`。
2. 提交合同和主题：

   ```json
   {
     "contract_id": 1,
     "topic_key": "p1_response_time"
   }
   ```

3. 检查基于证据生成的风险草稿。使用预置演示数据时，该请求应引用 RFP、Proposal 和 Contract 文本块，识别出高风险 `COMMITMENT_WEAKENED` 问题。
4. 确认、驳回该风险，或请求法务复核。

使用 `POST /gap-analysis/run-contract` 可分析合同的全部已配置主题。

## 前端页面

当前前端包括仪表盘、供应商、项目、站点、合同、文档、主题搜索、差距分析、风险问题、CEO 简报、AI 问答、AI 输出日志、审计日志和管理设置。

## 支持的文档与 MVP 边界

- 支持纯文本、DOCX、XLSX 和文本型 PDF 解析。
- 不支持 OCR 和扫描型 PDF。PDF 可提取文字过少时会返回 `OCR_NOT_SUPPORTED_IN_MVP`。
- 主题词典使用配置的关键词；启用嵌入后，自定义混合搜索会使用本地计算的嵌入叠加多语言语义匹配。
- 为兼容 SQLite，嵌入以 JSON 兼容数组保存；当前 MVP 不使用专用向量数据库。
- 规则引擎和 AI 只生成风险草稿，不构成最终法律结论。
- 所有高风险结果和简报都必须经过人工复核后才能采取行动。
- 仓库内置账号和服务配置仅用于本地演示，部署前必须修改。

## Windows 说明

使用 PowerShell 创建并激活后端环境：

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

在另一个 PowerShell 窗口启动前端：

```powershell
cd frontend
npm install
npm run dev
```

请确保 `.env` 使用 UTF-8 编码。如果 Git 自动转换行尾导致脚本或 Python 代码异常，可让当前仓库保留 LF 行尾：

```bash
git config core.autocrlf false
```
