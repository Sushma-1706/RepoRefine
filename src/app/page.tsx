'use client';

import { useState } from 'react';
import { analyzeProfile, analyzeRepoLink } from './actions';
import { ProfileAnalysis, RepoLinkAudit, AuditMode } from '@/types';
import { AuditChart } from '@/components/audit-chart';
import { CommitAnalyticsSection } from '@/components/commit-analytics';
import { RepoAuditResults } from '@/components/repo-audit-results';
import { Card, Badge, ProgressBar } from '@/components/ui-parts';
import { Loader2, Github, AlertTriangle, CheckCircle, Quote, Star, GitFork, Users, ArrowLeft, RefreshCcw, Link2 } from 'lucide-react';

export default function Home() {
  const [mode, setMode] = useState<AuditMode>('profile');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ProfileAnalysis | null>(null);
  const [repoData, setRepoData] = useState<RepoLinkAudit | null>(null);
  const [error, setError] = useState("");
  const [lastInput, setLastInput] = useState<{ username: string; persona: string } | null>(null);
  const [lastRepoUrl, setLastRepoUrl] = useState<string | null>(null);

  const hasResults = Boolean(data || repoData);

  async function handleProfileSubmit(formData: FormData) {
    const username = formData.get("username") as string;
    const persona = formData.get("persona") as string;
    setLastInput({ username, persona });
    setLoading(true);
    setError("");
    setData(null);
    setRepoData(null);
    try {
      const result = await analyzeProfile(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not analyze profile.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleRepoSubmit(formData: FormData) {
    const repoUrl = formData.get("repoUrl") as string;
    setLastRepoUrl(repoUrl);
    setLoading(true);
    setError("");
    setData(null);
    setRepoData(null);
    try {
      const result = await analyzeRepoLink(formData);
      setRepoData(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not analyze repository.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const handleRefresh = async () => {
    if (mode === 'profile' && lastInput) {
      setRefreshing(true);  // changed
      setError("");
      try {
        const formData = new FormData();
        formData.set("username", lastInput.username);
        formData.set("persona", lastInput.persona);
        const result = await analyzeProfile(formData);
        if (result.error) {
          setError(result.error);
        } else {
          setData(result);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not analyze profile.";
        setError(msg);
      } finally {
        setRefreshing(false);  // changed
      }
    } else if (mode === 'repo' && lastRepoUrl) {
      setRefreshing(true);  // changed
      setError("");
      try {
        const formData = new FormData();
        formData.set("repoUrl", lastRepoUrl);
        const result = await analyzeRepoLink(formData);
        setRepoData(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not analyze repository.";
        setError(message);
      } finally {
        setRefreshing(false);  // changed
      }
    }
  };

  const handleReset = () => {
    setData(null);
    setRepoData(null);
    setError("");
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 50) return "text-amber-400";
    return "text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-emerald-500/10 border-emerald-500/20";
    if (score >= 50) return "bg-amber-500/10 border-amber-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 selection:bg-blue-500/30 pb-20">
      <nav className="border-b border-slate-800 p-4 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div
            className="flex items-center gap-2 text-blue-500 font-bold text-xl tracking-tight cursor-pointer hover:opacity-80 transition"
            onClick={handleReset}
          >
            <Github className="w-6 h-6" />
            <span>RepoRefine</span>
          </div>

          {hasResults && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-full border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-full border border-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-12">

        {!hasResults && (
          <section className="text-center py-20 space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white">
                {mode === 'profile' ? (
                  <>Is your profile <br className="hidden md:block" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">hiring ready?</span></>
                ) : (
                  <>Does your repo have a <br className="hidden md:block" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">great README?</span></>
                )}
              </h1>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed">
                {mode === 'profile'
                  ? "Analyze your GitHub profile, repos, and activity to see exactly what recruiters notice — and what to fix."
                  : "Paste a repository link to audit its structure, detect the tech stack, generate a README draft, and get actionable improvement issues."}
              </p>
            </div>

            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => { setMode('profile'); setError(''); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border transition ${mode === 'profile'
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
              >
                <Users className="w-4 h-4" />
                Profile Audit
              </button>
              <button
                type="button"
                onClick={() => { setMode('repo'); setError(''); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border transition ${mode === 'repo'
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
              >
                <Link2 className="w-4 h-4" />
                Repo Link Audit
              </button>
            </div>

            {mode === 'profile' ? (
              <form action={handleProfileSubmit} className="max-w-lg mx-auto relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative flex bg-slate-900 rounded-xl p-2 border border-slate-800 shadow-2xl">
                  <input
                    name="username"
                    placeholder="github_username"
                    className="flex-1 bg-transparent border-none outline-none text-white px-4 placeholder:text-slate-600 text-lg"
                    required
                  />
                  <div className="border-l border-slate-800 mx-2"></div>
                  <select name="persona" className="bg-transparent text-slate-300 text-sm font-medium px-2 outline-none cursor-pointer hover:text-white">
                    <option value="recruiter" className="text-black">Recruiter</option>
                    <option value="mentor" className="text-black">Mentor</option>
                    <option value="roast" className="text-black">Roast Mode</option>
                  </select>
                  <button
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ml-2"
                  >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Analyze"}
                  </button>
                </div>
              </form>
            ) : (
              <form action={handleRepoSubmit} className="max-w-2xl mx-auto relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative flex bg-slate-900 rounded-xl p-2 border border-slate-800 shadow-2xl">
                  <input
                    name="repoUrl"
                    placeholder="https://github.com/owner/repo"
                    className="flex-1 bg-transparent border-none outline-none text-white px-4 placeholder:text-slate-600 text-lg"
                    required
                  />
                  <button
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ml-2"
                  >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Audit Repo"}
                  </button>
                </div>
              </form>
            )}

            {error && (
              <p className="text-red-400 font-medium bg-red-950/30 inline-block px-4 py-2 rounded-lg border border-red-900/50">
                {error}
              </p>
            )}
          </section>
        )}

        {data && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-8 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center md:items-start backdrop-blur-sm">
                <img
                  src={data.avatarUrl}
                  className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-slate-800 shadow-xl"
                  alt="avatar"
                />
                <div className="space-y-4 text-center md:text-left flex-1">
                  <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">{data.name}</h2>
                    <p className="text-blue-400 font-medium">@{data.username}</p>
                  </div>
                  <p className="text-slate-300 text-lg leading-relaxed max-w-xl">
                    {data.bio || <span className="text-slate-600 italic">No bio provided (That&apos;s a red flag 🚩)</span>}
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-slate-400">
                    <div className="flex items-center gap-1"><Users className="w-4 h-4" /> {data.followers} Followers</div>
                    <div className="flex items-center gap-1"><Star className="w-4 h-4" /> {data.stats.totalStars} Stars</div>
                    <div className="flex items-center gap-1"><Github className="w-4 h-4" /> {data.stats.totalRepos} Repos</div>
                  </div>
                </div>
              </div>

              <div className={`md:col-span-4 rounded-2xl p-8 flex flex-col items-center justify-center border ${getScoreBg(data.scores.total)}`}>
                <span className="text-slate-400 font-medium uppercase tracking-widest text-sm mb-2">Overall Grade</span>
                <span className={`text-8xl font-black tracking-tighter ${getScoreColor(data.scores.total)}`}>
                  {data.scores.total}
                </span>
                <div className="mt-4 w-full bg-slate-900/50 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${data.scores.total >= 80 ? 'bg-emerald-500' : data.scores.total >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${data.scores.total}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-20"></div>
              <div className="relative bg-slate-900 border border-slate-800 p-8 md:p-10 rounded-2xl shadow-2xl">
                <div className="flex items-start gap-4">
                  <Quote className="w-10 h-10 text-slate-600 shrink-0" />
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                        {data.aiReview.persona} Mode
                      </span>
                      <span className="text-slate-500 text-sm">AI Analysis</span>
                    </div>
                    <p className="text-xl md:text-2xl text-slate-200 leading-relaxed font-light">
                      &ldquo;{data.aiReview.commentary}&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <CommitAnalyticsSection analytics={data.commitAnalytics} />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-4">
              <div className="md:col-span-4 space-y-8">
                <Card>
                  <h3 className="font-bold text-white mb-6 text-lg">Skill Balance</h3>
                  <div className="-ml-4">
                    <AuditChart scores={data.scores} />
                  </div>
                </Card>

                <Card className="border-red-900/30 bg-red-950/10">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="text-red-500 w-5 h-5" />
                    Critical Red Flags
                  </h3>
                  <ul className="space-y-3">
                    {data.redFlags.length === 0 && <li className="text-emerald-400 text-sm flex gap-2"><CheckCircle className="w-4 h-4" /> Clean profile!</li>}
                    {data.redFlags.map((flag, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-red-200 bg-red-500/10 p-3 rounded-lg border border-red-500/10">
                        <span className="text-red-500 mt-0.5">•</span> {flag}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <div className="md:col-span-8 space-y-8">
                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-white text-lg">Repository Audit</h3>
                    <span className="text-xs text-slate-500">Last 6 active repos</span>
                  </div>
                  <div className="grid gap-4">
                    {data.repos.map((repo, i) => (
                      <div key={i} className="group p-5 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-blue-500/50 transition duration-300">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-blue-400 text-lg group-hover:text-blue-300 transition">{repo.name}</h4>
                            <div className="flex gap-3 text-xs text-slate-500 mt-1">
                              <span>{repo.language}</span>
                              <span>|</span>
                              <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {repo.stars}</span>
                              <span>|</span>
                              <span className="flex items-center gap-1"><GitFork className="w-3 h-3" /> {repo.forks}</span>
                              <span>|</span>
                              <span>Updated {repo.lastUpdated}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={`text-2xl font-black ${getScoreColor(repo.score)}`}>
                              {repo.score}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {repo.issues.length === 0 && <Badge variant="success">Perfect Score</Badge>}
                          {repo.issues.map((issue, j) => (
                            <Badge key={j} variant="destructive">{issue}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="bg-gradient-to-br from-emerald-900/20 to-slate-900 border border-emerald-900/30 rounded-2xl p-6 md:p-8">
                  <h3 className="font-bold text-white mb-6 flex items-center gap-2 text-xl">
                    <CheckCircle className="text-emerald-500 w-6 h-6" />
                    Recommended Fixes
                  </h3>
                  <div className="grid gap-4">
                    {data.aiReview.roadmap.map((item, i) => (
                      <div key={i} className="flex gap-4 items-start p-4 bg-slate-950/50 rounded-xl border border-slate-800/50 hover:bg-slate-900 transition">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-slate-200 text-base pt-1">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {repoData && <RepoAuditResults data={repoData} />}
      </div>
    </main>
  );
}
