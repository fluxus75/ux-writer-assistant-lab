# 🚀 UX Writer Assistant - Complete E2E Integration Test Guide

**버전**: 현재 구현 (2025-01-19)
**목표**: Docker(PostgreSQL + Qdrant) + Backend + Frontend(fe-test)를 모두 구동하여 완전한 워크플로우 테스트

---

## 📋 목차

1. [빠른 시작 (Quick Start)](#-빠른-시작-quick-start)
2. [사전 준비](#-사전-준비)
3. [데이터 완전 초기화 가이드](#-데이터-완전-초기화-가이드)
4. [인프라 설정 (Docker)](#-인프라-설정-docker)
5. [백엔드 설정 및 초기 데이터 생성](#-백엔드-설정-및-초기-데이터-생성)
6. [프론트엔드 설정 및 시작](#-프론트엔드-설정-및-시작)
7. [Mock 데이터 Ingestion](#-mock-데이터-ingestion)
8. [E2E 워크플로우 테스트](#-e2e-워크플로우-테스트)
9. [신규 기능 테스트](#-신규-기능-테스트)
10. [문제 해결](#-문제-해결)
11. [테스트 완료 체크리스트](#-테스트-완료-체크리스트)

---

## 🔥 빠른 시작 (Quick Start)

### 완전 초기화 후 시작하는 명령어 순서:

```bash
# 0. 작업 디렉토리 확인
pwd  # ux-writer-assistant-lab 루트 디렉토리인지 확인

# 1. Docker Desktop 실행 확인
docker info

# 2. Docker 완전 초기화
cd infra/dev
docker compose down -v
rm -rf dev-data/postgres dev-data/qdrant  # 완전 삭제 (선택사항)
docker compose up -d

# 3. 백엔드 초기화 (새 터미널 - 프로젝트 루트에서)
cd backend
uv run alembic downgrade base
uv run alembic upgrade head
uv run python scripts/seed_users.py
uv run uvicorn app.main:app --reload --port 8000

# 4. 프론트엔드 시작 (새 터미널 - 프로젝트 루트에서)
cd fe-test
pnpm install  # 최초 한 번만
pnpm dev

# 5. 브라우저에서 http://localhost:5173
# - Admin 선택 → Admin Dashboard → Ingest 페이지
# - Data Source: "Rich Mock Data (mock/day6)" 선택
# - Run Ingest 클릭
```

---

## 📦 사전 준비

### 필수 도구

- **Docker Desktop** 설치 및 실행 (또는 Podman Desktop)
- **Python 3.10+** with `uv` 설치
- **Node.js 20+** with `pnpm` 설치
- **포트 확인**: 5432 (PostgreSQL), 6333/6334 (Qdrant), 8000 (Backend), 5173 (Frontend)

### 포트 충돌 확인

```bash
# Windows PowerShell
netstat -ano | findstr "5432"  # PostgreSQL
netstat -ano | findstr "6333"  # Qdrant REST
netstat -ano | findstr "8000"  # Backend
netstat -ano | findstr "5173"  # Frontend
```

**포트 사용 중이면 해당 프로세스 종료 필요**

### Docker Desktop 실행 확인

```bash
docker info
```

**예상 출력**: Server Version, Storage Driver 등 정보 표시
**오류 시**: Docker Desktop을 실행하고 약 30초 대기

---

## 🗑️ 데이터 완전 초기화 가이드

### 왜 초기화가 필요한가?

- 이전 테스트 데이터 제거
- 마이그레이션 충돌 방지
- 일관된 테스트 환경 보장
- 벡터 스토어 중복 데이터 방지

### 초기화 단계별 가이드

#### 1단계: Docker 데이터 완전 삭제

```bash
cd infra/dev

# 컨테이너 및 볼륨 삭제
docker compose down -v

# (선택사항) 데이터 디렉토리 완전 삭제
rm -rf dev-data/postgres
rm -rf dev-data/qdrant

# 또는 Windows CMD:
# rmdir /s /q dev-data\postgres
# rmdir /s /q dev-data\qdrant
```

**⚠️ 주의**: 이 단계는 모든 기존 데이터를 삭제합니다!

#### 2단계: PostgreSQL 데이터베이스 초기화 (백엔드 작업)

**방법 A: Alembic으로 완전 초기화 (권장)**

```bash
cd backend

# 모든 마이그레이션을 되돌림 (테이블 전체 삭제)
uv run alembic downgrade base

# 최신 마이그레이션 적용
uv run alembic upgrade head

# 현재 버전 확인
uv run alembic current
```

**방법 B: 데이터베이스 직접 재생성 (문제 발생 시)**

```bash
# Docker 컨테이너 실행 후
docker exec -it dev-postgres-1 psql -U ux_writer -c "DROP DATABASE IF EXISTS ux_writer;"
docker exec -it dev-postgres-1 psql -U ux_writer -c "CREATE DATABASE ux_writer;"

# 마이그레이션 재적용
cd backend
uv run alembic upgrade head
```

#### 3단계: 테이블 생성 확인

```bash
# PostgreSQL 접속하여 테이블 확인
docker exec -it dev-postgres-1 psql -U ux_writer -d ux_writer -c "\dt"
```

**예상 출력**:
```
 Schema |          Name           | Type  |   Owner
--------+-------------------------+-------+-----------
 public | alembic_version         | table | ux_writer
 public | approvals               | table | ux_writer
 public | audit_logs              | table | ux_writer
 public | comments                | table | ux_writer
 public | context_snippets        | table | ux_writer
 public | device_taxonomy         | table | ux_writer
 public | draft_versions          | table | ux_writer
 public | drafts                  | table | ux_writer
 public | export_jobs             | table | ux_writer
 public | glossary_entries        | table | ux_writer
 public | guardrail_rules         | table | ux_writer
 public | rag_ingestions          | table | ux_writer
 public | requests                | table | ux_writer
 public | selected_draft_versions | table | ux_writer
 public | style_guide_entries     | table | ux_writer
 public | users                   | table | ux_writer
(16 rows)
```

#### 4단계: 테스트 사용자 생성

```bash
cd backend
uv run python scripts/seed_users.py
```

**출력 예시**:
```
Created user: designer-1 (Alice Kim) - designer
Created user: writer-1 (Bob Lee) - writer
Created user: admin-1 (Admin) - admin

✓ Seed completed: 3 created, 0 updated
```

**생성되는 사용자**:
- `designer-1` (Alice Kim) - Designer 역할
- `writer-1` (Bob Lee) - Writer 역할
- `admin-1` (Admin) - Admin 역할

#### 5단계: Device Taxonomy 초기 데이터 생성 (선택사항)

Device Taxonomy는 Admin UI에서 직접 생성하거나, 다음과 같이 SQL로 삽입 가능:

```bash
docker exec -it dev-postgres-1 psql -U ux_writer -d ux_writer << 'EOF'
INSERT INTO device_taxonomy (id, display_name_ko, display_name_en, category, active)
VALUES
  ('robot_vacuum', '로봇청소기', 'Robot Vacuum', 'home_appliance', true),
  ('air_purifier', '공기청정기', 'Air Purifier', 'home_appliance', true)
ON CONFLICT (id) DO UPDATE
SET display_name_ko = EXCLUDED.display_name_ko,
    display_name_en = EXCLUDED.display_name_en,
    category = EXCLUDED.category,
    active = EXCLUDED.active;
EOF
```

#### 6단계: Qdrant 벡터 스토어 초기화

Qdrant는 Docker 볼륨 삭제 시 자동으로 초기화됩니다.
수동 확인:

```bash
# 컬렉션 목록 확인 (빈 결과 예상)
curl http://localhost:6333/collections
```

**예상 출력** (초기화 완료 시):
```json
{
  "result": {
    "collections": []
  }
}
```

---

## 🐳 인프라 설정 (Docker)

### Docker Compose 시작

```bash
cd infra/dev
docker compose up -d
```

**처음 시작 시**: PostgreSQL 초기화에 약 10-15초 소요

### 컨테이너 상태 확인

```bash
docker compose ps
```

**예상 출력**:
```
NAME                STATUS              PORTS
dev-postgres-1      Up 30 seconds       0.0.0.0:5432->5432/tcp
dev-qdrant-1        Up 30 seconds       0.0.0.0:6333->6333/tcp, 0.0.0.0:6334->6334/tcp
```

### PostgreSQL 연결 테스트

```bash
docker exec -it dev-postgres-1 psql -U ux_writer -d ux_writer -c "SELECT version();"
```

**예상 출력**: PostgreSQL 15.x 버전 정보

### Qdrant 연결 테스트

```bash
curl http://localhost:6333/
```

**예상 출력**:
```json
{
  "title": "qdrant - vector search engine",
  "version": "1.15.1"
}
```

---

## ⚙️ 백엔드 설정 및 초기 데이터 생성

### 환경 준비

```bash
cd backend

# Python 가상환경 및 의존성 설치
uv venv .venv
uv pip install -e .
```

### 환경 변수 확인

```bash
cat .env | grep -E "(DATABASE_URL|QDRANT_URL|EMBEDDING)"
```

**확인 항목**:
```
DATABASE_URL=postgresql://ux_writer:ux_writer@localhost:5432/ux_writer
QDRANT_URL=http://localhost:6333
EMBEDDING_BACKEND=onnx  # 또는 stub
```

### 데이터베이스 마이그레이션

```bash
# 현재 버전 확인
uv run alembic current

# 최신 버전으로 업그레이드
uv run alembic upgrade head

# 마이그레이션 히스토리 확인
uv run alembic history
```

### 테스트 사용자 생성

```bash
uv run python scripts/seed_users.py
```

### 백엔드 서버 시작

```bash
uv run uvicorn app.main:app --reload --port 8000
```

**확인 사항**:
- 로그에 "Application startup complete" 표시
- ONNX 사용 시 "Loaded ONNX embedding model" 확인

### Health Check

**새 터미널에서**:
```bash
curl http://localhost:8000/health
```

**예상 출력**:
```json
{"status":"ok"}
```

### API 문서 확인

브라우저에서 열기:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 🎨 프론트엔드 설정 및 시작

### 의존성 설치

```bash
cd fe-test
pnpm install
```

### 환경 변수 설정

```bash
# .env 파일 생성 (없으면)
echo "VITE_API_BASE=http://localhost:8000" > .env

# 확인
cat .env
```

### 프론트엔드 서버 시작

```bash
pnpm dev
```

**예상 출력**:
```
VITE v5.4.20  ready in 599 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 브라우저 접속

브라우저에서 http://localhost:5173 열기

---

## 📥 Mock 데이터 Ingestion

### Mock/day6 데이터 구조

```
data/mock/day6/
├── context.jsonl       # 10개 항목 (AP-0101~AP-0105, RV-0001~RV-0005)
├── glossary.csv        # 6개 용어
├── style_corpus.csv    # 10개 스타일 예시
└── style_rules.yaml    # 스타일 규칙
```

### 브라우저에서 Ingest 실행

1. **역할 선택**: Admin 선택
2. **Admin Dashboard** → **Ingest** 페이지 이동
3. **Data Source 선택**:
   - ✅ **Rich Mock Data (mock/day6) - 10 items** 선택
4. **Run Ingest** 클릭

### Ingestion 결과 확인

**성공 시 응답 예시**:
```json
{
  "run_id": "20250113_120000",
  "counts": {
    "context": 10,
    "glossary": 6,
    "style": 10
  },
  "vector_store": {
    "status": "completed",
    "collections": {
      "context_snippets": 10,
      "glossary_terms": 6,
      "style_guides": 10
    }
  }
}
```

### PostgreSQL 데이터 검증

```bash
# Context snippets 확인
docker exec -it dev-postgres-1 psql -U ux_writer -d ux_writer -c \
  "SELECT COUNT(*) FROM context_snippets;"

# Glossary 확인
docker exec -it dev-postgres-1 psql -U ux_writer -d ux_writer -c \
  "SELECT COUNT(*) FROM glossary_entries;"

# Style guide 확인
docker exec -it dev-postgres-1 psql -U ux_writer -d ux_writer -c \
  "SELECT COUNT(*) FROM style_guide_entries;"
```

**예상 출력**: 각각 10, 6, 10

### Qdrant 벡터 데이터 검증

```bash
curl http://localhost:6333/collections
```

**예상 출력**:
```json
{
  "result": {
    "collections": [
      {"name": "context_snippets"},
      {"name": "glossary_terms"},
      {"name": "style_guides"}
    ]
  }
}
```

---

## 🧪 E2E 워크플로우 테스트

### 테스트 시나리오 1: Designer → Writer → Designer

#### Step 1: Designer - 새 요청 생성

1. **User Switcher** → **Alice Kim (Designer)** 선택
2. **Designer Dashboard** → **새 요청 생성** 클릭
3. **입력 정보**:
   - **제목**: "로봇청소기 충전 완료 메시지"
   - **디바이스**: robot_vacuum 선택
   - **기능**: "충전 완료"
   - **컨텍스트**: "충전이 완료되었을 때 표시할 메시지"
   - **원문**: "충전이 완료되었습니다"
   - **톤**: "friendly"
   - **스타일 가이드**: "concise, informative"
   - **작가 할당**: Bob Lee (writer-1) 선택
4. **요청 생성** 클릭

**확인 사항**:
- 요청 상태: `drafting`
- 할당된 Writer: Bob Lee
- Request ID 저장 (다음 단계에서 사용)

#### Step 2: Writer - AI 드래프트 생성 (RAG 활용)

1. **User Switcher** → **Bob Lee (Writer)** 선택
2. **Writer Dashboard** → **작업 대기중** 섹션에서 요청 확인
3. 요청 클릭하여 상세 페이지 이동
4. **AI 드래프트 생성** 섹션:
   - **텍스트**: "충전이 완료되었습니다"
   - **소스 언어**: ko
   - **타겟 언어**: en
   - **RAG 사용**: ✅ (기본값)
   - **RAG Top-K**: 3
   - **후보 개수**: 3
5. **AI 드래프트 생성** 클릭

**RAG 동작 확인**:
- ✅ 3개 버전 생성됨
- ✅ RAG 활성화 (use_rag=true)
- ✅ 관련 컨텍스트 참조:
  - `RV-0001`: "충전대로 복귀할게요." → "Returning to charging station."
  - Mock/day6 데이터의 로봇청소기 관련 문구 활용
- ✅ Guardrails 적용:
  - 길이 제한 준수
  - 용어집(glossary) 용어 사용
  - 스타일 가이드 적용

**예상 드래프트 결과**:
```
버전 1: "Charging completed."
버전 2: "Charging is complete."
버전 3: "Charging has been completed."
```

**상태 변경 확인**:
- 요청 상태 자동 변경: `drafting` → `in_review`

#### Step 3: Designer - 검토 및 승인

1. **User Switcher** → **Alice Kim (Designer)** 선택
2. **Designer Dashboard** → **검토중** 필터 적용
3. 요청 클릭하여 생성된 드래프트 확인
4. **검토 및 승인** 섹션:
   - 드래프트 버전 선택 (예: 버전 1)
   - **승인** 버튼 클릭
   - 사유 입력: "Good quality, matches our style"
5. **제출** 클릭

**최종 상태 확인**:
- 요청 상태: `approved`
- Dashboard에서 **승인됨** 필터로 확인

### 테스트 시나리오 2: 다양한 디바이스 테스트

#### 공기청정기 요청 생성

1. **Designer**로 로그인
2. **새 요청 생성**:
   - **제목**: "공기질 상태 메시지"
   - **디바이스**: air_purifier 선택
   - **기능**: "공기질 상태"
   - **텍스트**: "현재 공기질이 좋습니다"
   - **작가 할당**: writer-1

**확인 사항**:
- Mock/day6의 `air_purifier` 데이터 활용 확인
- Device 필터 작동 확인
- AP-0101 ~ AP-0105 컨텍스트 참조 확인

### 테스트 시나리오 3: RAG Retrieval 직접 테스트

**별도 터미널에서 API 호출**:

```bash
curl -X POST http://localhost:8000/v1/retrieve \
  -H "Content-Type: application/json" \
  -H "X-User-Id: admin-1" \
  -H "X-User-Role: admin" \
  -d '{
    "query": "charging station",
    "filters": {"device": "robot_vacuum"},
    "top_k": 3
  }'
```

**확인 사항**:
- 관련 문맥 검색 결과 반환
- 유사도 점수 확인
- RV-0001 (충전 복귀) 관련 문서 포함

---

## 🆕 신규 기능 테스트

### CSV 배치 업로드 테스트

#### 1. 샘플 CSV 템플릿 다운로드

1. **Designer**로 로그인
2. **새 요청 생성** → **배치로 여러 건 업로드** 클릭
3. **CSV 템플릿 다운로드** 버튼 클릭

**다운로드된 파일 내용**:
```csv
title,feature_name,context_description,source_text,tone,style_preferences,device
"청소 시작 버튼","Start Cleaning","사용자가 버튼을 눌러 청소 시작","청소를 시작합니다","friendly","concise","robot_vacuum"
"충전 복귀","Return to Charge","배터리 부족 시 자동 충전소 복귀","충전소로 돌아갑니다","informative","brief","robot_vacuum"
"일시정지","Pause Cleaning","청소 중 일시정지 기능","청소를 일시정지합니다","neutral","short","robot_vacuum"
```

#### 2. CSV 파일 수정 및 업로드

**CSV 파일 편집** (Excel 또는 텍스트 에디터):
- 3~5개 항목으로 수정
- title, feature_name 필수
- device는 robot_vacuum 또는 air_purifier 사용

**업로드**:
1. **Step 1**: Writer 선택 (선택사항)
   - Bob Lee 선택 (모든 요청에 일괄 할당)
2. **Step 2**: CSV 파일 업로드
   - 수정한 파일 선택
3. **Step 3**: 미리보기 확인
   - 최대 5행 표시
4. **업로드 및 생성** 클릭

**성공 응답**:
```
성공! 5개의 요청이 생성되었습니다. 목록 페이지로 이동합니다...
```

#### 3. 검증 에러 테스트

**의도적으로 오류가 있는 CSV 작성**:
```csv
title,feature_name,device
"","",""
"Valid Title","",""
"Too Long Title (300 characters)...","Valid Feature","invalid_device"
```

**예상 결과**:
- 검증 실패 테이블 표시
- 행 번호별 오류 메시지:
  - Row 2: title is required
  - Row 3: feature_name is required
  - Row 4: Invalid device ID

#### 4. 최대 30건 제한 테스트

**31개 항목의 CSV 업로드**:

**예상 결과**:
```
검증 실패: 1개의 오류가 발견되었습니다.

Row 31 | N/A | Maximum batch size of 30 requests exceeded
```

#### 5. 트랜잭션 롤백 테스트

**시나리오**: 15개 항목 중 10번째에 오류

**예상 결과**:
- 모든 요청 생성 실패 (0건 생성)
- 데이터베이스 롤백 확인

**검증**:
```bash
docker exec -it dev-postgres-1 psql -U ux_writer -d ux_writer -c \
  "SELECT COUNT(*) FROM requests WHERE title LIKE 'Batch%';"
```

**예상**: 0 (트랜잭션 롤백됨)

### Pagination 테스트

#### 1. 대량 데이터 생성

**CSV 배치 업로드로 30개 요청 생성** (최대 개수)

또는 **API 호출로 여러 요청 생성**:
```bash
for i in {1..25}; do
  curl -X POST http://localhost:8000/v1/requests \
    -H "Content-Type: application/json" \
    -H "X-User-Id: designer-1" \
    -H "X-User-Role: designer" \
    -d "{
      \"title\": \"Test Request $i\",
      \"feature_name\": \"test_feature_$i\",
      \"assigned_writer_id\": \"writer-1\"
    }"
done
```

#### 2. Pagination 네비게이션 테스트

1. **Designer Dashboard**로 이동
2. **전체 요청 수** 확인 (예: 35건)
3. **페이지 네비게이션**:
   - 첫 페이지: 20건 표시
   - **다음** 버튼 클릭 → 2페이지 (나머지 15건)
   - **이전** 버튼 클릭 → 1페이지

#### 3. 페이지 크기 변경

1. **페이지당** 드롭다운 선택
2. **10건** 선택 → 10개씩 표시
3. **50건** 선택 → 50개씩 표시 (전체 표시)

#### 4. Status 필터 + Pagination

1. **상태 필터**: "작성중" 선택
2. Pagination 적용 확인
3. 전체 건수 표시: "전체 15건"

#### 5. API 직접 테스트

```bash
# 1페이지 (20건)
curl "http://localhost:8000/v1/requests?page=1&page_size=20" \
  -H "X-User-Id: designer-1" -H "X-User-Role: designer"

# 2페이지 (20건)
curl "http://localhost:8000/v1/requests?page=2&page_size=20" \
  -H "X-User-Id: designer-1" -H "X-User-Role: designer"

# Status 필터 + Pagination
curl "http://localhost:8000/v1/requests?status=drafting&page=1&page_size=10" \
  -H "X-User-Id: designer-1" -H "X-User-Role: designer"
```

**응답 구조 확인**:
```json
{
  "items": [...],
  "pagination": {
    "total_count": 35,
    "page": 1,
    "page_size": 20,
    "total_pages": 2
  }
}
```

### Designer별 통계 API 테스트

```bash
curl http://localhost:8000/v1/requests/statistics \
  -H "X-User-Id: writer-1" \
  -H "X-User-Role: writer"
```

**예상 응답**:
```json
{
  "total_count": 35,
  "by_designer": [
    {
      "designer_id": "designer-1",
      "designer_name": "Alice Kim",
      "designer_email": "alice@company.com",
      "request_count": 35
    }
  ],
  "by_status": {
    "drafting": 20,
    "in_review": 10,
    "approved": 5,
    "needs_revision": 3,
    "cancelled": 2
  }
}
```

### Comments 시스템 테스트

#### 1. Request에 댓글 작성

**브라우저에서**:
1. **Designer** 또는 **Writer**로 로그인
2. 요청 상세 페이지 이동
3. **Activity Timeline** 또는 댓글 섹션에서 댓글 작성
4. 내용 입력 후 **댓글 작성** 클릭

**API 테스트**:
```bash
curl -X POST http://localhost:8000/v1/comments \
  -H "Content-Type: application/json" \
  -H "X-User-Id: designer-1" \
  -H "X-User-Role: designer" \
  -d '{
    "request_id": "<REQUEST_ID>",
    "body": "초안 잘 봤습니다. 톤을 조금 더 친근하게 해주세요."
  }'
```

#### 2. Draft Version에 특정 댓글 작성

```bash
curl -X POST http://localhost:8000/v1/comments \
  -H "Content-Type: application/json" \
  -H "X-User-Id: writer-1" \
  -H "X-User-Role: writer" \
  -d '{
    "request_id": "<REQUEST_ID>",
    "draft_version_id": "<VERSION_ID>",
    "body": "이 버전이 가장 적절한 것 같습니다."
  }'
```

#### 3. 댓글 조회 및 해결

**댓글 목록 조회**:
```bash
curl http://localhost:8000/v1/requests/<REQUEST_ID>/comments \
  -H "X-User-Id: designer-1" \
  -H "X-User-Role: designer"
```

**댓글 해결(Resolve)**:
```bash
curl -X POST http://localhost:8000/v1/comments/<COMMENT_ID>/resolve \
  -H "X-User-Id: designer-1" \
  -H "X-User-Role: designer"
```

**확인 사항**:
- ✅ 댓글이 Activity Timeline에 시간순 표시
- ✅ Draft version별 댓글 구분
- ✅ 작성자 이름, 시간 표시
- ✅ 해결된 댓글 "Resolved" 배지 표시

### Request 취소(Cancellation) 기능 테스트

#### 시나리오: Designer가 요청 취소

1. **Designer Dashboard** → `drafting` 또는 `needs_revision` 상태 요청 선택
2. 요청 상세 페이지 → **요청 취소** 버튼 클릭
3. 취소 사유 입력 (선택사항)
4. **확인** 클릭

**API 테스트**:
```bash
curl -X POST http://localhost:8000/v1/requests/<REQUEST_ID>/cancel \
  -H "Content-Type: application/json" \
  -H "X-User-Id: designer-1" \
  -H "X-User-Role: designer" \
  -d '{
    "reason": "요구사항 변경으로 더 이상 필요하지 않습니다."
  }'
```

**예상 응답**:
```json
{
  "id": "<REQUEST_ID>",
  "status": "cancelled",
  "message": "Request cancelled successfully"
}
```

**제약 사항 확인**:
- ❌ `approved` 상태 → 취소 불가 (400 에러)
- ❌ `rejected` 상태 → 취소 불가 (400 에러)
- ❌ `in_review` 상태 → 취소 불가 (400 에러)
- ✅ `drafting` 상태 → 취소 가능
- ✅ `needs_revision` 상태 → 취소 가능
- ❌ 다른 Designer의 요청 → 취소 불가 (403 에러)

### Device Management (Admin) 테스트

#### 1. Device 목록 조회

**브라우저**:
1. **Admin** 역할로 로그인
2. **Admin Dashboard** → **Device Management** 클릭

**API 테스트**:
```bash
curl http://localhost:8000/v1/admin/devices \
  -H "X-User-Id: admin-1" \
  -H "X-User-Role: admin"
```

#### 2. 새 Device 생성

**브라우저**:
1. **Device Management** 페이지
2. **새 디바이스 추가** 버튼 클릭
3. 폼 입력:
   - **ID**: `smart_tv` (소문자, 숫자, 언더스코어만)
   - **한글명**: `스마트 TV`
   - **영문명**: `Smart TV`
   - **카테고리**: `electronics`
4. **생성** 클릭

**API 테스트**:
```bash
curl -X POST http://localhost:8000/v1/admin/devices \
  -H "Content-Type: application/json" \
  -H "X-User-Id: admin-1" \
  -H "X-User-Role: admin" \
  -d '{
    "id": "smart_tv",
    "display_name_ko": "스마트 TV",
    "display_name_en": "Smart TV",
    "category": "electronics"
  }'
```

#### 3. Device 수정

```bash
curl -X PUT http://localhost:8000/v1/admin/devices/smart_tv \
  -H "Content-Type: application/json" \
  -H "X-User-Id: admin-1" \
  -H "X-User-Role: admin" \
  -d '{
    "display_name_ko": "스마트 TV (업데이트)",
    "active": true
  }'
```

#### 4. Device 비활성화

```bash
curl -X DELETE http://localhost:8000/v1/admin/devices/smart_tv \
  -H "X-User-Id: admin-1" \
  -H "X-User-Role: admin"
```

**확인 사항**:
- ✅ Active 디바이스만 Request 생성 시 선택 가능
- ✅ 비활성화된 디바이스는 목록에서 숨김
- ✅ `include_inactive=true` 쿼리로 비활성 디바이스 조회 가능

### Approved Requests Download 테스트

#### 1. 승인된 요청 목록 조회

**브라우저**:
1. **Designer Dashboard** → **Download** 탭 클릭
2. 필터 설정:
   - **기간**: 2025-01-01 ~ 2025-01-31
   - **Writer**: Bob Lee 선택
   - **Device**: robot_vacuum 선택
3. **조회** 클릭

**API 테스트**:
```bash
curl "http://localhost:8000/v1/requests/approved?from_date=2025-01-01&to_date=2025-01-31&writer_id=writer-1&device=robot_vacuum" \
  -H "X-User-Id: designer-1" \
  -H "X-User-Role: designer"
```

**예상 응답**:
```json
{
  "items": [
    {
      "id": "<REQUEST_ID>",
      "title": "로봇청소기 충전 완료 메시지",
      "feature_name": "충전 완료",
      "source_text": "충전이 완료되었습니다",
      "approved_draft_content": "Charging completed.",
      "device": "robot_vacuum",
      "assigned_writer_id": "writer-1",
      "assigned_writer_name": "Bob Lee",
      "approved_at": "2025-01-15T10:30:00Z",
      "created_at": "2025-01-10T09:00:00Z"
    }
  ],
  "total_count": 1
}
```

#### 2. Excel 다운로드

**브라우저**:
1. **Download** 페이지에서 승인된 요청 목록 확인
2. **체크박스**로 다운로드할 항목 선택
3. **Excel 다운로드** 버튼 클릭
4. `approved_requests_YYYYMMDD_HHMMSS.xlsx` 파일 다운로드 확인

**API 테스트**:
```bash
curl -X POST http://localhost:8000/v1/requests/download/excel \
  -H "Content-Type: application/json" \
  -H "X-User-Id: designer-1" \
  -H "X-User-Role: designer" \
  -d '{
    "request_ids": ["<REQUEST_ID_1>", "<REQUEST_ID_2>"]
  }' \
  --output approved_requests.xlsx
```

**Excel 파일 내용 확인**:
- ✅ 헤더: Device, 제목, 원문 (KO), 영문안, Feature Name, Writer, 승인일자, 요청일자
- ✅ 선택한 요청들의 데이터가 행으로 표시
- ✅ 컬럼 너비 자동 조정 (최대 50자)

### User List 조회 (Admin/Designer/Writer) 테스트

```bash
curl http://localhost:8000/v1/admin/users \
  -H "X-User-Id: admin-1" \
  -H "X-User-Role: admin"
```

**예상 응답**:
```json
[
  {
    "id": "designer-1",
    "name": "Alice Kim",
    "email": "alice@company.com",
    "role": "designer"
  },
  {
    "id": "writer-1",
    "name": "Bob Lee",
    "email": "bob@company.com",
    "role": "writer"
  },
  {
    "id": "admin-1",
    "name": "Admin",
    "email": "admin@company.com",
    "role": "admin"
  }
]
```

**확인 사항**:
- ✅ 모든 역할(Admin/Designer/Writer)에서 접근 가능
- ✅ 이름순 정렬

### Selected Draft Version 테스트

#### Writer가 드래프트 버전 선택

1. **Writer Dashboard** → 요청 상세 페이지
2. **AI 드래프트 생성**으로 3개 버전 생성
3. 각 버전 검토 후 원하는 버전의 **선택** 버튼 클릭
4. **검토 요청** 버튼 클릭 → `in_review` 상태로 변경

**확인 사항**:
- ✅ 선택된 버전에 "Selected" 배지 표시
- ✅ Request 상태 자동 변경: `drafting` → `in_review`
- ✅ 다른 버전 선택 시 이전 선택 해제

#### Designer가 선택된 버전 확인 및 승인

1. **Designer Dashboard** → **검토중** 요청 선택
2. 선택된 드래프트 버전 확인 (Selected 배지)
3. **승인** 또는 **수정 요청** 버튼 클릭

**승인 시**:
```bash
curl -X POST http://localhost:8000/v1/approvals \
  -H "Content-Type: application/json" \
  -H "X-User-Id: designer-1" \
  -H "X-User-Role: designer" \
  -d '{
    "request_id": "<REQUEST_ID>",
    "decision": "approved",
    "comment": "Perfect translation!"
  }'
```

**수정 요청 시** (needs_revision 상태로 변경):
```bash
curl -X POST http://localhost:8000/v1/approvals \
  -H "Content-Type: application/json" \
  -H "X-User-Id: designer-1" \
  -H "X-User-Role: designer" \
  -d '{
    "request_id": "<REQUEST_ID>",
    "decision": "rejected",
    "comment": "톤이 너무 딱딱합니다. 더 친근한 표현으로 수정해주세요."
  }'
```

**확인 사항**:
- ✅ 승인 시 → `approved` 상태
- ✅ 거절 시 → `needs_revision` 상태 (재작업 가능)
- ✅ 승인된 버전만 Download 페이지에서 조회 가능

---

## 🔧 문제 해결

### Docker Desktop 문제

```bash
# Docker Desktop 실행 확인
docker info

# 오류 시: Docker Desktop 재시작
# Windows: 작업 표시줄에서 Docker Desktop 종료 후 재시작

# Docker 네트워크 충돌 해결
docker network prune -f
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

# 개별 컨테이너 로그 확인
docker compose logs -f postgres
docker compose logs -f qdrant

# 컨테이너 상태 확인
docker compose ps
```

### PostgreSQL 연결 문제

```bash
# 포트 충돌 확인
netstat -ano | findstr "5432"

# 데이터베이스 연결 테스트
docker exec -it dev-postgres-1 psql -U ux_writer -d ux_writer -c "SELECT 1;"

# 데이터베이스 재생성
docker exec -it dev-postgres-1 psql -U ux_writer << 'EOF'
DROP DATABASE IF EXISTS ux_writer;
CREATE DATABASE ux_writer;
EOF

cd backend
uv run alembic upgrade head
uv run python scripts/seed_users.py
```

### Alembic 마이그레이션 문제

```bash
cd backend

# 1단계: 현재 버전 확인
uv run alembic current

# 2단계: 완전 초기화
uv run alembic downgrade base
uv run alembic upgrade head

# 3단계: 여전히 문제 시 - 마이그레이션 히스토리 삭제
docker exec -it dev-postgres-1 psql -U ux_writer -d ux_writer -c \
  "DELETE FROM alembic_version;"

# 4단계: 마이그레이션 재적용
uv run alembic stamp head
uv run alembic upgrade head

# 사용자 재생성 (항상 필요)
uv run python scripts/seed_users.py
```

### 백엔드 서버 문제

```bash
# 포트 충돌 확인
netstat -ano | findstr "8000"

# 환경 변수 확인
cd backend
cat .env

# 로그 확인하며 재시작
uv run uvicorn app.main:app --reload --port 8000 --log-level debug
```

### 프론트엔드 문제

```bash
cd fe-test

# 캐시 클리어 후 재시작
rm -rf node_modules/.vite
pnpm dev

# 의존성 재설치
rm -rf node_modules
pnpm install
pnpm dev

# 환경 변수 확인
cat .env
# VITE_API_BASE=http://localhost:8000
```

### Ingest 실패

**경로 오류**:
```bash
# 데이터 파일 존재 확인
ls -la data/mock/day6/
# context.jsonl, glossary.csv, style_corpus.csv, style_rules.yaml 확인
```

**Qdrant 연결 문제**:
```bash
# Qdrant 실행 확인
docker compose ps qdrant

# Qdrant API 테스트
curl http://localhost:6333/
```

**ONNX 모델 문제**:
```bash
# stub 모드로 전환 (.env 수정)
cd backend
echo "EMBEDDING_BACKEND=stub" >> .env

# 서버 재시작
uv run uvicorn app.main:app --reload --port 8000
```

### CSV 배치 업로드 문제

**파일 형식 오류**:
- UTF-8 인코딩 확인
- CSV 헤더 확인: title, feature_name 필수
- 최대 파일 크기: 1MB

**Device ID 오류**:
```bash
# Device Taxonomy 확인
docker exec -it dev-postgres-1 psql -U ux_writer -d ux_writer -c \
  "SELECT id, display_name_ko FROM device_taxonomy WHERE active = true;"
```

**트랜잭션 롤백 확인**:
```bash
# 생성된 요청 수 확인
docker exec -it dev-postgres-1 psql -U ux_writer -d ux_writer -c \
  "SELECT COUNT(*) FROM requests WHERE created_at > NOW() - INTERVAL '5 minutes';"
```

---

## ✅ 테스트 완료 체크리스트

### Infrastructure

- [ ] Docker Desktop 실행 중
- [ ] PostgreSQL 컨테이너 실행 중 (포트 5432)
- [ ] Qdrant 컨테이너 실행 중 (포트 6333, 6334)
- [ ] 데이터베이스 마이그레이션 완료 (16개 테이블)
- [ ] 테스트 사용자 생성 완료 (3명)
- [ ] Device Taxonomy 초기 데이터 생성 완료

### Data Ingestion

- [ ] Mock/day6 데이터 선택 가능
- [ ] Ingestion 성공 (10 context + 6 glossary + 10 style)
- [ ] PostgreSQL 데이터 저장 확인
- [ ] Qdrant 벡터 저장 성공 (3개 컬렉션)

### RAG & Translation

- [ ] RAG 검색 작동 (use_rag=true, rag_top_k=3)
- [ ] 관련 컨텍스트 참조 확인
- [ ] Guardrails 적용 확인
- [ ] 다중 버전 생성 확인 (3개 후보)

### Workflow

- [ ] Designer 요청 생성
- [ ] Writer 할당 및 드래프트 생성
- [ ] 상태 전환 (drafting → in_review → approved)
- [ ] Designer 승인/거절

### 신규 기능: CSV 배치 업로드

- [ ] CSV 템플릿 다운로드 작동
- [ ] Writer 선택 드롭다운 작동
- [ ] CSV 파일 업로드 및 미리보기
- [ ] 검증 에러 테이블 표시
- [ ] 최대 30건 제한 작동
- [ ] 트랜잭션 롤백 작동

### 신규 기능: Pagination

- [ ] Pagination 컨트롤 표시 (페이지 번호, 이전/다음)
- [ ] 페이지 이동 작동
- [ ] 페이지 크기 변경 (10/20/30/50)
- [ ] Status 필터 + Pagination 조합
- [ ] 전체 건수 표시
- [ ] API 응답에 pagination 메타데이터 포함

### 신규 기능: 통계 API

- [ ] Designer별 통계 표시
- [ ] Status별 통계 표시 (needs_revision, cancelled 포함)
- [ ] Writer/Admin만 접근 가능

### 신규 기능: Comments 시스템

- [ ] Request에 댓글 작성
- [ ] Draft version별 댓글 작성
- [ ] 댓글 목록 조회
- [ ] 댓글 해결(Resolve) 기능
- [ ] Activity Timeline에 통합 표시

### 신규 기능: Request Cancellation

- [ ] Designer가 자신의 요청 취소 가능
- [ ] drafting/needs_revision 상태에서만 취소 가능
- [ ] 취소 사유 입력 (선택사항)
- [ ] 권한 검증 (본인만 취소 가능)

### 신규 기능: Device Management (Admin)

- [ ] Device 목록 조회 (active/inactive 필터)
- [ ] 새 Device 생성 (ID 패턴 검증)
- [ ] Device 수정 (한글명/영문명/카테고리)
- [ ] Device 비활성화/삭제
- [ ] Request 생성 시 active 디바이스만 선택 가능

### 신규 기능: Approved Requests Download

- [ ] 승인된 요청 목록 조회 (필터링)
- [ ] 기간/Writer/Device 필터 작동
- [ ] Excel 다운로드 기능
- [ ] Excel 파일 포맷 확인 (헤더, 데이터)

### 신규 기능: Selected Draft Version

- [ ] Writer가 드래프트 버전 선택
- [ ] Selected 배지 표시
- [ ] 선택 변경 시 이전 선택 해제
- [ ] Designer가 선택된 버전만 승인/거절 가능

### 신규 기능: User List

- [ ] 모든 역할에서 사용자 목록 조회 가능
- [ ] 이름순 정렬
- [ ] Request 할당 시 드롭다운에 사용

### UI/UX

- [ ] 역할 전환 작동 (Designer/Writer/Admin)
- [ ] 데이터 소스 선택 UI 작동
- [ ] 드래프트 메타데이터 표시 (RAG 정보)
- [ ] Activity Timeline 통합 표시 (댓글, 승인, 상태변경)
- [ ] 에러 핸들링 및 메시지 표시
- [ ] 반응형 디자인 확인

---

## 🎉 성공 기준

모든 체크리스트 항목이 완료되고 다음을 확인:

1. **Mock/day6 데이터** 완전 로드 (10+6+10)
2. **RAG 활성화** 및 관련 문서 검색
3. **Designer → Writer → Designer 워크플로우** 완전 동작
4. **Guardrails 및 스타일 가이드** 자동 적용
5. **벡터 저장소(Qdrant)** 정상 작동
6. **CSV 배치 업로드** 기능 완전 동작
7. **Pagination** 기능 완전 동작
8. **통계 API** 정상 작동
9. **Comments 시스템** 정상 작동 (Activity Timeline 통합)
10. **Request Cancellation** 기능 및 권한 검증
11. **Device Management** (Admin) CRUD 작동
12. **Approved Requests Download** 및 Excel 다운로드
13. **Selected Draft Version** 선택 및 표시
14. **Request Status 확장** (needs_revision, cancelled)

---

## 📚 참고 자료

- **CSV_BATCH_UPLOAD_IMPLEMENTATION_PLAN.md**: CSV 배치 업로드 구현 계획
- **IMPLEMENTATION_PLAN.md**: 전체 구현 계획
- **README.md**: 프로젝트 개요 및 설정
- **CLAUDE.md**: 개발 가이드

---

## 🛑 테스트 완료 후 서버 종료

```bash
# Frontend
Ctrl+C in fe-test terminal

# Backend
Ctrl+C in backend terminal

# Docker (선택사항 - 데이터 보존)
cd infra/dev
docker compose stop

# Docker (데이터 삭제)
cd infra/dev
docker compose down -v
```

---

## 📝 테스트 결과 기록 템플릿

```
## E2E 테스트 결과

**테스트 날짜**: YYYY-MM-DD
**테스터**: [이름]
**환경**: Windows/Mac/Linux

### Infrastructure
- Docker: ✅/❌
- PostgreSQL: ✅/❌ (버전: ___)
- Qdrant: ✅/❌ (버전: ___)

### Data Ingestion
- Context: ✅/❌ (10개)
- Glossary: ✅/❌ (6개)
- Style: ✅/❌ (10개)

### Workflow
- Request Creation: ✅/❌
- Draft Generation: ✅/❌
- RAG Retrieval: ✅/❌
- Approval: ✅/❌

### 신규 기능
- CSV Batch Upload: ✅/❌
- Pagination: ✅/❌
- Statistics API: ✅/❌

### 발견된 이슈
1. [이슈 설명]
2. ...

### 추가 노트
[자유 기술]
```

---

**문서 버전**: 2.0.0
**최종 업데이트**: 2025-01-19
**작성자**: Claude Code

**주요 변경 사항 (v2.0.0)**:
- ✅ Request Status 확장 (needs_revision, cancelled 추가)
- ✅ Comments 시스템 추가 (Activity Timeline 통합)
- ✅ Request Cancellation 기능 추가
- ✅ Device Management (Admin) 추가
- ✅ Approved Requests Download 기능 추가
- ✅ Selected Draft Version 기능 추가
- ✅ User List API 추가
- ✅ 테이블 개수 업데이트 (15개 → 16개)
