import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { StatusMessage, StatusIndicator } from '../StatusMessage';

describe('StatusMessage', () => {
  it('renders basic message', () => {
    render(
      <StatusMessage 
        type="info" 
        message="This is an info message" 
      />
    );

    expect(screen.getByText('This is an info message')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders with details', () => {
    render(
      <StatusMessage 
        type="warning" 
        message="Warning message" 
        details="Additional details about the warning"
      />
    );

    expect(screen.getByText('Warning message')).toBeInTheDocument();
    expect(screen.getByText('Additional details about the warning')).toBeInTheDocument();
  });

  it('renders error as alert', () => {
    render(
      <StatusMessage 
        type="error" 
        message="Error occurred" 
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('renders non-error as status', () => {
    render(
      <StatusMessage 
        type="success" 
        message="Success message" 
      />
    );

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    
    render(
      <StatusMessage 
        type="info" 
        message="Dismissible message" 
        onDismiss={onDismiss}
      />
    );

    const dismissButton = screen.getByLabelText('Dismiss message');
    fireEvent.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders action buttons', () => {
    const action1 = vi.fn();
    const action2 = vi.fn();
    
    render(
      <StatusMessage 
        type="warning" 
        message="Message with actions" 
        actions={[
          { label: 'Action 1', onClick: action1, variant: 'primary' },
          { label: 'Action 2', onClick: action2, variant: 'secondary' }
        ]}
      />
    );

    const button1 = screen.getByText('Action 1');
    const button2 = screen.getByText('Action 2');

    expect(button1).toBeInTheDocument();
    expect(button2).toBeInTheDocument();

    fireEvent.click(button1);
    fireEvent.click(button2);

    expect(action1).toHaveBeenCalledTimes(1);
    expect(action2).toHaveBeenCalledTimes(1);
  });

  it('applies correct styles for different types', () => {
    const { rerender } = render(
      <StatusMessage type="success" message="Success" />
    );
    expect(document.querySelector('.bg-green-50')).toBeInTheDocument();

    rerender(<StatusMessage type="error" message="Error" />);
    expect(document.querySelector('.bg-red-50')).toBeInTheDocument();

    rerender(<StatusMessage type="warning" message="Warning" />);
    expect(document.querySelector('.bg-yellow-50')).toBeInTheDocument();

    rerender(<StatusMessage type="loading" message="Loading" />);
    expect(document.querySelector('.bg-blue-50')).toBeInTheDocument();
  });

  it('shows loading animation for loading type', () => {
    render(<StatusMessage type="loading" message="Loading..." />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <StatusMessage 
        type="info" 
        message="Custom class message" 
        className="custom-status"
      />
    );

    expect(document.querySelector('.custom-status')).toBeInTheDocument();
  });
});

describe('StatusIndicator', () => {
  it('renders with idle status', () => {
    render(<StatusIndicator status="idle" />);
    
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveAttribute('aria-label', 'Status: idle');
    expect(document.querySelector('.bg-gray-400')).toBeInTheDocument();
  });

  it('renders with loading status and animation', () => {
    render(<StatusIndicator status="loading" message="Loading data..." />);
    
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveAttribute('aria-label', 'Status: loading');
    expect(document.querySelector('.bg-blue-500')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('renders with success status', () => {
    render(<StatusIndicator status="success" message="Completed" />);
    
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveAttribute('aria-label', 'Status: success');
    expect(document.querySelector('.bg-green-500')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders with error status and animation', () => {
    render(<StatusIndicator status="error" message="Failed" />);
    
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveAttribute('aria-label', 'Status: error');
    expect(document.querySelector('.bg-red-500')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<StatusIndicator status="idle" className="custom-indicator" />);
    expect(document.querySelector('.custom-indicator')).toBeInTheDocument();
  });
});