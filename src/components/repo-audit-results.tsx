'use client';

import { useState } from 'react';
import { RepoLinkAudit } from '@/types';
import { Card, Badge } from '@/components/ui-parts';
import { RepoAssistant } from '@/components/repo-assistant';
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GitBranch,
  Star,
  GitFork,
} from 'lucide-react';

function getScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBg(score: number) {
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 50) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function priorityVariant(priority: string): 'destructive' | 'default' | 'success' {
  if (priority === 'high') return 'destructive';
  if (priority === 'medium') return 'default';
  return 'success';
}

export function RepoAuditResults({ data }: { data: RepoLinkAudit }) {
  const [readmeTab, setReadmeTab] = useState<'generated' | 'original'>('generated');
  const [copied, setCopied] = useState<string | null>(null);

  const readmeContent =
    readmeTab === 'generated' ? data.generatedReadme : data.readme.content || '_No existing README._';

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadReadme = () => {
    const blob = new Blob([data.generatedReadme], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'README.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatIssue = (issue: RepoLinkAudit['suggestedIssues'][0]) =>
    `## ${issue.title}\n\n${issue.body}\n\n**Labels:** ${issue.labels.join(', ')}\n**Priority:** ${issue.priority}`;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight">
                  {data.owner}/{data.repo}
                </h2>
                <a
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm inline-flex items-center gap-1 mt-1"
                >
                  View on GitHub <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {data.aiEnhanced && (
                <Badge variant="success">AI Enhanced</Badge>
              )}
            </div>
            <p className="text-slate-300 text-lg leading-relaxed">
              {data.metadata.description || (
                <span className="text-slate-600 italic">No repository description</span>
              )}
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4" /> {data.metadata.stars} Stars
              </span>
              <span className="flex items-center gap-1">
                <GitFork className="w-4 h-4" /> {data.metadata.forks} Forks
              </span>
              <span className="flex items-center gap-1">
                <GitBranch className="w-4 h-4" /> {data.metadata.language || 'Unknown'}
              </span>
              <span>Updated {data.metadata.lastPushed}</span>
            </div>
          </div>
        </div>

        <div
          className={`md:col-span-4 rounded-2xl p-8 flex flex-col items-center justify-center border ${getScoreBg(data.health.score)}`}
        >
          <span className="text-slate-400 font-medium uppercase tracking-widest text-sm mb-2">
            Health Score
          </span>
          <span className={`text-8xl font-black tracking-tighter ${getScoreColor(data.health.score)}`}>
            {data.health.score}
          </span>
          <span className="text-slate-500 text-sm mt-2">
            Docs: {data.health.documentationScore}/100
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-emerald-600 rounded-2xl blur opacity-20" />
        <div className="relative bg-slate-900 border border-slate-800 p-8 rounded-2xl">
          <p className="text-slate-300 text-lg leading-relaxed">{data.improvementSummary}</p>
        </div>
      </div>

      <RepoAssistant audit={data} />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-4 space-y-8">
          <Card>
            <h3 className="font-bold text-white mb-4 text-lg">Tech Stack</h3>
            <div className="space-y-4 text-sm">
              {data.techStack.languages.length > 0 && (
                <div>
                  <p className="text-slate-500 mb-2">Languages</p>
                  <div className="flex flex-wrap gap-2">
                    {data.techStack.languages.map((lang) => (
                      <Badge key={lang}>{lang}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {data.techStack.frameworks.length > 0 && (
                <div>
                  <p className="text-slate-500 mb-2">Frameworks</p>
                  <div className="flex flex-wrap gap-2">
                    {data.techStack.frameworks.map((fw) => (
                      <Badge key={fw} variant="success">{fw}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {data.techStack.packageManagers.length > 0 && (
                <div>
                  <p className="text-slate-500 mb-2">Package Managers</p>
                  <div className="flex flex-wrap gap-2">
                    {data.techStack.packageManagers.map((pm) => (
                      <Badge key={pm}>{pm}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {data.techStack.infra.length > 0 && (
                <div>
                  <p className="text-slate-500 mb-2">Infrastructure</p>
                  <div className="flex flex-wrap gap-2">
                    {data.techStack.infra.map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="font-bold text-white mb-4 text-lg">Repository Signals</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant={data.signals.hasCI ? 'success' : 'destructive'}>
                {data.signals.hasCI ? 'CI/CD' : 'No CI/CD'}
              </Badge>
              <Badge variant={data.signals.hasTests ? 'success' : 'destructive'}>
                {data.signals.hasTests ? 'Tests' : 'No Tests'}
              </Badge>
              <Badge variant={data.signals.hasDocker ? 'success' : 'default'}>
                {data.signals.hasDocker ? 'Docker' : 'No Docker'}
              </Badge>
              <Badge variant={data.signals.hasEnvExample ? 'success' : 'destructive'}>
                {data.signals.hasEnvExample ? '.env.example' : 'No .env.example'}
              </Badge>
              <Badge variant={data.metadata.license ? 'success' : 'destructive'}>
                {data.metadata.license || 'No License'}
              </Badge>
            </div>
            {data.signals.configFiles.length > 0 && (
              <p className="text-xs text-slate-500 mt-4">
                Config: {data.signals.configFiles.slice(0, 8).join(', ')}
                {data.signals.configFiles.length > 8 && '…'}
              </p>
            )}
          </Card>

          <Card className="border-red-900/30 bg-red-950/10">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="text-red-500 w-5 h-5" />
              Issues Found
            </h3>
            <ul className="space-y-2">
              {data.health.issues.length === 0 && (
                <li className="text-emerald-400 text-sm flex gap-2">
                  <CheckCircle className="w-4 h-4" /> Healthy repository!
                </li>
              )}
              {data.health.issues.map((issue, i) => (
                <li
                  key={i}
                  className="text-sm text-red-200 bg-red-500/10 p-2 rounded-lg border border-red-500/10"
                >
                  {issue}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h3 className="font-bold text-white mb-4 text-lg">README Sections</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-emerald-400 mb-2">Found</p>
                <div className="flex flex-wrap gap-2">
                  {data.readme.sectionsFound.length === 0 && (
                    <span className="text-slate-500">None detected</span>
                  )}
                  {data.readme.sectionsFound.map((s) => (
                    <Badge key={s} variant="success">{s}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-amber-400 mb-2">Missing</p>
                <div className="flex flex-wrap gap-2">
                  {data.readme.sectionsMissing.length === 0 && (
                    <span className="text-slate-500">All key sections present</span>
                  )}
                  {data.readme.sectionsMissing.map((s) => (
                    <Badge key={s} variant="destructive">{s}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="md:col-span-8 space-y-8">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                README
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReadmeTab('generated')}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                    readmeTab === 'generated'
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Generated
                </button>
                <button
                  onClick={() => setReadmeTab('original')}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                    readmeTab === 'original'
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Original
                </button>
                <button
                  onClick={() => copyText(readmeContent, 'readme')}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-700 text-slate-400 hover:text-white transition"
                >
                  <Copy className="w-4 h-4" />
                  {copied === 'readme' ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={downloadReadme}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-700 text-slate-400 hover:text-white transition"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
            <pre className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-[500px] overflow-y-auto font-mono">
              {readmeContent}
            </pre>
          </Card>

          <div className="bg-gradient-to-br from-emerald-900/20 to-slate-900 border border-emerald-900/30 rounded-2xl p-6 md:p-8">
            <h3 className="font-bold text-white mb-6 flex items-center gap-2 text-xl">
              <CheckCircle className="text-emerald-500 w-6 h-6" />
              Suggested GitHub Issues
            </h3>
            <div className="grid gap-4">
              {data.suggestedIssues.map((issue, i) => (
                <div
                  key={i}
                  className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/50 hover:bg-slate-900 transition"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h4 className="font-bold text-white">{issue.title}</h4>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={priorityVariant(issue.priority)}>{issue.priority}</Badge>
                      <button
                        onClick={() => copyText(formatIssue(issue), `issue-${i}`)}
                        className="text-slate-500 hover:text-white transition"
                        title="Copy issue template"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm whitespace-pre-wrap">{issue.body}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {issue.labels.map((label) => (
                      <Badge key={label}>{label}</Badge>
                    ))}
                  </div>
                  {copied === `issue-${i}` && (
                    <p className="text-emerald-400 text-xs mt-2">Copied to clipboard!</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
