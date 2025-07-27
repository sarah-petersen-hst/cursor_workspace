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