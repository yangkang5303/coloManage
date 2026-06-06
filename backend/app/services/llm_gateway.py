import hashlib
import json
import logging
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy.orm import Session
from tenacity import retry, stop_after_attempt, wait_exponential, AsyncRetrying

logger = logging.getLogger(__name__)

from app.core.config import get_settings
from app.models.domain import AIOutputLog


TASK_MODEL = {
    "classify_document": "small",
    "summarize_chunk": "small",
    "extract_section_titles": "small",
    "generate_short_summary": "small",
    "rewrite_brief": "small",
    "extract_obligations_from_evidence": "medium",
    "compare_topic_evidence": "medium",
    "generate_risk_issue_draft": "medium",
    "generate_ceo_brief": "medium",
    "chat_with_sources": "medium",
}


class LLMGateway:
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()

    async def run(self, task_type: str, payload: dict[str, Any], cited_chunk_ids: list[int] | None = None) -> dict[str, Any]:
        prompt = self._load_prompt(task_type)
        model = self._model_for_task(task_type)
        input_text = json.dumps({"instructions": prompt, "input": payload}, ensure_ascii=False)
        input_hash = hashlib.sha256(input_text.encode("utf-8")).hexdigest()
        logger.info("llm_gateway: task=%s model=%s input_hash=%s", task_type, model, input_hash[:12])
        try:
            output = await self._call(model, input_text)
            logger.debug("llm_gateway: task=%s completed", task_type)
        except Exception as exc:
            logger.error("llm_gateway: task=%s failed: %s", task_type, exc)
            output = {
                "status": "llm_unavailable",
                "answer_type": "evidence_not_found",
                "error": str(exc),
                "confidence_score": 0.0,
                "human_review_required": True,
            }
        parsed = self._parse_json(output)
        self.db.add(
            AIOutputLog(
                task_type=task_type,
                model_name=model,
                prompt_version="v1",
                input_hash=input_hash,
                input_preview=input_text[:2000],
                output_text=output if isinstance(output, str) else json.dumps(output, ensure_ascii=False),
                output_json=parsed,
                cited_chunk_ids=cited_chunk_ids or [],
                confidence_score=float(parsed.get("confidence_score", 0.0) or 0.0),
                human_review_required=bool(parsed.get("human_review_required", True)),
            )
        )
        self.db.commit()
        return parsed

    async def _call(self, model: str, input_text: str) -> str:
        if self.settings.llm_api_key == "changeme":
            return json.dumps(
                {
                    "answer_type": "evidence_not_found",
                    "summary": "LLM gateway is configured but no internal API key has been provided.",
                    "confidence_score": 0.0,
                    "human_review_required": True,
                }
            )
        async for attempt in AsyncRetrying(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=1, max=4)):
            with attempt:
                async with httpx.AsyncClient(timeout=self.settings.llm_timeout_seconds) as client:
                    response = await client.post(
                        f"{self.settings.llm_base_url.rstrip('/')}/chat/completions",
                        headers={"Authorization": f"Bearer {self.settings.llm_api_key}"},
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": "Return valid JSON only. Use only provided evidence."},
                                {"role": "user", "content": input_text},
                            ],
                            "temperature": 0.1,
                        },
                    )
                    response.raise_for_status()
                    data = response.json()
                    return data["choices"][0]["message"]["content"]

    def _model_for_task(self, task_type: str) -> str:
        size = TASK_MODEL.get(task_type, "medium")
        return self.settings.llm_small_model if size == "small" else self.settings.llm_medium_model

    def _load_prompt(self, task_type: str) -> str:
        prompt_path = Path(__file__).resolve().parents[1] / "prompts" / f"{task_type}.md"
        if prompt_path.exists():
            return prompt_path.read_text(encoding="utf-8")
        return "Use only the provided evidence. Return valid JSON only."

    def _parse_json(self, output: Any) -> dict[str, Any]:
        if isinstance(output, dict):
            return output
        try:
            return json.loads(output)
        except Exception:
            return {
                "raw_output": str(output),
                "confidence_score": 0.0,
                "human_review_required": True,
                "answer_type": "evidence_not_found",
            }
