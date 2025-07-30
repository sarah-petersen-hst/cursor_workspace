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
  "date": "string - the event date in YYYY-MM-DD format, or null if no date found",
  "workshops": "array of objects with startTime, endTime, style, level, or null if no workshops",
  "party": "object with startTime, endTime (or null if open-end), floors with music info, or null if no party info",
  "address": "string - full venue address as precise as possible",
  "source_url": "${sourceUrl}",
  "recurrence": "string - normalized recurrence pattern or null if not recurring",
  "venue_type": "string - 'Indoor', 'Outdoor', or 'Not specified'"
}

Important rules for date extraction:
- Look for specific dates in formats like "15.12.2024", "15. Dezember", "Samstag, 15.12."
- If only a weekday is mentioned (e.g., "jeden Samstag"), calculate the next occurrence of that weekday
- If it's a recurring event, provide the next occurrence date
- Today's date for reference: ${new Date().toISOString().split('T')[0]}
- Convert German month names: Januar=01, Februar=02, März=03, April=04, Mai=05, Juni=06, Juli=07, August=08, September=09, Oktober=10, November=11, Dezember=12
- If no clear date is found, use null

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
          if (event && event.name && event.date && event.address) {
            console.log(`Valid event found: ${event.name}`);
            validEvents.push(event);
          } else {
            console.log(`Skipping invalid event (missing required fields):`, event?.name || 'unnamed');
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
      if (!extractedData || !extractedData.name) {
        console.log('No valid event data extracted - missing name');
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