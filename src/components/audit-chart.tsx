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
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 p-3 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.15)] text-center min-w-[100px]">
        <p className="text-blue-400 font-bold text-xs mb-1 tracking-wider uppercase">{label}</p>
        <p className="text-white text-base font-black tracking-tight">{payload[0].value}<span className="text-slate-500 font-medium text-xs">/100</span></p>
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
          <defs>
            <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8}/>
            </linearGradient>
          </defs>
          <Radar
            name="Score"
            dataKey="A"
            stroke="#60a5fa"
            strokeWidth={3}
            fill="url(#radarGradient)"
            fillOpacity={0.5}
          />

          {/* Hover Interaction */}
          <Tooltip content={<CustomTooltip />} cursor={false} />

        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}