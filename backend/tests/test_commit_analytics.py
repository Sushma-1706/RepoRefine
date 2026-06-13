import unittest
from datetime import datetime, timezone

from app.commit_analytics import (
    _chronotype_analysis,
    _hygiene_details,
    _inactivity_analysis,
    build_commit_analytics,
)


class CommitAnalyticsTests(unittest.TestCase):
    def test_hygiene_details_flags_weak_messages(self) -> None:
        details = _hygiene_details(
            [
                "Add user authentication flow",
                "update",
                "fix bug",
            ]
        )
        self.assertLess(details["score"], 100)
        self.assertEqual(details["analyzed_count"], 3)
        self.assertGreater(details["weak_count"], 0)

    def test_inactivity_analysis_detects_long_gap(self) -> None:
        dates = [
            datetime(2025, 1, 1, tzinfo=timezone.utc),
            datetime(2025, 3, 15, tzinfo=timezone.utc),
        ]
        result = _inactivity_analysis(dates, datetime(2025, 4, 1, tzinfo=timezone.utc))
        self.assertGreaterEqual(result["longest_gap_days"], 30)
        self.assertEqual(result["gaps_over_30_days"], 1)

    def test_chronotype_analysis_returns_peak_day(self) -> None:
        dates = [
            datetime(2025, 6, 2, 9, tzinfo=timezone.utc),
            datetime(2025, 6, 9, 10, tzinfo=timezone.utc),
            datetime(2025, 6, 3, 14, tzinfo=timezone.utc),
        ]
        result = _chronotype_analysis(dates)
        self.assertEqual(result["peak_day"], "Mon")
        self.assertIn(result["label"], ["Early Bird", "Daytime Grinder", "Evening Coder", "Night Owl", "Weekend Warrior"])

    def test_build_commit_analytics_is_available(self) -> None:
        user_data = {
            "contributionsCollection": {
                "contributionCalendar": {
                    "totalContributions": 120,
                    "weeks": [
                        {
                            "contributionDays": [
                                {"date": "2025-01-05", "contributionCount": 4},
                                {"date": "2025-02-10", "contributionCount": 2},
                            ]
                        }
                    ],
                },
                "commitContributionsByRepository": [],
            },
            "repositories": {
                "nodes": [
                    {
                        "defaultBranchRef": {
                            "target": {
                                "history": {
                                    "nodes": [
                                        {
                                            "committedDate": "2025-01-05T10:00:00Z",
                                            "messageHeadline": "Initial commit for project",
                                        }
                                    ]
                                }
                            }
                        }
                    }
                ]
            },
        }
        aggregated = {"commit_messages": ["Initial commit for project"]}
        analytics = build_commit_analytics(user_data, aggregated)
        self.assertTrue(analytics["available"])
        self.assertIn("hygiene", analytics)
        self.assertIn("contribution_trend", analytics)
        self.assertIn("inactivity", analytics)
        self.assertIn("chronotype", analytics)


if __name__ == "__main__":
    unittest.main()
