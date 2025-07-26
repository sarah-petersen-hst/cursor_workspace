import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('Salsa Dance Events Finder', () => {
  test('renders Found Events heading', () => {
    render(<App />);
    expect(screen.getByText(/Found Events/i)).toBeInTheDocument();
  });

  test('renders event cards with correct titles', () => {
    render(<App />);
    expect(screen.getByText('Salsa Night Berlin')).toBeInTheDocument();
    expect(screen.getByText('Bachata Sensual Party')).toBeInTheDocument();
  });

  test('shows Trusted Source label for trusted events', () => {
    render(<App />);
    expect(screen.getByText('Trusted Source')).toBeInTheDocument();
  });

  test('shows green status bar for likely real events', () => {
    render(<App />);
    // The first event is likely real (votes.highlight === 'green')
    const eventCard = screen.getByText('Salsa Night Berlin').closest('.event-card');
    expect(eventCard).toHaveClass('likely-real');
  });

  test('expands and collapses event details', () => {
    render(<App />);
    const detailsButton = screen.getAllByText('Details')[0];
    fireEvent.click(detailsButton);
    expect(screen.getByText('Workshops')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hide Details'));
    expect(screen.queryByText('Workshops')).not.toBeInTheDocument();
  });

  test('voting buttons increment counters and highlight correctly', () => {
    render(<App />);
    // Expand details for the first event
    const detailsButton = screen.getAllByText('Details')[0];
    fireEvent.click(detailsButton);
    const existsButton = screen.getByText(/This event really exists/);
    const notExistsButton = screen.getByText(/This event doesn't exist/);
    // Initial counts
    expect(existsButton).toHaveTextContent('12');
    expect(notExistsButton).toHaveTextContent('3');
    // Click notExists to flip highlight
    fireEvent.click(notExistsButton);
    expect(notExistsButton).toHaveClass('highlight');
    // Click exists to flip back
    fireEvent.click(existsButton);
    expect(existsButton).toHaveClass('highlight');
  });
});
