// geminiExtractor.js - Extract event metadata from HTML using Gemini API
// Legal/Ethical: Only send minimal, relevant text to LLM

const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

// Initialize the Google GenAI client
const genAI = new GoogleGenAI({ apiKey: API_KEY });



/**
 * Extracts ALL structured event metadata from HTML content using the Gemini API
 * @param {string} htmlText - The HTML content to analyze
 * @param {string} sourceUrl - The source URL for context
 * @returns {Promise<Array<Object>|null>} Array of extracted event metadata or null if extraction fails
 */

async function extractEventMetadata(htmlText, sourceUrl) {
  try {
    console.log(`Extracting metadata from ${sourceUrl} using Gemini API...`);
        
    // Clean the HTML and extract text content
    const cleanText = htmlText.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                              .replace(/<[^>]+>/g, ' ')
                              .replace(/\s+/g, ' ')
                              .trim();
    
    console.log(`Cleaned text length: ${cleanText.length} characters`);
    
    const prompt = `You are an expert at extracting structured event information from German websites about salsa dance events.

Please analyze the following text content from ${sourceUrl} and extract ALL salsa dance event information.

IMPORTANT: 
- If this page is about salsa/latin dance events, parties, or socials, extract the information. If it's only about courses or unrelated content, return exactly: null
- If multiple events are found, return ALL events as an array of JSON objects
- If only one event is found, you can return either a single object or an array with one object
- Include all events that have at least a name, date, and address

Extract the following information and return it as JSON (single object or array of objects):
{
  "name": "string - the name/title of the event",
  "styles": "string - comma-separated dance styles from this list ONLY: Salsa, Salsa On 2, Salsa L.A., Salsa Cubana, Bachata, Bachata Dominicana, Bachata Sensual, Kizomba, Zouk, Forró. If no matching styles found, use null",
  "dates": "array of strings - ALL event dates in YYYY-MM-DD format. For specific dates like '13. April, 15. Juni', convert to ['2025-04-13', '2025-06-15']. For recurring events like 'jeden Montag', calculate the next 4 occurrences starting from next Monday",
  "workshops": "array of objects with startTime, endTime, style, level, or null if no workshops",
  "party": "object with startTime, endTime (or null if open-end), floors with music info, or null if no party info",
  "address": "string - full venue address as precise as possible",
  "city": "string - ONLY the city name extracted from address (e.g., 'Berlin', 'Cologne', 'Munich')",
  "source_url": "${sourceUrl}",
  "recurrence": "string - exact recurrence pattern found in text (e.g., 'jeden Montag', 'wöchentlich', '13. April, 15. Juni')",
  "recurrence_type": "string - 'weekly_monday', 'weekly_tuesday', etc., 'monthly', 'specific_dates', or null",
  "venue_type": "string - 'Indoor', 'Outdoor', or 'Not specified'"
}

Important rules for date extraction:
- Look for specific dates in formats like "15.12.2024", "15. Dezember", "Samstag, 15.12."
- Convert German month names: Januar=01, Februar=02, März=03, April=04, Mai=05, Juni=06, Juli=07, August=08, September=09, Oktober=10, November=11, Dezember=12
- Today's date for reference: ${new Date().toISOString().split('T')[0]}

RECURRING EVENTS - Calculate actual dates:
- "jeden Montag" → calculate next 4 Mondays: ['2025-01-20', '2025-01-27', '2025-02-03', '2025-02-10']
- "jeden Dienstag" → calculate next 4 Tuesdays
- "wöchentlich" + specific day → calculate next 4 occurrences
- "monatlich" → calculate next 4 monthly occurrences

MULTIPLE SPECIFIC DATES:
- "13. April, 15. Juni, 31. August" → ['2025-04-13', '2025-06-15', '2025-08-31']
- "Fünf Events in 2025: 13. April, 15. Juni..." → extract all dates mentioned

RECURRENCE TYPE classification:
- "jeden Montag" → recurrence_type: "weekly_monday"
- "jeden Dienstag" → recurrence_type: "weekly_tuesday" 
- "wöchentlich" → recurrence_type: "weekly" (if no specific day mentioned)
- "monatlich" → recurrence_type: "monthly"
- Multiple specific dates → recurrence_type: "specific_dates"

Other important rules:
- Only extract information about salsa/latin dance events, parties, or socials
- If no relevant dance event is found, return exactly: null
- For dance styles: ONLY use styles from the provided list. If the page mentions other styles not in the list, ignore them
- For recurrence: Normalize similar patterns to the same format (e.g., "alle zwei Wochen" and "zweiwöchentlich" should both become "alle zwei Wochen"). Examples include "wöchentlich", "jeden Freitag", "monatlich", "alle zwei Wochen" - but these are just examples, recognize and normalize any recurring pattern you find
- For venue type: Look for terms like "Open Air", "bei gutem Wetter", "Innenhof", "draußen", "drinnen" (these are examples, not a complete list)
- Address should be as complete as possible (street, number, city, postal code if available)

Text Content:
${cleanText.substring(0, 6000)}`;

    const response = await genAI.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt
    });

    const text = response.text;
    console.log('Raw Gemini response:', text);

    // Handle null response
    if (text.trim() === 'null' || text.trim() === '```json\nnull\n```') {
      console.log('Gemini determined this is not a relevant event page');
      return null;
    }

    // Try to extract JSON from the response
    let jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('No JSON found in Gemini response');
      console.log('Full response:', text);
      return null;
    }
    
    console.log('Found JSON match, attempting to parse...');

    try {
      let jsonString = jsonMatch[0];
      
      // Handle multiple events: detect various patterns of multiple objects
      const multipleEventPatterns = [
        '},\n{',      // },\n{
        '},\n  {',    // },\n  {
        '},\n\n{',    // },\n\n{
        '},\n    {',  // },\n    {
        '},\r\n{',    // Windows line endings
        '},\r\n  {'   // Windows with spaces
      ];
      
      const hasMultipleEvents = multipleEventPatterns.some(pattern => jsonString.includes(pattern));
      
      if (hasMultipleEvents) {
        console.log('Multiple events detected, wrapping in array...');
        jsonString = '[' + jsonString + ']';
        console.log('Wrapped JSON string length:', jsonString.length);
      }
      
      const extractedData = JSON.parse(jsonString);
      
      // If it's an array, return all valid events with required fields
      if (Array.isArray(extractedData)) {
        console.log(`Found ${extractedData.length} events in response`);
        const validEvents = [];
        for (const event of extractedData) {
          if (event && event.name && event.address && event.city && (event.dates && event.dates.length > 0)) {
            console.log(`Valid event found: ${event.name} with ${event.dates.length} dates in ${event.city}`);
            validEvents.push(event);
          } else {
            console.log(`Skipping invalid event (missing required fields):`, {
              name: !!event?.name,
              address: !!event?.address, 
              city: !!event?.city,
              dates: event?.dates?.length || 0
            });
          }
        }
        
        if (validEvents.length === 0) {
          console.log('No valid events found with required fields (name, date, address)');
          return null;
        }
        
        console.log(`Returning ${validEvents.length} valid events`);
        return validEvents; // Return array of all valid events
      }
      
      // Single event validation
      if (!extractedData || !extractedData.name || !extractedData.address || !extractedData.city || !(extractedData.dates && extractedData.dates.length > 0)) {
        console.log('No valid event data extracted - missing required fields:', {
          name: !!extractedData?.name,
          address: !!extractedData?.address,
          city: !!extractedData?.city,
          dates: extractedData?.dates?.length || 0
        });
        return null;
      }

      console.log('Successfully extracted single event metadata:', extractedData);
      console.log('Single event validation passed - wrapping in array');
      return [extractedData]; // Wrap single event in array for consistency
    } catch (parseError) {
      console.error('Error parsing JSON from Gemini response:', parseError);
      console.log('JSON string that failed to parse:', jsonMatch[0]);
      
      // Fallback: try to split and parse individual events
      console.log('Attempting fallback parsing of individual events...');
      try {
        const jsonString = jsonMatch[0];
        
        // Split by pattern },\n{ or similar and try to parse each part
        const eventStrings = jsonString.split(/},\s*{/);
        
        if (eventStrings.length > 1) {
          console.log(`Found ${eventStrings.length} potential events to parse individually`);
          const validEvents = [];
          
          for (let i = 0; i < eventStrings.length; i++) {
            let eventStr = eventStrings[i];
            
            // Fix the JSON by adding missing braces
            if (i > 0) eventStr = '{' + eventStr;  // Add opening brace
            if (i < eventStrings.length - 1) eventStr = eventStr + '}';  // Add closing brace
            
            try {
              console.log(`Parsing individual event ${i + 1}...`);
              const event = JSON.parse(eventStr);
              if (event && event.name && event.date && event.address) {
                console.log(`Valid individual event found: ${event.name}`);
                validEvents.push(event);
              } else {
                console.log(`Skipping invalid individual event (missing required fields):`, event?.name || 'unnamed');
              }
            } catch (individualError) {
              console.log(`Failed to parse individual event ${i + 1}:`, individualError.message);
            }
          }
          
          if (validEvents.length > 0) {
            console.log(`Fallback parsing successful: ${validEvents.length} valid events`);
            return validEvents;
          }
        }
      } catch (fallbackError) {
        console.error('Fallback parsing also failed:', fallbackError.message);
      }
      
      return null;
    }

  } catch (error) {
    console.error('Error extracting event metadata:', error);
    if (error.response) {
      console.error('Gemini API response:', error.response.data);
    }
    return null;
  }
}

module.exports = {
  extractEventMetadata
}; 