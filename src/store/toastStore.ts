/**
 * Toast Store
 * 
 * Centralized toast notification system using Zustand.
 * Supports success, error, warning, and info toasts with auto-dismiss.
 */

import { create } from 'zustand';

// ============================================================
// TYPES
// ============================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'cookie';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number; // ms, 0 = persistent
  dismissible?: boolean;
}

interface ToastState {
  toasts: Toast[];

  // Actions
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;

  // Convenience methods
  success: (message: string, description?: string) => string;
  error: (message: string, description?: string) => string;
  warning: (message: string, description?: string) => string;
  info: (message: string, description?: string) => string;
}

// ============================================================
// DEFAULTS
// ============================================================

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
  cookie: 1000 * 60 * 60
};

// ============================================================
// STORE
// ============================================================

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const duration = toast.duration ?? DEFAULT_DURATION[toast.type];

    const newToast: Toast = {
      ...toast,
      id,
      dismissible: toast.dismissible ?? true,
    };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // Auto-dismiss after duration (if not persistent)
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => {
    set({ toasts: [] });
  },

  // Convenience methods
  success: (message, description) => {
    return get().addToast({ type: 'success', message, description });
  },

  error: (message, description) => {
    return get().addToast({ type: 'error', message, description });
  },

  warning: (message, description) => {
    return get().addToast({ type: 'warning', message, description });
  },

  info: (message, description) => {
    return get().addToast({ type: 'info', message, description });
  },
}));

// ============================================================
// HOOK ALIAS
// ============================================================

export const useToast = () => {
  const { success, error, warning, info, removeToast, clearAll } = useToastStore();
  return { success, error, warning, info, dismiss: removeToast, clearAll };
};