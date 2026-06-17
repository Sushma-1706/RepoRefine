from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any


DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _parse_iso(date_str: str) -> datetime:
    return datetime.fromisoformat(date_str.replace("Z", "+00:00"))


def _hygiene_details(commit_messages: list[str]) -> dict[str, Any]:
    if not commit_messages:
        return {
            "score": 20,
            "analyzed_count": 0,
            "good_count": 0,
            "weak_count": 0,
            "insights": ["No commit messages available in the sampled history."],
        }

    good_count = 0
    issue_counter: Counter[str] = Counter()

    for message in commit_messages:
        normalized = message.strip()
        issues: list[str] = []
        if len(normalized) < 10:
            issues.append("too_short")
        if normalized and not normalized[0].isupper():
            issues.append("lowercase_start")
        if "update" in normalized.lower():
            issues.append("generic_update")

        if issues:
            issue_counter.update(issues)
        else:
            good_count += 1

    weak_count = len(commit_messages) - good_count
    score = round((good_count / len(commit_messages)) * 100)

    insights: list[str] = []
    if score >= 80:
        insights.append("Commit messages are clear and consistently descriptive.")
    elif score >= 60:
        insights.append("Most commit messages are usable, but some could be more specific.")
    else:
        insights.append("Commit messages need improvement to look professional to recruiters.")

    if issue_counter["too_short"]:
        insights.append(f"{issue_counter['too_short']} messages are too short (< 10 characters).")
    if issue_counter["lowercase_start"]:
        insights.append(f"{issue_counter['lowercase_start']} messages do not start with a capital letter.")
    if issue_counter["generic_update"]:
        insights.append(f"{issue_counter['generic_update']} messages rely on vague 'update' wording.")

    return {
        "score": score,
        "analyzed_count": len(commit_messages),
        "good_count": good_count,
        "weak_count": weak_count,
        "insights": insights[:4],
    }


def _collect_commit_dates(user_data: dict[str, Any]) -> list[datetime]:
    dates: list[datetime] = []

    for repo in user_data.get("repositories", {}).get("nodes", []):
        commit_nodes = (
            (repo.get("defaultBranchRef") or {})
            .get("target", {})
            .get("history", {})
            .get("nodes", [])
        )
        for commit in commit_nodes:
            committed_date = commit.get("committedDate")
            if committed_date:
                dates.append(_parse_iso(committed_date))

    contribution_groups = (
        user_data.get("contributionsCollection", {})
        .get("commitContributionsByRepository", [])
    )
    for group in contribution_groups:
        for node in group.get("contributions", {}).get("nodes", []):
            occurred_at = node.get("occurredAt")
            commit_count = node.get("commitCount", 0) or 0
            if occurred_at and commit_count > 0:
                parsed = _parse_iso(occurred_at)
                dates.extend([parsed] * commit_count)

    return sorted(set(dates))


def _monthly_contribution_trend(user_data: dict[str, Any]) -> dict[str, Any]:
    weeks = (
        user_data.get("contributionsCollection", {})
        .get("contributionCalendar", {})
        .get("weeks", [])
    )

    monthly: Counter[str] = Counter()
    for week in weeks:
        for day in week.get("contributionDays", []):
            date_str = day.get("date")
            count = day.get("contributionCount", 0) or 0
            if not date_str or count <= 0:
                continue
            month_key = date_str[:7]
            monthly[month_key] += count

    ordered_months = sorted(monthly.keys())[-12:]
    monthly_points = [
        {"month": month, "count": monthly[month]}
        for month in ordered_months
    ]

    recent = [point["count"] for point in monthly_points[-3:]]
    prior = [point["count"] for point in monthly_points[-6:-3]]
    recent_avg = round(sum(recent) / len(recent), 1) if recent else 0
    prior_avg = round(sum(prior) / len(prior), 1) if prior else 0

    if recent_avg > prior_avg * 1.15:
        direction = "up"
    elif recent_avg < prior_avg * 0.85:
        direction = "down"
    else:
        direction = "stable"

    total_last_year = (
        user_data.get("contributionsCollection", {})
        .get("contributionCalendar", {})
        .get("totalContributions", 0)
    )

    return {
        "total_last_year": total_last_year,
        "monthly": monthly_points,
        "direction": direction,
        "recent_average": recent_avg,
        "prior_average": prior_avg,
    }


def _inactivity_analysis(commit_dates: list[datetime], now: datetime) -> dict[str, Any]:
    if not commit_dates:
        return {
            "longest_gap_days": 0,
            "gaps_over_30_days": 0,
            "days_since_last_commit": None,
            "notable_gaps": [],
            "insight": "No commit timestamps were available to analyze inactivity gaps.",
        }

    notable_gaps: list[dict[str, Any]] = []
    gaps_over_30 = 0
    longest_gap = 0

    for previous, current in zip(commit_dates, commit_dates[1:]):
        gap_days = (current - previous).days
        if gap_days > longest_gap:
            longest_gap = gap_days
        if gap_days >= 30:
            gaps_over_30 += 1
            notable_gaps.append(
                {
                    "start": previous.date().isoformat(),
                    "end": current.date().isoformat(),
                    "days": gap_days,
                }
            )

    notable_gaps.sort(key=lambda gap: gap["days"], reverse=True)
    days_since_last = (now - commit_dates[-1]).days

    if gaps_over_30 == 0:
        insight = "No major inactivity gaps (30+ days) detected in the sampled commit history."
    elif gaps_over_30 == 1:
        insight = "One notable inactivity gap detected. Consider maintaining steadier contribution cadence."
    else:
        insight = f"{gaps_over_30} inactivity gaps of 30+ days detected. Recruiters may read this as inconsistent activity."

    return {
        "longest_gap_days": longest_gap,
        "gaps_over_30_days": gaps_over_30,
        "days_since_last_commit": days_since_last,
        "notable_gaps": notable_gaps[:3],
        "insight": insight,
    }


def _chronotype_analysis(commit_dates: list[datetime]) -> dict[str, Any]:
    if not commit_dates:
        return {
            "peak_day": "N/A",
            "peak_hour": 0,
            "peak_hour_label": "N/A",
            "day_distribution": [{"day": day, "count": 0} for day in DAY_NAMES],
            "hour_distribution": [{"hour": hour, "count": 0} for hour in range(24)],
            "label": "Unknown",
            "insight": "Not enough commit timestamps to infer activity patterns.",
        }

    day_counter: Counter[str] = Counter()
    hour_counter: Counter[int] = Counter()

    for commit_date in commit_dates:
        day_counter[DAY_NAMES[commit_date.weekday()]] += 1
        hour_counter[commit_date.hour] += 1

    peak_day = day_counter.most_common(1)[0][0]
    peak_hour = hour_counter.most_common(1)[0][0]
    peak_hour_label = datetime(2000, 1, 1, peak_hour).strftime("%I %p").lstrip("0")

    weekday_total = sum(day_counter[day] for day in DAY_NAMES[:5])
    weekend_total = sum(day_counter[day] for day in DAY_NAMES[5:])

    if peak_hour <= 4 or peak_hour >= 23:
        label = "Night Owl"
        insight = f"Most commits land around {peak_hour_label}, suggesting late-night coding sessions."
    elif peak_hour <= 11:
        label = "Early Bird"
        insight = f"Peak activity appears in the morning ({peak_hour_label}), indicating early-day momentum."
    elif peak_hour <= 17:
        label = "Daytime Grinder"
        insight = f"Commits cluster during working hours (peak at {peak_hour_label})."
    else:
        label = "Evening Coder"
        insight = f"Most commits happen in the evening (peak at {peak_hour_label})."

    if weekend_total / 2 > weekday_total / 5:
        label = "Weekend Warrior"
        insight = "Weekend commits dominate your cadence, which can signal side-project focus."

    return {
        "peak_day": peak_day,
        "peak_hour": peak_hour,
        "peak_hour_label": peak_hour_label,
        "day_distribution": [
            {"day": day, "count": day_counter[day]}
            for day in DAY_NAMES
        ],
        "hour_distribution": [
            {"hour": hour, "count": hour_counter[hour]}
            for hour in range(24)
        ],
        "label": label,
        "insight": insight,
    }


def build_commit_analytics(user_data: dict[str, Any], aggregated: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    commit_dates = _collect_commit_dates(user_data)
    commit_messages = aggregated.get("commit_messages", [])

    return {
        "available": True,
        "hygiene": _hygiene_details(commit_messages),
        "contribution_trend": _monthly_contribution_trend(user_data),
        "inactivity": _inactivity_analysis(commit_dates, now),
        "chronotype": _chronotype_analysis(commit_dates),
    }
