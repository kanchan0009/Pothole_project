import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../ui/Card';

describe('Card', () => {
  it('applies the base glass surface', () => {
    render(<Card>Content</Card>);
    expect(screen.getByText('Content')).toHaveClass('glass-card');
  });

  it('switches to the hover surface when hover is enabled', () => {
    render(<Card hover>Content</Card>);
    expect(screen.getByText('Content')).toHaveClass('glass-card-hover');
  });

  it('merges custom classes', () => {
    render(<Card className="p-6">Content</Card>);
    expect(screen.getByText('Content')).toHaveClass('glass-card', 'p-6');
  });
});
