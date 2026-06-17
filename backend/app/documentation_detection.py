from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

README_FILE_PATTERN = re.compile(r"^readme(\.(md|markdown|rst|txt|asciidoc))?$", re.IGNORECASE)

DOC_ENTRY_PATTERNS = [
    re.compile(r"^readme(\.(md|markdown|rst|txt|asciidoc))?$", re.IGNORECASE),
    re.compile(r"^index\.(md|markdown|rst|html)$", re.IGNORECASE),
    re.compile(r"^getting[-_]started\.md$", re.IGNORECASE),
]

LOCATION_PRIORITY = {
    "root": 400,
    "docs": 300,
    "documentation": 250,
    "doc": 200,
}

EXTENSION_PRIORITY = {
    ".md": 30,
    ".markdown": 28,
    ".rst": 25,
    ".txt": 20,
    ".asciidoc": 18,
    "": 15,
}


@dataclass(frozen=True)
class DocumentationMatch:
    path: str
    file_name: str
    location: str
    expression: str


def _blob_entries(entries: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    return [entry for entry in (entries or []) if entry.get("type") == "blob"]


def _matches_patterns(file_name: str, patterns: list[re.Pattern[str]]) -> bool:
    return any(pattern.match(file_name) for pattern in patterns)


def _extension_score(file_name: str) -> int:
    lower = file_name.lower()
    for ext, score in EXTENSION_PRIORITY.items():
        if ext == "" and lower == "readme":
            return score
        if ext and lower.endswith(ext):
            return score
    if lower.startswith("index."):
        return 22
    if "getting-started" in lower or "getting_started" in lower:
        return 20
    return 10


def _build_match(file_name: str, location: str, folder: str | None = None) -> DocumentationMatch:
    path = f"{folder}/{file_name}" if folder else file_name
    return DocumentationMatch(
        path=path,
        file_name=file_name,
        location=location,
        expression=f"HEAD:{path}",
    )


def _candidates_from_entries(
    entries: list[dict[str, Any]] | None,
    location: str,
    patterns: list[re.Pattern[str]],
    folder: str | None = None,
) -> list[DocumentationMatch]:
    return [
        _build_match(entry["name"], location, folder)
        for entry in _blob_entries(entries)
        if _matches_patterns(entry["name"], patterns)
    ]


def find_documentation_match(
    root_entries: list[dict[str, Any]] | None,
    docs_entries: list[dict[str, Any]] | None = None,
    doc_entries: list[dict[str, Any]] | None = None,
    documentation_entries: list[dict[str, Any]] | None = None,
) -> DocumentationMatch | None:
    candidates = [
        *_candidates_from_entries(root_entries, "root", [README_FILE_PATTERN]),
        *_candidates_from_entries(docs_entries, "docs", DOC_ENTRY_PATTERNS, "docs"),
        *_candidates_from_entries(doc_entries, "doc", DOC_ENTRY_PATTERNS, "doc"),
        *_candidates_from_entries(
            documentation_entries,
            "documentation",
            DOC_ENTRY_PATTERNS,
            "documentation",
        ),
    ]
    if not candidates:
        return None

    return max(
        candidates,
        key=lambda candidate: (
            LOCATION_PRIORITY[candidate.location],
            _extension_score(candidate.file_name),
        ),
    )


def evaluate_documentation(
    match: DocumentationMatch | None,
    content: str | None,
    is_empty: bool = False,
) -> tuple[list[str], int]:
    if is_empty:
        return [], 0

    if not match:
        return ["No Documentation"], 40

    text = (content or "").strip()
    if not text:
        return [], 0

    if len(text) < 300:
        return ["Weak Documentation"], 20

    return [], 0
