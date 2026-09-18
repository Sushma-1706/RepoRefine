'use server';

import { getProfileData } from "@/lib/github-service";
import { generateAIReview } from "@/lib/ai-service";
import { analyzeRepoFromUrl } from "@/lib/repo-service";
import { Persona, ProfileAnalysis, RepoLinkAudit } from "@/types";

type ProfileResult = ProfileAnalysis | { error: string };

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
  };
  recruiter_readiness: {
    scores: {
      overall: number;
      consistency: number;
      project_depth: number;
    };
  };
};

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
    lastUpdated: repo.last_updated ? new Date(repo.last_updated).toLocaleDateString() : "Unknown",
    issues: repo.issues,
    openIssues: repo.issues.length,
    score: repo.score,
  }));

  const totalStars = data.analytics.repository_summaries.reduce((acc, repo) => acc + repo.stars, 0);
  const totalForks = data.analytics.repository_summaries.reduce((acc, repo) => acc + repo.forks, 0);

  return {
    username: data.developer.login,
    avatarUrl: data.developer.avatar_url || "",
    name: data.developer.name || data.developer.login,
    bio: data.developer.bio || "",
    followers: data.developer.followers,
    scores: {
      total: data.recruiter_readiness.scores.overall,
      branding: data.recruiter_readiness.scores.project_depth,
      repoQuality: Math.round(repos.reduce((acc, repo) => acc + repo.score, 0) / (repos.length || 1)),
      consistency: data.recruiter_readiness.scores.consistency,
      profile: data.recruiter_readiness.scores.overall,
    },
    stats: {
      totalRepos: data.analytics.repository_count,
      totalStars,
      forks: totalForks,
    },
    repos,
    redFlags: data.analytics.red_flags,
  };
}

export async function analyzeProfile(formData: FormData): Promise<ProfileResult> {
  const rawUsername = formData.get("username") as string;
  const username = rawUsername.trim();
  const persona = (formData.get("persona") as Persona) || "recruiter";

if (!username) {
  return { error: "Username cannot be empty." }
}
if (username.length > 39) {
  return { error: "Invalid GitHub username: too long (max 39 characters)." }
}
if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(username)) {
  return { error: "Invalid GitHub username: only letters, numbers, and hyphens allowed." }
}

  console.log(`🚀 Starting analysis for: ${username}`);

  try {
    // 1. Check Env Vars
    if (!process.env.GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN is missing in .env.local");
    }

   let profileData: Partial<ProfileAnalysis>;
    try {
      console.log("...Fetching data from Python backend pipeline");
      profileData = await getBackendProfile(username);
    } catch {
      console.warn("⚠️ Backend API unavailable. Falling back to local GraphQL service.");
      profileData = await getProfileData(username);
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
        roadmap: ["Add GROQ API Key", "Check GitHub Token", "Review Code Manually"],
      };
    }

    console.log("✅ Analysis Complete");

    // 4. Merge
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
    return { error: "GitHub token is missing or invalid. Check your .env.local file." }
  }
  if (message.includes("not found") || message.includes("Could not resolve")) {
    return { error: `GitHub user '${username}' not found.` }
  }
  if (message.includes("rate limit") || message.includes("429")) {
    return { error: "GitHub API rate limit exceeded. Please wait a few minutes and try again." }
  }
  return { error: message }
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