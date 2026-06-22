from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any

from .documentation_detection import evaluate_documentation, find_documentation_match


def _parse_iso(date_str: str) -> datetime:
    return datetime.fromisoformat(date_str.replace("Z", "+00:00"))


def _evaluate_repository(
    repo: dict[str, Any],
    now: datetime,
    documentation_content: str | None = None,
) -> dict[str, Any]:
    issues: list[str] = []
    score = 100

    if not repo.get("description"):
        issues.append("Missing Description")
        score -= 10
    if not repo.get("licenseInfo"):
        issues.append("No License")
        score -= 20

    documentation_match = find_documentation_match(
        (repo.get("rootTree") or {}).get("entries"),
        (repo.get("docsTree") or {}).get("entries"),
        (repo.get("docTree") or {}).get("entries"),
        (repo.get("documentationTree") or {}).get("entries"),
    )
    doc_issues, doc_deduction = evaluate_documentation(
        documentation_match,
        documentation_content,
        bool(repo.get("isEmpty")),
    )
    issues.extend(doc_issues)
    score -= doc_deduction

    pushed_at = repo.get("pushedAt")
    if pushed_at:
        age_days = (now - _parse_iso(pushed_at)).days
        if age_days > 180:
            issues.append("Inactive > 6mo")
            score -= 15

    commit_nodes = (
        (repo.get("defaultBranchRef") or {})
        .get("target", {})
        .get("history", {})
        .get("nodes", [])
    )
    if len(commit_nodes) < 10:
        issues.append("Low Commit Activity")
        score -= 10

    return {
        "name": repo.get("name", "Unknown"),
        "description": repo.get("description") or "",
        "language": ((repo.get("primaryLanguage") or {}).get("name") or "Unknown"),
        "stars": repo.get("stargazerCount", 0),
        "forks": repo.get("forkCount", 0),
        "last_updated": pushed_at,
        "issues": issues,
        "score": max(0, score),
        "commit_count": len(commit_nodes),
        "commit_messages": [c.get("messageHeadline", "") for c in commit_nodes],
    }


def aggregate_activity(
    user_data: dict[str, Any],
    documentation_contents: dict[str, str | None] | None = None,
) -> dict[str, Any]:
    repositories = user_data.get("repositories", {}).get("nodes", [])
    language_counter: Counter[str] = Counter()
    repo_summaries: list[dict[str, Any]] = []
    documentation_contents = documentation_contents or {}

    now = datetime.now(timezone.utc)
    for repo in repositories:
        repo_name = repo.get("name", "Unknown")
        summary = _evaluate_repository(
            repo,
            now,
            documentation_contents.get(repo_name),
        )
        repo_summaries.append(summary)
        language_counter[summary["language"]] += 1

    contribution_total = (
        user_data.get("contributionsCollection", {})
        .get("contributionCalendar", {})
        .get("totalContributions", 0)
    )

    commit_messages = [
        message
        for repo in repo_summaries
        for message in repo["commit_messages"]
        if message
    ]

    red_flags = sorted({issue for repo in repo_summaries for issue in repo["issues"]})

    return {
        "profile": {
            "login": user_data.get("login"),
            "name": user_data.get("name"),
            "avatar_url": user_data.get("avatarUrl"),
            "bio": user_data.get("bio") or "",
            "followers": user_data.get("followers", {}).get("totalCount", 0),
        },
        "repository_count": len(repo_summaries),
        "commit_count_sample": sum(repo["commit_count"] for repo in repo_summaries),
        "total_contributions_last_year": contribution_total,
        "inactive_repository_count": sum(
            1 for repo in repo_summaries if "Inactive > 6mo" in repo["issues"]
        ),
        "top_languages": language_counter.most_common(5),
        "repository_summaries": repo_summaries,
        "commit_messages": commit_messages,
        "red_flags": red_flags,
    }
