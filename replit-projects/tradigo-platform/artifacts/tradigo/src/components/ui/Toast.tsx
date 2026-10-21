import React, { useEffect } from 'react';
import { create } from 'zustand';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number; // ms, default 4000
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      duration: 4000,
      ...toast,
      id,
    };
    set((state) => ({ toasts: [...state.toasts, newToast] }));
    return id;
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Convenience helper object
export const toast = {
  success: (message: string, title?: string, duration?: number) =>
    useToastStore.getState().addToast({ message, title, type: 'success', duration }),
  error: (message: string, title?: string, duration?: number) =>
    useToastStore.getState().addToast({ message, title, type: 'error', duration }),
  info: (message: string, title?: string, duration?: number) =>
    useToastStore.getState().addToast({ message, title, type: 'info', duration }),
  warning: (message: string, title?: string, duration?: number) =>
    useToastStore.getState().addToast({ message, title, type: 'warning', duration }),
  custom: (toastOptions: Omit<Toast, 'id'>) =>
    useToastStore.getState().addToast(toastOptions),
};

export const ToastContainer = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <aside aria-label="Notifications" className="fixed bottom-5 right-5 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none px-4 md:px-0">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </AnimatePresence>
    </aside>
  );
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onDismiss();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toast, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
  };

  const borderStyles = {
    success: 'border-emerald-500/30 bg-emerald-950/20 dark:bg-emerald-950/30',
    error: 'border-rose-500/30 bg-rose-950/20 dark:bg-rose-950/30',
    warning: 'border-amber-500/30 bg-amber-950/20 dark:bg-amber-950/30',
    info: 'border-blue-500/30 bg-blue-950/20 dark:bg-blue-950/30',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        "pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md text-foreground",
        "bg-card/95 border-border/80",
        borderStyles[toast.type]
      )}
    >
      <div className="mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className="text-sm font-semibold text-foreground tracking-tight mb-0.5">
            {toast.title}
          </h4>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed break-words">
          {toast.message}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors -mr-1 -mt-1 focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
