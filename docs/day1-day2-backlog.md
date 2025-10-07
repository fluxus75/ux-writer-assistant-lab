# Day 1–2 Delivery Notes

이 문서는 Day 1과 Day 2 동안 도출된 분석/설계 결과를 코드베이스에 반영하면서 정리한 메모다. 백엔드/프런트엔드/데이터 파이프라인/QA 인프라 각각의 상태와 다음 작업을 추적한다.

## Backend / API
- `app/db/models.py`에 요청(Request) → 초안(Draft) → 버전(DraftVersion) → 승인(Approval) 플로우와 Guardrail/Export/Audit 테이블을 SQLAlchemy ORM으로 정의했다.
- `app/db/session.py`를 통해 데이터베이스 연결과 세션 스코프를 구성했다. 기본값은 로컬 SQLite지만 `DATABASE_URL` 환경변수로 PostgreSQL 등으로 전환할 수 있다.
- `app/core/settings.py`에 DB, Qdrant, 임베딩 모델 설정 필드를 추가하여 환경 기반 구성이 가능하도록 했다.
- 향후 작업: Alembic 마이그레이션 생성, 서비스 계층에서 ORM 모델을 활용하도록 Repository 패턴을 도입, FastAPI 의존성에 `get_db_session` 주입.

## Frontend
- Day 1에 정리한 IA를 기반으로 디자인 시스템 토큰 및 컴포넌트 구성을 `fe-test/DESIGN_TOKENS.md`에 초안으로 기록한다.
- Day 3 이후 Next.js 본 서비스로 마이그레이션할 계획이며, 현재 Vite 기반 테스트 UI는 API 계약 검증 용도로 유지한다.

## RAG / 데이터 / ML
- `app/services/rag/config.py`에서 bge-m3 임베딩과 Qdrant 기본 컬렉션 구성을 코드로 명시했다.
- 벡터 컬렉션(스타일 가이드, 확정 문구, 용어집, 컨텍스트) 별 메타데이터 스키마를 정의하여 ingest 시 일관된 payload 구조를 강제한다.
- 향후 작업: 임베딩 파이프라인 스크립트 추가, Qdrant 클라이언트 초기화 및 하이브리드 검색 서비스 구현, rerank 모델/파라미터 연동.

## QA / Infra
- `pyproject.toml`에 SQLAlchemy, Alembic, Qdrant-client, pytest-asyncio, ruff를 추가하여 CI 파이프라인 구성을 준비했다.
- 이후 GitHub Actions 또는 내부 CI에서 `ruff`, `pytest` 실행 파이프라인을 정의할 예정이다.

## Outstanding Items After Day 2
- Alembic 초기 마이그레이션 스크립트 생성 및 README에 반영.
- Role 기반 인증 미들웨어 구현과 API 분리(`/v1/requests`, `/v1/drafts` 등) 착수.
- RAG ingest/service 모듈 실제 구현과 테스트 데이터 Postgres/Qdrant 적재 자동화.
- 프런트엔드 Next.js 베이스 프로젝트 초기화 및 실제 워크플로우 화면 개발.
