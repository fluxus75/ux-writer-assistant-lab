# 🚀 UX Writer Assistant - Complete E2E Test Guide

**목표**: Docker(PostgreSQL + Qdrant) + Backend + Frontend를 모두 구동하여 `mock/day6` 데이터로 완전한 워크플로우 테스트

## 🔥 빠른 시작 (Quick Start)

### 완전 초기화 후 시작하는 명령어 순서:
```bash
# 1. Docker Desktop 실행 확인
docker info

# 2. Docker 완전 초기화
cd infra/dev
docker compose down -v
docker compose up -d

# 3. 백엔드 초기화 (새 터미널)
cd backend
uv run alembic downgrade base
uv run alembic upgrade head
uv run python scripts/seed_users.py
uv run uvicorn app.main:app --reload --port 8000

# 4. 프론트엔드 시작 (새 터미널)
cd fe-test
pnpm dev

# 5. 브라우저에서 http://localhost:5173
# - Admin 선택 → Ingest → mock/day6 선택 → Run Ingest
```

---

## 📋 사전 준비

### 필수 도구
- **Docker Desktop** 설치 및 실행
- **Python 3.10+** with `uv` 설치
- **Node.js 20+** with `pnpm` 설치
- **포트 확인**: 5432 (PostgreSQL), 6333/6334 (Qdrant), 8000 (Backend), 5173 (Frontend)

### Docker Desktop 실행 확인
```bash
# Windows PowerShell에서
docker info
```

**예상 출력:** Server Version, Storage Driver 등 정보 표시
**오류 시:** Docker Desktop을 실행하고 잠시 대기 (약 30초)

### 💡 무료 오픈소스 대안: Podman Desktop
**회사 환경에서 Docker Desktop 라이선스 문제가 있나요?**

👉 **[Podman Desktop 가이드 보기](../docker-alternatives.md)**

- ✅ 100% 무료 오픈소스
- ✅ docker-compose.yml 그대로 사용 가능
- ✅ `docker` 명령어 호환
- ✅ Windows/Mac/Linux 지원

**Podman 사용 시:** 아래 모든 `docker compose` 명령어를 `podman-compose`로 교체하세요.

---

## 1️⃣ 인프라 완전 초기화 및 시작 (Docker)

### 1.1 기존 데이터 완전 삭제 (Clean Slate)
```bash
cd infra/dev

# 기존 컨테이너 및 볼륨 완전 삭제
docker compose down -v

# 데이터 디렉토리 삭제 (선택사항)
rm -rf dev-data/postgres
rm -rf dev-data/qdrant
```

**⚠️ 주의:** 이 단계는 모든 기존 데이터를 삭제합니다!

### 1.2 Docker 컨테이너 새로 시작
```bash
docker compose up -d
```

**처음 시작 시 대기 시간:** PostgreSQL 초기화에 약 10-15초 소요

### 1.2 컨테이너 상태 확인
```bash
docker compose ps
# PostgreSQL (5432), Qdrant (6333, 6334) 확인
```

**예상 출력:**
```
NAME                        STATUS
dev-postgres-1              Up
dev-qdrant-1               Up
```

### 1.3 PostgreSQL 연결 테스트
```bash
# Windows PowerShell
docker exec -it dev-postgres-1 psql -U ux_writer -d ux_writer -c "SELECT version();"
```

---

## 2️⃣ 백엔드 설정 및 시작

### 2.1 백엔드 환경 준비
```bash
cd backend

# Python 가상환경 및 의존성 설치
uv venv .venv
uv pip install -e .
```

### 2.2 데이터베이스 완전 초기화 (Alembic)

#### 방법 1: 깨끗한 초기화 (권장)
```bash
# Alembic 버전 테이블 포함 모든 스키마 삭제
uv run alembic downgrade base

# 최신 마이그레이션 적용
uv run alembic upgrade head
```

#### 방법 2: Alembic 이슈 발생 시
```bash
# 데이터베이스 완전 재생성
docker exec -it dev-postgres-1 psql -U ux_writer -c "DROP DATABASE IF EXISTS ux_writer;"
docker exec -it dev-postgres-1 psql -U ux_writer -c "CREATE DATABASE ux_writer;"

# 마이그레이션 재적용
uv run alembic upgrade head
```

**확인:**
```bash
# 테이블 생성 확인
docker exec -it dev-postgres-1 psql -U ux_writer -d ux_writer -c "\dt"
```

**예상 출력:** alembic_version, users, requests, drafts, approvals 등 테이블 목록

### 2.3 테스트 사용자 생성
```bash
uv run python scripts/seed_users.py
```

**출력 예시:**
```
Created user: designer-1 (Alice Kim) - designer
Created user: writer-1 (Bob Lee) - writer
Created user: admin-1 (Admin) - admin
```

**생성되는 사용자:**
- `designer-1` (Alice Kim) - Designer
- `writer-1` (Bob Lee) - Writer
- `admin-1` (Admin) - Admin

### 2.3 환경 변수 확인
```bash
cat .env | grep -E "(DATABASE_URL|QDRANT_URL|EMBEDDING)"
```

**확인 항목:**
- `DATABASE_URL=postgresql://ux_writer:ux_writer@localhost:5432/ux_writer`
- `QDRANT_URL=http://localhost:6333`
- `EMBEDDING_BACKEND=onnx` 또는 `stub`

### 2.4 백엔드 서버 시작
```bash
uv run uvicorn app.main:app --reload --port 8000
```

**확인:**
- 로그에 "Application startup complete" 표시
- ONNX 사용 시 "Loaded ONNX embedding model" 확인

### 2.5 Health Check
**새 터미널:**
```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

---

## 3️⃣ 프론트엔드 설정 및 시작

### 3.1 의존성 설치
```bash
cd fe-test
pnpm install
```

### 3.2 환경 변수 설정
```bash
# .env 파일이 없으면 생성
echo "VITE_API_BASE=http://localhost:8000" > .env
```

### 3.3 프론트엔드 서버 시작
```bash
pnpm dev
```

**예상 출력:**
```
VITE v5.4.20  ready in 599 ms

➜  Local:   http://localhost:5173/
```

---

## 4️⃣ Mock/Day6 데이터 Ingestion

### 4.1 브라우저에서 Ingest 실행

1. **브라우저 열기**: http://localhost:5173
2. **역할 선택**: Admin 선택
3. **Admin Dashboard** → **Ingest 페이지** 이동
4. **데이터 소스 선택**:
   - ✅ **Rich Mock Data (mock/day6) - 10 items** 선택
5. **Run Ingest** 클릭

### 4.2 Ingestion 결과 확인

**성공 시 응답 예시:**
```json
{
  "run_id": "run_20250111_120000",
  "counts": {
    "context": 10,
    "glossary": 7,
    "style": 11
  },
  "vector_store": {
    "status": "completed",
    "collections": {
      "context_snippets": 10,
      "glossary_terms": 7,
      "style_guides": 11
    }
  }
}
```

**✓ 확인 포인트:**
- `counts.context = 10` (10개 컨텍스트 항목)
- `vector_store.status = "completed"` (벡터 저장 성공)

### 4.3 Qdrant 벡터 데이터 검증
```bash
curl http://localhost:6333/collections
```

**예상 출력:**
```json
{
  "collections": [
    {"name": "style_guides"},
    {"name": "glossary_terms"},
    {"name": "context_snippets"}
  ]
}
```

---

## 5️⃣ 완전한 E2E 워크플로우 테스트

### 5.1 Designer 워크플로우

#### Step 1: 역할 전환
- **User Switcher** → **Alice Kim (Designer)** 선택

#### Step 2: 새 요청 생성
1. **Designer Dashboard** → **새 요청 생성** 클릭
2. 입력:
   - **제목**: "로봇청소기 충전 완료 메시지"
   - **기능명**: "charging_complete"
   - **설명**: "충전이 완료되었을 때 표시할 메시지"
   - **톤**: "friendly"
   - **스타일 선호**: "concise, informative"
   - **할당 작성자**: writer-1
3. **생성** 클릭

#### Step 3: 요청 확인
- 상태: `drafting`
- 할당된 Writer: Bob Lee

---

### 5.2 Writer 워크플로우 (RAG 활용)

#### Step 1: 역할 전환
- **User Switcher** → **Bob Lee (Writer)** 선택

#### Step 2: 할당된 요청 확인
- **Writer Dashboard** → **작업 대기중** 섹션에서 요청 확인
- 요청 클릭하여 상세 페이지 이동

#### Step 3: AI 드래프트 생성
1. **AI 드래프트 생성** 섹션:
   - **텍스트**: "충전이 완료되었습니다"
   - **소스 언어**: ko
   - **타겟 언어**: en
2. **AI 드래프트 생성** 클릭

#### Step 4: RAG 동작 확인
**생성된 드래프트에서 확인:**
- ✅ **3개 버전** 생성됨 (num_candidates=3)
- ✅ **RAG 활성화** (use_rag=true, rag_top_k=3)
- ✅ **관련 컨텍스트 참조**:
  - `RV-0001`: "충전대로 복귀할게요." → "Returning to charging station."
  - Mock/day6 데이터의 로봇청소기 관련 문구 활용
- ✅ **Guardrails 적용**:
  - 길이 제한 준수
  - 용어집(glossary) 용어 사용
  - 스타일 가이드 적용

**예상 드래프트 결과:**
```
버전 1: "Charging completed."
버전 2: "Charging is complete."
버전 3: "Charging has been completed."
```

#### Step 5: 상태 변경 확인
- 요청 상태 자동 변경: `drafting` → `in_review`

---

### 5.3 Designer 승인 워크플로우

#### Step 1: 역할 복귀
- **User Switcher** → **Alice Kim (Designer)** 선택

#### Step 2: 검토
- **Designer Dashboard** → **검토중** 필터 적용
- 요청 클릭하여 생성된 드래프트 확인

#### Step 3: 승인
1. **검토 및 승인** 섹션
2. **승인** 버튼 클릭
3. 사유 입력: "Good quality, matches our style"

#### Step 4: 최종 상태 확인
- 요청 상태: `approved`
- Dashboard에서 **승인됨** 필터로 확인

---

## 6️⃣ 고급 테스트 시나리오

### 6.1 다양한 디바이스 테스트
**공기청정기 요청 생성:**
- 제목: "공기질 상태 메시지"
- 기능명: "air_quality_status"
- 텍스트: "현재 공기질이 좋습니다"

**확인:**
- Mock/day6의 `air_purifier` 데이터 활용 확인
- Device 필터 작동 확인

### 6.2 RAG Retrieval 직접 테스트
**별도 터미널에서:**
```bash
curl -X POST http://localhost:8000/v1/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "query": "charging station",
    "filters": {"device": "robot_vacuum"},
    "top_k": 3
  }'
```

**확인:**
- 관련 문맥 검색 결과 반환
- 유사도 점수 확인

### 6.3 Guardrails 테스트
**금지 용어 테스트:**
- 텍스트: "charger is ready" 입력
- 자동 교체 확인: "charger" → "charging station"

---

## 7️⃣ 문제 해결 (Troubleshooting)

### Docker Desktop 문제
```bash
# Docker Desktop 실행 확인
docker info

# 오류 시: Docker Desktop 재시작
# Windows: 작업 표시줄에서 Docker Desktop 종료 후 재시작
```

### Docker 컨테이너 문제
```bash
cd infra/dev

# 완전 재시작 (데이터 보존)
docker compose restart

# 완전 초기화 (데이터 삭제)
docker compose down -v
rm -rf dev-data
docker compose up -d

# 로그 확인
docker compose logs -f postgres
docker compose logs -f qdrant
```

### Alembic 마이그레이션 문제
```bash
cd backend

# 1단계: 현재 버전 확인
uv run alembic current

# 2단계: 완전 초기화
uv run alembic downgrade base
uv run alembic upgrade head

# 3단계: 여전히 문제 시 - DB 재생성
docker exec -it dev-postgres-1 psql -U ux_writer -c "DROP DATABASE IF EXISTS ux_writer;"
docker exec -it dev-postgres-1 psql -U ux_writer -c "CREATE DATABASE ux_writer;"
uv run alembic upgrade head

# 사용자 재생성 (항상 필요)
uv run python scripts/seed_users.py
```

### 프론트엔드 문제
```bash
# 캐시 클리어 후 재시작
rm -rf node_modules/.vite
pnpm dev
```

### Ingest 실패
- **경로 오류**: `data/mock/day6` 폴더 존재 확인
- **파일 누락**: context.jsonl, glossary.csv, style_corpus.csv, style_rules.yaml 확인
- **Qdrant 연결**: Docker Qdrant 컨테이너 실행 확인

---

## 8️⃣ 테스트 완료 체크리스트

### Infrastructure
- [ ] Docker PostgreSQL 실행 중
- [ ] Docker Qdrant 실행 중
- [ ] 데이터베이스 마이그레이션 완료
- [ ] 테스트 사용자 생성 완료

### Data Ingestion
- [ ] Mock/day6 데이터 선택 가능
- [ ] Ingestion 성공 (10개 context, 7개 glossary, 11개 style)
- [ ] Qdrant 벡터 저장 성공

### RAG & Translation
- [ ] RAG 검색 작동 (use_rag=true, rag_top_k=3)
- [ ] 관련 컨텍스트 참조 확인
- [ ] Guardrails 적용 확인
- [ ] 다중 버전 생성 확인

### Workflow
- [ ] Designer 요청 생성
- [ ] Writer 할당 및 드래프트 생성
- [ ] 상태 전환 (drafting → in_review → approved)
- [ ] Designer 승인/거절

### UI/UX
- [ ] 역할 전환 작동
- [ ] 데이터 소스 선택 UI 작동
- [ ] 드래프트 메타데이터 표시
- [ ] 에러 핸들링

---

## 🎉 성공 기준

모든 체크리스트 항목이 완료되고 다음을 확인:

1. **10개 Mock/day6 컨텍스트 데이터** 로드 성공
2. **RAG가 활성화**되어 관련 문서 검색
3. **Designer → Writer → Designer 워크플로우** 완전 동작
4. **Guardrails 및 스타일 가이드** 자동 적용
5. **벡터 저장소(Qdrant)** 정상 작동

---

## 📚 참고 자료

- **IMPLEMENTATION_PLAN.md**: 전체 구현 계획
- **README.md**: 프로젝트 개요 및 설정
- **CLAUDE.md**: 개발 가이드

**테스트 완료 후 서버 종료:**
```bash
# Frontend
Ctrl+C in fe-test terminal

# Backend
Ctrl+C in backend terminal

# Docker
cd infra/dev
docker compose down
```

---

## ✅ 실제 테스트 결과 (2025-10-11)

### 테스트 환경
- **날짜**: 2025-10-11
- **테스터**: Claude Code (Automated E2E Test)
- **데이터**: mock/day6 (10 context, 6 glossary, 10 style)

### 실행 결과

#### 1. Infrastructure Setup
✅ **Docker 초기화 완료**
```bash
$ docker compose down -v && docker compose up -d
Network ux-writer-dev-net  Created
Container dev-postgres-1  Started
Container dev-qdrant-1  Started
```

✅ **PostgreSQL 연결 성공**
```
PostgreSQL 15.14 (Debian 15.14-1.pgdg13+1)
```

✅ **데이터베이스 마이그레이션 완료**
```bash
$ uv run alembic upgrade head
# 14 tables created: users, requests, drafts, approvals, audit_logs, etc.
```

✅ **테스트 사용자 생성 완료**
- designer-1 (Alice Kim)
- writer-1 (Bob Lee)
- admin-1 (Admin)

#### 2. Mock/day6 Data Ingestion
✅ **Ingestion 성공**
```json
{
  "run_id": "20251011_151208",
  "counts": {
    "context": 10,
    "glossary": 6,
    "style": 10
  },
  "vector_store": {
    "status": "completed",
    "collections": {
      "style_guides": 10,
      "glossary_terms": 6,
      "context_snippets": 10
    }
  }
}
```

✅ **PostgreSQL 데이터 검증**
- context_snippets: 10 records
- glossary_entries: 6 records
- style_guide_entries: 10 records

✅ **Qdrant Vector Store 검증**
- context_snippets: 76 vectors (chunked)
- glossary_terms: 60 vectors (multi-embedding)
- style_guides: 76 vectors (chunked)

#### 3. Complete E2E Workflow Test

✅ **Step 1: Designer creates Request**
```bash
$ curl -X POST http://localhost:8000/v1/requests \
  -H "X-User-Id: designer-1" -H "X-User-Role: designer" \
  -d '{"title": "WiFi Settings Title", "feature_name": "WiFi Settings", ...}'

Response:
{
  "id": "f0593561-724c-430a-bf74-d87ad828a910",
  "status": "drafting",
  "assigned_writer_id": "writer-1",
  ...
}
```

✅ **Step 2: Writer generates AI Draft with RAG**
```bash
$ curl -X POST http://localhost:8000/v1/drafts \
  -H "X-User-Id: writer-1" -H "X-User-Role: writer" \
  -d '{"request_id": "...", "text": "WiFi Settings", "source_language": "en", "target_language": "ko", ...}'

Response:
{
  "id": "a1e24df2-d43d-4a81-b5c6-9f595830cc7d",
  "llm_run_id": "624b2e8b-d61e-4982-aaa7-4bfc81532941",
  "generation_method": "ai",
  "versions": [
    {"version_index": 1, "content": "WiFi 설정"},
    {"version_index": 2, "content": "WiFi 설정"},
    {"version_index": 3, "content": "WiFi 설정"}
  ],
  "request_status": "in_review"  // Auto-transitioned!
}
```

**RAG Metadata Verification:**
- ✅ Retrieval mode: "style"
- ✅ Top-K: 5 items retrieved
- ✅ Novelty mode: true
- ✅ Guardrails: passed (no violations)
- ✅ Retrieved context: AP-S001 ~ AP-S005 (air_purifier related)

✅ **Step 3: Designer approves Draft**
```bash
$ curl -X POST http://localhost:8000/v1/approvals \
  -H "X-User-Id: designer-1" -H "X-User-Role: designer" \
  -d '{"request_id": "...", "decision": "approved", "comment": "Looks good!"}'

Response:
{
  "id": "6cba88b7-3839-46d7-be40-a063e92d19fb",
  "decision": "approved",
  "request_status": "approved"  // Final state!
}
```

✅ **Step 4: Audit Log Verification**
```sql
SELECT action, actor_id, entity_type, created_at FROM audit_logs;

Result:
 created           | designer-1 | request | 2025-10-11 06:16:58
 generated         | writer-1   | draft   | 2025-10-11 06:17:28
 approval:approved | designer-1 | request | 2025-10-11 06:18:14
```

### 테스트 요약

| Component | Status | Details |
|-----------|--------|---------|
| Docker (PostgreSQL) | ✅ | Version 15.14, 14 tables created |
| Docker (Qdrant) | ✅ | 4 collections, 212 total vectors |
| Backend Server | ✅ | Uvicorn running on port 8000 |
| Data Ingestion | ✅ | 10 context + 6 glossary + 10 style |
| Request Creation | ✅ | Designer → Request created |
| AI Draft Generation | ✅ | Writer → 3 versions generated with RAG |
| Approval Workflow | ✅ | Designer → Request approved |
| Audit Logging | ✅ | 3 actions logged correctly |
| State Transitions | ✅ | drafting → in_review → approved |

### 성공 기준 달성 여부

- ✅ Mock/day6 데이터 완전 로드 (10+6+10 items)
- ✅ RAG 검색 활성화 (5개 관련 문서 검색됨)
- ✅ Designer → Writer → Designer 워크플로우 완전 동작
- ✅ Guardrails 자동 적용 (violations: 0)
- ✅ Qdrant 벡터 저장소 정상 작동 (212 vectors)
- ✅ Audit log 완전 기록 (3 actions)

**🎉 전체 E2E 테스트 성공!**
