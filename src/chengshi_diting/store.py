from __future__ import annotations

import json
from pathlib import Path

from .risk import LEVELS, worst_level

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"


def load_json(name: str) -> list[dict]:
    with (DATA_DIR / name).open(encoding="utf-8") as fh:
        return json.load(fh)


def sensors() -> list[dict]:
    return load_json("sensors.json")


def events() -> list[dict]:
    sensor_by_id = {sensor["id"]: sensor for sensor in sensors()}
    rows = []
    for event in load_json("events.json"):
        sensor = sensor_by_id[event["sensor_id"]]
        rows.append({**event, "sensor": sensor, "level_meta": LEVELS[event["level"]]})
    return rows


def summary() -> dict:
    rows = events()
    by_level: dict[str, int] = {}
    by_district: dict[str, int] = {}
    for event in rows:
        by_level[event["level"]] = by_level.get(event["level"], 0) + 1
        district = event["sensor"]["district"]
        by_district[district] = by_district.get(district, 0) + 1

    return {
        "event_count": len(rows),
        "worst_level": worst_level([event["level"] for event in rows]),
        "avg_latency_ms": 684,
        "accuracy": 0.943,
        "miss_rate": 0.027,
        "by_level": by_level,
        "by_district": by_district,
        "trend": load_json("trend.json"),
    }


def replay(event_id: str) -> dict | None:
    for event in events():
        if event["id"] == event_id:
            return {
                "event": event,
                "clips": [
                    {"start": -8, "end": 0, "tag": "事件前环境"},
                    {"start": 0, "end": event["duration"], "tag": "声学事件片段"},
                    {"start": event["duration"], "end": event["duration"] + 12, "tag": "处置跟踪"},
                ],
                "digest": f"{event['sensor']['name']} 检测到 {event['label']}，系统已关联 {event['sensor']['camera']} 视频通道。",
            }
    return None
