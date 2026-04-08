"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import ConfirmationModal, {
  type ConfirmationModalProps,
} from "@/components/Confirmation-Modal/modal";

export type ConfirmationRequestOptions = Omit<
  ConfirmationModalProps,
  "open" | "onClose" | "onConfirm" | "loading"
>;

type ConfirmationRequest = ConfirmationRequestOptions & {
  resolve: (value: boolean) => void;
};

type ConfirmationContextValue = {
  confirm: (options: ConfirmationRequestOptions) => Promise<boolean>;
};

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);

  const resolveRequest = useCallback((value: boolean) => {
    setRequest((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const confirm = useCallback((options: ConfirmationRequestOptions) => {
    return new Promise<boolean>((resolve) => {
      setRequest((current) => {
        current?.resolve(false);
        return { ...options, resolve };
      });
    });
  }, []);

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}

      <ConfirmationModal
        open={!!request}
        title={request?.title ?? "Confirm action"}
        message={request?.message ?? ""}
        confirmLabel={request?.confirmLabel}
        cancelLabel={request?.cancelLabel}
        tone={request?.tone}
        variant={request?.variant}
        hideCancel={request?.hideCancel}
        onClose={() => resolveRequest(false)}
        onConfirm={() => resolveRequest(true)}
      />
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);

  if (!context) {
    throw new Error("useConfirmation must be used within a ConfirmationProvider.");
  }

  return context;
}
