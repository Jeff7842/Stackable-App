"use client";

type ToastType = "error" | "success" | "info" | "warning";

interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  onClose: (id: string) => void;
}

export default function Toast({
  id,
  type,
  title,
  description,
  onClose,
}: ToastProps) {
  const styles = {
    // Colours come from the dashboard design tokens (app/globals.css), so the
    // toast follows light / dark mode.
    error: {
      icon: "bg-danger-tint text-danger",
      ring: "ring-danger-tint",
      accent: "bg-danger",
      description: "text-ink-soft",
    },
    success: {
      icon: "bg-success-tint text-success",
      ring: "ring-success-tint",
      accent: "bg-success",
      description: "text-ink-soft",
    },
    info: {
      icon: "bg-info-tint text-info",
      ring: "ring-info-tint",
      accent: "bg-info",
      description: "text-ink-soft",
    },
    warning: {
      icon: "bg-warning-tint text-warning",
      ring: "ring-warning-tint",
      accent: "bg-warning",
      description: "text-ink-soft",
    },
  };

  const icons = {
    error: (
      <div className="rounded-full p-1.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3Z"
          />
        </svg>
      </div>
    ),
    success: (
      <div className="rounded-full p-1.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m4.5 12.75 6 6 9-13.5"
          />
        </svg>
      </div>
    ),
    info: (
      <div className="rounded-full p-1.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.8"
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16v-4m0-4h.01m8.99 4a9 9 0 1 1-18 0a9 9 0 0 1 18 0Z"
          />
        </svg>
      </div>
    ),
    warning: (
      <div className="rounded-full p-1.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.6"
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.29 3.86l-7.4 12.82A1.5 1.5 0 0 0 4.19 19h15.62a1.5 1.5 0 0 0 1.3-2.32l-7.4-12.82a1.5 1.5 0 0 0-2.6 0Z"
          />
        </svg>
      </div>
    ),
  };

  return (
    <div className="pointer-events-auto w-full text-left">
      <div
        className="relative overflow-hidden rounded-2xl bg-surface px-4 py-4 shadow-pop ring-1 ring-ghost"
      >
        <div className={`absolute inset-y-0 left-0 w-1 ${styles[type].accent}`} />

        <div className="flex items-start justify-between gap-3 pl-2">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-8 ${styles[type].icon} ${styles[type].ring}`}
            >
              {icons[type]}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{title}</p>
              {description ? (
                <p className={`mt-1 text-sm leading-5 ${styles[type].description}`}>
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          <button
            onClick={() => onClose(id)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-300 ease-standard hover:bg-recessed hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
            aria-label="Dismiss notification"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
