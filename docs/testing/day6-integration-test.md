# 🚀 Production-Level 테스트 완전 상세 가이드

## 1단계: 인프라 준비 및 Docker 서비스 시작

### 1.1 Docker 컨테이너 시작
```bash
cd C:/Users/yoons/works/ux-writer-assistant-lab/infra/dev
docker compose up -d
```

### 1.2 컨테이너 상태 확인
```bash
docker compose ps
# PostgreSQL (5432), Qdrant (6333, 6334) 포트 확인
```

### 1.3 데이터베이스 연결 테스트
```bash
cd ../../backend
# PostgreSQL 연결 확인
psql postgresql://ux_writer:ux_writer@localhost:5432/ux_writer -c "SELECT version();"
```

### 1.4 데이터베이스 마이그레이션
```bash
cd backend
uv venv .venv
uv pip install -e .[dev]
uv run alembic upgrade head
```

## 2단계: Mock 데이터 적재

### 2.1 테스트 사용자 생성
```bash
cd backend
uv run python scripts/seed_users.py
# designer-1, writer-1, admin-1 계정 생성 확인
```

### 2.2 Mock 데이터 ingestion (ONNX 모델 사용)
```bash
# 백엔드 임시 시작 (데이터 적재용)
uv run uvicorn app.main:app --port 8000 &
BACKEND_PID=$!

# Mock 데이터 적재 (새로 생성한 데이터 사용)
curl -X POST "http://localhost:8000/v1/ingest" \
     -H "Content-Type: application/json" \
     -d '{"path": "data/mock/day6"}'

# 응답에서 vector_store.status가 "completed"인지 확인
kill $BACKEND_PID
```

### 2.3 벡터 데이터 검증
```bash
# Qdrant 컬렉션 확인
curl http://localhost:6333/collections
# style_guides, glossary_terms, context_snippets 존재 확인
```

## 3단계: 백엔드 서버 시작

### 3.1 환경 변수 확인
```bash
cd backend
cat .env | grep -E "(EMBEDDING_BACKEND|EMBEDDING_ONNX_PATH)"
# EMBEDDING_BACKEND=onnx
# EMBEDDING_ONNX_PATH=C:/Users/yoons/models/bge-m3-onnx/model.onnx 확인
```

### 3.2 백엔드 서버 시작
```bash
uv run uvicorn app.main:app --reload --port 8000
# 로그에서 "Loaded ONNX embedding model" 메시지 확인
```

### 3.3 API 상태 검증
```bash
# 새 터미널에서
curl http://localhost:8000/health
# {"status":"ok"} 응답 확인

# RAG 기능 테스트
curl -X POST "http://localhost:8000/v1/retrieve" \
     -H "Content-Type: application/json" \
     -d '{"query": "charging", "use_rag": true, "topK": 3}'
# novelty_mode: true 확인 (ONNX 모델 사용 중)
```

## 4단계: Next.js 프론트엔드 설정 및 시작

### 4.1 환경 변수 설정
```bash
cd frontend
cp .env.example .env.local

# .env.local 내용 확인
cat .env.local
# NEXT_PUBLIC_API_BASE=http://localhost:8000
# NEXT_PUBLIC_API_ROLE=designer  
# NEXT_PUBLIC_API_USER_ID=designer-1
```

### 4.2 프론트엔드 의존성 설치 및 시작
```bash
pnpm install
pnpm dev
# http://localhost:3000 에서 서비스 시작
```

### 4.3 프론트엔드 연결 확인
```bash
# 브라우저에서 http://localhost:3000 접속
# 네트워크 탭에서 API 호출 정상 여부 확인
```

## 5단계: Production-Level E2E 워크플로우 테스트

### 5.1 디자이너 역할 테스트
**목표**: 새 요청 생성 및 작성자 할당

1. **요청 생성**:
   - http://localhost:3000/requests/new 접속
   - 제목: "로봇청소기 충전 완료 메시지"
   - 기능명: "charging_complete"
   - 제약사항: "40자 이내, 친근한 톤"
   - 할당 작성자: writer-1
   - 요청 생성 버튼 클릭

2. **요청 목록 확인**:
   - 워크스페이스에서 생성된 요청 확인
   - 상태가 "pending" 인지 확인

### 5.2 작성자 역할 테스트  
**목표**: AI 드래프트 생성 및 RAG 활용

1. **역할 전환**:
   ```bash
   # .env.local 수정
   NEXT_PUBLIC_API_ROLE=writer
   NEXT_PUBLIC_API_USER_ID=writer-1
   # 브라우저 새로고침
   ```

2. **AI 드래프트 생성**:
   - 할당된 요청 클릭
   - "Generate AI Draft" 버튼 클릭
   - RAG 컨텍스트 활용 확인:
     * 로봇청소기 관련 mock 데이터 참조
     * 스타일 가이드 적용
     * 용어집(glossary) 활용

3. **가드레일 검증**:
   - 생성된 드래프트에서 금지 용어 체크
   - 길이 제한 (100자) 준수 확인
   - 자동 용어 교체 확인 ("charger" → "charging station")

### 5.3 승인 워크플로우 테스트
**목표**: 검토, 피드백, 최종 승인

1. **디자이너 역할로 복귀**:
   ```bash
   # .env.local 복원
   NEXT_PUBLIC_API_ROLE=designer
   NEXT_PUBLIC_API_USER_ID=designer-1
   ```

2. **드래프트 검토**:
   - 생성된 드래프트 확인
   - 댓글 기능 테스트
   - 수정 요청 또는 승인 처리

3. **최종 승인**:
   - 승인 버튼 클릭
   - 요청 상태가 "approved"로 변경 확인

## 6단계: 고급 테스트 시나리오

### 6.1 다양한 디바이스 테스트
- 공기청정기 관련 요청 생성
- Mock 데이터의 다른 시나리오 활용

### 6.2 가드레일 스트레스 테스트
- 의도적으로 금지 용어 포함한 요청
- 길이 제한 초과하는 텍스트
- 교체 규칙 동작 확인

### 6.3 RAG 성능 테스트
- 다양한 키워드로 retrieve API 테스트
- ONNX vs stub 모드 성능 비교
- 벡터 유사도 점수 검증

이 가이드를 통해 실제 production 환경과 동일한 조건에서 전체 시스템을 완전히 검증할 수 있습니다.