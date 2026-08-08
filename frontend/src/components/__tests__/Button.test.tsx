import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../ui/Button';

describe('Button', () => {
  it('renders its children as the accessible name', () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('defaults to the primary variant', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary');
  });

  it('applies the requested variant classes', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-danger');
  });

  it('shows a spinner and disables while loading', () => {
    render(<Button loading>Send</Button>);
    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toBeDisabled();
    expect(button.querySelector('span[aria-hidden="true"]')).not.toBeNull();
  });

  it('honours the disabled prop', () => {
    render(<Button disabled>Send</Button>);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });
});
