import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

/** Glassmorphism surface — the signature card of the design system. */
export function Card({ hover = false, className = '', children, ...props }: CardProps) {
  return (
    <div className={`${hover ? 'glass-card-hover' : 'glass-card'} ${className}`} {...props}>
      {children}
    </div>
  );
}
