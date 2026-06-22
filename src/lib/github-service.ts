import { AnalyzedRepo, ProfileAnalysis } from "@/types";
import { github, formatGitHubError } from "@/lib/github/client";
import { ProfileQueryResponse } from "@/lib/github/graphql-types";
import {
  DocumentationMatch,
  evaluateDocumentation,
  findDocumentationMatch,
  TreeEntry,
} from "@/lib/documentation-detection";

const PROFILE_QUERY = `
  query($username: String!) {
    user(login: $username) {
      name
      avatarUrl
      bio
      company
      location
      twitterUsername
      websiteUrl
      followers { totalCount }
      
      stats: repositories(ownerAffiliations: OWNER) {
        totalCount
      }

      repositories(first: 100, orderBy: {field: STARGAZERS, direction: DESC}, ownerAffiliations: OWNER, isFork: false) {
        nodes {
          name
          description
          stargazerCount
          forkCount
          pushedAt
          isEmpty
          primaryLanguage { name }
          licenseInfo { name }
          rootTree: object(expression: "HEAD:") {
            ... on Tree {
              entries { name type }
            }
          }
          docsTree: object(expression: "HEAD:docs") {
            ... on Tree {
              entries { name type }
            }
          }
          docTree: object(expression: "HEAD:doc") {
            ... on Tree {
              entries { name type }
            }
          }
          documentationTree: object(expression: "HEAD:documentation") {
            ... on Tree {
              entries { name type }
            }
          }
          openIssues: issues(states: OPEN) { totalCount }
          object(expression: "HEAD:README.md") {
            ... on Blob { text }
          }
        }
      }
    }
  }
`;

function buildDocumentationContentQuery(
  username: string,
  matches: Array<{ repoName: string; match: DocumentationMatch }>
): string {
  const repoFields = matches
    .map(
      ({ repoName, match }, index) => `
    repo_${index}: repository(name: "${repoName}") {
      name
      documentationContent: object(expression: "${match.expression}") {
        ... on Blob { text }
      }
    }`
    )
    .join("\n");

  return `
    query($username: String!) {
      user(login: $username) {
        ${repoFields}
      }
    }
  `;
}

async function fetchDocumentationContents(
  username: string,
  matches: Array<{ repoName: string; match: DocumentationMatch }>
): Promise<Map<string, string | null>> {
  const contentByRepo = new Map<string, string | null>();
  if (matches.length === 0) return contentByRepo;

  const query = buildDocumentationContentQuery(username, matches);
  const data: Record<string, any> = await github(query, { username });

  for (let index = 0; index < matches.length; index += 1) {
    const repoName = matches[index].repoName;
    const repoData = data.user?.[`repo_${index}`];
    contentByRepo.set(repoName, repoData?.documentationContent?.text ?? null);
  }

  return contentByRepo;
}

/**
 * Parse README headings and detect present/missing sections.
 * This is used to ensure the documentation is comprehensive.
 */
function detectReadmeSections(text: string): { detected: string[]; missing: string[] } {
  // Recruiter-focused sections with common heading variations
  const sectionVariants: { key: string; variants: string[] }[] = [
    { key: "overview", variants: ["overview", "about", "introduction", "what is"] },
    { key: "features", variants: ["features", "highlights", "what it does"] },
    { key: "tech stack", variants: ["tech stack", "technologies", "built with", "stack"] },
    { key: "installation", variants: ["installation", "getting started", "setup", "how to run"] },
    { key: "usage", variants: ["usage", "how to use", "how it works", "running"] },
    { key: "demo", variants: ["demo", "screenshots", "preview", "live demo"] },
    { key: "limitations", variants: ["limitations", "known issues", "caveats"] },
    { key: "future", variants: ["future", "future enhancements", "roadmap", "future scope", "upcoming"] },
  ];

  // Extract only headings (lines starting with #, ##, ###)
  const headings = text
    .split("\n")
    .filter(line => /^#{1,3}\s+/.test(line))
    .map(line => line.replace(/^#+\s+/, "").toLowerCase().trim());

  const detected = sectionVariants
    .filter(section => headings.some(h => section.variants.some(v => h.includes(v))))
    .map(s => s.key);

  const missing = sectionVariants
    .filter(s => !detected.includes(s.key))
    .map(s => s.key);

  return { detected, missing };
}

export async function getProfileData(username: string): Promise<Partial<ProfileAnalysis>> {
  try {
    const data = (await github(PROFILE_QUERY, { username })) as ProfileQueryResponse;

    if (!data.user) {
      throw new Error(`User '${username}' not found on GitHub.`);
    }

    const user = data.user;
    const breakdown: { label: string; value: number; reason: string }[] = [];
    const repoNodes: any[] = user.repositories.nodes;

    const documentationMatches = repoNodes.map((repo) => ({
      repoName: repo.name as string,
      match: findDocumentationMatch(
        repo.rootTree?.entries as TreeEntry[] | undefined,
        repo.docsTree?.entries as TreeEntry[] | undefined,
        repo.docTree?.entries as TreeEntry[] | undefined,
        repo.documentationTree?.entries as TreeEntry[] | undefined
      ),
      isEmpty: Boolean(repo.isEmpty),
    }));

    const reposNeedingContent = documentationMatches.filter(
      ({ match, isEmpty }) => match && !isEmpty
    ) as Array<{ repoName: string; match: DocumentationMatch; isEmpty: boolean }>;

    const documentationContents = await fetchDocumentationContents(
      username,
      reposNeedingContent.map(({ repoName, match }) => ({ repoName, match }))
    );

    const analyzedRepos: AnalyzedRepo[] = repoNodes.map((repo: any) => {
      const issues: string[] = [];
      let score = 100;

      if (!repo.description) { issues.push("Missing Description"); score -= 10; }
      if (!repo.licenseInfo) { issues.push("No License"); score -= 20; }
      const docMatchInfo = documentationMatches.find((entry) => entry.repoName === repo.name);
      const docEvaluation = evaluateDocumentation(
        docMatchInfo?.match ?? null,
        documentationContents.get(repo.name),
        docMatchInfo?.isEmpty ?? false
      );
      issues.push(...docEvaluation.issues);
      score -= docEvaluation.scoreDeduction;
      
      // Strict README check
      if (!repo.object?.text) {
        issues.push("No README");
        score -= 40;
      } else {
        const { detected, missing } = detectReadmeSections(repo.object.text);
        if (detected.length < 2) {
          issues.push("Weak README (missing key sections)");
          score -= 20;
        }
        if (missing.length > 5) {
          issues.push(`README missing: ${missing.slice(0, 3).join(", ")}`);
          score -= 10;
        }
      }     
      const lastPush = new Date(repo.pushedAt);
      const daysSincePush = (Date.now() - lastPush.getTime()) / (1000 * 3600 * 24);
      if (daysSincePush > 365) { issues.push("Inactive > 1yr"); score -= 10; }

      const openIssueCount = repo.openIssues?.totalCount || 0;
      if (openIssueCount > 10) { issues.push(`${openIssueCount} stale open issues`); score -= 15; }
      else if (openIssueCount > 5) { issues.push(`${openIssueCount} open issues`); score -= 5; }

      return {
        name: repo.name,
        description: repo.description || "",
        language: repo.primaryLanguage?.name || "Unknown",
        stars: repo.stargazerCount,
        forks: repo.forkCount,
        openIssues: openIssueCount,
        lastUpdated: new Date(repo.pushedAt).toLocaleDateString(),
        issues,
        score: Math.max(0, score),
      };
    });

    const topRepos = analyzedRepos.slice(0, 10);
    const otherRepos = analyzedRepos.slice(10);

    const topAvg = topRepos.reduce((acc, r) => acc + r.score, 0) / (topRepos.length || 1);
    const otherAvg = otherRepos.length > 0
      ? otherRepos.reduce((acc, r) => acc + r.score, 0) / otherRepos.length
      : topAvg;

    const weightedRepoScore = Math.round((topAvg * 0.8) + (otherAvg * 0.2));

    breakdown.push({
      label: "Code Standards",
      value: weightedRepoScore,
      reason: `Weighted score of ${analyzedRepos.length} repositories (Top 10 impactful projects prioritized).`,
    });

    let brandingScore = 0;
    if (user.bio) brandingScore += 20;
    if (user.company) brandingScore += 10;
    if (user.location) brandingScore += 10;
    if (user.websiteUrl) brandingScore += 30;
    if (user.twitterUsername) brandingScore += 10;
    if (user.avatarUrl) brandingScore += 20;

    breakdown.push({
      label: "Profile Completeness",
      value: brandingScore,
      reason: user.bio ? "Bio and links present." : "Missing key profile details.",
    });

    const recentActivity = analyzedRepos.some((r) => {
      const date = new Date(r.lastUpdated);
      const days = (Date.now() - date.getTime()) / (1000 * 3600 * 24);
      return days < 30;
    });

    const consistencyScore = recentActivity ? 95 : 40;

    breakdown.push({
      label: "Activity Health",
      value: consistencyScore,
      reason: recentActivity ? "Recent contributions detected." : "No code pushed in over 30 days.",
    });

    const totalScore = Math.round(
      (weightedRepoScore * 0.5) +
      (brandingScore * 0.2) +
      (consistencyScore * 0.3)
    );

    return {
      username,
      avatarUrl: user.avatarUrl,
      name: user.name || username,
      bio: user.bio || "",
      followers: user.followers.totalCount,
      scores: {
        total: totalScore,
        branding: brandingScore,
        repoQuality: weightedRepoScore,
        consistency: consistencyScore,
        profile: totalScore,
      },
      stats: {
        totalRepos: user.stats.totalCount,
        totalStars: analyzedRepos.reduce((acc, r) => acc + r.stars, 0),
        forks: analyzedRepos.reduce((acc, r) => acc + r.forks, 0),
      },
      repos: analyzedRepos,
      redFlags: analyzedRepos.flatMap((r) => r.issues).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5),
    };
  } catch (error: unknown) {
    console.error("GitHub API Error Details:", error);
    throw new Error(formatGitHubError(error));
  }
}
