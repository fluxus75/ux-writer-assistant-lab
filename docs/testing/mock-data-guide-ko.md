# Day 6 검증을 위한 목 데이터 플레이북

프로덕션 리소스에 접근할 수 없을 때도 작지만 현실적인 데이터셋을 생성하여 Day 6 워크플로우를 완전히 실행할 수 있습니다. 이 가이드는 권장 단계를 안내하고 수집 스키마와 일치하는 JSONL/CSV/YAML 파일을 생성할 수 있는 제너레이터 스크립트를 제공합니다.

## 1. 필요한 파일 이해하기
`/v1/ingest` 파이프라인은 하나의 디렉토리 아래에 네 개의 아티팩트를 기대합니다:

| 파일 | 목적 |
| --- | --- |
| `context.jsonl` | 정식 응답, 디바이스 메타데이터, 스타일 태그를 포함하는 대화형 시드 |
| `style_corpus.csv` | 기능 및 스타일 태그별로 그룹화된 영어 참조 문자열 |
| `glossary.csv` | must-use 플래그가 있는 다국어 용어 테이블 |
| `style_rules.yaml` | 최대 길이, 금지 용어, 교체 규칙과 같은 글로벌 제약 조건 |

스키마 참조를 위해 기존 `data/input/` 번들을 확인할 수 있습니다.

## 2. 스타터 데이터셋 생성하기
두 가지 제품 시나리오(로봇 청소기 및 공기 청정기)를 조합하는 Python 헬퍼를 제공합니다. 저장소 루트에서 실행하세요:

```bash
python scripts/dev/generate_mock_dataset.py --output data/mock/day6
```

스크립트는 위에서 언급한 네 개의 파일을 생성합니다. 단일 제품 라인으로 범위를 제한할 수도 있습니다:

```bash
python scripts/dev/generate_mock_dataset.py --scenarios robot_vacuum --output data/mock/vacuum_only
```

> **의존성**: 스크립트는 `pyyaml`을 사용합니다. 현재 환경에 설치되어 있지 않다면 
> `backend/` 내에서 `uv pip install pyyaml`을 실행하거나 전역적으로 `pip install pyyaml`을 실행하세요.

## 3. 팀에 맞게 사용자 정의하기
1. 생성된 파일을 에디터에서 엽니다.
2. 샘플 한국어/영어 문자열을 실제 제품 영역과 유사한 톤, 용어, 기능으로 교체합니다.
3. 필요에 따라 행을 추가하거나 제거하되, 수집 서비스가 파싱할 수 있도록 컬럼 헤더는 동일하게 유지합니다.
4. 정책을 반영하도록 `style_rules.yaml`을 업데이트합니다 (최대 길이, 금지 용어, 교체 규칙).

추가적인 다양성을 위해 `scripts/dev/generate_mock_dataset.py` 내의 시나리오 섹션을 복제하고 딕셔너리를 조정하세요. 스크립트는 선택된 모든 시나리오를 하나의 번들로 집계합니다.

## 4. 수집 전 데이터셋 검증하기
편집 후 다음과 같은 빠른 검사를 실행하세요:

1. **스키마 정상성** – `jq`/`csvlook` 또는 스프레드시트를 사용하여 모든 행에 예상 컬럼이 있는지 확인합니다.
2. **인코딩** – 파일이 UTF-8인지 확인합니다 (스크립트는 기본적으로 UTF-8로 작성).
3. **스타일 규칙** – 금지된 단어가 실제로 용어집이나 컨텍스트에 나타나는지 확인하여 테스트 시 가드레일 로직을 검증할 수 있도록 합니다.

## 5. 로컬에서 로드 및 테스트하기
1. Docker Compose 스택이나 Day 6 로컬 서비스들(Postgres, Qdrant, FastAPI, Next.js)을 시작합니다.
2. 새로 생성된 디렉토리로 수집 엔드포인트를 호출합니다:
   ```bash
   curl -X POST "http://localhost:8000/v1/ingest" \
        -H "Content-Type: application/json" \
        -d '{"path": "data/mock/day6"}'
   ```
3. Day 6 스모크 스크립트나 수동 UI 플로우(요청 생성, 드래프트, 승인)를 실행하여 목 데이터가 올바르게 작동하는지 확인합니다.

이 목 데이터셋을 프로덕션 구조와 유사하게 유지함으로써, 사무실 데이터 소스에서 떨어져 있을 때도 UX Writer Assistant 플로우를 안전하게 실행할 수 있습니다.

## 6. 추가 팁 및 사용 사례

### 시나리오 확장하기
더 많은 제품 카테고리나 사용 사례를 추가하려면:

1. `scripts/dev/generate_mock_dataset.py`의 `SCENARIOS` 딕셔너리에 새 섹션을 추가합니다.
2. 각 시나리오에는 다음이 포함되어야 합니다:
   - `context`: 대화형 컨텍스트 데이터
   - `style_corpus`: 스타일 참조 문자열
   - `glossary`: 용어집 항목
   - `style_rules`: 해당 제품별 규칙

### 언어별 테스트
다국어 지원을 테스트하려면:
- `glossary.csv`에 다양한 언어 쌍을 추가
- `context.jsonl`에 다국어 사용자 발화 및 응답 포함
- `style_rules.yaml`에 언어별 제약 조건 설정

### 성능 테스트
대량 데이터셋 생성을 위해:
```bash
# 더 많은 항목으로 데이터셋 생성
python scripts/dev/generate_mock_dataset.py --scale 10 --output data/mock/large_dataset
```

### 문제 해결
- **수집 실패**: 생성된 파일의 스키마가 올바른지 확인
- **인코딩 오류**: 모든 파일이 UTF-8로 저장되었는지 확인
- **검색 결과 없음**: Qdrant가 정상적으로 실행 중이고 벡터 임베딩이 생성되었는지 확인