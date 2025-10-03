# Day 3 — Dev Environment Database & Qdrant Setup

Day 3의 목표는 로컬 개발 환경에서 PostgreSQL과 Qdrant 인스턴스를 기동해 백엔드/RAG 파이프라인이 동일한 스토리지에 접근할 수 있도록 만드는 것입니다. 아래 가이드는 Docker Compose 기반 배포, 애플리케이션 설정, 초기 점검, 데이터 시드까지의 과정을 다룹니다.

## 1. 사전 준비 사항
- Docker 24.x + Docker Compose v2
- Python 3.11 (백엔드 가상환경 생성 시 필요)
- `uv` CLI (https://github.com/astral-sh/uv)
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
    image: qdrant/qdrant:v1.8.2
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

3. **Alembic 마이그레이션 준비**
   - Alembic 초기화: `uv run alembic init migrations`
   - `env.py`에서 `app.db.session.Base.metadata`를 참조하도록 수정
   - 초기 마이그레이션: `uv run alembic revision --autogenerate -m "init"`
   - 적용: `uv run alembic upgrade head`

> Day 3 시점에서는 ORM 모델과 마이그레이션 뼈대만 준비하면 됩니다. 실제 워크플로우 테이블 데이터는 `POST /v1/ingest` 호출 시 자동으로 적재됩니다.

## 4. 애플리케이션 설정 반영
1. 루트 `.env` 값을 백엔드에서 읽을 수 있도록 `backend/.env` 심볼릭 링크 또는 환경 변수 export를 설정합니다.
2. `backend` 디렉터리에서 의존성 설치 후 로컬 서버를 기동합니다.
   ```bash
   cd backend
   uv venv .venv
   uv pip install -e .[dev]
   uv run uvicorn app.main:app --reload --port 8000
   ```
3. `POST /v1/ingest`를 호출하면 데이터가 PostgreSQL, Qdrant에 적재되며 로컬 테스트 UI(`fe-test`)에서도 동일한 리소스를 읽게 됩니다.

## 5. 기본 컬렉션 (Qdrant)
| Collection | 용도 | 벡터 차원 | 주요 메타데이터 |
|------------|------|-----------|-----------------|
| `style_guides` | 스타일 가이드 문장 | 1024 (bge-m3) | language, device, feature_norm, style_tag, tone |
| `approved_strings` | 승인된 UX 문구 | 1024 | request_id, draft_version_id, device, status |
| `glossary_terms` | 용어집 엔트리 | 1024 | term, translation, language_pair, device, must_use |
| `context_snippets` | 컨텍스트/대화 사례 | 1024 | context_id, product_area, locale, tags |

Day 3 구현에서는 기본적으로 결정적 스텁 임베딩을 사용하지만, `EMBEDDING_BACKEND=onnx`와 `EMBEDDING_ONNX_PATH=/path/to/model.onnx`를 지정하면 즉시 bge-m3 ONNX 추론 경로를 활성화할 수 있습니다. 모델과 `tokenizer.json` 파일은 동일 폴더에 존재해야 하며, ONNX 패키지(`onnxruntime`, `tokenizers`) 의존성은 `uv pip install -e .` 명령으로 설치됩니다.

```bash
# 예시: huggingface transformers에서 변환된 ONNX 모델 사용 시
export EMBEDDING_BACKEND=onnx
export EMBEDDING_ONNX_PATH="$HOME/models/bge-m3/bge-m3.onnx"
uv run python -c "from app.services.rag.embedding import get_embedding_client; print(len(get_embedding_client().embed(['test'])[0]))"
```

## 6. 종료 & 데이터 초기화
```bash
cd infra/dev
docker compose down
rm -rf dev-data/postgres/* dev-data/qdrant/*  # 전체 초기화 시
```

## 7. 트러블슈팅 메모
- Qdrant 연결 오류가 발생하면 `curl http://localhost:6333/collections`로 상태를 확인하세요.
- Windows 환경에서 Docker Desktop을 사용하는 경우 포트 충돌을 방지하기 위해 5432, 6333, 6334 포트를 여유 있게 확보합니다.
- PostgreSQL 연결 문자열에 `psycopg` 드라이버가 포함되어야 합니다 (`postgresql+psycopg://`).
- 로컬 테스트에서는 Qdrant API Key가 비어 있으면 됩니다. 매니지드 환경에서만 `QDRANT_API_KEY`를 채우세요.

---

DB/Qdrant가 기동된 이후에는 다음 트랙을 병렬로 진행할 수 있습니다.

- **Backend/API**: SQLAlchemy 세션을 FastAPI 의존성으로 연결하고 `/v1/ingest`가 Postgres/Qdrant에 데이터를 기록하도록 재구현했습니다. 이후 `/v1/requests`, `/v1/drafts` 등 워크플로우 API를 추가합니다.
- **RAG·데이터/ML**: `default_collections` 기준으로 컬렉션을 초기화하고, 향후 Day 5에 실제 bge-m3 임베딩 파이프라인을 교체하면 됩니다.
- **Frontend**: Next.js 기반 앱에서 요청 생성/검수 플로우 UI를 실제 API와 연동할 준비를 진행합니다.
- **Frontend**: Next.js 14 App Router 스캐폴드를 `frontend/` 디렉터리에 추가했습니다. `pnpm dev`로 실행하여 요청 리스트, 워크스페이스, Export 대시보드를 확인할 수 있습니다.

