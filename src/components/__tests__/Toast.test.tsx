import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { Toast, ToastContainer } from '../Toast';

// Mock timers for testing
vi.useFakeTimers();

describe('Toast', () => {
  const defaultProps = {
    id: 'test-toast',
    type: 'info' as const,
    title: 'Test Toast',
    onDismiss: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  it('renders basic toast', () => {
    render(<Toast {...defaultProps} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Test Toast')).toBeInTheDocument();
  });

  it('renders toast with message', () => {
    render(
      <Toast 
        {...defaultProps} 
        message="This is a detailed message"
      />
    );

    expect(screen.getByText('Test Toast')).toBeInTheDocument();
    expect(screen.getByText('This is a detailed message')).toBeInTheDocument();
  });

  it('auto-dismisses after duration', async () => {
    const onDismiss = vi.fn();
    
    render(
      <Toast 
        {...defaultProps} 
        duration={1000}
        onDismiss={onDismiss}
      />
    );

    expect(onDismiss).not.toHaveBeenCalled();

    // Fast-forward time
    vi.advanceTimersByTime(1300); // Duration + exit animation

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledWith('test-toast');
    });
  });

  it('does not auto-dismiss when duration is 0', () => {
    const onDismiss = vi.fn();
    
    render(
      <Toast 
        {...defaultProps} 
        duration={0}
        onDismiss={onDismiss}
      />
    );

    vi.advanceTimersByTime(10000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses when close button is clicked', async () => {
    const onDismiss = vi.fn();
    
    render(
      <Toast 
        {...defaultProps} 
        onDismiss={onDismiss}
      />
    );

    const closeButton = screen.getByLabelText('Dismiss notification');
    fireEvent.click(closeButton);

    // Wait for exit animation
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledWith('test-toast');
    });
  });

  it('renders action buttons', () => {
    const action1 = vi.fn();
    const action2 = vi.fn();
    
    render(
      <Toast 
        {...defaultProps} 
        actions={[
          { label: 'Action 1', onClick: action1 },
          { label: 'Action 2', onClick: action2 }
        ]}
      />
    );

    const button1 = screen.getByText('Action 1');
    const button2 = screen.getByText('Action 2');

    expect(button1).toBeInTheDocument();
    expect(button2).toBeInTheDocument();

    fireEvent.click(button1);
    expect(action1).toHaveBeenCalledTimes(1);
  });

  it('dismisses when action button is clicked', async () => {
    const onDismiss = vi.fn();
    const action = vi.fn();
    
    render(
      <Toast 
        {...defaultProps} 
        onDismiss={onDismiss}
        actions={[{ label: 'Action', onClick: action }]}
      />
    );

    const actionButton = screen.getByText('Action');
    fireEvent.click(actionButton);

    expect(action).toHaveBeenCalledTimes(1);

    // Wait for exit animation
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledWith('test-toast');
    });
  });

  it('applies correct styles for different types', () => {
    const { rerender } = render(<Toast {...defaultProps} type="success" />);
    expect(document.querySelector('.bg-green-50')).toBeInTheDocument();

    rerender(<Toast {...defaultProps} type="error" />);
    expect(document.querySelector('.bg-red-50')).toBeInTheDocument();

    rerender(<Toast {...defaultProps} type="warning" />);
    expect(document.querySelector('.bg-yellow-50')).toBeInTheDocument();

    rerender(<Toast {...defaultProps} type="info" />);
    expect(document.querySelector('.bg-blue-50')).toBeInTheDocument();
  });
});

describe('ToastContainer', () => {
  const createToast = (id: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => ({
    id,
    type,
    title: `Toast ${id}`,
    onDismiss: vi.fn()
  });

  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastContainer toasts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders multiple toasts', () => {
    const toasts = [
      createToast('1'),
      createToast('2'),
      createToast('3')
    ];

    render(<ToastContainer toasts={toasts} />);

    expect(screen.getByText('Toast 1')).toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
    expect(screen.getByText('Toast 3')).toBeInTheDocument();
  });

  it('applies correct position classes', () => {
    const toasts = [createToast('1')];

    const { rerender } = render(
      <ToastContainer toasts={toasts} position="top-left" />
    );
    expect(document.querySelector('.top-4.left-4')).toBeInTheDocument();

    rerender(<ToastContainer toasts={toasts} position="bottom-right" />);
    expect(document.querySelector('.bottom-4.right-4')).toBeInTheDocument();

    rerender(<ToastContainer toasts={toasts} position="top-center" />);
    expect(document.querySelector('.top-4.left-1\\/2')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const toasts = [createToast('1')];

    render(<ToastContainer toasts={toasts} className="custom-container" />);
    expect(document.querySelector('.custom-container')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    const toasts = [createToast('1')];

    render(<ToastContainer toasts={toasts} />);

    const container = document.querySelector('.toast-container');
    expect(container).toHaveAttribute('aria-live', 'polite');
    expect(container).toHaveAttribute('aria-label', 'Notifications');
  });
});