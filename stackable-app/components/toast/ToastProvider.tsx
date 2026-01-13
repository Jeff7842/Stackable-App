"use client";

import { createContext, useContext, useState } from "react";
import Toast from "./Toast";

type ToastType = "error" | "success" | "info" | "warning";

interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ToastContext = createContext<any>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  let toastCounter = 0;

const id = `toast-${++toastCounter}`;

  const showToast = (toast: Omit<ToastData, "id">) => {
    
    setToasts((prev) => [...prev, { ...toast, id }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* GLOBAL TOAST AREA */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 transition pointer-events-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
