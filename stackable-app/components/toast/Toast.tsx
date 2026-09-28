"use client";

// Gradient design restored from the `main` branch's toast mockup
// (components/toast/sample.tsx) — colour, shadow and icon-badge treatment per
// type, wired to the real showToast() props (id/type/title/description/onClose).
// Sizing is auto-height (not sample.tsx's fixed h-12/h-14) so a longer
// description can wrap without clipping; width is governed by ToastProvider's
// container, same as before.

type ToastType = "error" | "success" | "info" | "warning";

interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  onClose: (id: string) => void;
}

const STYLES: Record<
  ToastType,
  {
    card: string;
    shadow: string;
    iconBadge: string;
    icon: string;
    title: string;
    description: string;
    close: string;
  }
> = {
  error: {
    card: "bg-gradient-to-r from-rose-600 to-red-700",
    shadow: "shadow-lg shadow-red-900/40",
    iconBadge: "bg-white/15 backdrop-blur-xl",
    icon: "text-[#ffbf00]",
    title: "text-[#fff200]",
    description: "text-red-100/90",
    close: "text-red-100/90 hover:text-white hover:bg-white/10",
  },
  success: {
    card: "bg-gradient-to-r from-[#08bd38] to-emerald-700",
    shadow: "shadow-lg shadow-emerald-900/30",
    iconBadge: "bg-white/15 backdrop-blur-xl",
    icon: "text-yellow-400",
    title: "text-white",
    description: "text-emerald-100/80",
    close: "text-emerald-100/90 hover:text-white hover:bg-white/10",
  },
  info: {
    card: "bg-gradient-to-r from-sky-600 to-blue-700",
    shadow: "shadow-lg shadow-blue-900/30",
    iconBadge: "bg-white/15 backdrop-blur-xl",
    icon: "text-orange-400",
    title: "text-white",
    description: "text-blue-100/80",
    close: "text-blue-100/90 hover:text-white hover:bg-white/10",
  },
  warning: {
    card: "bg-gradient-to-r from-amber-500 to-orange-600",
    shadow: "shadow-lg shadow-orange-900/40",
    iconBadge: "bg-black/20 backdrop-blur-xl",
    icon: "text-white",
    title: "text-white",
    description: "text-amber-100/85",
    close: "text-amber-100/90 hover:text-white hover:bg-white/10",
  },
};

const icons: Record<ToastType, React.ReactNode> = {
  error: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
      />
    </svg>
  ),
  success: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  ),
  // Generic info-circle (sample.tsx used a chat-bubble tied to its "you have a message" example copy;
  // this toast carries arbitrary info messages, so it keeps the neutral info glyph instead).
  info: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01m8.99 4a9 9 0 1 1-18 0a9 9 0 0 1 18 0Z" />
    </svg>
  ),
  warning: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" className="w-6 h-6">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.29 3.86l-7.4 12.82A1.5 1.5 0 0 0 4.19 19h15.62a1.5 1.5 0 0 0 1.3-2.32l-7.4-12.82a1.5 1.5 0 0 0-2.6 0Z"
      />
    </svg>
  ),
};

export default function Toast({ id, type, title, description, onClose }: ToastProps) {
  const s = STYLES[type];

  return (
    <div className="pointer-events-auto w-full text-left">
      <div className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 sm:px-[10px] ${s.card} ${s.shadow}`}>
        <div className="flex gap-2 min-w-0">
          <div className={`shrink-0 self-start rounded-lg p-1 ${s.iconBadge} ${s.icon}`}>{icons[type]}</div>

          <div className="leading-tight min-w-0">
            <p className={`text-[13px] font-semibold ${s.title}`}>{title}</p>
            {description ? <p className={`text-xs ${s.description}`}>{description}</p> : null}
          </div>
        </div>

        <button
          onClick={() => onClose(id)}
          className={`shrink-0 rounded-md p-1 transition-colors ${s.close}`}
          aria-label="Dismiss notification"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
