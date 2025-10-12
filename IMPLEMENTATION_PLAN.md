# Complete UX Writer Assistant Frontend & RBAC Implementation Plan

## 프로젝트 개요

UX Writer Assistant의 완전한 Designer ↔ Writer 워크플로우 구현 및 역할 기반 접근 제어(RBAC) 시스템 완성.

## 현재 상태 분석

### Backend (완료됨)
- ✅ Request/Draft/Approval/Comment 워크플로우 API
- ✅ Header 기반 RBAC 시스템 (`X-User-Role`, `X-User-Id`)
- ✅ 완전한 데이터베이스 모델 및 서비스 로직

### Frontend (현재 상태)
- ❌ 기본 Ingest/Retrieve/Translate 페이지만 존재
- ❌ UX Designer ↔ Writer 워크플로우 미구현
- ❌ 역할 기반 UI 없음
- ❌ 사용자 친화적 인증 시스템 없음

## Phase 1-2 구현 목표

### Phase 1: 핵심 워크플로우 페이지 (High Priority)
1. Designer Dashboard - 요청 생성/관리 
2. Writer Dashboard - 할당된 요청 작업
3. Admin Dashboard - 시스템 관리
4. 역할 전환 메커니즘

### Phase 2: 완전한 워크플로우 (Medium Priority) 
1. AI 드래프트 생성 통합
2. 승인/거절 워크플로우
3. 상태 업데이트 및 알림
4. 코멘트 시스템 연동

---

## 상세 구현 계획 (코드 기준)

### 1. 프론트엔드 구조 개편

#### 1.1 앱 구조 변경
**파일**: `fe-test/src/main.tsx`
```typescript
// 기존: 단순 탭 기반 → 역할 기반 라우팅으로 변경
function App() {
  const { currentUser } = useUser();
  
  if (!currentUser) return <RoleSelector />;
  
  switch (currentUser.role) {
    case 'designer': return <DesignerDashboard />;
    case 'writer': return <WriterDashboard />;
    case 'admin': return <AdminDashboard />;
  }
}
```

#### 1.2 새로운 컴포넌트 구조
```
fe-test/src/
├── components/
│   ├── RoleSelector.tsx        # 역할 전환 컴포넌트
│   ├── UserContext.tsx         # 사용자 컨텍스트
│   ├── RequestCard.tsx         # 요청 카드 컴포넌트
│   ├── DraftList.tsx          # 드래프트 목록
│   └── StatusBadge.tsx        # 상태 표시 배지
├── pages/
│   ├── DesignerDashboard.tsx   # 디자이너 대시보드
│   ├── WriterDashboard.tsx     # 라이터 대시보드
│   ├── AdminDashboard.tsx      # 관리자 대시보드
│   ├── RequestDetail.tsx       # 요청 상세/작업 페이지
│   ├── RequestCreate.tsx       # 요청 생성 페이지
│   ├── Ingest.tsx             # (기존) → Admin 전용
│   ├── Retrieve.tsx           # (기존) → Admin 전용
│   └── Translate.tsx          # (기존) → Admin 전용
└── hooks/
    ├── useRequests.tsx         # 요청 데이터 훅
    └── useDrafts.tsx          # 드래프트 데이터 훅
```

### 2. API 클라이언트 확장

#### 2.1 타입 정의 확장
**파일**: `fe-test/src/lib/api.ts`
```typescript
// 기존 TranslateRequest/Response 외에 추가
export interface User {
  id: string;
  role: 'designer' | 'writer' | 'admin';
  name: string;
  email: string;
}

export interface RequestSummary {
  id: string;
  title: string;
  feature_name: string;
  status: 'drafting' | 'in_review' | 'approved' | 'rejected';
  assigned_writer_id?: string;
  created_at: string;
  updated_at: string;
  draft_count: number;
}

export interface RequestDetail extends RequestSummary {
  context_description?: string;
  tone?: string;
  style_preferences?: string;
  constraints_json?: any;
}

export interface DraftVersion {
  id: string;
  version_index: number;
  content: string;
  metadata_json?: any;
  created_at: string;
}

export interface Draft {
  id: string;
  request_id: string;
  llm_run_id?: string;
  generation_method: 'ai' | 'manual';
  created_by: string;
  created_at: string;
  versions: DraftVersion[];
  request_status: string;
}

export interface CreateRequestPayload {
  title: string;
  feature_name: string;
  context_description?: string;
  tone?: string;
  style_preferences?: string;
  constraints?: any;
  assigned_writer_id?: string;
}

export interface CreateDraftPayload {
  request_id: string;
  text: string;
  source_language: string;
  target_language: string;
  hints?: any;
  glossary?: Record<string, string>;
  num_candidates?: number;
  use_rag?: boolean;
  rag_top_k?: number;
  temperature?: number;
}
```

#### 2.2 API 함수 추가
**파일**: `fe-test/src/lib/api.ts`
```typescript
// 현재 사용자 컨텍스트에서 헤더 자동 주입
function getAuthHeaders() {
  const user = getCurrentUser();
  return {
    'X-User-Role': user.role,
    'X-User-Id': user.id,
  };
}

export async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// 요청 관련 API
export const createRequest = (payload: CreateRequestPayload) => 
  apiCall<RequestDetail>('/v1/requests', { method: 'POST', body: JSON.stringify(payload) });

export const getRequests = () => 
  apiCall<{items: RequestSummary[]}>('/v1/requests');

export const getRequest = (id: string) => 
  apiCall<RequestDetail>(`/v1/requests/${id}`);

// 드래프트 관련 API  
export const generateDraft = (payload: CreateDraftPayload) => 
  apiCall<Draft>('/v1/drafts', { method: 'POST', body: JSON.stringify(payload) });

// 승인 관련 API
export const createApproval = (payload: {request_id: string, decision: 'approved'|'rejected', comment?: string}) => 
  apiCall('/v1/approvals', { method: 'POST', body: JSON.stringify(payload) });
```

### 3. 핵심 컴포넌트 구현

#### 3.1 역할 선택 및 사용자 컨텍스트
**파일**: `src/components/UserContext.tsx`
```typescript
const MOCK_USERS = [
  { id: 'designer-1', role: 'designer' as const, name: 'Alice Kim', email: 'alice@company.com' },
  { id: 'writer-1', role: 'writer' as const, name: 'Bob Lee', email: 'bob@company.com' },
  { id: 'admin-1', role: 'admin' as const, name: 'Admin', email: 'admin@company.com' },
];

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  const switchUser = (userId: string) => {
    const user = MOCK_USERS.find(u => u.id === userId);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  return (
    <UserContext.Provider value={{ currentUser, switchUser, availableUsers: MOCK_USERS }}>
      {children}
    </UserContext.Provider>
  );
};
```

**파일**: `src/components/RoleSelector.tsx`
```typescript
export function RoleSelector() {
  const { currentUser, switchUser, availableUsers } = useUser();
  
  return (
    <div style={{ padding: 20 }}>
      <h2>사용자 선택</h2>
      <div style={{ display: 'flex', gap: 12, flexDirection: 'column', maxWidth: 300 }}>
        {availableUsers.map(user => (
          <button 
            key={user.id}
            onClick={() => switchUser(user.id)}
            style={{ 
              padding: 12, 
              border: currentUser?.id === user.id ? '2px solid blue' : '1px solid gray',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            <strong>{user.name}</strong><br/>
            <small>{user.role.toUpperCase()}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
```

#### 3.2 Designer Dashboard
**파일**: `src/pages/DesignerDashboard.tsx`
```typescript
export function DesignerDashboard() {
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [filter, setFilter] = useState<'all' | 'drafting' | 'in_review' | 'approved'>('all');
  
  useEffect(() => {
    getRequests().then(data => setRequests(data.items));
  }, []);

  const filteredRequests = requests.filter(req => 
    filter === 'all' || req.status === filter
  );

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Designer Dashboard</h1>
        <UserSwitcher />
      </div>
      
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => window.location.hash = 'create-request'}>
          새 요청 생성
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>필터: </label>
        <select value={filter} onChange={e => setFilter(e.target.value as any)}>
          <option value="all">전체</option>
          <option value="drafting">작성중</option>
          <option value="in_review">검토중</option>
          <option value="approved">승인됨</option>
        </select>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {filteredRequests.map(request => (
          <RequestCard 
            key={request.id} 
            request={request} 
            onClick={() => window.location.hash = `request/${request.id}`}
          />
        ))}
      </div>
    </div>
  );
}
```

#### 3.3 Writer Dashboard
**파일**: `src/pages/WriterDashboard.tsx`
```typescript
export function WriterDashboard() {
  const [assignedRequests, setAssignedRequests] = useState<RequestSummary[]>([]);
  const { currentUser } = useUser();
  
  useEffect(() => {
    getRequests().then(data => {
      // 나에게 할당된 요청만 필터링
      const myRequests = data.items.filter(req => 
        req.assigned_writer_id === currentUser?.id
      );
      setAssignedRequests(myRequests);
    });
  }, [currentUser]);

  const draftingRequests = assignedRequests.filter(req => req.status === 'drafting');
  const reviewRequests = assignedRequests.filter(req => req.status === 'in_review');

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Writer Dashboard</h1>
        <UserSwitcher />
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        <section>
          <h2>작업 대기중 ({draftingRequests.length})</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {draftingRequests.map(request => (
              <RequestCard 
                key={request.id} 
                request={request}
                onClick={() => window.location.hash = `work/${request.id}`}
                showDraftButton={true}
              />
            ))}
          </div>
        </section>

        <section>
          <h2>검토중 ({reviewRequests.length})</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {reviewRequests.map(request => (
              <RequestCard 
                key={request.id} 
                request={request}
                onClick={() => window.location.hash = `work/${request.id}`}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
```

#### 3.4 Admin Dashboard  
**파일**: `src/pages/AdminDashboard.tsx`
```typescript
export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'system'>('overview');
  
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Admin Dashboard</h1>
        <UserSwitcher />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setActiveTab('overview')}>전체 현황</button>
        <button onClick={() => setActiveTab('system')}>시스템 관리</button>
      </div>

      {activeTab === 'overview' && (
        <AdminOverview />
      )}
      
      {activeTab === 'system' && (
        <div>
          <h2>시스템 관리</h2>
          <div style={{ display: 'flex', gap: 12, margin: '20px 0' }}>
            <button onClick={() => setActiveTab('ingest')}>Ingest</button>
            <button onClick={() => setActiveTab('retrieve')}>Retrieve</button>
            <button onClick={() => setActiveTab('translate')}>Translate</button>
          </div>
          
          {/* 기존 Ingest/Retrieve/Translate 컴포넌트를 여기에 임베드 */}
          <Ingest />
          <Retrieve />
          <Translate />
        </div>
      )}
    </div>
  );
}
```

#### 3.5 요청 상세/작업 페이지
**파일**: `src/pages/RequestDetail.tsx`
```typescript
export function RequestDetail({ requestId, mode }: { requestId: string, mode: 'view' | 'work' }) {
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const { currentUser } = useUser();
  
  // AI 드래프트 생성 상태
  const [draftText, setDraftText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('ko');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    getRequest(requestId).then(setRequest);
    // TODO: 드래프트 목록 API 추가 필요
  }, [requestId]);

  const handleGenerateDraft = async () => {
    if (!request || !draftText.trim()) return;
    
    setGenerating(true);
    try {
      const result = await generateDraft({
        request_id: request.id,
        text: draftText,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        num_candidates: 3,
      });
      
      // 생성된 드래프트를 목록에 추가
      setDrafts(prev => [result, ...prev]);
      setRequest(prev => prev ? {...prev, status: 'in_review'} : null);
      
    } catch (error) {
      alert('드래프트 생성 실패: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleApproval = async (decision: 'approved' | 'rejected') => {
    if (!request) return;
    
    try {
      await createApproval({
        request_id: request.id,
        decision,
        comment: prompt(`${decision === 'approved' ? '승인' : '거절'} 사유를 입력하세요:`) || undefined
      });
      
      setRequest(prev => prev ? {...prev, status: decision} : null);
      alert(`요청이 ${decision === 'approved' ? '승인' : '거절'}되었습니다.`);
      
    } catch (error) {
      alert('처리 실패: ' + error.message);
    }
  };

  if (!request) return <div>로딩중...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      <button onClick={() => history.back()}>← 돌아가기</button>
      
      <h1>{request.title}</h1>
      <p><strong>기능:</strong> {request.feature_name}</p>
      <p><strong>상태:</strong> <StatusBadge status={request.status} /></p>
      {request.context_description && <p><strong>설명:</strong> {request.context_description}</p>}
      
      {/* Writer 모드: AI 드래프트 생성 */}
      {mode === 'work' && currentUser?.role === 'writer' && request.status === 'drafting' && (
        <section style={{ border: '1px solid #ccc', padding: 16, margin: '20px 0' }}>
          <h3>AI 드래프트 생성</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <textarea
              placeholder="번역할 텍스트를 입력하세요"
              value={draftText}
              onChange={e => setDraftText(e.target.value)}
              rows={4}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                placeholder="소스 언어" 
                value={sourceLanguage}
                onChange={e => setSourceLanguage(e.target.value)}
              />
              <input 
                placeholder="타겟 언어"
                value={targetLanguage} 
                onChange={e => setTargetLanguage(e.target.value)}
              />
            </div>
            <button 
              onClick={handleGenerateDraft} 
              disabled={generating || !draftText.trim()}
            >
              {generating ? '생성중...' : 'AI 드래프트 생성'}
            </button>
          </div>
        </section>
      )}

      {/* Designer 모드: 승인/거절 */}
      {mode === 'view' && currentUser?.role === 'designer' && request.status === 'in_review' && (
        <section style={{ border: '1px solid #ccc', padding: 16, margin: '20px 0' }}>
          <h3>검토 및 승인</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              onClick={() => handleApproval('approved')}
              style={{ background: 'green', color: 'white', padding: '8px 16px' }}
            >
              승인
            </button>
            <button 
              onClick={() => handleApproval('rejected')}
              style={{ background: 'red', color: 'white', padding: '8px 16px' }}
            >
              거절
            </button>
          </div>
        </section>
      )}

      {/* 드래프트 목록 */}
      <section>
        <h3>드래프트 목록 ({drafts.length})</h3>
        <DraftList drafts={drafts} />
      </section>
    </div>
  );
}
```

### 4. 라우팅 및 상태 관리

#### 4.1 해시 기반 라우팅
**파일**: `src/main.tsx`
```typescript
function App() {
  const { currentUser } = useUser();
  const [route, setRoute] = useState(() => window.location.hash);
  
  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (!currentUser) {
    return <RoleSelector />;
  }

  // 라우팅 로직
  if (route.startsWith('#request/')) {
    const requestId = route.split('/')[1];
    return <RequestDetail requestId={requestId} mode="view" />;
  }
  
  if (route.startsWith('#work/')) {
    const requestId = route.split('/')[1];
    return <RequestDetail requestId={requestId} mode="work" />;
  }
  
  if (route === '#create-request') {
    return <RequestCreate />;
  }

  // 기본 대시보드
  switch (currentUser.role) {
    case 'designer': return <DesignerDashboard />;
    case 'writer': return <WriterDashboard />;
    case 'admin': return <AdminDashboard />;
    default: return <RoleSelector />;
  }
}
```

## 기존 페이지들의 Admin 전용 설정 이유

### Ingest 페이지
- 시스템 전체의 데이터를 메모리에 로드하는 관리 기능
- 모든 사용자의 워크플로우에 영향을 미치는 시스템 레벨 작업
- 일반 Designer/Writer가 할 필요가 없는 기술적 관리 작업

### Retrieve 페이지
- RAG 시스템의 low-level 검색 기능 테스트
- 실제 워크플로우에서는 AI 드래프트 생성 시 자동으로 사용됨
- Designer/Writer가 직접 사용할 필요 없는 개발/디버깅 도구

### Translate 페이지
- 원시 번역 기능의 직접 테스트
- 실제 워크플로우에서는 Draft 생성 과정에 통합됨
- 일반 사용자가 직접 사용하기에는 너무 기술적

### 최종 구조
```
- Designer Dashboard: 요청 생성/관리, 승인/거절
- Writer Dashboard: 할당된 요청 작업, AI 드래프트 생성  
- Admin Dashboard: 
  - 시스템 관리 (Ingest/Retrieve/Translate)
  - 전체 요청 모니터링
  - 사용자 관리
```

이 계획을 통해 완전한 UX Writer Assistant 워크플로우를 구현할 수 있습니다.