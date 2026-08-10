import type { ReactNode } from 'react';
import { Card } from '../ui/Card';

interface SparklineCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  trend?: string;
  trendColor?: string;
  progress?: number;
  progressColor?: string;
  sublabel1?: string;
  subvalue1?: string;
  sublabel2?: string;
  subvalue2?: string;
}

export function SparklineCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  trend,
  trendColor = 'text-dashboard-green bg-dashboard-green/10',
  progress,
  progressColor = 'bg-primary',
  sublabel1,
  subvalue1,
  sublabel2,
  subvalue2,
}: SparklineCardProps) {
  return (
    <Card className="flex flex-col justify-between p-5 transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        {trend && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${trendColor}`}>
            {trend}
          </span>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-2xl font-extrabold text-primary xl:text-3xl">{value}</h3>
        <p className="mt-1 text-[11px] font-semibold text-primary/50">{label}</p>
      </div>

      {(progress !== undefined || sublabel1 || sublabel2) && (
        <div className="mt-5 space-y-2">
          {progress !== undefined && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
              <div
                className={`h-full rounded-full ${progressColor}`}
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
          )}
          <div className="flex items-center justify-between text-[10px] font-semibold text-primary/50">
            {sublabel1 && (
              <span>
                {sublabel1} <span className="text-primary">{subvalue1}</span>
              </span>
            )}
            {sublabel2 && (
              <span>
                {sublabel2} <span className="text-primary">{subvalue2}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
