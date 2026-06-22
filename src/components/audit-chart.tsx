'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import type { ProfileAnalysis } from '@/types';

interface AuditChartProps {
  scores: ProfileAnalysis['scores'];
}

const CustomTooltip = ({ active, payload, label }: Partial<TooltipContentProps<ValueType, NameType>>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl">
        <p className="text-blue-400 font-bold text-xs">{label}</p>
        <p className="text-white text-sm">Score: {payload[0].value}/100</p>
      </div>
    );
  }
  return null;
};

export function AuditChart({ scores }: AuditChartProps) {
  // We rename the labels to be shorter so they don't get cut off
  const data = [
    { subject: 'Identity', A: scores.branding, fullMark: 100 },
    { subject: 'Code', A: scores.repoQuality, fullMark: 100 },
    { subject: 'Activity', A: scores.consistency, fullMark: 100 },
    ...(typeof scores.commitHygiene === 'number'
      ? [{ subject: 'Commits', A: scores.commitHygiene, fullMark: 100 }]
      : []),
    ...(typeof scores.contribution === 'number'
      ? [{ subject: 'Contrib', A: scores.contribution, fullMark: 100 }]
      : []),
    { subject: 'Health', A: scores.total, fullMark: 100 },
  ];

  return (
    <div className="h-[250px] w-full flex items-center justify-center relative">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
          
          {/* The Spider Web Grid */}
          <PolarGrid stroke="#334155" strokeDasharray="3 3" />
          
          {/* The Labels (Identity, Code, etc) */}
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} 
          />
          
          {/* The Blue Shape */}
          <Radar
            name="Score"
            dataKey="A"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="#3b82f6"
            fillOpacity={0.4}
          />

          {/* Hover Interaction */}
          <Tooltip content={<CustomTooltip />} cursor={false} />

        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}