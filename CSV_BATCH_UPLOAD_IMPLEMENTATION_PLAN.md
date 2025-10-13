# CSV 배치 업로드 및 Pagination 구현 계획

## 📋 요구사항 분석

### 1. CSV 배치 업로드 (최대 30건)
- Designer가 **먼저 Writer를 선택**하고 CSV 업로드
- CSV에는 writer 정보 없이 request 내용만 포함
- 선택한 writer가 모든 request에 일괄 할당
- 건별 데이터 정합성 체크
- 한 건이라도 문제 있으면 전체 거부

### 2. Writer Workspace 개선
- Designer별 request 필터링 및 통계
- 전체/Designer별 건수 표시

### 3. Pagination
- Request 리스트 페이징

### 4. 샘플 CSV 제공
- 테스트용 샘플 CSV 파일 생성

---

## 🏗️ 구현 계획 (6개 Phase + 샘플)

### Phase 1: Backend - CSV 검증 유틸리티
**목적**: CSV 파일 파싱 및 검증 로직

**작업**:
1. `backend/app/services/requests/csv_validator.py` 생성
   - CSV 파일 파싱 (pandas 또는 csv 모듈 사용)
   - **필수 필드 검증**: `title`, `feature_name`
   - **선택 필드**: `context_description`, `source_text`, `tone`, `style_preferences`, `device`
   - ⚠️ `assigned_writer_id` 필드는 CSV에 없음 (UI에서 선택)
   - 최대 30건 제한
   - 데이터 타입 검증
   - Device ID 유효성 검증 (DeviceTaxonomy 테이블 조회)
   - 빈 행 무시

2. 검증 결과 구조
```python
@dataclass
class CSVRow:
    row_number: int
    title: str
    feature_name: str
    context_description: Optional[str]
    source_text: Optional[str]
    tone: Optional[str]
    style_preferences: Optional[str]
    device: Optional[str]

@dataclass
class CSVValidationError:
    row_number: int
    field: Optional[str]
    error: str

@dataclass
class CSVValidationResult:
    is_valid: bool
    total_rows: int
    valid_rows: List[CSVRow]
    errors: List[CSVValidationError]
```

**예상 시간**: 2-3시간

---

### Phase 2: Backend - 배치 Request 생성 API
**목적**: CSV 파일 업로드 및 배치 생성

**작업**:
1. `POST /v1/requests/batch` endpoint 생성
   - **Request**:
     - Multipart form-data로 CSV 파일 수신
     - `assigned_writer_id`: Optional[str] (form field 또는 query parameter)
   - **처리 로직**:
     1. CSV 검증 (Phase 1 유틸리티 사용)
     2. Writer ID 검증 (제공된 경우)
     3. **트랜잭션**: 한 건이라도 실패 시 전체 롤백
     4. 모든 request에 동일한 `assigned_writer_id` 적용
     5. Feature auto-normalization (device 있을 때)
   - **권한**: Designer만 접근

2. Response 구조
```python
class BatchCreateResponse(BaseModel):
    success: bool
    created_count: int
    created_request_ids: List[str]
    errors: Optional[List[Dict[str, Any]]]  # 검증 에러 상세
    validation_summary: Optional[Dict[str, Any]]
```

**트랜잭션 처리**:
```python
try:
    with session.begin():  # 자동 롤백
        created_ids = []
        for row in validated_rows:
            request = create_request(
                session,
                title=row.title,
                feature_name=row.feature_name,
                requested_by=current_user,
                assigned_writer=assigned_writer,
                ...
            )
            created_ids.append(request.id)
        return BatchCreateResponse(
            success=True,
            created_count=len(created_ids),
            created_request_ids=created_ids
        )
except Exception as e:
    # 롤백 자동 처리
    raise HTTPException(...)
```

**예상 시간**: 2-3시간

---

### Phase 3: Backend - Pagination 및 필터링 강화
**목적**: Request 리스트 API에 pagination 및 designer 필터 추가

**작업**:
1. `GET /v1/requests` 수정
   - **Pagination 파라미터**:
     - `page`: 페이지 번호 (기본 1)
     - `page_size`: 페이지당 항목 수 (기본 20, 최대 50)
   - **필터 파라미터**:
     - `requested_by`: Designer ID로 필터링
     - `assigned_writer_id`: Writer ID로 필터링
     - `status`: 기존 status 필터 유지
   - **정렬**: `created_at DESC` (최신순)

2. Response 구조 변경
```python
class PaginationMeta(BaseModel):
    total_count: int
    page: int
    page_size: int
    total_pages: int

class RequestListResponse(BaseModel):
    items: List[RequestSummary]
    pagination: PaginationMeta
```

3. SQL 쿼리 최적화
```python
# Total count (filtering 포함)
total = session.query(func.count(Request.id)).filter(...).scalar()

# Paginated results
offset = (page - 1) * page_size
records = session.query(Request).filter(...).order_by(
    Request.created_at.desc()
).offset(offset).limit(page_size).all()
```

**예상 시간**: 1-2시간

---

### Phase 4: Backend - Designer별 통계 API
**목적**: Writer가 designer별 request 건수를 볼 수 있는 API

**작업**:
1. `GET /v1/requests/statistics` endpoint 생성
   - Writer/Admin만 접근 가능
   - 전체 request 수
   - Designer별 request 수 (상위 10명)
   - Status별 request 수

2. Response 구조
```python
class DesignerStatistics(BaseModel):
    designer_id: str
    designer_name: str
    designer_email: str
    request_count: int

class RequestStatistics(BaseModel):
    total_count: int
    by_designer: List[DesignerStatistics]
    by_status: Dict[str, int]  # {"drafting": 5, "in_review": 3, ...}
```

3. SQL 쿼리
```python
# Designer별 집계
stmt = (
    select(
        Request.requested_by,
        User.name,
        User.email,
        func.count(Request.id).label('count')
    )
    .join(User, Request.requested_by == User.id)
    .group_by(Request.requested_by, User.name, User.email)
    .order_by(func.count(Request.id).desc())
    .limit(10)
)
```

**예상 시간**: 1시간

---

### Phase 5: Frontend - CSV 업로드 UI
**목적**: Designer가 writer 선택 후 CSV 파일로 배치 업로드

**작업**:
1. `fe-test/src/pages/RequestBatchCreate.tsx` 생성

**UI 구성** (순서대로):

```
┌─────────────────────────────────────────────┐
│ 배치 Request 생성                            │
├─────────────────────────────────────────────┤
│ Step 1: Writer 선택 (선택사항)               │
│ [Writer 드롭다운] ▼                          │
│ └─ "자동 할당" 또는 writer 목록              │
│                                              │
│ Step 2: CSV 파일 업로드                      │
│ [파일 선택] [CSV 템플릿 다운로드]            │
│                                              │
│ Step 3: 미리보기 (파일 선택 후)              │
│ ┌────────────────────────────────────────┐ │
│ │ Title | Feature | Context | Device ... │ │
│ │ 청소 시작 | Start | 버튼을... | robot_...│ │
│ │ 충전 복귀 | Return | 배터리... | robot...│ │
│ └────────────────────────────────────────┘ │
│                                              │
│ [업로드 및 생성] 버튼                        │
└─────────────────────────────────────────────┘
```

**기능**:
- Writer 드롭다운: API로 writer 목록 로드
- CSV 템플릿 다운로드 버튼
  - 샘플 데이터 포함된 CSV 생성
  - 파일명: `request_template_example.csv`
- CSV 파일 선택
  - 클라이언트 검증: `.csv` 확장자, 최대 1MB
  - 파싱 후 테이블로 미리보기 (최대 5행)
- 업로드 버튼
  - FormData로 파일 + writer_id 전송
  - 진행 상태 표시 (Loading spinner)
  - 성공: "30건이 생성되었습니다" + request 목록으로 이동
  - 실패: 에러 테이블 표시 (행 번호, 필드, 에러 메시지)

2. `RequestCreate.tsx`에 링크 추가
   - "배치로 여러 건 업로드" 버튼 추가

**예상 시간**: 4-5시간

---

### Phase 6: Frontend - Pagination 및 필터링 UI
**목적**: Request 리스트에 pagination 및 designer 필터 추가

**작업**:

1. **공통 컴포넌트 생성**:
   - `fe-test/src/components/Pagination.tsx`
   ```tsx
   <Pagination
     currentPage={page}
     totalPages={totalPages}
     onPageChange={setPage}
   />
   ```

2. **Request 리스트 개선**:
   - 필터 영역 추가
   ```
   ┌─────────────────────────────────────┐
   │ 필터: [Designer ▼] [Status ▼]      │
   │ 전체 120건 | Kim 디자이너 15건      │
   └─────────────────────────────────────┘
   ```
   - Pagination 컨트롤 하단 추가
   ```
   ┌─────────────────────────────────────┐
   │ [이전] 1 2 3 4 5 [다음]             │
   │ 페이지당 [20▼] 건                   │
   └─────────────────────────────────────┘
   ```

3. **Custom Hook**:
   - `fe-test/src/hooks/usePaginatedRequests.ts`
   ```tsx
   const {
     requests,
     pagination,
     loading,
     filters,
     setPage,
     setFilters,
     refresh
   } = usePaginatedRequests();
   ```

4. **통계 표시 컴포넌트**:
   - Writer용: Designer별 request 수 표시
   - "전체 {total}건" 항상 표시
   - 필터 선택 시: "| {designer_name} {count}건"

**적용 위치**:
- Designer의 request 목록
- Writer workspace
- Admin dashboard

**예상 시간**: 3-4시간

---

### Phase 7: 샘플 CSV 파일 생성
**목적**: 테스트 및 사용자 가이드용 샘플 CSV 제공

**작업**:

1. **백엔드에 샘플 파일 저장**:
   - `backend/sample_data/request_batch_template.csv` 생성
   - 실제 사용 가능한 예시 데이터 10건 포함

2. **샘플 CSV 내용**:
```csv
title,feature_name,context_description,source_text,tone,style_preferences,device
"청소 시작 버튼","Start Cleaning","사용자가 버튼을 눌러 청소 시작","청소를 시작합니다","friendly","concise",robot_vacuum
"충전 복귀","Return to Charge","배터리 부족 시 자동 충전소 복귀","충전소로 돌아갑니다","informative","brief",robot_vacuum
"일시정지","Pause Cleaning","청소 중 일시정지 기능","청소를 일시정지합니다","neutral","short",robot_vacuum
"청소 완료","Cleaning Complete","청소 완료 후 알림 메시지","청소가 완료되었습니다","positive","friendly",robot_vacuum
"장애물 감지","Obstacle Detected","장애물 감지 시 알림","장애물이 감지되었습니다","warning","clear",robot_vacuum
"공기질 양호","Air Quality Good","공기 청정 후 상태 알림","현재 공기질이 양호합니다","positive","reassuring",air_purifier
"필터 교체 알림","Replace Filter","필터 교체 시기 알림","필터를 교체해주세요","neutral","actionable",air_purifier
"자동 모드 실행","Auto Mode On","자동 모드 시작 시 메시지","자동 모드로 실행 중입니다","informative","brief",air_purifier
"조용한 모드","Quiet Mode","조용한 모드 활성화 알림","조용한 모드가 켜졌습니다","gentle","short",air_purifier
"에러 발생","System Error","시스템 오류 발생 시 알림","오류가 발생했습니다. 고객센터에 문의하세요","urgent","helpful",robot_vacuum
```

3. **프론트엔드 다운로드 기능**:
   - "CSV 템플릿 다운로드" 버튼 클릭 시
   - 위 샘플 데이터를 blob으로 생성하여 다운로드
   - 파일명: `request_template_example_YYYYMMDD.csv`

4. **README 문서**:
   - `backend/sample_data/README.md` 생성
   - CSV 형식 설명
   - 필수/선택 필드 설명
   - 제약사항 (최대 30건, device ID 유효성 등)

**예상 시간**: 1시간

---

## 📦 CSV 파일 형식 (최종안)

### 필수 컬럼
- `title`: Request 제목 (최대 255자)
- `feature_name`: 기능명 (최대 255자)

### 선택 컬럼
- `context_description`: 컨텍스트 설명 (텍스트)
- `source_text`: 참고 원문 (텍스트)
- `tone`: 톤 (최대 255자)
- `style_preferences`: 스타일 선호도 (텍스트)
- `device`: Device ID (DeviceTaxonomy 테이블의 ID, 예: `robot_vacuum`)

### ⚠️ 제외된 컬럼
- ~~`assigned_writer_id`~~ → UI에서 일괄 선택

---

## 🔄 구현 순서

1. ✅ **Phase 1**: CSV 검증 유틸리티 (Backend) - 2-3h
2. ✅ **Phase 2**: 배치 생성 API (Backend) - 2-3h
3. ✅ **Phase 3**: Pagination & 필터 API (Backend) - 1-2h
4. ✅ **Phase 4**: 통계 API (Backend) - 1h
5. ✅ **Phase 5**: CSV 업로드 UI (Frontend) - 4-5h
6. ✅ **Phase 6**: Pagination & 필터 UI (Frontend) - 3-4h
7. ✅ **Phase 7**: 샘플 CSV 생성 - 1h

**예상 총 소요 시간**: 14-19시간

---

## 🧪 테스트 시나리오

### Backend
1. ✅ CSV 검증: 필수 필드 누락, device ID 오류, 최대 건수 초과
2. ✅ 배치 생성: 트랜잭션 롤백 (15건 중 10번째 실패 시 0건 생성)
3. ✅ Pagination: offset/limit 정확성, edge case (빈 페이지)
4. ✅ 통계: 집계 정확성, 권한 확인

### Frontend
1. ✅ Writer 선택: 선택 안 함 / 특정 writer 선택
2. ✅ CSV 템플릿 다운로드: 파일 생성 및 다운로드
3. ✅ CSV 업로드: 파일 형식 오류, 크기 제한, 성공 케이스
4. ✅ 에러 표시: 검증 실패 시 행별 에러 테이블
5. ✅ Pagination: 페이지 이동, 페이지 사이즈 변경
6. ✅ 필터링: designer/status 조합

---

## 📝 구현 참고사항

### Backend
- CSV 파싱: Python 표준 `csv` 모듈 사용 (pandas 불필요)
- 트랜잭션: SQLAlchemy `session.begin()` context manager 사용
- 파일 업로드: FastAPI `UploadFile` 사용
- 최대 파일 크기: 1MB 제한

### Frontend
- CSV 파싱: `papaparse` 라이브러리 사용
- 파일 업로드: `FormData` API 사용
- 상태 관리: React hooks (`useState`, `useEffect`)
- 에러 표시: Table 형태로 명확하게

### 데이터베이스
- Request 테이블: 기존 구조 유지
- 트랜잭션 롤백: 일부 실패 시 모두 롤백
- Index: `requested_by`, `assigned_writer_id`, `status`, `created_at`
