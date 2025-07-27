import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import headerImage from './couple_small_LE_upscale_balanced_x4_2.png';
import { getOrCreateUserUuid, getSavedEventIds, setSavedEventIds } from './utils';

/**
 * List of available dance styles for filtering events.
 */
const DANCE_STYLES = [
  'Salsa',
  'Salsa On 2',
  'Salsa L.A.',
  'Salsa Cubana',
  'Bachata',
  'Bachata Dominicana',
  'Bachata Sensual',
  'Kizomba',
  'Zouk',
  'Forró',
];

/**
 * Placeholder list of cities for the city select dropdown.
 */
const CITIES = [
  'Berlin',
  'Hamburg',
  'Munich',
  'Cologne',
  'Frankfurt',
  'Stuttgart',
  'Düsseldorf',
  'Dresden',
  'Leipzig',
  'Nuremberg',
];

/**
 * Type definition for an event.
 */
type VenueType = 'Indoor' | 'Outdoor' | 'Not specified';

type Event = {
  id: string;
  name: string;
  date: string;
  address: string;
  source: string;
  trusted: boolean;
  recurrence?: string; // e.g., 'every Tuesday', 'every second Friday', etc.
  venueType?: VenueType;
};

/**
 * Type definition for a workshop.
 */
type Workshop = {
  start: string;
  end: string;
  style: string;
  level: 'Beginner' | 'Advanced' | 'Open Level';
};

/**
 * Type definition for party floor music distribution.
 */
type FloorMusic = {
  floor: string;
  distribution: string;
};

/**
 * Type definition for event details.
 */
type EventDetails = {
  workshops: Workshop[];
  party: {
    start: string;
    end?: string;
    floors: FloorMusic[];
  };
  votes: {
    exists: number;
    notExists: number;
    highlight: 'green' | 'yellow';
  };
};

/**
 * Placeholder event details for demonstration.
 */
const EVENT_DETAILS: Record<string, EventDetails> = {
  '1': {
    workshops: [
      { start: '18:00', end: '19:00', style: 'Salsa', level: 'Beginner' },
      { start: '19:15', end: '20:15', style: 'Bachata', level: 'Open Level' },
    ],
    party: {
      start: '21:00',
      floors: [
        { floor: 'Main Floor', distribution: '60% Salsa, 40% Bachata' },
        { floor: 'Second Floor', distribution: '100% Kizomba' },
      ],
    },
    votes: { exists: 3, notExists: 3, highlight: 'green' },
  },
  '2': {
    workshops: [
      { start: '20:00', end: '21:00', style: 'Bachata Sensual', level: 'Advanced' },
    ],
    party: {
      start: '21:00',
      end: undefined,
      floors: [
        { floor: 'Main Floor', distribution: 'from 21:00, 50% Bachata, 50% Salsa' },
      ],
    },
    votes: { exists: 2, notExists: 5, highlight: 'yellow' },
  },
};

/**
 * Placeholder events for demonstration.
 */
const EVENTS: Event[] = [
  {
    id: '1',
    name: 'Salsa Night Berlin',
    date: '2024-05-18',
    address: 'Alexanderplatz 1, 10178 Berlin',
    source: 'SalsaBerlin.de',
    trusted: true,
    recurrence: 'every Tuesday',
    venueType: 'Indoor',
  },
  {
    id: '2',
    name: 'Bachata Sensual Party',
    date: '2024-05-20',
    address: 'Kulturbrauerei, Schönhauser Allee 36, 10435 Berlin',
    source: 'Facebook',
    trusted: false,
    recurrence: 'every second Friday',
    venueType: 'Outdoor',
  },
  {
    id: '3',
    name: 'Zouk Open Air',
    date: '2024-05-25',
    address: 'Tempelhofer Feld, Berlin',
    source: 'ZoukBerlin.de',
    trusted: false,
    venueType: 'Outdoor',
  },
  {
    id: '4',
    name: 'Monthly Salsa Social',
    date: '2024-06-01',
    address: 'Salsa Club, Berlin',
    source: 'Meetup',
    trusted: false,
    recurrence: 'every 1st Saturday of the month',
    venueType: 'Not specified',
  },
];

/**
 * EventCard component displays a single event summary and expandable details.
 * Fetches and submits votes to the backend, enforcing one vote per user per event per week.
 * Highlights the button the user voted for this week.
 * @param {Event} event - The event to display.
 * @returns {JSX.Element}
 */
function EventCard({ event, isSaved, onToggleSave }: { event: Event; isSaved?: boolean; onToggleSave?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [voteData, setVoteData] = useState<{ exists: number; not_exists: number; highlight: 'green' | 'yellow'; week: string } | null>(null);
  const [userVote, setUserVote] = useState<'exists' | 'not_exists' | null>(null);
  const [loadingVotes, setLoadingVotes] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const userUuid = getOrCreateUserUuid();

  /**
   * Fetch vote counts and the user's vote for this event from the backend.
   */
  const fetchVotes = async () => {
    setLoadingVotes(true);
    setVoteError(null);
    try {
      const res = await fetch(`http://localhost:4000/api/votes/${event.id}?userUuid=${userUuid}`);
      const data = await res.json();
      // Use the most recent week with data
      const weeks = Object.keys(data.weekVotes).sort().reverse();
      let week = weeks[0];
      if (!week && weeks.length > 0) week = weeks[0];
      if (week) {
        const exists = data.weekVotes[week].exists || 0;
        const not_exists = data.weekVotes[week].not_exists || 0;
        const highlight = exists > not_exists ? 'green' : 'yellow';
        setVoteData({ exists, not_exists, highlight, week });
      } else {
        setVoteData({ exists: 0, not_exists: 0, highlight: 'yellow', week: '' });
      }
      setUserVote(data.userVote || null);
    } catch (err) {
      setVoteError('Failed to fetch votes');
    } finally {
      setLoadingVotes(false);
    }
  };

  /**
   * Submit a vote to the backend and refresh vote counts.
   */
  const submitVote = async (voteType: 'exists' | 'not_exists') => {
    setVoteError(null);
    try {
      await fetch('http://localhost:4000/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, userUuid, voteType }),
      });
      await fetchVotes();
    } catch (err) {
      setVoteError('Failed to submit vote');
    }
  };

  // Fetch votes when details are expanded
  useEffect(() => {
    if (expanded) fetchVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Determine if the event is likely real (green status bar)
  const isLikelyReal = voteData?.highlight === 'green';

  // Find the event in EVENTS to get recurrence and venueType
  const eventMeta = EVENTS.find(e => e.id === event.id);

  return (
    <div className={`event-card${isLikelyReal ? ' likely-real' : ''}`}>
      <div className="event-title-row">
        <span className="event-title">{event.name}</span>
        {event.trusted && <span className="trusted-label">Trusted Source</span>}
      </div>
      <div className="event-date">{event.date}</div>
      <div className="event-address">{event.address}</div>
      <div className="event-source">Source: {event.source}</div>
      <div className="event-actions">
        {onToggleSave && (
          <button
            className={`button event-save${isSaved ? ' saved' : ''}`}
            onClick={onToggleSave}
            aria-label={isSaved ? 'Unsave event' : 'Save event'}
          >
            {isSaved ? 'Unsave' : 'Save'}
          </button>
        )}
        <button className="button event-details" onClick={() => setExpanded((prev) => !prev)} aria-expanded={expanded} aria-controls={`details-${event.id}`}>{expanded ? 'Hide Details' : 'Details'}</button>
      </div>
      {expanded && (
        <div className="event-details-expanded" id={`details-${event.id}`}
          tabIndex={-1} aria-label={`Details for ${event.name}`}
        >
          {/* Event Meta */}
          <div className="event-meta">
            {/* Recurrence info */}
            {eventMeta?.recurrence && (
              <div className="event-recurrence">
                <span role="img" aria-label="recurring">🔁</span> This event takes place {eventMeta.recurrence}
              </div>
            )}
            {/* Venue type */}
            <div className={`event-venue-type venue-${(eventMeta?.venueType || 'not-specified').toLowerCase().replace(/ /g, '-')}`}>Venue: {eventMeta?.venueType || 'Not specified'}</div>
            {/* Weather warning for outdoor venues */}
            {eventMeta?.venueType === 'Outdoor' && (
              <div className="event-weather-warning">
                <span role="img" aria-label="weather">⚠️</span> Note: This event takes place outdoors and may be weather-dependent.
              </div>
            )}
          </div>
          {/* Workshops */}
          <div className="details-workshops">
            <h3>Workshops</h3>
            {EVENT_DETAILS[event.id]?.workshops.map((ws, idx) => (
              <div className="workshop-row" key={idx}>
                <span className="workshop-time">{ws.start} - {ws.end}</span>
                <span className="workshop-style">{ws.style}</span>
                <span className="workshop-level">{ws.level}</span>
              </div>
            ))}
          </div>
          {/* Party Details */}
          <div className="details-party">
            <h3>Party</h3>
            <div className="party-time">
              {EVENT_DETAILS[event.id]?.party.end
                ? `${EVENT_DETAILS[event.id]?.party.start} - ${EVENT_DETAILS[event.id]?.party.end}`
                : `from ${EVENT_DETAILS[event.id]?.party.start}`}
            </div>
            <div className="party-floors">
              {EVENT_DETAILS[event.id]?.party.floors.map((floor, idx) => (
                <div className="party-floor" key={idx}>
                  <span className="floor-name">{floor.floor}:</span> {floor.distribution}
                </div>
              ))}
            </div>
          </div>
          {/* Voting */}
          <div className="details-voting">
            <button
              className={`button vote-exists${voteData?.highlight === 'green' ? ' highlight' : ''}${userVote === 'exists' ? ' your-vote' : ''}`}
              onClick={() => submitVote('exists')}
              aria-label="This event really exists"
              disabled={loadingVotes}
            >
              This event really exists <span className="vote-count">{voteData?.exists ?? 0}</span>
            </button>
            <button
              className={`button vote-not-exists${voteData?.highlight === 'yellow' ? ' highlight' : ''}${userVote === 'not_exists' ? ' your-vote' : ''}`}
              onClick={() => submitVote('not_exists')}
              aria-label="This event doesn't exist"
              disabled={loadingVotes}
            >
              This event doesn't exist <span className="vote-count">{voteData?.not_exists ?? 0}</span>
            </button>
            {/* Withdraw Vote Button */}
            {userVote && (
              <button
                className="button withdraw-vote"
                onClick={async () => {
                  setVoteError(null);
                  setLoadingVotes(true);
                  try {
                    await fetch('http://localhost:4000/api/vote', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ eventId: event.id, userUuid }),
                    });
                    await fetchVotes();
                  } catch (err) {
                    setVoteError('Failed to withdraw vote');
                  } finally {
                    setLoadingVotes(false);
                  }
                }}
                aria-label="Withdraw your vote"
                disabled={loadingVotes}
              >
                Withdraw Vote
              </button>
            )}
            {voteError && <span className="vote-error">{voteError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main application component for the Salsa Dance Events Finder.
 * Implements navigation, header, main layout, saved events, and dynamic header image.
 * @returns {JSX.Element} The root component.
 */
function App() {
  // State for selected dance styles
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  // State for city search
  const [cityQuery, setCityQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  // State for date
  const [selectedDate, setSelectedDate] = useState('');
  // Saved events state
  const [savedEventIds, setSavedEventIdsState] = useState<string[]>(getSavedEventIds());
  // Navigation state
  const [activeView, setActiveView] = useState<'find' | 'saved'>('find');
  // Header shrink state
  const [headerHeight, setHeaderHeight] = useState(500);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);

  // Debounced city search
  useEffect(() => {
    if (!cityQuery) {
      setCitySuggestions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setCityLoading(true);
      setCityError(null);
      try {
        const res = await fetch(`http://localhost:4000/api/cities?query=${encodeURIComponent(cityQuery)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setCitySuggestions(data);
        } else {
          setCitySuggestions([]);
        }
      } catch (err) {
        setCityError('Failed to fetch cities');
        setCitySuggestions([]);
      } finally {
        setCityLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [cityQuery]);

  // Save/unsave event
  const toggleSaveEvent = useCallback((eventId: string) => {
    setSavedEventIdsState((prev) => {
      const next = prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId];
      setSavedEventIds(next);
      return next;
    });
  }, []);

  // Listen for scroll to shrink header
  useEffect(() => {
    const onScroll = () => {
      const minHeight = 120;
      const maxHeight = 500;
      const scrollY = window.scrollY;
      const newHeight = Math.max(minHeight, maxHeight - scrollY);
      setHeaderHeight(newHeight);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /**
   * Handles toggling a dance style in the multi-select.
   * @param style The dance style to toggle.
   */
  const handleStyleToggle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style)
        ? prev.filter((s) => s !== style)
        : [...prev, style]
    );
  };

  /**
   * Handles city selection from the dropdown.
   * @param city The selected city.
   */
  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setCityQuery(city);
  };

  /**
   * Handles the search button click (to be implemented).
   * For now, just logs the selected filters.
   */
  const handleSearch = () => {
    // Placeholder: log selected filters
    // eslint-disable-next-line no-console
    console.log({ selectedStyles, selectedCity, selectedDate });
  };

  // Filter cities based on query
  const filteredCities = cityQuery
    ? CITIES.filter((city) =>
        city.toLowerCase().includes(cityQuery.toLowerCase())
      )
    : CITIES;

  // Get saved events
  const savedEvents = EVENTS.filter((e) => savedEventIds.includes(e.id));

  // EventCard with save/unsave logic
  function EventCardWithSave(props: { event: Event }) {
    const { event } = props;
    const isSaved = savedEventIds.includes(event.id);
    return (
      <EventCard event={event} isSaved={isSaved} onToggleSave={() => toggleSaveEvent(event.id)} />
    );
  }

  return (
    <div className="App">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-main">
          <div className="navbar-item">
            Events
            <div className="navbar-subitems">
              <div className="navbar-subitem" onClick={() => setActiveView('find')}>Find Events</div>
              <div className="navbar-subitem" onClick={() => setActiveView('saved')}>Saved Events</div>
            </div>
          </div>
          <div className="navbar-item">Legal Notice</div>
        </div>
      </nav>
      {/* Header with image and headline */}
      <header className="header" style={{ height: headerHeight }}>
        <div className="header-image-container" style={{ height: headerHeight }}>
          <img src={headerImage} alt="Dancing couple" className="header-image" style={{ height: headerHeight }} />
          <h1 className="header-headline">Find your Latin Dance Party</h1>
        </div>
      </header>
      {/* Filter/Search Container (only in Find Events view) */}
      {activeView === 'find' && (
        <section className="filter-container">
          {/* Dance Style Multi-Select */}
          <div className="style-labels">
            {DANCE_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                className={`style-label${selectedStyles.includes(style) ? ' selected' : ''}`}
                onClick={() => handleStyleToggle(style)}
                aria-pressed={selectedStyles.includes(style)}
              >
                {style}
              </button>
            ))}
          </div>
          {/* City Searchable Select */}
          <div className="city-select">
            <input
              type="text"
              placeholder="Type city..."
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              aria-label="City"
              autoComplete="off"
              list="city-list"
            />
            {cityLoading && <div className="city-loading">Loading...</div>}
            {cityError && <div className="city-error">{cityError}</div>}
            {citySuggestions.length > 0 && (
              <ul className="city-suggestions">
                {citySuggestions.map((city) => (
                  <li key={city} onClick={() => { setCityQuery(city); setSelectedCity(city); setCitySuggestions([]); }}>{city}</li>
                ))}
              </ul>
            )}
          </div>
          {/* Date Input */}
          <div className="date-input">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Date"
            />
          </div>
          {/* Search Button */}
          <button className="button search-button" onClick={handleSearch} type="button">
            Search
          </button>
        </section>
      )}
      {/* Main content area */}
      <main className="main-content">
        {/* Events Container */}
        {activeView === 'find' && (
          <section className="events-container">
            <h2 className="events-heading">Found Events</h2>
            <div className="events-list">
              {EVENTS.map((event) => (
                <EventCardWithSave key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}
        {activeView === 'saved' && (
          <section className="events-container">
            <h2 className="events-heading">Saved Events</h2>
            <div className="events-list">
              {savedEvents.length === 0 ? (
                <div className="no-saved-events">No saved events yet.</div>
              ) : (
                savedEvents.map((event) => (
                  <EventCardWithSave key={event.id} event={event} />
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
