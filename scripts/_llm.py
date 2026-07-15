"""Shared helpers for the one-shot enrichment scripts (Tasks 2, 3, 4)."""
import json
import os


def call_json(llm, prompt: str) -> dict:
    """Invoke the model and parse its reply as JSON.

    Models wrap JSON in markdown fences unpredictably regardless of instructions,
    so strip them before parsing.
    """
    text = llm.invoke(prompt).content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0]
    return json.loads(text.strip())


def save_json(path: str, data) -> None:
    """Write JSON, creating the parent directory. Arabic stays readable in the file."""
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
