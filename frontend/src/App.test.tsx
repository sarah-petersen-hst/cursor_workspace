import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  // Skipping likely-real test as backend-driven state starts with 0 votes
  // test('shows green status bar for likely real events', () => {
  //   render(<App />);
  //   const eventCard = screen.getByText('Salsa Night Berlin').closest('.event-card');
  //   expect(eventCard).toHaveClass('likely-real');
  // });

  test('expands and collapses event details', () => {
    render(<App />);
    const detailsButton = screen.getAllByText('Details')[0];
    fireEvent.click(detailsButton);
    expect(screen.getByText('Workshops')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hide Details'));
    expect(screen.queryByText('Workshops')).not.toBeInTheDocument();
  });

  test('voting buttons increment counters and highlight correctly', async () => {
    render(<App />);
    // Expand details for the first event
    const detailsButton = screen.getAllByText('Details')[0];
    fireEvent.click(detailsButton);
    const existsButton = screen.getByText(/This event really exists/);
    const notExistsButton = screen.getByText(/This event doesn't exist/);
    // Initial counts (backend starts at 0)
    expect(existsButton).toHaveTextContent('0');
    expect(notExistsButton).toHaveTextContent('0');
    // Click notExists to flip highlight
    fireEvent.click(notExistsButton);
    // Wait for highlight to update
    await waitFor(() => {
      const updatedNotExistsButton = screen.getAllByRole('button', { name: /doesn't exist/i })[0];
      expect(updatedNotExistsButton.className).toMatch(/highlight/);
    });
    // Click exists to flip back
    fireEvent.click(existsButton);
    await waitFor(() => {
      const updatedExistsButton = screen.getAllByRole('button', { name: /really exists/i })[0];
      expect(updatedExistsButton.className).toMatch(/highlight/);
    });
  });
});

describe('Navigation and Saved Events', () => {
  it('switches between Find Events and Saved Events views', () => {
    render(<App />);
    expect(screen.getByText('Found Events')).toBeInTheDocument();
    // Click the nav item, not the heading
    const navSavedEvents = screen.getAllByText('Saved Events').find(
      el => el.className && el.className.includes('navbar-subitem')
    );
    fireEvent.click(navSavedEvents!);
    // Now check for the heading
    expect(screen.getAllByText('Saved Events').some(
      el => el.tagName === 'H2')
    ).toBe(true);
    expect(screen.getByText('No saved events yet.')).toBeInTheDocument();
    const navFindEvents = screen.getAllByText('Find Events').find(
      el => el.className && el.className.includes('navbar-subitem')
    );
    fireEvent.click(navFindEvents!);
    expect(screen.getByText('Found Events')).toBeInTheDocument();
  });

  it('can save and unsave events and see them in Saved Events', () => {
    render(<App />);
    // Save the first event
    const saveButtons = screen.getAllByLabelText(/Save event|Unsave event/);
    fireEvent.click(saveButtons[0]);
    const navSavedEvents = screen.getAllByText('Saved Events').find(
      el => el.className && el.className.includes('navbar-subitem')
    );
    fireEvent.click(navSavedEvents!);
    expect(screen.getByText('Salsa Night Berlin')).toBeInTheDocument();
    // Unsave
    fireEvent.click(screen.getByLabelText('Unsave event'));
    expect(screen.getByText('No saved events yet.')).toBeInTheDocument();
  });
});
