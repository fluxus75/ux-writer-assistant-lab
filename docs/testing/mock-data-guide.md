# Mock Data Playbook for Day 6 Validation

When you are away from production resources, you can still exercise the Day 6
workflow end to end by fabricating a small but realistic dataset. This guide
walks through the recommended steps and ships a generator script so you can
produce JSONL/CSV/YAML files that match the ingestion schema.

## 1. Understand the Required Files
The `/v1/ingest` pipeline expects four artefacts under a single directory:

| File | Purpose |
| --- | --- |
| `context.jsonl` | Conversational seeds that include canonical responses, device metadata, and style tags. |
| `style_corpus.csv` | English reference strings grouped by feature and style tag. |
| `glossary.csv` | Bilingual terminology table with must-use flags. |
| `style_rules.yaml` | Global constraints such as max length, forbidden terms, and replacement rules. |

You can open the existing `data/input/` bundle for a schema reference.

## 2. Generate a Starter Dataset
We provide a Python helper that assembles two product scenarios (robot vacuum
and air purifier). Run it from the repository root:

```bash
python scripts/dev/generate_mock_dataset.py --output data/mock/day6
```

The script will create the four files mentioned above. You can also scope it to
a single product line:

```bash
python scripts/dev/generate_mock_dataset.py --scenarios robot_vacuum --output data/mock/vacuum_only
```

> **Dependencies**: The script uses `pyyaml`. If it is not installed in your
> current environment, run `uv pip install pyyaml` inside `backend/` or `pip
> install pyyaml` globally.

## 3. Customize for Your Team
1. Open the generated files in your editor.
2. Replace the sample Korean/English strings with tone, terminology, and
   features that resemble your real product area.
3. Add or remove rows as needed—keep the column headers identical so the
   ingestion service can parse them.
4. Update `style_rules.yaml` to mirror your policy (max length, banned terms,
   replacements).

For additional variety, duplicate the scenario sections inside
`scripts/dev/generate_mock_dataset.py` and adjust the dictionaries. The script
aggregates all selected scenarios into a single bundle.

## 4. Validate the Dataset Before Ingest
After editing, run these quick checks:

1. **Schema sanity** – Use `jq`/`csvlook` or a spreadsheet to ensure every row
   has the expected columns.
2. **Encoding** – Confirm the files are UTF-8 (the script writes UTF-8 by
   default).
3. **Style rules** – Make sure forbidden words actually appear in the glossary
   or context so you can verify the guardrail logic when testing.

## 5. Load and Test Locally
1. Start the Docker Compose stack or the Day 6 local services (Postgres,
   Qdrant, FastAPI, Next.js).
2. Call the ingest endpoint with the freshly generated directory:
   ```bash
   curl -X POST "http://localhost:8000/v1/ingest" \
        -H "Content-Type: application/json" \
        -d '{"path": "data/mock/day6"}'
   ```
3. Run through the Day 6 smoke script or the manual UI flows (request creation,
   drafts, approvals) to confirm the mocked data behaves correctly.

By keeping this mock dataset close to your production structure, you can safely
exercise the UX Writer Assistant flows even when you are away from office data
sources.
