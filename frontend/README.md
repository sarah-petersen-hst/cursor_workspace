# Salsa Dance Events Finder - Frontend

## Chat Log

- [2024-05-11 12:00] User: A website should be created that allows users to find salsa dance events. The available dance styles should always be displayed as round labels and in a consistent style. ... (full requirements)
- [2024-05-11 12:02] Assistant: High-level plan, asked about DB and image.
- [2024-05-11 12:03] User: Ok lets not take care of the rest api for fetching the events yet ... (additional requirements)
- [2024-05-11 12:04] Assistant: Initialized React app, requested image.
- [2024-05-11 12:05] User: i put it in the src folder
- [2024-05-11 12:06] Assistant: Confirmed image, started implementation.
- [2024-05-11 12:10] User: We can continue
- [2024-05-11 12:11] Assistant: Added filter/search container with round style labels, city select, date input, and search button. Updated CSS for layout, accessibility, and responsiveness.
- [2024-05-11 12:13] User: Proceed
- [2024-05-11 12:14] Assistant: Added events container, event cards, and related CSS. Used placeholder data and prepared for details expansion.
- [2024-05-11 12:15] User: proceed
- [2024-05-11 12:16] Assistant: Added expandable event details, workshops, party details, and voting logic with highlight. Updated CSS and documentation.
- [2024-05-11 12:17] User: For likely real events (defined at the start of this chat) do a color coding with a green status bar on the left margin of the event info
- [2024-05-11 12:18] Assistant: Added green status bar for likely real events, with logic and CSS. Updated documentation.

## Implementation Notes

- Initialized React app with TypeScript using Create React App.
- Added custom color scheme: orange (#E92932) for buttons, brown (#221112) for background.
- Set up navigation bar, header with image and headline, and main content area in `App.tsx`.
- Added Google Fonts import for 'Poppins' in `public/index.html`.
- Implemented filter/search container with:
  - Round, multi-select dance style labels (consistent style, dark red when selected)
  - Searchable city select (with datalist for accessibility)
  - Date input
  - Orange search button
- Implemented events container with:
  - Heading 'Found Events'
  - Event cards showing event name, date, address, source, Save button, Details button, and Trusted Source label if applicable
  - Placeholder data for events
  - Divider lines between event cards
- Implemented expandable event details:
  - Workshops (start/end time, style, difficulty)
  - Party details (start time, end time or 'from...', floors and music distribution)
  - Voting buttons with counters and highlight logic (green/yellow)
  - Placeholder data for details and votes
- Added green status bar for likely real events (more 'exists' than 'notExists' votes in the last week), with logic and CSS.
- Used custom CSS for all styling, including overlap, rounded corners, and responsive layout.
- All code is documented with JSDoc/TSDoc comments.
- Accessibility best practices (aria attributes, focus styles) are followed.
- Further components, tests, and documentation will be added as the implementation progresses.
