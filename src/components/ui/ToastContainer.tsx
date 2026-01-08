/**
 * ToastContainer
 * 
 * Renders all active toasts in a fixed position container.
 * Add this component once at the app root level.
 */

import { useToastStore, type Toast, type ToastType } from '@/store/toastStore';
import { useState } from 'react';

// ============================================================
// TOAST ICONS
// ============================================================

const ToastIcon = ({ type }: { type: ToastType }) => {
  const iconProps = { className: 'w-5 h-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' };
  
  switch (type) {
    case 'success':
      return (
        <svg {...iconProps}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'error':
      return (
        <svg {...iconProps}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...iconProps}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg {...iconProps}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

// ============================================================
// STYLES
// ============================================================

const TYPE_STYLES: Record<ToastType, { container: string; icon: string }> = {
  success: {
    container: 'bg-green-900/90 border-green-700/50',
    icon: 'text-green-400',
  },
  error: {
    container: 'bg-red-900/90 border-red-700/50',
    icon: 'text-red-400',
  },
  warning: {
    container: 'bg-amber-900/90 border-amber-700/50',
    icon: 'text-amber-400',
  },
  info: {
    container: 'bg-blue-900/90 border-blue-700/50',
    icon: 'text-blue-400',
  },
};

// ============================================================
// SINGLE TOAST COMPONENT
// ============================================================

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const styles = TYPE_STYLES[toast.type];

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 200); // Wait for exit animation
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-lg
        transition-all duration-200 ease-out
        ${styles.container}
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${styles.icon}`}>
        <ToastIcon type={toast.type} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-100">
          {toast.message}
        </p>
        {toast.description && (
          <p className="mt-1 text-xs text-surface-400">
            {toast.description}
          </p>
        )}
      </div>

      {/* Dismiss button */}
      {toast.dismissible && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 text-surface-500 hover:text-surface-200 transition-colors rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ============================================================
// TOAST CONTAINER
// ============================================================

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;