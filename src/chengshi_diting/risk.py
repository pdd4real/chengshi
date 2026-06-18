LEVELS = {
    "red": {"name": "红色", "rank": 5, "description": "极敏感事件，立即联动处置"},
    "orange": {"name": "橙色", "rank": 4, "description": "高风险事件，需人工复核"},
    "yellow": {"name": "黄色", "rank": 3, "description": "关注事件，进入巡检队列"},
    "blue": {"name": "蓝色", "rank": 2, "description": "轻微异常，持续观察"},
    "green": {"name": "绿色", "rank": 1, "description": "区域状态正常"},
}

EVENT_LEVEL = {
    "爆炸声": "red",
    "玻璃破碎": "orange",
    "车辆碰撞": "orange",
    "人群聚集": "yellow",
    "尖叫呼救": "red",
    "鸣笛": "blue",
    "正常环境声": "green",
}


def level_for(label: str, confidence: float) -> str:
    base = EVENT_LEVEL.get(label, "green")
    if confidence < 0.45:
        return "green"
    if confidence < 0.62 and base in {"red", "orange"}:
        return "yellow"
    return base


def worst_level(levels: list[str]) -> str:
    return max(levels or ["green"], key=lambda item: LEVELS[item]["rank"])
