import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../ui/Badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Completed</Badge>);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('defaults to the neutral tone', () => {
    render(<Badge>Neutral</Badge>);
    expect(screen.getByText('Neutral')).toHaveClass('bg-primary/5');
  });

  it('applies the tone classes', () => {
    render(<Badge tone="success">Done</Badge>);
    const badge = screen.getByText('Done');
    expect(badge).toHaveClass('bg-success/10');
    expect(badge).toHaveClass('text-success');
  });
});
