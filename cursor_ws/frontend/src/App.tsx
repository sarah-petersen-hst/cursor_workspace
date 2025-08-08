import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

type Workshop = {
  start: string;
  end: string;
  style: string;
  level: 'Beginner' | 'Advanced' | 'Open Level';
};

type FloorMusic = {
  floor: string;
  distribution: string;
};

type Event = {
  id: string;
  name: string;
  date: string;
  address: string;
  source: string;
  trusted: boolean;
  styles?: string[]; // Array of dance styles like ['Salsa', 'Bachata']
  recurrence?: string; // e.g., 'every Tuesday', 'every second Friday', etc.
  venueType?: VenueType;
  workshops?: Workshop[];
  party?: {
    start: string;
    end?: string;
    floors: FloorMusic[];
  };
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
 * EventCard component displays a single event summary and expandable details.
 * Fetches and submits votes to the backend, enforcing one vote per user per event per week.
 * Highlights the button the user voted for this week.
 * @param {Event} event - The event to display.
 * @returns {JSX.Element}
 */
function EventCard({ 
  event, 
  isSaved, 
  onToggleSave, 
  expanded, 
  onToggleExpanded 
}: { 
  event: Event; 
  isSaved?: boolean; 
  onToggleSave?: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const [voteData, setVoteData] = useState<{ exists: number; not_exists: number; highlight: 'green' | 'yellow'; week: string } | null>(null);
  const [userVote, setUserVote] = useState<'exists' | 'not_exists' | null>(null);
  const [loadingVotes, setLoadingVotes] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const userUuid = getOrCreateUserUuid();

  // Venue voting state
  const [venueVoteData, setVenueVoteData] = useState<{ indoor: number; outdoor: number; userVote: 'indoor' | 'outdoor' | null }>({ indoor: 0, outdoor: 0, userVote: null });
  const [venueVoteLoading, setVenueVoteLoading] = useState(false);
  const [venueVoteError, setVenueVoteError] = useState<string | null>(null);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [submittingVenueVote, setSubmittingVenueVote] = useState(false);

  // Use the event data directly (it now includes all necessary fields from the transformation layer)

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
    if (submittingVote) return;
    setSubmittingVote(true);
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
    } finally {
      setSubmittingVote(false);
    }
  };

  /**
   * Withdraw the user's vote for this event.
   */
  const withdrawVote = async () => {
    if (submittingVote) return;
    setSubmittingVote(true);
    setVoteError(null);
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
      setSubmittingVote(false);
    }
  };

  // Fetch venue votes for this event
  const fetchVenueVotes = async () => {
    setVenueVoteLoading(true);
    setVenueVoteError(null);
    try {
      const res = await fetch(`http://localhost:4000/api/venue-votes/${event.id}?userUuid=${userUuid}`);
      const data = await res.json();
      setVenueVoteData({
        indoor: data.counts?.indoor || 0,
        outdoor: data.counts?.outdoor || 0,
        userVote: data.userVote || null,
      });
    } catch (err) {
      setVenueVoteError('Failed to fetch venue votes');
    } finally {
      setVenueVoteLoading(false);
    }
  };

  // Submit venue vote
  const submitVenueVote = async (voteType: 'indoor' | 'outdoor') => {
    if (submittingVenueVote) return;
    setSubmittingVenueVote(true);
    setVenueVoteError(null);
    try {
      await fetch('http://localhost:4000/api/venue-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, userUuid, voteType }),
      });
      await fetchVenueVotes();
    } catch (err) {
      setVenueVoteError('Failed to submit venue vote');
    } finally {
      setSubmittingVenueVote(false);
    }
  };

  // Withdraw venue vote
  const withdrawVenueVote = async () => {
    if (submittingVenueVote) return;
    setSubmittingVenueVote(true);
    setVenueVoteError(null);
    try {
      await fetch('http://localhost:4000/api/venue-vote', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, userUuid }),
      });
      await fetchVenueVotes();
    } catch (err) {
      setVenueVoteError('Failed to withdraw venue vote');
    } finally {
      setSubmittingVenueVote(false);
    }
  };

  // Fetch votes when details are expanded
  useEffect(() => {
    if (expanded) fetchVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Fetch venue votes when details are expanded and venueType is Not specified
  useEffect(() => {
    console.log('Expanded state changed:', expanded, 'for event:', event.id);
    if (expanded && event.venueType === 'Not specified') fetchVenueVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, event.venueType]);

  // Determine if the event is likely real (green status bar)
  const isLikelyReal = voteData?.highlight === 'green';

  return (
    <div className={`event-card${isLikelyReal ? ' likely-real' : ''}`}>
      <div className="event-title-row">
        <span className="event-title">{event.name}</span>
        {event.trusted && <span className="trusted-label">Trusted Source</span>}
      </div>
      <div className="event-date">{event.date}</div>
      <div className="event-address">{event.address}</div>
      {event.styles && event.styles.length > 0 && (
        <div className="event-styles">
          {event.styles.map((style, index) => (
            <span key={index} className="event-style-tag">{style}</span>
          ))}
        </div>
      )}
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
        <button className="button event-details" onClick={() => {
          console.log('🔘 Details button clicked for event:', event.id, 'current expanded:', expanded);
          console.log('🔍 Event data structure:', {
            id: event.id,
            name: event.name,
            venueType: event.venueType,
            workshops: event.workshops,
            party: event.party,
            recurrence: event.recurrence
          });
          onToggleExpanded();
        }} aria-expanded={expanded} aria-controls={`details-${event.id}`}>{expanded ? 'Hide Details' : 'Details'}</button>
      </div>
             {expanded && (
         <div className="event-details-expanded" id={`details-${event.id}`}
           tabIndex={-1} aria-label={`Details for ${event.name}`}
         >
           {/* Event Metadata */}
           <div className="event-meta">
             {event.recurrence && (
               <div className="event-recurrence-pretty">
                 <span className="recurrence-icon">🔄</span>
                 <span className="recurrence-label">Recurring:</span>
                 <span className="recurrence-value">{event.recurrence}</span>
               </div>
             )}
             
             <div className={`event-venue-type ${event.venueType === 'Indoor' ? 'venue-indoor' : event.venueType === 'Outdoor' ? 'venue-outdoor' : 'venue-not-specified'}`}>
               <span className="venue-icon">
                 {event.venueType === 'Indoor' ? '🏠' : event.venueType === 'Outdoor' ? '🌤️' : '❓'}
               </span>
               Venue: {event.venueType}
             </div>

             {event.venueType === 'Outdoor' && (
               <div className="weather-warning">
                 <span className="weather-icon">⚠️</span>
                 <span className="weather-text">Note: This event takes place outdoors and may be weather-dependent.</span>
               </div>
             )}
           </div>

           {/* Workshops Section - Only show if workshops exist */}
           {event.workshops && event.workshops.length > 0 && (
             <div className="details-workshops">
               <h3>Workshops</h3>
               <div className="workshops-container">
                 {event.workshops.map((workshop, index) => (
                   <div key={index} className="workshop-item">
                     <div className="workshop-time">{workshop.start} - {workshop.end}</div>
                     <div className="workshop-style">{workshop.style}</div>
                     <div className="workshop-level">{workshop.level}</div>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* Party Section - Only show if party exists */}
           {event.party && (
             <div className="details-party">
               <h3>Party</h3>
               <div className="party-info">
                 <div className="party-time">
                   <span className="party-label">Start:</span> {event.party.start}
                   {event.party.end ? (
                     <span> - <span className="party-label">End:</span> {event.party.end}</span>
                   ) : (
                     <span> (from {event.party.start})</span>
                   )}
                 </div>
                 
                 {event.party.floors && event.party.floors.length > 0 && (
                   <div className="party-floors">
                     <div className="floors-label">Floor Music:</div>
                     {event.party.floors.map((floor, index) => (
                       <div key={index} className="party-floor">
                         <span className="floor-name">{floor.floor}:</span>
                         <span className="floor-distribution">{floor.distribution}</span>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
           )}

           {/* Voting Section */}
           <div className="details-voting">
             {loadingVotes ? (
               <div className="voting-loading">Loading votes...</div>
             ) : voteError ? (
               <div className="voting-error">Error: {voteError}</div>
             ) : voteData ? (
               <>
                 <button
                   className={`button vote-exists${userVote === 'exists' ? ' your-vote' : ''}${voteData.highlight === 'green' ? ' highlight' : ''}`}
                   onClick={() => submitVote('exists')}
                   disabled={submittingVote}
                 >
                   This event really exists
                   <span className="vote-count">{voteData.exists}</span>
                 </button>
                 <button
                   className={`button vote-not-exists${userVote === 'not_exists' ? ' your-vote' : ''}${voteData.highlight === 'yellow' ? ' highlight' : ''}`}
                   onClick={() => submitVote('not_exists')}
                   disabled={submittingVote}
                 >
                   This event doesn't exist
                   <span className="vote-count">{voteData.not_exists}</span>
                 </button>
                 {userVote && (
                   <button
                     className="button withdraw-vote"
                     onClick={withdrawVote}
                     disabled={submittingVote}
                   >
                     Withdraw Vote
                   </button>
                 )}
               </>
             ) : null}
           </div>

           {/* Venue Voting - only show if venue type is "Not specified" */}
           {event.venueType === 'Not specified' && (
             <div className="venue-voting-section">
               <div className="venue-voting-header">Help us determine the venue type:</div>
               {venueVoteLoading ? (
                 <div className="venue-voting-loading">Loading venue votes...</div>
               ) : venueVoteError ? (
                 <div className="venue-voting-error">Error: {venueVoteError}</div>
               ) : (
                 <div className="venue-voting-buttons">
                   <button
                     className={`venue-vote-btn${venueVoteData.userVote === 'indoor' ? ' your-vote' : ''}`}
                     onClick={() => submitVenueVote('indoor')}
                     disabled={submittingVenueVote}
                   >
                     <span className="venue-vote-icon">🏠</span>
                     Indoor
                     <span className="venue-vote-count">{venueVoteData.indoor}</span>
                   </button>
                   <button
                     className={`venue-vote-btn${venueVoteData.userVote === 'outdoor' ? ' your-vote' : ''}`}
                     onClick={() => submitVenueVote('outdoor')}
                     disabled={submittingVenueVote}
                   >
                     <span className="venue-vote-icon">🌤️</span>
                     Outdoor
                     <span className="venue-vote-count">{venueVoteData.outdoor}</span>
                   </button>
                   {venueVoteData.userVote && (
                     <button
                       className="venue-vote-btn withdraw"
                       onClick={withdrawVenueVote}
                       disabled={submittingVenueVote}
                     >
                       Withdraw Vote
                     </button>
                   )}
                 </div>
               )}
             </div>
           )}
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
  // Expanded events state (moved here to persist across re-renders)
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

  // Toggle expanded state for an event
  const toggleEventExpanded = (eventId: number) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
        console.log(`Expanded state changed: false for event: ${eventId}`);
      } else {
        newSet.add(eventId);
        console.log(`Expanded state changed: true for event: ${eventId}`);
      }
      return newSet;
    });
  };

  // Add state for loading and error
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Event[] | null>(null);
  const [allEvents, setAllEvents] = useState<Event[] | null>(null); // Store all events from backend // For future dynamic results
  
  // Load initial events when component mounts
  useEffect(() => {
    console.log('🚀 App mounted, triggering initial search...');
    handleSearch();
  }, []); // Run once on mount

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

  // Listen for scroll to shrink header - trigger only once at threshold
  useEffect(() => {
    let hasShrunken = false;
    const shrinkThreshold = 100; // Pixels scrolled before shrinking
    
    const onScroll = () => {
      const scrollY = window.scrollY;
      
      if (scrollY >= shrinkThreshold && !hasShrunken) {
        // Shrink header once when threshold is crossed
        setHeaderHeight(120);
        hasShrunken = true;
        console.log('🔽 Header shrunk at scroll position:', scrollY);
      }
    };
    
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /**
   * Filters events by selected dance styles.
   * @param events All events from backend
   * @param selectedStyles Array of selected dance styles
   * @returns Filtered events or all events if no styles selected
   */
  const filterEventsByStyles = (events: Event[], selectedStyles: string[]): Event[] => {
    if (!selectedStyles || selectedStyles.length === 0) {
      return events; // Show all events if no styles selected
    }
    
    return events.filter(event => {
      // Check if event has any of the selected styles
      if (!event.styles || event.styles.length === 0) {
        return false; // Don't show events without style information
      }
      
      return selectedStyles.some(selectedStyle => 
        event.styles!.some((eventStyle: string) => 
          eventStyle.toLowerCase().includes(selectedStyle.toLowerCase()) ||
          selectedStyle.toLowerCase().includes(eventStyle.toLowerCase())
        )
      );
    });
  };

  /**
   * Handles toggling a dance style in the multi-select.
   * @param style The dance style to toggle.
   */
  const handleStyleToggle = (style: string) => {
    setSelectedStyles((prev) => {
      const newStyles = prev.includes(style)
        ? prev.filter((s) => s !== style)
        : [...prev, style];
      
      // Apply filtering immediately when styles change
      if (allEvents) {
        const filtered = filterEventsByStyles(allEvents, newStyles);
        setSearchResults(filtered);
        console.log(`🎯 Filtered events: ${filtered.length} out of ${allEvents.length} total events`);
      }
      
      return newStyles;
    });
  };

  /**
   * Handles city selection from the dropdown.
   * @param city The selected city.
   */
  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setCityQuery(city);
  };

  // Update handleSearch to call backend
  const handleSearch = async () => {
    console.log('🔍 HandleSearch called with:', { cityQuery, selectedDate, selectedStyles });
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const searchPayload = {
        city: cityQuery,
        date: selectedDate,
        style: selectedStyles[0] || '', // Send first selected style for Google search targeting
        styles: selectedStyles, // Send all selected styles for frontend filtering
      };
      console.log('📤 Sending search request:', searchPayload);
      
      const res = await fetch('http://localhost:4000/api/events/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchPayload),
      });
      
      console.log('📥 Search response status:', res.status);
      if (!res.ok) throw new Error('Failed to fetch events');
      
      const data = await res.json();
      console.log('📊 Search results:', data);
      const allEventsFromBackend = data.events || [];
      setAllEvents(allEventsFromBackend);
      
      // Apply dance style filtering to the results
      const filteredEvents = filterEventsByStyles(allEventsFromBackend, selectedStyles);
      setSearchResults(filteredEvents);
      
      console.log(`🎯 Showing ${filteredEvents.length} out of ${allEventsFromBackend.length} events after filtering`);
    } catch (err) {
      console.error('❌ Search error:', err);
      setSearchError('Failed to fetch events. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Filter cities based on query
  const filteredCities = cityQuery
    ? CITIES.filter((city) =>
        city.toLowerCase().includes(cityQuery.toLowerCase())
      )
    : CITIES;

  // Get saved events from search results (memoized to prevent unnecessary re-renders)
  const savedEvents = useMemo(() => {
    console.log('🔄 Recalculating savedEvents. SearchResults:', searchResults?.length || 0, 'SavedEventIds:', savedEventIds);
    return (searchResults || []).filter((e) => savedEventIds.includes(e.id));
  }, [searchResults, savedEventIds]);

  // EventCard with save/unsave logic
  function EventCardWithSave(props: { event: Event }) {
    const { event } = props;
    const isSaved = savedEventIds.includes(event.id);
    const eventIdNumber = parseInt(event.id);
    const expanded = expandedEvents.has(eventIdNumber);
    return (
      <EventCard 
        event={event} 
        isSaved={isSaved} 
        onToggleSave={() => toggleSaveEvent(event.id)}
        expanded={expanded}
        onToggleExpanded={() => toggleEventExpanded(eventIdNumber)}
      />
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
          <button className="button search-button" onClick={handleSearch} type="button" disabled={searchLoading}>
            {searchLoading ? 'Searching...' : 'Search'}
          </button>
        </section>
      )}
      {/* Main content area */}
      <main className="main-content">
        {searchLoading && (
          <div className="search-loading">Searching for events...</div>
        )}
        {searchError && (
          <div className="search-error">{searchError}</div>
        )}
        {searchResults && !searchLoading && !searchError && (
          <section className="events-container">
            <h2 className="events-heading">Found Events</h2>
            <div className="events-list">
              {!searchResults || searchResults.length === 0 ? (
                <div className="no-events-found">
                  {searchResults === null ? 'Loading events...' : 'No events found for your search.'}
                </div>
              ) : (
                searchResults.map((event) => {
                  console.log('🎯 Rendering event:', event.id, event.name);
                  return <EventCardWithSave key={event.id} event={event} />;
                })
              )}
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
