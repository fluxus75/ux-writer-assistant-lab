# Exporting `BAAI/bge-m3` to ONNX + Tokenizer JSON

The backend can run with deterministic stub embeddings, but production-like evaluations require the real `bge-m3` model packaged as ONNX (`FP16`) plus `tokenizer.json`. Follow the steps below once per developer machine.

## 1. Install prerequisites

```bash
python -m venv .venv-onnx
source .venv-onnx/bin/activate
pip install --upgrade pip
pip install torch>=2.1 transformers>=4.37 optimum[onnxruntime]>=1.17
```

## 2. Export the encoder to ONNX

```bash
python - <<'PY'
from pathlib import Path
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer

model_id = "BAAI/bge-m3"
output_dir = Path("bge-m3-onnx")
output_dir.mkdir(exist_ok=True)

tokenizer = AutoTokenizer.from_pretrained(model_id)
tokenizer.save_pretrained(output_dir)

model = ORTModelForFeatureExtraction.from_pretrained(
    model_id,
    export=True,
    provider="CPUExecutionProvider",
    file_name="model.onnx",
    dtype="fp16",
)
model.save_pretrained(output_dir)
print("Exported ONNX model to", output_dir.resolve())
PY
```

The directory now contains:

```
bge-m3-onnx/
├── model.onnx
├── tokenizer.json
├── config.json
└── special_tokens_map.json
```

## 3. Configure the backend

Set the following environment variables (e.g. in `backend/.env`):

```
EMBEDDING_BACKEND=onnx
EMBEDDING_ONNX_PATH=/absolute/path/to/bge-m3-onnx/model.onnx
```

When the FastAPI server starts, it loads `model.onnx` and automatically locates the `tokenizer.json` that sits in the same folder.

## 4. Optional: GPU execution

If CUDA is available, install `onnxruntime-gpu` instead of the CPU wheel and re-run the export with `provider="CUDAExecutionProvider"`. Update `pip install` accordingly:

```bash
pip install onnxruntime-gpu>=1.16
```

The runtime automatically falls back to CPU if GPU is unavailable.

## 5. Verifying the setup

1. Restart the backend.
2. Inspect the logs – you should see `Loaded ONNX embedding model from ...`.
3. Call `/v1/retrieve` or `/v1/translate` with `use_rag=true` and confirm the response metadata includes `"novelty_mode"` plus non-zero vector scores.

Keep the exported model outside the repository to avoid committing large binary artifacts.
