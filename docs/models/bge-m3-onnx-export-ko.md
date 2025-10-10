# `BAAI/bge-m3`를 ONNX + Tokenizer JSON으로 내보내기

백엔드는 결정론적 스텁 임베딩으로 실행할 수 있지만, 프로덕션과 같은 평가를 위해서는 ONNX(`FP16`)와 `tokenizer.json`으로 패키징된 실제 `bge-m3` 모델이 필요합니다. 개발자 머신당 한 번씩 아래 단계를 따라하세요.

## 1. 사전 준비 사항 설치

```bash
uv venv .venv-onnx
source .venv-onnx/bin/activate  # Windows: .venv-onnx\Scripts\activate
uv pip install torch>=2.1 transformers>=4.37 optimum[onnxruntime]>=1.17
```

> **Windows 사용자 참고**: 가상환경 활성화 시 `.venv-onnx\Scripts\activate`를 사용하세요.

## 2. 인코더를 ONNX로 내보내기

```bash
python - <<'PY'
from pathlib import Path
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer

model_id = "BAAI/bge-m3"
output_dir = Path("bge-m3-onnx")
output_dir.mkdir(exist_ok=True)

print("토크나이저 다운로드 및 저장 중...")
tokenizer = AutoTokenizer.from_pretrained(model_id)
tokenizer.save_pretrained(output_dir)

print("모델을 ONNX 형식으로 변환 중... (시간이 걸릴 수 있습니다)")
model = ORTModelForFeatureExtraction.from_pretrained(
    model_id,
    export=True,
    provider="CPUExecutionProvider",
    file_name="model.onnx",
    dtype="fp16",
)
model.save_pretrained(output_dir)
print("ONNX 모델이 다음 위치에 내보내짐:", output_dir.resolve())
PY
```

완료 후 디렉토리 구조는 다음과 같습니다:

```
bge-m3-onnx/
├── model.onnx              # ONNX 모델 파일 (메인)
├── tokenizer.json          # 토크나이저 설정
├── config.json             # 모델 설정
├── special_tokens_map.json # 특수 토큰 매핑
└── tokenizer_config.json   # 토크나이저 구성
```

## 3. 백엔드 설정

다음 환경 변수를 설정하세요 (예: `backend/.env` 파일에):

```bash
# ONNX 백엔드 사용
EMBEDDING_BACKEND=onnx

# ONNX 모델 파일의 절대 경로
EMBEDDING_ONNX_PATH=/absolute/path/to/bge-m3-onnx/model.onnx
```

**Windows 예시:**
```bash
EMBEDDING_BACKEND=onnx
EMBEDDING_ONNX_PATH=C:/Users/사용자명/path/to/bge-m3-onnx/model.onnx
```

**Linux/macOS 예시:**
```bash
EMBEDDING_BACKEND=onnx
EMBEDDING_ONNX_PATH=/home/사용자명/path/to/bge-m3-onnx/model.onnx
```

FastAPI 서버가 시작되면 `model.onnx`를 로드하고 같은 폴더에 있는 `tokenizer.json`을 자동으로 찾습니다.

## 4. 선택사항: GPU 실행

CUDA가 사용 가능한 경우, CPU 대신 `onnxruntime-gpu`를 설치하고 `provider="CUDAExecutionProvider"`로 다시 내보내기를 실행하세요:

```bash
# GPU 지원 ONNX Runtime 설치
uv pip install onnxruntime-gpu>=1.16

# 내보내기 스크립트에서 provider 변경
provider="CUDAExecutionProvider"
```

GPU를 사용할 수 없는 경우 런타임이 자동으로 CPU로 폴백됩니다.

### GPU 사용 시 주의사항:
- NVIDIA GPU 및 CUDA 11.x 이상 필요
- VRAM 최소 4GB 권장 (bge-m3 모델 크기 고려)
- 드라이버 및 CUDA 툴킷이 올바르게 설치되어 있는지 확인

## 5. 설정 검증

1. **백엔드 재시작**
   ```bash
   cd backend
   uv run uvicorn app.main:app --reload --port 8000
   ```

2. **로그 확인** - 다음과 같은 메시지를 확인하세요:
   ```
   INFO: Loaded ONNX embedding model from /path/to/bge-m3-onnx/model.onnx
   INFO: Model dimensions: 1024
   ```

3. **API 테스트** - `/v1/retrieve` 또는 `/v1/translate`를 `use_rag=true`로 호출하여 응답 메타데이터에 `"novelty_mode"`와 0이 아닌 벡터 점수가 포함되는지 확인:
   ```bash
   curl -X POST "http://localhost:8000/v1/retrieve" \
        -H "Content-Type: application/json" \
        -d '{"query": "충전 독", "use_rag": true, "topK": 3}'
   ```

4. **성능 검증** - ONNX 모델이 스텁보다 더 정확한 유사도 검색 결과를 제공하는지 확인

## 6. 추가 팁 및 문제 해결

### 모델 크기 최적화
ONNX 모델 크기를 줄이려면 양자화를 고려하세요:
```python
# INT8 양자화 (성능 vs 정확도 트레이드오프)
dtype="int8"
```

### 일반적인 문제들

**1. 메모리 부족 오류**
- 더 작은 배치 크기 사용
- 시스템 메모리 또는 VRAM 확인

**2. 토크나이저 오류**
- `tokenizer.json` 파일이 `model.onnx`와 같은 디렉토리에 있는지 확인
- 경로에 특수 문자나 공백이 없는지 확인

**3. 성능 저하**
- GPU 사용 시 `CPUExecutionProvider` 대신 `CUDAExecutionProvider` 확인
- 모델이 올바른 precision(fp16)으로 로드되었는지 확인

### 저장소 관리
내보낸 모델을 저장소 밖에 보관하여 대용량 바이너리 아티팩트 커밋을 피하세요. `.gitignore`에 다음을 추가하는 것을 권장합니다:
```
# ONNX 모델 파일
*.onnx
bge-m3-onnx/
```

### 프로덕션 배포
프로덕션 환경에서는:
- 모델 파일을 안전한 중앙 저장소에 보관
- 컨테이너 이미지에 모델 포함하거나 런타임에 다운로드
- 모니터링을 통해 임베딩 성능 추적