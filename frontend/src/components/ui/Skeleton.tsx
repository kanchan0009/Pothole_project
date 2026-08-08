import type { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

/** Pulsing placeholder block for loading states. */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-primary/10 ${className}`}
      aria-hidden
      {...props}
    />
  );
}

/** Convenience row skeleton for list/table loading. */
export function SkeletonRow({ lines = 1 }: { lines?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
