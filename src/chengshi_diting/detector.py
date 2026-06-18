from __future__ import annotations

from .models import DetectionResult
from .risk import level_for

LABEL_RULES = [
    ("爆炸声", "impact_energy", 0.88),
    ("尖叫呼救", "voice_peak", 0.82),
    ("玻璃破碎", "high_freq", 0.76),
    ("车辆碰撞", "low_freq", 0.72),
    ("人群聚集", "crowd_density", 0.66),
    ("鸣笛", "tonal", 0.58),
]


def detect(features: dict[str, float]) -> DetectionResult:
    """Score simplified acoustic features as a lightweight SED stand-in."""
    best_label = "正常环境声"
    best_score = 0.31

    for label, key, weight in LABEL_RULES:
        value = max(0.0, min(1.0, float(features.get(key, 0.0))))
        score = 0.18 + value * weight
        if score > best_score:
            best_label = label
            best_score = score

    confidence = round(min(best_score, 0.98), 3)
    latency = int(180 + 520 * min(1.0, sum(features.values()) / 6))
    return DetectionResult(
        label=best_label,
        confidence=confidence,
        level=level_for(best_label, confidence),
        latency_ms=latency,
    )
