'use server';

import { getProfileData } from "@/lib/github-service";
import { generateAIReview } from "@/lib/ai-service";
import { UNAVAILABLE_COMMIT_ANALYTICS } from "@/lib/commit-analytics-fallback";
import { analyzeRepoFromUrl } from "@/lib/repo-service";
import { CommitAnalytics, Persona, ProfileAnalysis, RepoLinkAudit } from "@/types";

type BackendCommitAnalytics = {
  available: boolean;
  hygiene: {
    score: number;
    analyzed_count: number;
    good_count: number;
    weak_count: number;
    insights: string[];
  };
  contribution_trend: {
    total_last_year: number;
    monthly: Array<{ month: string; count: number }>;
    direction: "up" | "down" | "stable";
    recent_average: number;
    prior_average: number;
  };
  inactivity: {
    longest_gap_days: number;
    gaps_over_30_days: number;
    days_since_last_commit: number | null;
    notable_gaps: Array<{ start: string; end: string; days: number }>;
    insight: string;
  };
  chronotype: {
    peak_day: string;
    peak_hour: number;
    peak_hour_label: string;
    day_distribution: Array<{ day: string; count: number }>;
    hour_distribution: Array<{ hour: number; count: number }>;
    label: string;
    insight: string;
  };
};

type BackendResponse = {
  developer: {
    login: string;
    name: string;
    avatar_url?: string;
    bio?: string;
    followers: number;
  };
  analytics: {
    repository_count: number;
    repository_summaries: Array<{
      name: string;
      description: string;
      language: string;
      stars: number;
      forks: number;
      last_updated?: string;
      issues: string[];
      score: number;
    }>;
    red_flags: string[];
    commit_analytics?: BackendCommitAnalytics;
  };
  recruiter_readiness: {
    scores: {
      overall: number;
      consistency: number;
      project_depth: number;
      commit_hygiene?: number;
      velocity?: number;
      contribution?: number;
    };
    recommendations?: string[];
  };
};

function mapCommitAnalytics(data?: BackendCommitAnalytics): CommitAnalytics {
  if (!data) return UNAVAILABLE_COMMIT_ANALYTICS;

  return {
    available: data.available,
    hygiene: {
      score: data.hygiene.score,
      analyzedCount: data.hygiene.analyzed_count,
      goodCount: data.hygiene.good_count,
      weakCount: data.hygiene.weak_count,
      insights: data.hygiene.insights,
    },
    contributionTrend: {
      totalLastYear: data.contribution_trend.total_last_year,
      monthly: data.contribution_trend.monthly,
      direction: data.contribution_trend.direction,
      recentAverage: data.contribution_trend.recent_average,
      priorAverage: data.contribution_trend.prior_average,
    },
    inactivity: {
      longestGapDays: data.inactivity.longest_gap_days,
      gapsOver30Days: data.inactivity.gaps_over_30_days,
      daysSinceLastCommit: data.inactivity.days_since_last_commit,
      notableGaps: data.inactivity.notable_gaps,
      insight: data.inactivity.insight,
    },
    chronotype: {
      peakDay: data.chronotype.peak_day,
      peakHour: data.chronotype.peak_hour,
      peakHourLabel: data.chronotype.peak_hour_label,
      dayDistribution: data.chronotype.day_distribution,
      hourDistribution: data.chronotype.hour_distribution,
      label: data.chronotype.label,
      insight: data.chronotype.insight,
    },
  };
}

async function getBackendProfile(username: string): Promise<Partial<ProfileAnalysis>> {
  const backendBaseUrl = process.env.BACKEND_API_URL;
  if (!backendBaseUrl) {
    throw new Error("BACKEND_API_URL not configured");
  }

  const response = await fetch(
    `${backendBaseUrl.replace(/\/$/, "")}/api/v1/analyze/${encodeURIComponent(username)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Backend API failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as BackendResponse;

  const repos = data.analytics.repository_summaries.slice(0, 6).map((repo) => ({
    name: repo.name,
    description: repo.description,
    language: repo.language,
    stars: repo.stars,
    forks: repo.forks,
    openIssues: 0,
    lastUpdated: repo.last_updated ? new Date(repo.last_updated).toLocaleDateString() : "Unknown",
    issues: repo.issues,
    score: repo.score,
  }));

  const totalStars = data.analytics.repository_summaries.reduce((acc, repo) => acc + repo.stars, 0);
  const totalForks = data.analytics.repository_summaries.reduce((acc, repo) => acc + repo.forks, 0);
  const readinessScores = data.recruiter_readiness.scores;

  return {
    username: data.developer.login,
    avatarUrl: data.developer.avatar_url || "",
    name: data.developer.name || data.developer.login,
    bio: data.developer.bio || "",
    followers: data.developer.followers,
    scores: {
      total: readinessScores.overall,
      branding: readinessScores.project_depth,
      repoQuality: Math.round(repos.reduce((acc, repo) => acc + repo.score, 0) / (repos.length || 1)),
      consistency: readinessScores.consistency,
      profile: readinessScores.overall,
      commitHygiene: readinessScores.commit_hygiene,
      velocity: readinessScores.velocity,
      contribution: readinessScores.contribution,
    },
    stats: {
      totalRepos: data.analytics.repository_count,
      totalStars,
      forks: totalForks,
    },
    repos,
    redFlags: data.analytics.red_flags,
    commitAnalytics: mapCommitAnalytics(data.analytics.commit_analytics),
    recommendations: data.recruiter_readiness.recommendations,
  };
}

export async function analyzeProfile(formData: FormData): Promise<ProfileAnalysis & { error?: string }> {
  const rawUsername = formData.get("username") as string;
  const username = rawUsername.trim();
  const persona = (formData.get("persona") as Persona) || "recruiter";

  if (!username) {
    return { error: "Username cannot be empty." } as any;
  }
  if (username.length > 39) {
    return { error: "Invalid GitHub username: too long (max 39 characters)." } as any;
  }
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(username)) {
    return { error: "Invalid GitHub username: only letters, numbers, and hyphens allowed." } as any;
  }

  console.log(`🚀 Starting analysis for: ${username}`);

  try {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN is missing in .env.local");
    }

    let profileData: Partial<ProfileAnalysis>;
    let usedBackend = false;
    try {
      console.log("...Fetching data from Python backend pipeline");
      profileData = await getBackendProfile(username);
      usedBackend = true;
    } catch {
      console.warn("⚠️ Backend API unavailable. Falling back to local GraphQL service.");
      profileData = await getProfileData(username);
      profileData.commitAnalytics = UNAVAILABLE_COMMIT_ANALYTICS;
    }

    if (!usedBackend && !profileData.commitAnalytics) {
      profileData.commitAnalytics = UNAVAILABLE_COMMIT_ANALYTICS;
    }

    console.log("...Fetching AI Review");
    let aiData: { commentary: string; roadmap: string[] };
    try {
      if (!process.env.GROQ_API_KEY) throw new Error("No Groq Key");
      aiData = await generateAIReview(profileData, persona);
    } catch {
      console.warn("⚠️ Groq Failed or Key missing. Using fallback.");
      aiData = {
        commentary: "AI Analysis unavailable. Please add a valid GROQ_API_KEY to .env.local to generate a personalized review.",
        roadmap: profileData.recommendations?.slice(0, 3) ?? [
          "Add GROQ API Key",
          "Check GitHub Token",
          "Review Code Manually",
        ],
      };
    }

    console.log("✅ Analysis Complete");

    return {
      ...profileData,
      aiReview: {
        persona,
        ...aiData,
      },
    } as ProfileAnalysis;

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to analyze profile";
    if (message.includes("GITHUB_TOKEN")) {
      return { error: "GitHub token is missing or invalid. Check your .env.local file." } as any;
    }
    if (message.includes("not found") || message.includes("Could not resolve")) {
      return { error: `GitHub user '${username}' not found.` } as any;
    }
    if (message.includes("rate limit") || message.includes("429")) {
      return { error: "GitHub API rate limit exceeded. Please wait a few minutes and try again." } as any;
    }
    return { error: message } as any;
  }
}
export async function analyzeRepoLink(formData: FormData): Promise<RepoLinkAudit> {
  const repoUrl = formData.get("repoUrl") as string;

  if (!process.env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is missing in .env.local");
  }

  if (!repoUrl?.trim()) {
    throw new Error("Repository URL is required.");
  }

  console.log(`🔍 Starting repo link audit for: ${repoUrl}`);

  try {
    const result = await analyzeRepoFromUrl(repoUrl);
    console.log("✅ Repo audit complete");
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to analyze repository";
    console.error("❌ REPO AUDIT ERROR:", message);
    throw new Error(message);
  }
}
