'use client';

import { FormEvent, useState } from 'react';
import { Bot, FileCode2, Loader2, Send } from 'lucide-react';
import { RepoLinkAudit } from '@/types';

type Message = { role: 'user' | 'assistant'; content: string; sources?: Array<{ path: string; startLine: number; endLine: number }> };
const quickActions = [
  ['Explain Repository', '/repo-summary'], ['Generate README', '/readme'], ['Analyze Architecture', '/architecture'], ['Analyze Issues', '/issues'], ['Analyze Security', '/security'], ['Analyze CI/CD', '/ci'], ['Find Problems', 'What repository health signals need attention?'], ['Explain Code', '/explain src/app/page.tsx'],
];

export function RepoAssistant({ audit }: { audit: RepoLinkAudit }) {
  const repository = `${audit.owner}/${audit.repo}`;
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: `I’m ready to inspect **${repository}**. I retrieve its GitHub metadata, tree, prioritized files, issues, commits, and workflows before answering repository-specific questions.` }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const ask = async (question: string) => {
    if (!question.trim() || loading) return;
    setMessages(current => [...current, { role: 'user', content: question }]); setInput(''); setLoading(true);
    try {
      const response = await fetch('/api/assistant/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repository, message: question }) });
      const payload = await response.json() as { answer?: string; sources?: Message['sources']; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Assistant request failed.');
      setMessages(current => [...current, { role: 'assistant', content: payload.answer || 'No answer returned.', sources: payload.sources }]);
    } catch (error) { setMessages(current => [...current, { role: 'assistant', content: `**Unable to inspect the repository:** ${error instanceof Error ? error.message : 'Unknown error'}` }]); }
    finally { setLoading(false); }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void ask(input); };
  return <section className="rounded-2xl border border-blue-500/20 bg-slate-900/70 shadow-2xl overflow-hidden" aria-labelledby="assistant-title">
    <header className="p-5 border-b border-slate-800 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><h2 id="assistant-title" className="text-xl font-bold text-white flex items-center gap-2"><Bot className="w-5 h-5 text-blue-400" /> RepoRefine AI</h2><p className="text-sm text-slate-400 mt-1">Repository context: <span className="text-slate-200">{repository}</span> · branch detected by GitHub</p></div>
      <span className="text-xs text-blue-300 border border-blue-500/20 bg-blue-500/10 rounded-full px-3 py-1.5">Evidence-grounded assistant</span>
    </header>
    <div className="p-4 border-b border-slate-800 flex flex-wrap gap-2" aria-label="Assistant quick actions">{quickActions.map(([label, prompt]) => <button type="button" key={label} onClick={() => void ask(prompt)} disabled={loading} className="text-xs font-medium text-slate-300 hover:text-white border border-slate-700 hover:border-blue-500/60 rounded-lg px-3 py-2 transition disabled:opacity-50">{label}</button>)}</div>
    <div className="p-5 space-y-4 max-h-[560px] overflow-y-auto" aria-live="polite">{messages.map((message, index) => <article key={index} className={`rounded-xl p-4 ${message.role === 'user' ? 'ml-4 bg-blue-600/20 border border-blue-500/20' : 'mr-4 bg-slate-950/60 border border-slate-800'}`}><p className="text-xs font-bold uppercase tracking-wider mb-2 text-slate-500">{message.role === 'user' ? 'You' : 'RepoRefine AI'}</p><div className="text-sm leading-6 text-slate-200 whitespace-pre-wrap">{message.content}</div>{message.sources && message.sources.length > 0 && <div className="mt-3 pt-3 border-t border-slate-800"><p className="text-xs text-slate-500 mb-1">Repository evidence</p>{message.sources.map(item => <p className="text-xs text-blue-300 flex gap-1" key={`${item.path}-${item.startLine}`}><FileCode2 className="w-3.5 h-3.5 shrink-0" />{item.path} · lines {item.startLine}–{item.endLine}</p>)}</div>}</article>)}{loading && <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Indexing repository context…</div>}</div>
    <form onSubmit={submit} className="p-4 border-t border-slate-800 flex gap-2"><label className="sr-only" htmlFor="repo-assistant-question">Ask about this repository</label><input id="repo-assistant-question" value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about this repository…" className="min-w-0 flex-1 bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500" /><button type="submit" disabled={loading || !input.trim()} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl px-4 py-3 text-sm font-bold text-white"><Send className="w-4 h-4" /> Send</button></form>
  </section>;
}
