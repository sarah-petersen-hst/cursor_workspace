import { v4 as uuidv4 } from 'uuid';

/**
 * Get or create a persistent UUID for this browser in localStorage.
 * @returns {string} The UUID.
 */
export function getOrCreateUserUuid(): string {
  let uuid = localStorage.getItem('userUuid');
  if (!uuid) {
    uuid = uuidv4();
    localStorage.setItem('userUuid', uuid);
  }
  return uuid;
}

/**
 * Get saved event IDs from localStorage.
 * @returns {string[]} Array of saved event IDs.
 */
export function getSavedEventIds(): string[] {
  const saved = localStorage.getItem('savedEvents');
  return saved ? JSON.parse(saved) : [];
}

/**
 * Save event IDs to localStorage.
 * @param {string[]} ids - Array of event IDs to save.
 */
export function setSavedEventIds(ids: string[]) {
  localStorage.setItem('savedEvents', JSON.stringify(ids));
} 