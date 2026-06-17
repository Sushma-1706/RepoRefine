from __future__ import annotations

from fastapi import FastAPI, HTTPException

from .analytics import aggregate_activity
from .commit_analytics import build_commit_analytics
from .documentation_detection import find_documentation_match
from .github_graphql import (
    GitHubGraphQLError,
    fetch_documentation_contents,
    fetch_github_analytics,
)
from .scoring import score_recruiter_readiness

app = FastAPI(title="RepoRefine Analytics API", version="0.2.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/analyze/{username}")
async def analyze_developer(username: str) -> dict:
    try:
        user_data = await fetch_github_analytics(username)
        repositories = user_data.get("repositories", {}).get("nodes", [])

        repo_matches: list[tuple[str, str]] = []
        for repo in repositories:
            if repo.get("isEmpty"):
                continue
            documentation_match = find_documentation_match(
                (repo.get("rootTree") or {}).get("entries"),
                (repo.get("docsTree") or {}).get("entries"),
                (repo.get("docTree") or {}).get("entries"),
                (repo.get("documentationTree") or {}).get("entries"),
            )
            if documentation_match:
                repo_matches.append((repo["name"], documentation_match.expression))

        documentation_contents = await fetch_documentation_contents(username, repo_matches)
        aggregated = aggregate_activity(user_data, documentation_contents)
        scoring = score_recruiter_readiness(aggregated)
        commit_analytics = build_commit_analytics(user_data, aggregated)
        return {
            "developer": aggregated["profile"],
            "analytics": {
                "repository_count": aggregated["repository_count"],
                "commit_count_sample": aggregated["commit_count_sample"],
                "total_contributions_last_year": aggregated["total_contributions_last_year"],
                "inactive_repository_count": aggregated["inactive_repository_count"],
                "top_languages": aggregated["top_languages"],
                "repository_summaries": aggregated["repository_summaries"],
                "red_flags": aggregated["red_flags"],
                "commit_analytics": commit_analytics,
            },
            "recruiter_readiness": scoring,
        }
    except GitHubGraphQLError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
