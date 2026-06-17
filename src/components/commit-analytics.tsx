'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CommitAnalytics } from '@/types';
import { Card, ProgressBar } from '@/components/ui-parts';
import {
  Activity,
  AlertTriangle,
  Clock,
  GitCommitHorizontal,
  Moon,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function formatMonth(month: string) {
  const [year, value] = month.split('-');
  const date = new Date(Number(year), Number(value) - 1, 1);
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function TrendIcon({ direction }: { direction: CommitAnalytics['contributionTrend']['direction'] }) {
  if (direction === 'up') return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  if (direction === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-400">
      {message}
    </div>
  );
}

export function CommitAnalyticsSection({ analytics }: { analytics?: CommitAnalytics }) {
  if (!analytics?.available) {
    return (
      <Card>
        <h3 className="font-bold text-white mb-2 text-lg">Commit & Activity Analytics</h3>
        <p className="text-slate-400 text-sm mb-4">
          Commit hygiene, contribution trends, inactivity gaps, and chronotype patterns are provided by the Python backend.
        </p>
        <EmptyState message={analytics?.hygiene.insights[0] ?? 'Commit analytics are currently unavailable.'} />
      </Card>
    );
  }

  const { hygiene, contributionTrend, inactivity, chronotype } = analytics;

  return (
    <section className="space-y-6">
      <div>
        <h3 className="font-bold text-white text-2xl">Commit & Activity Analytics</h3>
        <p className="text-slate-400 text-sm mt-1">
          Hygiene, contribution cadence, inactivity gaps, and your most active days and times.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h4 className="font-bold text-white flex items-center gap-2">
                <GitCommitHorizontal className="w-5 h-5 text-blue-400" />
                Commit Hygiene
              </h4>
              <p className="text-slate-400 text-sm mt-1">
                {hygiene.analyzedCount} sampled messages analyzed
              </p>
            </div>
            <span className={`text-4xl font-black ${scoreColor(hygiene.score)}`}>{hygiene.score}</span>
          </div>

          <ProgressBar value={hygiene.score} className="bg-blue-500" />

          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
              <p className="text-emerald-300 font-semibold">{hygiene.goodCount}</p>
              <p className="text-slate-400">Clear messages</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-amber-300 font-semibold">{hygiene.weakCount}</p>
              <p className="text-slate-400">Needs improvement</p>
            </div>
          </div>

          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {hygiene.insights.map((insight) => (
              <li key={insight} className="flex gap-2">
                <span className="text-blue-400">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h4 className="font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                Contribution Trend
              </h4>
              <p className="text-slate-400 text-sm mt-1">
                {contributionTrend.totalLastYear} contributions in the last year
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300 capitalize">
              <TrendIcon direction={contributionTrend.direction} />
              {contributionTrend.direction}
            </div>
          </div>

          {contributionTrend.monthly.length === 0 ? (
            <EmptyState message="No monthly contribution data available for this profile." />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={contributionTrend.monthly}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonth}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                    labelFormatter={(label) => formatMonth(String(label))}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={{ fill: '#34d399', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <p className="text-xs text-slate-500 mt-3">
            Recent 3-month avg: {contributionTrend.recentAverage} · Prior 3-month avg:{' '}
            {contributionTrend.priorAverage}
          </p>
        </Card>

        <Card>
          <h4 className="font-bold text-white flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Inactivity Gaps
          </h4>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
              <p className="text-2xl font-bold text-white">{inactivity.longestGapDays}</p>
              <p className="text-xs text-slate-400">Longest gap (days)</p>
            </div>
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
              <p className="text-2xl font-bold text-white">{inactivity.gapsOver30Days}</p>
              <p className="text-xs text-slate-400">Gaps over 30 days</p>
            </div>
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
              <p className="text-2xl font-bold text-white">
                {inactivity.daysSinceLastCommit ?? '—'}
              </p>
              <p className="text-xs text-slate-400">Days since last commit</p>
            </div>
          </div>

          <p className="text-sm text-slate-300 mb-3">{inactivity.insight}</p>

          {inactivity.notableGaps.length === 0 ? (
            <EmptyState message="No major inactivity gaps detected in the sampled history." />
          ) : (
            <div className="space-y-2">
              {inactivity.notableGaps.map((gap) => (
                <div
                  key={`${gap.start}-${gap.end}`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">
                    {gap.start} → {gap.end}
                  </span>
                  <span className="text-amber-300 font-semibold">{gap.days} days</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h4 className="font-bold text-white flex items-center gap-2">
                <Moon className="w-5 h-5 text-purple-400" />
                Chronotype
              </h4>
              <p className="text-slate-400 text-sm mt-1">{chronotype.insight}</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
              {chronotype.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-white font-semibold">{chronotype.peakDay}</p>
                <p className="text-slate-400 text-xs">Most active day</p>
              </div>
            </div>
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-white font-semibold">{chronotype.peakHourLabel}</p>
                <p className="text-slate-400 text-xs">Peak commit hour</p>
              </div>
            </div>
          </div>

          {chronotype.dayDistribution.length === 0 ? (
            <EmptyState message="Not enough commit timestamps to chart activity patterns." />
          ) : (
            <div className="space-y-4">
              <div className="h-36">
                <p className="text-xs text-slate-500 mb-2">Commits by day of week</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chronotype.dayDistribution}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                    <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="h-36">
                <p className="text-xs text-slate-500 mb-2">Commits by hour of day</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chronotype.hourDistribution}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                    <Bar dataKey="count" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
