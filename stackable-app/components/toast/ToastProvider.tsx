"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Toast from "./Toast";

export type ToastType = "error" | "success" | "info" | "warning";

export type ToastInput = {
  type: ToastType;
  title: string;
  description?: string;
};

interface ToastData extends ToastInput {
  id: string;
}

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastCounter = useRef(0);
  const MAX_TOASTS = 4;

  const showToast = (toast: ToastInput) => {
    const id = `toast-${++toastCounter.current}`;

    setToasts((prev) => {
      const next = prev.length >= MAX_TOASTS ? prev.slice(1) : prev;

      return [...next, { ...toast, id }];
    });

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[130] flex w-[min(100vw-2rem,24rem)] flex-col gap-3 sm:right-6 sm:top-6">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return context;
}
