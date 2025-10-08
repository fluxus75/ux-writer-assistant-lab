# Day 6 — Production-Ready Dev Environment Setup

Day 6의 목표는 완전한 워크플로우 시스템을 위한 로컬 개발 환경을 구축하는 것입니다. PostgreSQL과 Qdrant 인스턴스를 기동하고, 전체 워크플로우 API (requests, drafts, approvals, comments)와 하이브리드 RAG 시스템을 테스트할 수 있는 환경을 제공합니다.

## 1. 사전 준비 사항
- Docker 24.x + Docker Compose v2
- Python 3.11 (백엔드 가상환경 생성 시 필요)
- `uv` CLI (https://github.com/astral-sh/uv)
- `jq` (JSON 처리용, 스모크 테스트 스크립트에서 필요)
  - Windows: `winget install jqlang.jq`
  - macOS: `brew install jq`
  - Linux: `sudo apt install jq` 또는 `sudo yum install jq`
- 레포지토리 루트에 `.env` 파일. 예시는 다음과 같습니다.

```dotenv
# Database
DATABASE_URL=postgresql+psycopg://ux_writer:ux_writer@localhost:5432/ux_writer

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=  # self-host 기본값은 빈 문자열

# Embedding / RAG
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_PRECISION=fp16
EMBEDDING_BACKEND=stub  # "onnx"로 변경하면 로컬 ONNX 추론을 사용
EMBEDDING_ONNX_PATH=     # onnx 모드 시 모델 경로 (.onnx)
EMBEDDING_MAX_BATCH=16

# LLM (Stub 또는 실 API 사용 시 설정)
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=
```

> **참고**: 로컬 검증 시에는 Qdrant API Key가 필요하지 않지만, 매니지드 클러스터를 사용할 경우 발급된 키를 설정하세요.

## 2. Docker Compose 예시 (`infra/dev/docker-compose.yml` 권장)
```yaml
version: "3.9"
services:
  postgres:
    image: postgres:15
    restart: unless-stopped
    environment:
      POSTGRES_USER: ux_writer
      POSTGRES_PASSWORD: ux_writer
      POSTGRES_DB: ux_writer
    ports:
      - "5432:5432"
    volumes:
      - ./dev-data/postgres:/var/lib/postgresql/data

  qdrant:
    image: qdrant/qdrant:v1.15.1
    restart: unless-stopped
    environment:
      QDRANT__STORAGE__CACHE_SIZE: 1024
    ports:
      - "6333:6333"  # REST
      - "6334:6334"  # gRPC
    volumes:
      - ./dev-data/qdrant:/qdrant/storage

networks:
  default:
    name: ux-writer-dev-net
```

### 2.1. 디렉터리 준비
```bash
mkdir -p infra/dev
mkdir -p infra/dev/dev-data/postgres infra/dev/dev-data/qdrant
```

## 3. 기동 및 초기화 절차
```bash
cd infra/dev
docker compose up -d
```

컨테이너가 올라오면 다음 명령으로 정상 동작 여부를 확인합니다.

1. **PostgreSQL 연결 테스트**
   ```bash
   cd backend
   uv run python -c "from app.db.session import get_engine; print(get_engine().connect())"
   ```

2. **Qdrant 컬렉션 목록 조회**
   ```bash
   cd backend
   uv run python -c "from app.services.rag.config import vector_store_config; print(vector_store_config.create_client().get_collections())"
   ```

3. **Alembic 마이그레이션 적용**
   ```bash
   cd backend
   uv run alembic upgrade head
   ```
   
   > Day 6에서는 완전한 워크플로우 테이블 스키마(User, Request, Draft, Approval, Comment, AuditLog 등)가 포함된 마이그레이션이 이미 준비되어 있습니다.

## 4. 애플리케이션 설정 반영
1. 루트 `.env` 값을 백엔드에서 읽을 수 있도록 `backend/.env` 심볼릭 링크 또는 환경 변수 export를 설정합니다.
2. `backend` 디렉터리에서 의존성 설치 후 로컬 서버를 기동합니다.
   ```bash
   cd backend
   uv venv .venv
   uv pip install -e .[dev]
   uv run uvicorn app.main:app --reload --port 8000
   ```
3. `POST /v1/ingest`를 호출하면 데이터가 PostgreSQL, Qdrant에 적재되며 워크플로우 API와 RAG 시스템이 활성화됩니다.

## 4.1. Day 6 API 엔드포인트 테스트
서버가 기동된 후 다음 엔드포인트들을 테스트할 수 있습니다:

**워크플로우 API:**
- `POST /v1/requests` — UX 카피 요청 생성 (RBAC 헤더 필요)
- `GET /v1/requests` — 요청 목록 조회
- `POST /v1/drafts` — AI 드래프트 생성 및 버전 관리
- `POST /v1/approvals` — 승인/거부 결정 기록
- `POST /v1/comments` — 협업 코멘트 및 해결 처리

**스모크 테스트 실행:**
```bash
# 전체 워크플로우 테스트 (LLM API Key 필요)
export LLM_API_KEY=your_openai_key
export WORKFLOW_SMOKE=1
export DESIGNER_ID=designer-1
export WRITER_ID=writer-1
export ADMIN_ID=admin-1
scripts/dev/run_day3_smoke.sh
```

> **참고**: 스모크 테스트 스크립트는 `jq`를 사용하여 JSON 응답을 처리합니다. 설치 후 새 터미널 세션을 시작해야 환경 변수가 적용됩니다.

## 5. 기본 컬렉션 (Qdrant)
| Collection | 용도 | 벡터 차원 | 주요 메타데이터 |
|------------|------|-----------|-----------------|
| `style_guides` | 스타일 가이드 문장 | 1024 (bge-m3) | language, device, feature_norm, style_tag, tone |
| `approved_strings` | 승인된 UX 문구 | 1024 | request_id, draft_version_id, device, status |
| `glossary_terms` | 용어집 엔트리 | 1024 | term, translation, language_pair, device, must_use |
| `context_snippets` | 컨텍스트/대화 사례 | 1024 | context_id, product_area, locale, tags |

Day 6에서는 하이브리드 검색 시스템이 완전히 구현되어 있으며, MMR(Maximal Marginal Relevance) 기반 diversity filtering과 스타일 기반 reranking을 지원합니다. `EMBEDDING_BACKEND=onnx`와 `EMBEDDING_ONNX_PATH=/path/to/model.onnx`를 지정하면 bge-m3 ONNX 추론을 활성화할 수 있습니다. 자세한 내용은 `docs/models/bge-m3-onnx-export.md`를 참조하세요.

```bash
# 예시: huggingface transformers에서 변환된 ONNX 모델 사용 시
export EMBEDDING_BACKEND=onnx
export EMBEDDING_ONNX_PATH="$HOME/models/bge-m3/bge-m3.onnx"
uv run python -c "from app.services.rag.embedding import get_embedding_client; print(len(get_embedding_client().embed(['test'])[0]))"
```

## 6. 프론트엔드 연동 (Day 6)
Next.js 워크스페이스 쉘을 함께 실행하여 전체 시스템을 테스트할 수 있습니다:

```bash
# 프론트엔드 실행
cd frontend
pnpm install
pnpm dev  # http://localhost:3000

# 환경 변수 설정 (.env.local)
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_API_ROLE=designer
NEXT_PUBLIC_API_USER_ID=designer-1
```

## 7. 종료 & 데이터 초기화
```bash
cd infra/dev
docker compose down
rm -rf dev-data/postgres/* dev-data/qdrant/*  # 전체 초기화 시
```

## 8. 트러블슈팅 메모
- Qdrant 연결 오류가 발생하면 `curl http://localhost:6333/collections`로 상태를 확인하세요.
- Windows 환경에서 Docker Desktop을 사용하는 경우 포트 충돌을 방지하기 위해 5432, 6333, 6334 포트를 여유 있게 확보합니다.
- PostgreSQL 연결 문자열에 `psycopg` 드라이버가 포함되어야 합니다 (`postgresql+psycopg://`).
- 로컬 테스트에서는 Qdrant API Key가 비어 있으면 됩니다. 매니지드 환경에서만 `QDRANT_API_KEY`를 채우세요.
- 스모크 테스트에서 "jq: command not found" 오류 시:
  - `jq` 설치 후 새 터미널 세션을 시작하세요
  - Windows: 설치 후 PowerShell/명령 프롬프트를 재시작
  - Git Bash 사용 시: `winget install jqlang.jq` 후 Git Bash 재시작

---

## Day 6 완성된 기능들

- **완전한 워크플로우 API**: 요청 생성부터 승인까지의 전체 플로우가 구현되어 있습니다
- **하이브리드 RAG 시스템**: MMR 기반 diversity filtering과 스타일 기반 reranking 지원
- **고급 Guardrails**: 데이터베이스 기반 rule 로딩과 YAML/DB 병합 지원  
- **Audit 로깅**: 모든 워크플로우 액션에 대한 감사 추적
- **Next.js 워크스페이스**: 실시간 데이터를 활용한 프로덕션급 UI
- **E2E 테스트**: 자동화된 스모크 테스트와 샘플 페이로드 제공

추가 문서:
- `docs/testing/frontend-e2e-guide.md` — 프론트엔드 E2E 테스트 가이드
- `docs/models/bge-m3-onnx-export.md` — ONNX 모델 export 파이프라인  
- `scripts/dev/run_day3_smoke.sh` — 전체 워크플로우 자동 테스트

