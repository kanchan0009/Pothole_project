import type { ReactNode } from 'react';

interface QuickActionCardProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  bgColor: string;
  onClick?: () => void;
  badge?: number;
}

export function QuickActionCard({ title, subtitle, icon, bgColor, onClick, badge }: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      className={`relative flex h-full w-full flex-col items-start justify-between rounded-2xl p-5 text-left text-white shadow-md transition hover:-translate-y-1 hover:shadow-lg ${bgColor}`}
    >
      {badge !== undefined && (
        <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-bold text-primary shadow-sm">
          {badge}
        </span>
      )}
      
      {icon && (
        <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-white/20 text-lg backdrop-blur-sm">
          {icon}
        </div>
      )}
      
      <div>
        <h4 className="text-sm font-bold">{title}</h4>
        {subtitle && <p className="mt-1 text-[11px] font-medium text-white/80">{subtitle}</p>}
      </div>
    </button>
  );
}
