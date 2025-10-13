# 배치 Request 생성 - CSV 템플릿 가이드

이 디렉토리에는 배치 Request 생성을 위한 CSV 템플릿 파일과 가이드가 포함되어 있습니다.

## CSV 파일 형식

### 필수 컬럼

- **title**: Request 제목 (최대 255자)
- **feature_name**: 기능명 (최대 255자)

### 선택 컬럼

- **context_description**: 컨텍스트 설명 (텍스트)
- **source_text**: 참고 원문 (텍스트)
- **tone**: 톤 (최대 255자)
- **style_preferences**: 스타일 선호도 (텍스트)
- **device**: Device ID (DeviceTaxonomy 테이블의 ID, 예: `robot_vacuum`, `air_purifier`)

### CSV 예시

```csv
title,feature_name,context_description,source_text,tone,style_preferences,device
"청소 시작 버튼","Start Cleaning","사용자가 버튼을 눌러 청소 시작","청소를 시작합니다","friendly","concise","robot_vacuum"
"충전 복귀","Return to Charge","배터리 부족 시 자동 충전소 복귀","충전소로 돌아갑니다","informative","brief","robot_vacuum"
```

## 제약사항

1. **최대 건수**: 한 번에 최대 30개의 request를 업로드할 수 있습니다.
2. **파일 크기**: CSV 파일은 최대 1MB까지 업로드 가능합니다.
3. **인코딩**: UTF-8 인코딩을 사용해야 합니다.
4. **Device ID**: device 필드에 입력하는 값은 DeviceTaxonomy 테이블에 등록된 유효한 device ID여야 합니다.

## 사용 방법

### 1. 템플릿 다운로드

프론트엔드의 "배치 요청 생성" 페이지에서 "템플릿 다운로드" 버튼을 클릭하면 예시 데이터가 포함된 CSV 파일을 다운로드할 수 있습니다.

### 2. CSV 파일 작성

- 템플릿을 기반으로 데이터를 입력합니다.
- 필수 필드(title, feature_name)는 반드시 입력해야 합니다.
- 선택 필드는 비워둘 수 있습니다.
- 큰따옴표로 텍스트를 감싸면 쉼표가 포함된 값을 사용할 수 있습니다.

### 3. Writer 선택 (선택사항)

- UI에서 Writer를 선택하면 모든 request에 해당 writer가 일괄 할당됩니다.
- Writer를 선택하지 않으면 나중에 개별적으로 할당할 수 있습니다.

### 4. CSV 업로드

- "배치 요청 생성" 페이지에서 작성한 CSV 파일을 업로드합니다.
- 업로드 전에 파일 내용을 미리보기로 확인할 수 있습니다.
- 검증 오류가 있으면 행별 오류 메시지가 표시됩니다.

## 검증 규칙

배치 업로드 시 다음 항목이 검증됩니다:

1. **필수 필드 검증**: title, feature_name이 비어있지 않아야 합니다.
2. **길이 검증**: title, feature_name, tone은 최대 255자를 초과할 수 없습니다.
3. **Device ID 검증**: device 필드의 값이 유효한 device ID인지 확인합니다.
4. **최대 건수 검증**: 30건을 초과하는 경우 거부됩니다.
5. **트랜잭션 처리**: 한 건이라도 검증 실패 시 전체 배치가 거부됩니다.

## 에러 처리

검증 실패 시:
- 각 행별 오류 메시지가 테이블 형태로 표시됩니다.
- 행 번호, 필드명, 오류 내용을 확인할 수 있습니다.
- 오류를 수정한 후 다시 업로드할 수 있습니다.

## Feature Normalization

device 필드가 제공되면:
- 자동으로 feature_name이 정규화된 feature_norm으로 변환됩니다.
- 예: "충전 복귀" → "return_to_charging"
- 정규화에 실패해도 request 생성은 계속 진행됩니다.

## 샘플 파일

- `request_batch_template.csv`: 10개의 예시 데이터가 포함된 샘플 템플릿

이 샘플 파일을 참고하여 자신의 데이터를 작성할 수 있습니다.

## API 엔드포인트

배치 생성 API:
```
POST /v1/requests/batch
```

Query Parameters:
- `assigned_writer_id` (optional): Writer ID

Request Body:
- `file`: CSV 파일 (multipart/form-data)

## 추가 참고사항

- CSV 파일은 Excel, Google Sheets 등에서 작성할 수 있습니다.
- 저장 시 CSV 형식으로 export하고 UTF-8 인코딩을 선택하세요.
- 빈 행은 자동으로 무시됩니다.
