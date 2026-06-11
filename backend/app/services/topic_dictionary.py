import json
from pathlib import Path
from typing import Any

# 话题配置文件路径
_TOPIC_FILE = Path(__file__).parent.parent / "data" / "topic_dictionary.json"

# 缓存加载的话题数据
_topic_cache: list[dict[str, Any]] = []


def _load_topics() -> list[dict[str, Any]]:
    """从 JSON 文件动态加载话题配置。"""
    global _topic_cache
    if not _topic_cache:
        try:
            with open(_TOPIC_FILE, "r", encoding="utf-8") as f:
                _topic_cache = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            _topic_cache = []
    return _topic_cache


def get_all_topics() -> list[dict[str, Any]]:
    """获取所有话题配置（含 key、label、description）。"""
    return _load_topics()


def get_topic(topic_key: str) -> dict[str, Any] | None:
    """根据话题 key 获取完整话题配置。"""
    for topic in _load_topics():
        if topic.get("key") == topic_key:
            return topic
    return None


def keywords_for_topic(topic_key: str) -> list[str]:
    """根据话题 key 获取关键词列表（仅用于 embedding 查询增强/降级兼容）。"""
    topic = get_topic(topic_key)
    return topic.get("keywords", []) if topic else []


def topic_search_text(topic_key: str) -> str:
    """拼接话题标签、描述和关键词，作为向量检索的语义查询文本。"""
    topic = get_topic(topic_key)
    if not topic:
        return ""
    parts = [
        str(topic.get("label", "")),
        str(topic.get("description", "")),
        " ".join(topic.get("keywords", [])),
    ]
    return "\n".join(part for part in parts if part.strip())
