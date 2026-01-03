import { useState, useEffect } from 'react';

/**
 * A hook that works like useState but persists the value to localStorage.
 * 
 * @param {string} key - The localStorage key to use
 * @param {any} initialValue - The fallback value if nothing is in localStorage
 * @returns {[any, Function]} - State and setter
 */
export function usePersistentState(key, initialValue) {
  // Use a function for lazy initialization
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn(`Failed to load state for key "${key}":`, e);
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      if (state === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(state));
      }
    } catch (e) {
      console.warn(`Failed to save state for key "${key}":`, e);
    }
  }, [key, state]);

  return [state, setState];
}
