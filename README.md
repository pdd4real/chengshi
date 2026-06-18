# 城市·谛听 CityListen

CityListen 是一个面向城市公共安全场景的声学事件感知服务，提供声音事件检测、风险分级、事件检索与联动摘要接口。

## Overview

- `src/chengshi_diting/`: application package, HTTP API, detection pipeline, and domain models
- `data/`: seed data for sensors, events, and historical trend aggregation
- `tests/`: regression tests for detection and risk ranking

## Features

- Acoustic event scoring pipeline with five-level risk classification
- Sensor-aware event retrieval enriched with district, camera, and severity metadata
- Summary and replay endpoints for downstream dashboards or case management systems
- Zero-dependency HTTP server for local development and packaging

## Getting Started

### Requirements

- Python 3.10+
- `uv` recommended for environment and lockfile management

### Install

```bash
uv sync
```

### Run the API

```bash
uv run python -m chengshi_diting.api --host 127.0.0.1 --port 8088
```

Without `uv`:

```bash
PYTHONPATH=src python -m chengshi_diting.api --host 127.0.0.1 --port 8088
```

The service starts on `http://127.0.0.1:8088`.

## API

- `GET /api/events`: list detected events enriched with sensor and severity metadata
- `GET /api/summary`: return system-wide counts, latency, accuracy, miss rate, and trend data
- `GET /api/replay?id=E-240617-03`: return replay segments and event digest for a given event ID
- `POST /api/detect`: submit simplified acoustic features and receive a classified event result

## Development

Run tests:

```bash
PYTHONPATH=src uv run python -m unittest discover -s tests
```

Package entrypoint:

```bash
uv run citylisten-api --host 127.0.0.1 --port 8088
```
