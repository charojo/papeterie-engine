import { useState, useEffect, useRef } from 'react';

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
    // If no key, just return initial val
    if (!key) return initialValue;

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

  // Use ref to access latest initialValue without triggering effect
  const initialValueRef = useRef(initialValue);
  useEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);

  // Re-initialize state when key changes
  useEffect(() => {
    if (!key) {
      // If we switched to no-key, we might want to reset? 
      // Or just keep current state?
      // Matches original behavior: if key changes, we re-read storage or use initial
      // If key is null, we can't read storage, so we fall back to initial
      // BUT: if we want to "persist" across key nullification during runtime, we might want to stay put.
      // However, the original code reset state on key change.
      // Let's stick to safe behavior: reset to initial if key goes away.
      // Actually, looking at the previous implementation:
      // if (saved !== null) ... else setState(initialValueRef.current)
      // So yes, re-initialize to initialValueRef.current is correct behavior for "key missing".
      setState(initialValueRef.current);
      return;
    }

    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        setState(JSON.parse(saved));
      } else {
        setState(initialValueRef.current);
      }
    } catch (e) {
      console.warn(`Failed to reload state for new key "${key}":`, e);
      setState(initialValueRef.current);
    }
  }, [key]);

  useEffect(() => {
    if (!key) return; // No persistence without key

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
