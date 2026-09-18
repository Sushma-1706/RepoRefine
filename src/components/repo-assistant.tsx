'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Bot, FileCode2, Loader2, Send, Square, User } from 'lucide-react';
import { RepoLinkAudit } from '@/types';

type Source = { path: string; startLine: number; endLine: number };
type Message = { role: 'user' | 'assistant'; content: string; sources?: Source[] };
const actions = ['Explain repository', 'Explore architecture', 'Find potential problems', 'Analyze security', 'Review issues', 'Generate README'];

function renderText(content: string) {
  return content.split('\n').map((line, index) => {
    if (line.startsWith('## ')) return <h3 key={index} className="mt-5 mb-2 text-base font-semibold text-slate-100">{line.slice(3)}</h3>;
    if (line.startsWith('### ')) return <h4 key={index} className="mt-4 mb-1 text-sm font-semibold text-slate-200">{line.slice(4)}</h4>;
    if (line.startsWith('- ')) return <p key={index} className="ml-4 py-0.5 text-slate-300 before:mr-2 before:text-slate-500 before:content-['•']">{line.slice(2)}</p>;
    return line ? <p key={index} className="py-1 text-slate-300">{line}</p> : <div key={index} className="h-2" />;
  });
}

export function RepoAssistant({ audit }: { audit: RepoLinkAudit }) {
  const repository = `${audit.owner}/${audit.repo}`;
  const storageKey = `reporefine:chat:${repository}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const abortController = useRef<AbortController | null>(null);
  const scrollTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) { try { setMessages(JSON.parse(saved) as Message[]); return; } catch { window.localStorage.removeItem(storageKey); } }
    setMessages([{ role: 'assistant', content: `I’m ready to help with **${repository}**. I will identify the branch and commit used for each answer, and I’ll call out missing evidence rather than filling gaps.` }]);
  }, [storageKey, repository]);
  useEffect(() => { if (messages.length) window.localStorage.setItem(storageKey, JSON.stringify(messages)); scrollTarget.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, storageKey]);

  const ask = async (question: string) => {
    if (!question.trim() || loading) return;
    const outgoing = question.trim();
    setMessages(current => [...current, { role: 'user', content: outgoing }]);
    setInput(''); setLoading(true);
    abortController.current = new AbortController();
    try {
      const response = await fetch('/api/assistant/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abortController.current.signal, body: JSON.stringify({ repository, message: outgoing }) });
      const payload = await response.json() as { answer?: string; sources?: Source[]; error?: string; context?: { branch: string; commitSha: string; cached: boolean } };
      if (!response.ok) throw new Error(payload.error || 'Assistant request failed.');
      const provenance = payload.context ? `\n\n---\nAnswer grounded in \`${payload.context.branch}\` at \`${payload.context.commitSha.slice(0, 7)}\`${payload.context.cached ? ' (cached index)' : ''}.` : '';
      setMessages(current => [...current, { role: 'assistant', content: `${payload.answer || 'No answer returned.'}${provenance}`, sources: payload.sources }]);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setMessages(current => [...current, { role: 'assistant', content: `## Unable to answer\n${error instanceof Error ? error.message : 'Unknown error'}` }]);
    } finally { setLoading(false); abortController.current = null; }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void ask(input); };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(input); } };

  return <section className="flex min-h-[650px] flex-col" aria-labelledby="assistant-title">
    <header className="flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
      <div><h2 id="assistant-title" className="flex items-center gap-2 text-lg font-semibold text-slate-100"><Bot className="h-5 w-5 text-sky-400" /> Chat</h2><p className="mt-1 text-sm text-slate-400">Ask about the indexed repository. Follow-up questions retain this repository context.</p></div>
      <span className="hidden rounded-full bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300 sm:block">Evidence-grounded</span>
    </header>
    {messages.length <= 1 && <div className="flex flex-wrap gap-2 py-5">{actions.map(action => <button type="button" key={action} onClick={() => void ask(action)} disabled={loading} className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-sky-500 hover:bg-slate-800 hover:text-white disabled:opacity-50">{action}</button>)}</div>}
    <div className="flex-1 space-y-6 overflow-y-auto py-6" aria-live="polite">
      {messages.map((message, index) => <article key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
        {message.role === 'assistant' && <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-sky-400/10 text-sky-300"><Bot className="h-4 w-4" /></span>}
        <div className={message.role === 'user' ? 'max-w-[80%] rounded-2xl rounded-tr-sm bg-sky-600 px-4 py-3 text-sm leading-6 text-white' : 'max-w-3xl text-sm leading-6'}>
          {message.role === 'user' ? message.content : renderText(message.content)}
          {message.sources?.length ? <details className="mt-4 border-t border-slate-800 pt-3"><summary className="cursor-pointer text-xs font-medium text-sky-300">Evidence ({message.sources.length} files)</summary><div className="mt-2 space-y-1">{message.sources.map(item => <p className="flex items-center gap-1 text-xs text-slate-400" key={`${item.path}-${item.startLine}`}><FileCode2 className="h-3.5 w-3.5" /><code>{item.path}</code> <span>lines {item.startLine}–{item.endLine}</span></p>)}</div></details> : null}
        </div>
        {message.role === 'user' && <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-800 text-slate-300"><User className="h-4 w-4" /></span>}
      </article>)}
      {loading && <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Inspecting repository evidence…</div>}
      <div ref={scrollTarget} />
    </div>
    <form onSubmit={submit} className="sticky bottom-0 border-t border-slate-800 bg-[#121925] pt-4">
      <label className="sr-only" htmlFor="repo-assistant-question">Ask about this repository</label>
      <div className="flex gap-2 rounded-xl border border-slate-700 bg-slate-950 p-2 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20"><textarea id="repo-assistant-question" value={input} onChange={event => setInput(event.target.value)} onKeyDown={onKeyDown} rows={2} placeholder="Ask a follow-up question…" className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm text-slate-100 outline-none placeholder:text-slate-500" />{loading ? <button type="button" onClick={() => abortController.current?.abort()} className="self-end rounded-lg bg-slate-800 p-3 text-slate-200" aria-label="Stop generating"><Square className="h-4 w-4" /></button> : <button type="submit" disabled={!input.trim()} className="self-end rounded-lg bg-sky-500 p-3 text-slate-950 transition hover:bg-sky-400 disabled:opacity-40" aria-label="Send message"><Send className="h-4 w-4" /></button>}</div>
      <p className="pt-2 text-xs text-slate-500">Enter to send · Shift+Enter for a new line</p>
    </form>
  </section>;
}
