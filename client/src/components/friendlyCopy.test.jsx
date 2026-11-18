import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { messages } from '../lib/messages';
import ErrorBoundary from './ErrorBoundary';
import { FormField, ToastStack } from './ui';

describe('friendly copy components', () => {
  it('connects field help and friendly validation for assistive technology', () => {
    render(<FormField id="name" label={messages.fields.name.label} helper={messages.fields.name.helper} error={messages.validation.nameEmpty} />);

    const input = screen.getByLabelText(messages.fields.name.label);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'name-help name-error');
    expect(screen.getByRole('alert')).toHaveTextContent(messages.validation.nameEmpty);
  });

  it('shows no more than three friendly messages at once', () => {
    render(<ToastStack items={[1, 2, 3, 4].map((id) => ({ id, message: `Message ${id}`, duration: 0 }))} />);

    expect(screen.queryByText('Message 1')).not.toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(3);
  });

  it('hides crash details and offers both recovery actions', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const preventWindowError = (event) => event.preventDefault();
    window.addEventListener('error', preventWindowError);
    function Broken() { throw new Error('database payload undefined'); }

    render(<ErrorBoundary><Broken /></ErrorBoundary>);

    expect(screen.getByRole('heading', { name: messages.crash.title })).toBeInTheDocument();
    expect(screen.getByText(messages.crash.text)).toBeInTheDocument();
    expect(screen.queryByText(/database|payload|undefined/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.crash.reload })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: messages.crash.home })).toBeInTheDocument();
    window.removeEventListener('error', preventWindowError);
    consoleSpy.mockRestore();
  });
});
