import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}


export function Card({ hover = false, className = '', children, ...props }: CardProps) {
  return (
    <div className={`${hover ? 'glass-card-hover' : 'glass-card'} ${className}`} {...props}>
      {children}
    </div>
  );
}
