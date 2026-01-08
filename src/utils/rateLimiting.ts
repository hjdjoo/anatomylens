/**
 * Rate Limiting Utilities
 * 
 * Provides throttling and debouncing utilities for user actions.
 * Includes both standalone functions and React hooks.
 */

import { useCallback, useRef, useEffect } from 'react';

// ============================================================
// THROTTLE - Execute at most once per interval
// ============================================================

/**
 * Creates a throttled function that only invokes the provided function
 * at most once per specified interval.
 * 
 * @param fn - Function to throttle
 * @param intervalMs - Minimum time between invocations in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  intervalMs: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;
  let lastResult: ReturnType<T> | undefined;

  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    const now = Date.now();
    if (now - lastCall >= intervalMs) {
      lastCall = now;
      lastResult = fn(...args) as ReturnType<T>;
    }
    return lastResult;
  };
}

/**
 * React hook for throttled callbacks.
 * The callback reference is stable across re-renders.
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  intervalMs: number,
  deps: React.DependencyList = []
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  const lastCall = useRef(0);
  const callbackRef = useRef(callback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback, ...deps]);

  return useCallback((...args: Parameters<T>): ReturnType<T> | undefined => {
    const now = Date.now();
    if (now - lastCall.current >= intervalMs) {
      lastCall.current = now;
      return callbackRef.current(...args) as ReturnType<T>;
    }
    return undefined;
  }, [intervalMs]);
}

// ============================================================
// DEBOUNCE - Execute after pause in calls
// ============================================================

/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified delay has elapsed since the last call.
 * 
 * @param fn - Function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns Debounced function with cancel method
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * React hook for debounced callbacks.
 * Automatically cleans up on unmount.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delayMs: number,
  deps: React.DependencyList = []
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback, ...deps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
      timeoutRef.current = null;
    }, delayMs);
  }, [delayMs]);
}

// ============================================================
// ACTION RATE LIMITER - For specific user actions
// ============================================================

interface RateLimitConfig {
  /** Maximum number of actions allowed in the window */
  maxActions: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Callback when rate limit is hit */
  onLimitReached?: () => void;
}

interface ActionRateLimiter {
  /** Check if action is allowed and record it if so */
  tryAction: () => boolean;
  /** Get remaining actions in current window */
  remaining: () => number;
  /** Reset the limiter */
  reset: () => void;
}

/**
 * Creates a rate limiter for specific user actions.
 * Tracks action counts within a sliding time window.
 */
export function createActionRateLimiter(config: RateLimitConfig): ActionRateLimiter {
  const { maxActions, windowMs, onLimitReached } = config;
  const actionTimestamps: number[] = [];

  const cleanOldActions = () => {
    const cutoff = Date.now() - windowMs;
    while (actionTimestamps.length > 0 && actionTimestamps[0] < cutoff) {
      actionTimestamps.shift();
    }
  };

  return {
    tryAction: () => {
      cleanOldActions();
      if (actionTimestamps.length >= maxActions) {
        onLimitReached?.();
        return false;
      }
      actionTimestamps.push(Date.now());
      return true;
    },

    remaining: () => {
      cleanOldActions();
      return Math.max(0, maxActions - actionTimestamps.length);
    },

    reset: () => {
      actionTimestamps.length = 0;
    },
  };
}

/**
 * React hook for action rate limiting.
 */
export function useActionRateLimiter(config: RateLimitConfig): ActionRateLimiter {
  const limiterRef = useRef<ActionRateLimiter | null>(null);

  if (!limiterRef.current) {
    limiterRef.current = createActionRateLimiter(config);
  }

  // Update onLimitReached callback if it changes
  useEffect(() => {
    // Re-create limiter if config changes significantly
    limiterRef.current = createActionRateLimiter(config);
  }, [config.maxActions, config.windowMs]);

  return limiterRef.current;
}

// ============================================================
// ASYNC OPERATION DEDUPLICATION
// ============================================================

type AsyncFn<T> = () => Promise<T>;

/**
 * Ensures only one instance of an async operation runs at a time.
 * Subsequent calls while one is in-flight will return the same promise.
 */
export function dedupeAsync<T>(fn: AsyncFn<T>): AsyncFn<T> {
  let inFlightPromise: Promise<T> | null = null;

  return async () => {
    if (inFlightPromise) {
      return inFlightPromise;
    }

    inFlightPromise = fn().finally(() => {
      inFlightPromise = null;
    });

    return inFlightPromise;
  };
}

/**
 * React hook for deduplicating async operations.
 */
export function useDedupeAsync<T>(fn: AsyncFn<T>, deps: React.DependencyList = []): AsyncFn<T> {
  const inFlightRef = useRef<Promise<T> | null>(null);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn, ...deps]);

  return useCallback(async () => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    inFlightRef.current = fnRef.current().finally(() => {
      inFlightRef.current = null;
    });

    return inFlightRef.current;
  }, []);
}