from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Sensor:
    id: str
    name: str
    district: str
    lat: float
    lng: float
    camera: str


@dataclass(frozen=True)
class SoundEvent:
    id: str
    sensor_id: str
    label: str
    confidence: float
    started_at: str
    duration: float
    level: str
    video_clip: str


@dataclass(frozen=True)
class DetectionResult:
    label: str
    confidence: float
    level: str
    latency_ms: int
