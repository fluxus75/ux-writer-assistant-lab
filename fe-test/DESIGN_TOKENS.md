# Day 2 — Design Token & Component Inventory (Draft)

테스트 UI(`fe-test`)는 아직 실서비스가 아니지만, Day 3 이후 Next.js 마이그레이션을 대비해 다음과 같은 토큰/컴포넌트 기준선을 정의한다.

## Foundations
- **Color Palette**
  - Primary: `#1E40AF` (Blue 900)
  - Secondary: `#0EA5E9` (Cyan 500)
  - Accent: `#F97316` (Orange 500)
  - Neutral scale: `#0F172A`, `#1E293B`, `#334155`, `#475569`, `#64748B`, `#CBD5F5`, `#E2E8F0`, `#F8FAFC`
  - Semantic: Success `#16A34A`, Warning `#FACC15`, Error `#DC2626`
- **Typography**
  - Heading XL: 28/36 SemiBold
  - Heading L: 24/32 SemiBold
  - Heading M: 20/28 Medium
  - Body L: 18/26 Regular
  - Body M: 16/24 Regular
  - Caption: 13/18 Regular uppercase
- **Spacing Scale**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px
- **Radius**: 4, 8, 12px (modal: 16px)
- **Shadow**: `0 8px 24px rgba(15, 23, 42, 0.12)`

## Component Inventory
- **Form Controls**: TextField, TextArea, Select, TagPicker, Switch, Tooltip (helper text)
- **Buttons**: Primary, Secondary, Tertiary/IconButton with disabled, loading states
- **Layout**: AppShell (TopNav + SideNav), PageHeader, Tabs, TwoPane (list/detail), Modal/Dialog, Drawer
- **Feedback**: StatusBadge (drafting/in_review/approved/rejected), AlertBanner (success/warning/error), Toast
- **Data Display**: Card, MetadataList, CommentThread, Timeline/History list, DiffView (draft comparison)

## Usage Notes
- 요청 생성, 라이터 편집, 승인 리뷰 세 흐름 모두 동일한 토큰과 컴포넌트 세트를 사용하여 학습 비용을 줄인다.
- 다국어 확장을 대비해 본문 기본 폰트는 Noto Sans 계열을 사용하고, 16px 이상을 기본으로 한다.
- Guardrail 경고는 AlertBanner + inline 하이라이트 조합으로 표기한다.
