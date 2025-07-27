import { getOrCreateUserUuid, getSavedEventIds, setSavedEventIds } from './utils';

/**
 * Mock localStorage for testing.
 */
beforeEach(() => {
  localStorage.clear();
});

describe('getOrCreateUserUuid', () => {
  it('creates and returns a UUID if not present', () => {
    const uuid = getOrCreateUserUuid();
    expect(uuid).toMatch(/[0-9a-fA-F-]{36}/);
    expect(localStorage.getItem('userUuid')).toBe(uuid);
  });
  it('returns the same UUID if already present', () => {
    const uuid1 = getOrCreateUserUuid();
    const uuid2 = getOrCreateUserUuid();
    expect(uuid1).toBe(uuid2);
  });
});

describe('getSavedEventIds and setSavedEventIds', () => {
  it('returns an empty array if nothing is saved', () => {
    expect(getSavedEventIds()).toEqual([]);
  });
  it('saves and retrieves event IDs', () => {
    setSavedEventIds(['1', '2']);
    expect(getSavedEventIds()).toEqual(['1', '2']);
  });
  it('overwrites previous saved IDs', () => {
    setSavedEventIds(['1']);
    setSavedEventIds(['2', '3']);
    expect(getSavedEventIds()).toEqual(['2', '3']);
  });
}); 