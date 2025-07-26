import React, { useState } from 'react';
import './App.css';
import headerImage from './couple_small_LE_upscale_balanced_x4_2.png';

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
type Event = {
  id: string;
  name: string;
  date: string;
  address: string;
  source: string;
  trusted: boolean;
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
  },
  {
    id: '2',
    name: 'Bachata Sensual Party',
    date: '2024-05-20',
    address: 'Kulturbrauerei, Schönhauser Allee 36, 10435 Berlin',
    source: 'Facebook',
    trusted: false,
  },
];

/**
 * EventCard component displays a single event summary and expandable details.
 * Adds a green status bar for likely real events (more 'exists' than 'notExists' votes in the last week).
 * @param {Event} event - The event to display.
 * @returns {JSX.Element}
 */
function EventCard({ event }: { event: Event }) {
  const [expanded, setExpanded] = useState(false);
  const details = EVENT_DETAILS[event.id];
  /**
   * Handles toggling the details view.
   */
  const handleToggleDetails = () => setExpanded((prev) => !prev);
  /**
   * Handles voting for event existence.
   * @param type 'exists' or 'notExists'
   */
  const [votes, setVotes] = useState(details.votes);
  const handleVote = (type: 'exists' | 'notExists') => {
    setVotes((prev) => {
      const newExists = type === 'exists' ? prev.exists + 1 : prev.exists;
      const newNotExists = type === 'notExists' ? prev.notExists + 1 : prev.notExists;
      const newHighlight = newExists > newNotExists ? 'green' : 'yellow';
      return {
        ...prev,
        exists: newExists,
        notExists: newNotExists,
        highlight: newHighlight,
      };
    });
  };
  // Determine if the event is likely real (green status bar)
  const isLikelyReal = votes.highlight === 'green';
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
        <button className="button event-save">Save</button>
        <button className="button event-details" onClick={handleToggleDetails} aria-expanded={expanded} aria-controls={`details-${event.id}`}>{expanded ? 'Hide Details' : 'Details'}</button>
      </div>
      {expanded && details && (
        <div className="event-details-expanded" id={`details-${event.id}`}
          tabIndex={-1} aria-label={`Details for ${event.name}`}
        >
          {/* Workshops */}
          <div className="details-workshops">
            <h3>Workshops</h3>
            {details.workshops.map((ws, idx) => (
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
              {details.party.end
                ? `${details.party.start} - ${details.party.end}`
                : `from ${details.party.start}`}
            </div>
            <div className="party-floors">
              {details.party.floors.map((floor, idx) => (
                <div className="party-floor" key={idx}>
                  <span className="floor-name">{floor.floor}:</span> {floor.distribution}
                </div>
              ))}
            </div>
          </div>
          {/* Voting */}
          <div className="details-voting">
            <button
              className={`button vote-exists${votes.highlight === 'green' ? ' highlight' : ''}`}
              onClick={() => handleVote('exists')}
              aria-label="This event really exists"
            >
              This event really exists <span className="vote-count">{votes.exists}</span>
            </button>
            <button
              className={`button vote-not-exists${votes.highlight === 'yellow' ? ' highlight' : ''}`}
              onClick={() => handleVote('notExists')}
              aria-label="This event doesn't exist"
            >
              This event doesn't exist <span className="vote-count">{votes.notExists}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main application component for the Salsa Dance Events Finder.
 * Implements the navigation bar, header, and main layout structure.
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

  return (
    <div className="App">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-main">
          <div className="navbar-item">
            Events
            <div className="navbar-subitems">
              <div className="navbar-subitem">Find Events</div>
              <div className="navbar-subitem">Saved Events</div>
            </div>
          </div>
          <div className="navbar-item">Legal Notice</div>
        </div>
      </nav>
      {/* Header with image and headline */}
      <header className="header">
        <div className="header-image-container">
          <img src={headerImage} alt="Dancing couple" className="header-image" />
          <h1 className="header-headline">Find your Latin Dance Party</h1>
        </div>
      </header>
      {/* Filter/Search Container */}
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
            list="city-list"
          />
          <datalist id="city-list">
            {filteredCities.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
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
      {/* Main content area */}
      <main className="main-content">
        {/* Events Container */}
        <section className="events-container">
          <h2 className="events-heading">Found Events</h2>
          <div className="events-list">
            {EVENTS.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
