import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Hoisted so the mock factory (which vitest hoists above imports) can see them.
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
const contactApi = vi.hoisted(() => ({ submitMessage: vi.fn() }));

vi.mock('../../components/ui/Toast', () => ({ useToast: () => toast }));
vi.mock('../../api/contact', () => ({ contactApi }));

import { Contact } from '../Contact';

const VALID = {
  name: 'Jane Citizen',
  email: 'jane@example.com',
  subject: 'Pothole near school',
  message: 'There is a deep pothole right in front of the school gate.',
};

function fillForm(values: typeof VALID = VALID) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: values.name } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: values.email } });
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: values.subject } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: values.message } });
}

/** jsdom quirk: fireEvent.click on a submit button does not reliably dispatch
 * the form's submit event — dispatch it on the form directly (RTL convention). */
function submitForm() {
  const form = document.querySelector('form');
  if (!form) throw new Error('Expected a <form> in the document');
  fireEvent.submit(form);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Contact', () => {
  it('renders the four form fields', () => {
    render(<Contact />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Subject')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
  });

  it('shows validation errors for an empty submit and sends nothing', async () => {
    render(<Contact />);
    submitForm();

    expect(await screen.findByText('Enter your name')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Add a short subject')).toBeInTheDocument();
    expect(screen.getByText('Please write a few more words')).toBeInTheDocument();
    expect(contactApi.submitMessage).not.toHaveBeenCalled();
  });

  it('submits a valid message with the exact payload and shows a success toast', async () => {
    contactApi.submitMessage.mockResolvedValue({ id: 1, createdAt: '2026-01-01T00:00:00.000Z' });
    render(<Contact />);
    fillForm();
    submitForm();

    await waitFor(() => expect(contactApi.submitMessage).toHaveBeenCalledTimes(1));
    expect(contactApi.submitMessage).toHaveBeenCalledWith(VALID);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows an error toast when the request fails', async () => {
    contactApi.submitMessage.mockRejectedValue(new Error('boom'));
    render(<Contact />);
    fillForm();
    submitForm();

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
