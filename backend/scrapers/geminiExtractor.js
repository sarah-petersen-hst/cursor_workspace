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
 * Extracts structured event metadata from HTML content using the Gemini API
 * @param {string} htmlText - The HTML content to analyze
 * @param {string} sourceUrl - The source URL for context
 * @returns {Promise<Object|null>} Extracted event metadata or null if extraction fails
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

Please analyze the following text content from ${sourceUrl} and extract ONLY salsa dance event information.

IMPORTANT: If this page is about salsa/latin dance events, parties, or socials, extract the information. If it's only about courses or unrelated content, return exactly: null

Extract the following information and return it as a JSON object:
{
  "name": "string - the name/title of the event",
  "styles": "string - comma-separated dance styles (e.g., 'Salsa, Bachata, Kizomba')",
  "date": "string - the event date in YYYY-MM-DD format",
  "workshops": "array of objects with startTime, endTime, style, level",
  "party": "object with startTime, endTime (or null if open-end), floors with music info",
  "address": "string - full venue address as precise as possible",
  "source_url": "${sourceUrl}",
  "recurrence": "string - recurrence pattern like 'wöchentlich', 'jeden Freitag', 'monatlich' or null",
  "venue_type": "string - 'Indoor', 'Outdoor', or 'Not specified'"
}

Important rules for date extraction:
- Look for specific dates in formats like "15.12.2024", "15. Dezember", "Samstag, 15.12."
- If only a weekday is mentioned (e.g., "jeden Samstag"), calculate the next occurrence of that weekday
- If it's a recurring event, provide the next occurrence date
- Today's date for reference: ${new Date().toISOString().split('T')[0]}
- Convert German month names: Januar=01, Februar=02, März=03, April=04, Mai=05, Juni=06, Juli=07, August=08, September=09, Oktober=10, November=11, Dezember=12

Other important rules:
- Only extract information about salsa/latin dance events, parties, or socials
- If no relevant dance event is found, return exactly: null
- For recurrence, look for patterns like "jeden Dienstag", "wöchentlich", "alle zwei Wochen", "monatlich"
- For venue type, look for terms like "Open Air", "bei gutem Wetter", "Innenhof", "draußen", "drinnen"
- Normalize similar recurrence patterns (e.g., "alle zwei Wochen" and "zweiwöchentlich" should both be "alle zwei Wochen")
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

    try {
      const extractedData = JSON.parse(jsonMatch[0]);
      
      // Validate that we got meaningful event data
      if (!extractedData || !extractedData.name) {
        console.log('No valid event data extracted - missing name');
        return null;
      }

      console.log('Successfully extracted event metadata:', extractedData);
      return extractedData;
    } catch (parseError) {
      console.error('Error parsing JSON from Gemini response:', parseError);
      console.log('JSON string that failed to parse:', jsonMatch[0]);
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