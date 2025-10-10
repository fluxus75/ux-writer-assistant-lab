#!/usr/bin/env python3
"""Generate a near-realistic UX writing dataset for local testing.

This helper fabricates JSONL/CSV/YAML files that mimic the structure of the
production corpora (context snippets, style corpus, glossary, style rules).
It is designed so teammates without access to the real dataset can still run
Day 6 end-to-end flows locally.
"""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping

# ---------------------------------------------------------------------------
# Source snippets for each scenario. Extend or adjust the dictionaries to
# better match your production domain.
# ---------------------------------------------------------------------------

SCENARIOS: Mapping[str, Mapping[str, Iterable[Mapping[str, object]]]] = {
    "robot_vacuum": {
        "context": [
            {
                "id": "RV-0001",
                "user_utterance": "충전해",
                "response_case_raw": "go_to_dock",
                "response_case_norm": "in_progress",
                "response_case_tags": ["navigation", "power"],
                "device": "robot_vacuum",
                "feature": "충전 복귀",
                "feature_norm": "charging",
                "style_tag": "concise.system.action",
                "ko_response": "충전대로 복귀할게요.",
                "notes": "톤: 밝고 단정."
            },
            {
                "id": "RV-0002",
                "user_utterance": "청소 시작",
                "response_case_raw": "start_cleaning",
                "response_case_norm": "in_progress",
                "response_case_tags": ["start"],
                "device": "robot_vacuum",
                "feature": "청소 시작",
                "feature_norm": "start_cleaning",
                "style_tag": "concise.system.action",
                "ko_response": "청소를 시작할게요.",
                "notes": "명령형 대응"
            },
            {
                "id": "RV-0003",
                "user_utterance": "멈춰",
                "response_case_raw": "pause",
                "response_case_norm": "paused",
                "response_case_tags": ["control"],
                "device": "robot_vacuum",
                "feature": "일시정지",
                "feature_norm": "pause",
                "style_tag": "concise.system.action",
                "ko_response": "잠깐 멈춰 둘게요.",
                "notes": "Stop command"
            },
            {
                "id": "RV-0004",
                "user_utterance": "조용한 모드로 바꿔",
                "response_case_raw": "switch_silent",
                "response_case_norm": "success",
                "response_case_tags": ["mode"],
                "device": "robot_vacuum",
                "feature": "사일런트 모드",
                "feature_norm": "silent_mode",
                "style_tag": "concise.system.action",
                "ko_response": "사일런트 모드로 전환했어요.",
                "notes": "모드 토글"
            },
            {
                "id": "RV-0005",
                "user_utterance": "먼지통 상태 알려줘",
                "response_case_raw": "dustbin_status",
                "response_case_norm": "info",
                "response_case_tags": ["status"],
                "device": "robot_vacuum",
                "feature": "먼지통 상태",
                "feature_norm": "dustbin_status",
                "style_tag": "concise.system.info",
                "ko_response": "먼지통이 60% 찼어요.",
                "notes": "정보 제공"
            },
        ],
        "style_corpus": [
            {
                "sid": "RV-S001",
                "device": "robot_vacuum",
                "feature_norm": "charging",
                "style_tag": "concise.system.action",
                "en_line": "Heading back to the charging station.",
                "notes": "Use progressive tone"
            },
            {
                "sid": "RV-S002",
                "device": "robot_vacuum",
                "feature_norm": "start_cleaning",
                "style_tag": "concise.system.action",
                "en_line": "Starting a cleaning run.",
                "notes": ""
            },
            {
                "sid": "RV-S003",
                "device": "robot_vacuum",
                "feature_norm": "pause",
                "style_tag": "concise.system.action",
                "en_line": "Pausing for now.",
                "notes": ""
            },
            {
                "sid": "RV-S004",
                "device": "robot_vacuum",
                "feature_norm": "silent_mode",
                "style_tag": "concise.system.action",
                "en_line": "Switched to Silent Mode.",
                "notes": ""
            },
            {
                "sid": "RV-S005",
                "device": "robot_vacuum",
                "feature_norm": "dustbin_status",
                "style_tag": "concise.system.info",
                "en_line": "Dust bin is 60% full.",
                "notes": ""
            },
        ],
        "glossary": [
            {
                "ko_term": "충전대",
                "en_term": "charging station",
                "device": "robot_vacuum",
                "must_use": True,
                "pos": "noun",
                "synonyms_ko": "도킹스테이션",
                "notes": "Prefer native Korean wording"
            },
            {
                "ko_term": "사일런트 모드",
                "en_term": "Silent Mode",
                "device": "robot_vacuum",
                "must_use": True,
                "pos": "noun",
                "synonyms_ko": "조용 모드",
                "notes": ""
            },
            {
                "ko_term": "먼지통",
                "en_term": "dust bin",
                "device": "robot_vacuum",
                "must_use": False,
                "pos": "noun",
                "synonyms_ko": "먼지통",
                "notes": ""
            },
        ],
        "style_rules": {
            "length_max": 40,
            "forbidden_terms": ["도킹"],
            "replace_map": {"도킹": "충전대"},
        },
    },
    "air_purifier": {
        "context": [
            {
                "id": "AP-0101",
                "user_utterance": "공기질 어때?",
                "response_case_raw": "air_quality_status",
                "response_case_norm": "info",
                "response_case_tags": ["status"],
                "device": "air_purifier",
                "feature": "공기질 상태",
                "feature_norm": "air_quality",
                "style_tag": "concise.system.info",
                "ko_response": "현재 공기질은 좋음이에요.",
                "notes": ""
            },
            {
                "id": "AP-0102",
                "user_utterance": "터보로 올려",
                "response_case_raw": "boost_mode",
                "response_case_norm": "success",
                "response_case_tags": ["mode"],
                "device": "air_purifier",
                "feature": "터보 모드",
                "feature_norm": "boost_mode",
                "style_tag": "concise.system.action",
                "ko_response": "터보 모드를 켰어요.",
                "notes": ""
            },
            {
                "id": "AP-0103",
                "user_utterance": "타이머 2시간으로 맞춰",
                "response_case_raw": "set_timer",
                "response_case_norm": "success",
                "response_case_tags": ["timer"],
                "device": "air_purifier",
                "feature": "타이머",
                "feature_norm": "timer",
                "style_tag": "concise.system.action",
                "ko_response": "2시간 뒤에 전원이 꺼지도록 설정했어요.",
                "notes": ""
            },
            {
                "id": "AP-0104",
                "user_utterance": "필터 언제 갈아?",
                "response_case_raw": "filter_life",
                "response_case_norm": "info",
                "response_case_tags": ["maintenance"],
                "device": "air_purifier",
                "feature": "필터 수명",
                "feature_norm": "filter_life",
                "style_tag": "concise.system.info",
                "ko_response": "필터 수명이 20% 남았어요.",
                "notes": ""
            },
            {
                "id": "AP-0105",
                "user_utterance": "수면모드로 바꿔",
                "response_case_raw": "sleep_mode",
                "response_case_norm": "success",
                "response_case_tags": ["mode"],
                "device": "air_purifier",
                "feature": "수면 모드",
                "feature_norm": "sleep_mode",
                "style_tag": "concise.system.action",
                "ko_response": "수면 모드로 전환했어요.",
                "notes": ""
            },
        ],
        "style_corpus": [
            {
                "sid": "AP-S001",
                "device": "air_purifier",
                "feature_norm": "air_quality",
                "style_tag": "concise.system.info",
                "en_line": "Air quality is currently good.",
                "notes": ""
            },
            {
                "sid": "AP-S002",
                "device": "air_purifier",
                "feature_norm": "boost_mode",
                "style_tag": "concise.system.action",
                "en_line": "Boost mode is on.",
                "notes": ""
            },
            {
                "sid": "AP-S003",
                "device": "air_purifier",
                "feature_norm": "timer",
                "style_tag": "concise.system.action",
                "en_line": "Timer set for 2 hours.",
                "notes": ""
            },
            {
                "sid": "AP-S004",
                "device": "air_purifier",
                "feature_norm": "filter_life",
                "style_tag": "concise.system.info",
                "en_line": "20% filter life remaining.",
                "notes": ""
            },
            {
                "sid": "AP-S005",
                "device": "air_purifier",
                "feature_norm": "sleep_mode",
                "style_tag": "concise.system.action",
                "en_line": "Switched to Sleep Mode.",
                "notes": ""
            },
        ],
        "glossary": [
            {
                "ko_term": "공기질",
                "en_term": "air quality",
                "device": "air_purifier",
                "must_use": True,
                "pos": "noun",
                "synonyms_ko": "공기 상태",
                "notes": ""
            },
            {
                "ko_term": "터보 모드",
                "en_term": "Turbo Mode",
                "device": "air_purifier",
                "must_use": False,
                "pos": "noun",
                "synonyms_ko": "강풍 모드",
                "notes": ""
            },
            {
                "ko_term": "필터",
                "en_term": "filter",
                "device": "air_purifier",
                "must_use": True,
                "pos": "noun",
                "synonyms_ko": "정화 필터",
                "notes": ""
            },
        ],
        "style_rules": {
            "length_max": 45,
            "forbidden_terms": ["미세먼지"],
            "replace_map": {"미세먼지": "공기질"},
        },
    },
}


def write_jsonl(path: Path, rows: Iterable[Mapping[str, object]]) -> None:
    with path.open("w", encoding="utf-8") as fp:
        for row in rows:
            fp.write(json.dumps(row, ensure_ascii=False) + "\n")


def write_csv(path: Path, rows: Iterable[Mapping[str, object]], headers: List[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def _quote(value: str) -> str:
    return "\"" + value.replace("\"", "\\\"") + "\""


def write_style_rules(path: Path, rules: Mapping[str, object]) -> None:
    length_max = int(rules.get("length_max", 0))
    forbidden_terms = list(dict.fromkeys(rules.get("forbidden_terms", [])))
    replace_map = rules.get("replace_map", {})

    with path.open("w", encoding="utf-8") as fp:
        fp.write(f"length_max: {length_max}\n")

        if forbidden_terms:
            fp.write("forbidden_terms:\n")
            for term in forbidden_terms:
                fp.write(f"  - {_quote(str(term))}\n")
        else:
            fp.write("forbidden_terms: []\n")

        if replace_map:
            fp.write("replace_map:\n")
            for source, target in replace_map.items():
                fp.write(f"  {_quote(str(source))}: {_quote(str(target))}\n")
        else:
            fp.write("replace_map: {}\n")


def generate_dataset(output_dir: Path, scenarios: List[str]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    context_rows = []
    style_rows = []
    glossary_rows = []
    aggregated_rules: Dict[str, Any] = {
        "length_max": 0,
        "forbidden_terms": [],
        "replace_map": {},
    }

    for scenario in scenarios:
        payload = SCENARIOS[scenario]
        context_rows.extend(payload["context"])
        style_rows.extend(payload["style_corpus"])
        glossary_rows.extend(payload["glossary"])

        rules = payload["style_rules"]
        aggregated_rules["length_max"] = max(
            aggregated_rules["length_max"], rules.get("length_max", 0)
        )
        aggregated_rules["forbidden_terms"].extend(rules.get("forbidden_terms", []))
        aggregated_rules["replace_map"].update(rules.get("replace_map", {}))

    write_jsonl(output_dir / "context.jsonl", context_rows)
    write_csv(
        output_dir / "style_corpus.csv",
        style_rows,
        headers=["sid", "device", "feature_norm", "style_tag", "en_line", "notes"],
    )
    write_csv(
        output_dir / "glossary.csv",
        glossary_rows,
        headers=["ko_term", "en_term", "device", "must_use", "pos", "synonyms_ko", "notes"],
    )
    write_style_rules(output_dir / "style_rules.yaml", aggregated_rules)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate mock UX writing dataset")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/mock_dataset"),
        help="Directory where the dataset files will be written.",
    )
    parser.add_argument(
        "--scenarios",
        choices=sorted(SCENARIOS.keys()),
        nargs="*",
        default=sorted(SCENARIOS.keys()),
        help="Subset of scenarios to include in the dataset.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    generate_dataset(args.output, list(args.scenarios))
    print(f"Mock dataset written to {args.output.resolve()}")


if __name__ == "__main__":
    main()
