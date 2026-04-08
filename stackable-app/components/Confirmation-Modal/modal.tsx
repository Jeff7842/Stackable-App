"use client";

export type ConfirmationTone = "primary" | "danger" | "success" | "warning";
export type ConfirmationVariant = "confirm" | "success";

export type ConfirmationModalProps = {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  tone?: ConfirmationTone;
  variant?: ConfirmationVariant;
  hideCancel?: boolean;
};

const toneStyles: Record<
  ConfirmationTone,
  { icon: string; iconRing: string; confirm: string }
> = {
  primary: {
    icon: "bg-[#FFF4E2] text-[#B56A00]",
    iconRing: "ring-[#F8D7A0]",
    confirm: "bg-[#F19F24] text-white hover:bg-[#d88915]",
  },
  danger: {
    icon: "bg-red-50 text-red-600",
    iconRing: "ring-red-100",
    confirm: "bg-red-600 text-white hover:bg-red-700",
  },
  success: {
    icon: "bg-emerald-50 text-emerald-600",
    iconRing: "ring-emerald-100",
    confirm: "bg-emerald-600 text-white hover:bg-emerald-700",
  },
  warning: {
    icon: "bg-amber-50 text-amber-600",
    iconRing: "ring-amber-100",
    confirm: "bg-amber-500 text-white hover:bg-amber-600",
  },
};

function Icon({
  variant,
  tone,
}: {
  variant: ConfirmationVariant;
  tone: ConfirmationTone;
}) {
  if (variant === "success") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    );
  }

  if (tone === "danger") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export default function ConfirmationModal({
  open,
  title,
  message,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  tone = "primary",
  variant = "confirm",
  hideCancel = false,
}: ConfirmationModalProps) {
  if (!open) {
    return null;
  }

  const selectedTone = variant === "success" ? "success" : tone;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal overlay"
        onClick={loading ? undefined : onClose}
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[4px]"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-gray-100 bg-white shadow-[0_35px_80px_rgba(15,23,42,0.18)]">
        <div className="px-6 pb-6 pt-8 text-center sm:px-7">
          <div className="flex justify-center">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full ring-8 ${toneStyles[selectedTone].icon} ${toneStyles[selectedTone].iconRing}`}
            >
              <Icon variant={variant} tone={selectedTone} />
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">{message}</p>
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
            {!hideCancel && (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="inline-flex min-w-[140px] items-center justify-center rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelLabel}
              </button>
            )}

            <button
              type="button"
              onClick={onConfirm ?? onClose}
              disabled={loading}
              className={`inline-flex min-w-[140px] items-center justify-center rounded-[16px] px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneStyles[selectedTone].confirm}`}
            >
              {loading ? "Please wait..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
