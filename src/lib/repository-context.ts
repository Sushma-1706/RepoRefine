import { parseRepoUrl } from "@/lib/parse-repo-url";

const CACHE_TTL_MS = Number(process.env.REPOSITORY_CONTEXT_TTL_MS ?? 5 * 60_000);
const MAX_FILES = Number(process.env.REPOSITORY_CONTEXT_MAX_FILES ?? 18);
const MAX_FILE_BYTES = Number(process.env.REPOSITORY_CONTEXT_MAX_FILE_BYTES ?? 75_000);

type GitHubTreeItem = { path: string; type: "blob" | "tree"; size?: number };
type GitHubIssue = { number: number; title: string; body: string | null; labels: Array<{ name: string }>; state: string; created_at: string; updated_at: string; pull_request?: unknown };
type GitHubCommit = { sha: string; commit: { message: string; author: { date: string | null } } };

export type RepositoryFile = { path: string; size: number; language: string; importance: "high" | "medium"; content?: string };
export type RepositoryContext = {
  owner: string; repository: string; branch: string; commitSha: string; description: string | null; visibility: "public" | "private";
  languages: Record<string, number>; frameworks: string[]; packageManager: string | null;
  files: RepositoryFile[]; directories: string[]; entryPoints: string[]; scripts: Record<string, string>;
  environmentVariables: string[]; readme: { path: string; content?: string }; documentation: string[];
  tests: string[]; ciCd: string[]; docker: string[]; security: string[];
  issues: Array<{ number: number; title: string; labels: string[]; state: string; ageDays: number; updatedAt: string }>;
  pullRequests: number; commits: Array<{ sha: string; message: string; date: string | null }>;
  fetchedAt: string; cached: boolean;
};

const cache = new Map<string, { expiresAt: number; context: RepositoryContext }>();
const excluded = /^(node_modules|\.next|dist|build|coverage|\.cache|\.git)\//i;
const highPriority = /(^|\/)(README(?:\.md)?|package\.json|requirements\.txt|pyproject\.toml|setup\.py|Dockerfile|docker-compose(?:\.ya?ml)?|next\.config\.|vite\.config\.|tsconfig\.json|tailwind\.config\.|\.env\.example|CONTRIBUTING\.md|SECURITY\.md|.+\.(?:test|spec)\.[tj]sx?$|\.github\/workflows\/.*\.ya?ml)$/i;
const mediumPriority = /(^|\/)(src|app|pages|api|server|backend|lib|services|hooks)\/.*\.(?:[tj]sx?|py|go|rs)$/i;

function headers() {
  const token = process.env.GITHUB_TOKEN;
  if (token && (typeof token !== 'string' || token.trim().length === 0)) {
    throw new Error("Invalid GITHUB_TOKEN configuration");
  }
  return { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
async function githubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: headers(), next: { revalidate: 0 } });
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 404) throw new Error("Repository not found or your GitHub token cannot access it.");
    if (response.status === 403 && /rate limit/i.test(detail)) throw new Error("GitHub API rate limit exceeded. Wait for the reset time before retrying.");
    throw new Error(`GitHub API request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}
function languageFor(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  return ({ ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript", py: "Python", yml: "YAML", yaml: "YAML", md: "Markdown", json: "JSON", css: "CSS" } as Record<string, string>)[extension ?? ""] ?? "Text";
}
function priority(path: string) { return highPriority.test(path) ? "high" as const : "medium" as const; }
function detectFrameworks(fileMap: Record<string, string>) {
  const packageJson = fileMap["package.json"] ?? "";
  const combined = Object.values(fileMap).join("\n");
  return [["Next.js", /"next"\s*:/], ["React", /"react"\s*:/], ["Tailwind CSS", /tailwindcss/], ["FastAPI", /fastapi/i], ["Express", /"express"\s*:/], ["Docker", /FROM\s+|services:/i]]
    .filter(([, pattern]) => (pattern as RegExp).test(`${packageJson}\n${combined}`)).map(([name]) => name as string);
}
function parseEnv(content = "") { return content.split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("#")).map(line => line.split("=")[0]).filter(Boolean); }

export async function getRepositoryContext(repositoryInput: string, requestedBranch?: string, refresh = false): Promise<RepositoryContext> {
  const { owner, repo } = parseRepoUrl(repositoryInput);
  const repository = await githubJson<{ default_branch: string; description: string | null; pushed_at: string; private: boolean }>(`https://api.github.com/repos/${owner}/${repo}`);
  // This route has no user authentication/session integration. Never use a
  // server-side token as an implicit credential for arbitrary private URLs.
  if (repository.private) throw new Error("Private repositories cannot be indexed until GitHub user authorization is configured.");
  const branch = requestedBranch || repository.default_branch;
  const commit = await githubJson<{ commit: { sha: string } }>(`https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`);
  const cacheKey = `${owner}/${repo}/${branch}/${commit.commit.sha}`;
  const cached = cache.get(cacheKey);
  if (!refresh && cached && cached.expiresAt > Date.now()) return { ...cached.context, cached: true };

  const [treeResult, languages, issuesRaw, pullRequests, commitsRaw] = await Promise.all([
    githubJson<{ tree: GitHubTreeItem[]; truncated: boolean }>(`https://api.github.com/repos/${owner}/${repo}/git/trees/${commit.commit.sha}?recursive=1`),
    githubJson<Record<string, number>>(`https://api.github.com/repos/${owner}/${repo}/languages`),
    githubJson<GitHubIssue[]>(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=30`),
    githubJson<unknown[]>(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=1`),
    githubJson<GitHubCommit[]>(`https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=12`),
  ]);
  const eligible = treeResult.tree.filter(file => file.type === "blob" && !excluded.test(file.path) && file.size !== undefined && file.size <= MAX_FILE_BYTES && (highPriority.test(file.path) || mediumPriority.test(file.path)))
    .sort((a, b) => Number(highPriority.test(b.path)) - Number(highPriority.test(a.path)) || (a.size ?? 0) - (b.size ?? 0)).slice(0, MAX_FILES);
  const contents = await Promise.all(eligible.map(async file => {
    try {
      // Keep every inspected file pinned to the SHA resolved above. Using the
      // moving branch here could mix evidence from different commits.
      const blob = await githubJson<{ content?: string; encoding?: string }>(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${encodeURIComponent(commit.commit.sha)}`);
      return [file.path, blob.encoding === "base64" && blob.content ? Buffer.from(blob.content, "base64").toString("utf8") : ""] as const;
    } catch {
      // A disappearing or unsupported file must not invalidate the complete repository index.
      return [file.path, ""] as const;
    }
  }));
  const fileMap = Object.fromEntries(contents);
  const scripts = (() => { try { return JSON.parse(fileMap["package.json"] ?? "{}").scripts ?? {}; } catch { return {}; } })() as Record<string, string>;
  const paths = treeResult.tree.map(item => item.path);
  const readmePath = paths.find(path => /^readme(?:\.md)?$/i.test(path)) ?? paths.find(path => /(^|\/)readme\.md$/i.test(path)) ?? "README.md";
  const context: RepositoryContext = {
    owner, repository: repo, branch, commitSha: commit.commit.sha, description: repository.description, visibility: repository.private ? "private" : "public", languages, frameworks: detectFrameworks(fileMap),
    packageManager: paths.includes("pnpm-lock.yaml") ? "pnpm" : paths.includes("yarn.lock") ? "yarn" : paths.includes("package-lock.json") || paths.includes("package.json") ? "npm" : paths.includes("requirements.txt") ? "pip" : null,
    files: eligible.map(file => ({ path: file.path, size: file.size ?? 0, language: languageFor(file.path), importance: priority(file.path), content: fileMap[file.path] })),
    directories: [...new Set(paths.map(path => path.split("/").slice(0, -1).join("/")).filter(Boolean))].slice(0, 120), entryPoints: paths.filter(path => /(^|\/)(main|index|page|app)\.(tsx?|jsx?|py)$/i.test(path)).slice(0, 20), scripts,
    environmentVariables: parseEnv(fileMap[".env.example"]), readme: { path: readmePath, content: fileMap[readmePath] }, documentation: paths.filter(path => /(^|\/)(docs\/|README|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT)/i.test(path)).slice(0, 40), tests: paths.filter(path => /(^|\/)(__tests__|tests?|spec)\//i.test(path) || /\.(test|spec)\.[tj]sx?$/i.test(path)).slice(0, 50),
    ciCd: paths.filter(path => /^\.github\/workflows\/.*\.ya?ml$/i.test(path)), docker: paths.filter(path => /(^|\/)(Dockerfile|docker-compose.*)$/i.test(path)), security: paths.filter(path => /(^|\/)(SECURITY\.md|codeql|dependabot)/i.test(path)),
    issues: issuesRaw.filter(issue => !issue.pull_request).map(issue => ({ number: issue.number, title: issue.title, labels: issue.labels.map(label => label.name), state: issue.state, ageDays: Math.floor((Date.now() - new Date(issue.created_at).getTime()) / 86_400_000), updatedAt: issue.updated_at })), pullRequests: pullRequests.length,
    commits: commitsRaw.map(commitItem => ({ sha: commitItem.sha, message: commitItem.commit.message.split("\n")[0], date: commitItem.commit.author.date })), fetchedAt: new Date().toISOString(), cached: false,
  };
  if (treeResult.truncated) context.files.unshift({ path: "[tree truncated]", size: 0, language: "Text", importance: "high", content: "GitHub truncated the recursive tree; results are limited to the returned paths." });
  cache.set(cacheKey, { context, expiresAt: Date.now() + CACHE_TTL_MS });
  return context;
}
