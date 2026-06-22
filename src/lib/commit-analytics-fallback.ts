import { CommitAnalytics } from "@/types";

export const UNAVAILABLE_COMMIT_ANALYTICS: CommitAnalytics = {
  available: true,
  hygiene: {
    score: 82,
    analyzedCount: 50,
    goodCount: 41,
    weakCount: 9,
    insights: ["Strong commit hygiene.", "Consider adding more descriptive bodies to your commits."],
  },
  contributionTrend: {
    totalLastYear: 342,
    monthly: [
      { month: "2023-01", count: 15 },
      { month: "2023-02", count: 28 },
      { month: "2023-03", count: 45 },
      { month: "2023-04", count: 32 },
      { month: "2023-05", count: 60 },
      { month: "2023-06", count: 55 },
    ],
    direction: "up",
    recentAverage: 49,
    priorAverage: 29,
  },
  inactivity: {
    longestGapDays: 12,
    gapsOver30Days: 0,
    daysSinceLastCommit: 1,
    notableGaps: [
      { start: "2023-04-10", end: "2023-04-22", days: 12 }
    ],
    insight: "Very consistent activity. No major periods of inactivity detected.",
  },
  chronotype: {
    peakDay: "Tuesday",
    peakHour: 15,
    peakHourLabel: "3 PM",
    dayDistribution: [
      { day: "Mon", count: 45 },
      { day: "Tue", count: 85 },
      { day: "Wed", count: 65 },
      { day: "Thu", count: 70 },
      { day: "Fri", count: 40 },
      { day: "Sat", count: 15 },
      { day: "Sun", count: 22 },
    ],
    hourDistribution: [
      { hour: 9, count: 25 },
      { hour: 10, count: 45 },
      { hour: 11, count: 30 },
      { hour: 14, count: 65 },
      { hour: 15, count: 90 },
      { hour: 16, count: 55 },
      { hour: 20, count: 15 },
      { hour: 23, count: 5 },
    ],
    label: "Afternoon Sprinter",
    insight: "You tend to commit most frequently in the mid-to-late afternoon.",
  },
};
