import React from 'react';
import { render, screen } from '@testing-library/react';
import { 
  LoadingSpinner, 
  LoadingDots, 
  LoadingBar, 
  PulsingSkeleton 
} from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default props', () => {
    render(<LoadingSpinner />);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-label', 'Loading...');
  });

  it('renders with custom label', () => {
    render(<LoadingSpinner label="Searching..." />);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Searching...');
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(<LoadingSpinner size="small" />);
    expect(document.querySelector('.w-4')).toBeInTheDocument();

    rerender(<LoadingSpinner size="large" />);
    expect(document.querySelector('.w-12')).toBeInTheDocument();
  });

  it('applies color classes correctly', () => {
    render(<LoadingSpinner color="secondary" />);
    expect(document.querySelector('.border-gray-600')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<LoadingSpinner className="custom-class" />);
    expect(document.querySelector('.custom-class')).toBeInTheDocument();
  });
});

describe('LoadingDots', () => {
  it('renders three dots', () => {
    render(<LoadingDots />);
    
    const container = screen.getByRole('status');
    expect(container).toBeInTheDocument();
    
    const dots = container.querySelectorAll('div > div');
    expect(dots).toHaveLength(3);
  });

  it('applies staggered animation delays', () => {
    render(<LoadingDots />);
    
    const container = screen.getByRole('status');
    const dots = container.querySelectorAll('div > div');
    
    expect(dots[0]).toHaveStyle('animation-delay: 0s');
    expect(dots[1]).toHaveStyle('animation-delay: 0.2s');
    expect(dots[2]).toHaveStyle('animation-delay: 0.4s');
  });

  it('renders with custom label', () => {
    render(<LoadingDots label="Processing..." />);
    
    const container = screen.getByRole('status');
    expect(container).toHaveAttribute('aria-label', 'Processing...');
  });
});

describe('LoadingBar', () => {
  it('renders with default props', () => {
    render(<LoadingBar />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('displays progress correctly', () => {
    render(<LoadingBar progress={75} />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    
    // Find the progress fill element by looking for the element with the width style
    const progressFill = progressBar.querySelector('[style*="width: 75%"]');
    expect(progressFill).toBeInTheDocument();
  });

  it('clamps progress values', () => {
    const { rerender } = render(<LoadingBar progress={-10} />);
    let progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');

    rerender(<LoadingBar progress={150} />);
    progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '100');
  });

  it('shows percentage when enabled', () => {
    render(<LoadingBar progress={50} showPercentage={true} label="Loading data" />);
    
    expect(screen.getByText('Loading data')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('applies color classes correctly', () => {
    render(<LoadingBar color="success" />);
    expect(document.querySelector('.bg-green-600')).toBeInTheDocument();
  });
});

describe('PulsingSkeleton', () => {
  it('renders with default props', () => {
    render(<PulsingSkeleton />);
    
    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-label', 'Loading content...');
  });

  it('applies custom dimensions', () => {
    render(<PulsingSkeleton width="200px" height="50px" />);
    
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveStyle('width: 200px');
    expect(skeleton).toHaveStyle('height: 50px');
  });

  it('applies rounded style when enabled', () => {
    render(<PulsingSkeleton rounded={true} />);
    
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('rounded-full');
  });

  it('applies custom className', () => {
    render(<PulsingSkeleton className="custom-skeleton" />);
    
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('custom-skeleton');
  });
});