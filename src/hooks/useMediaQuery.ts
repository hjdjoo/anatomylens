/**
 * useMediaQuery Hook
 * 
 * Detects viewport size changes and returns boolean for media query match.
 * Uses matchMedia API for efficient detection.
 */

import { useState, useEffect } from 'react';

/**
 * Subscribe to a CSS media query and return whether it matches
 * @param query - CSS media query string (e.g., '(min-width: 768px)')
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    // SSR safety: default to false if window is undefined
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);

    // Set initial value
    setMatches(mediaQuery.matches);

    // Create listener
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [query]);

  return matches;
}

/**
 * Convenience hook for common breakpoints (Tailwind-aligned)
 */
export function useBreakpoint() {
  const isSm = useMediaQuery('(min-width: 640px)');
  const isMd = useMediaQuery('(min-width: 768px)');
  const isLg = useMediaQuery('(min-width: 1024px)');
  const isXl = useMediaQuery('(min-width: 1280px)');

  return { isSm, isMd, isLg, isXl };
}

/**
 * Simple mobile detection (below md breakpoint)
 */
export function useIsMobile(): boolean {
  return !useMediaQuery('(min-width: 768px)');
}

export default useMediaQuery;
