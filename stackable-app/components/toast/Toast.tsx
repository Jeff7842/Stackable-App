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
    error: "from-rose-600 to-red-700 shadow-red-900/40",
    success: "from-[#08bd38] to-emerald-700 shadow-emerald-900/30",
    info: "from-sky-600 to-blue-700 shadow-blue-900/30",
    warning: "from-amber-500 to-orange-600 shadow-orange-900/40",
  };

  const icons = {
  error: (
    <div
        className="
          text-[#ffbf00]
          bg-white/15 backdrop-blur-xl
          p-1 rounded-lg
        "
      >
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
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
      </div>
  ),
  success: (
    <div
        className="
          text-yellow-400
          bg-white/15 backdrop-blur-xl
          p-1 rounded-lg
        "
      >
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
    <div
        className="
          text-orange-400
          bg-white/15 backdrop-blur-xl
          p-1 rounded-lg
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.8"
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z"
          />
        </svg>
      </div>
  ),
  warning: (
    <div
        className="
          text-white
          bg-black/20 backdrop-blur-xl
          p-1 rounded-lg
        "
      >
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

const textColors = {
  error: "text-[#fff200]",
  success: "text-white",
  info: "text-white",
  warning: "text-white",
};

const descriptionColors = {
  error: "text-red-100/90",
  success: "text-emerald-100/80",
  info: "text-blue-100/80",
  warning: "text-amber-100/85",
};


  return (
    <div className="w-full min-w-70 max-w-[22.5rem] text-left text-[12px] sm:text-xs">
      <div
        className={`
          flex items-center text-left justify-between h-14 sm:h-14 rounded-lg
          bg-gradient-to-r ${styles[type]}
          px-[10px] shadow-lg
        `}
      >
         {/* LEFT CLUSTER */}
    <div className="flex items-center gap-2 text-left">
      {/* Icon */}
      <div className="shrink-0 text-white  backdrop-blur-[15px] p-1 rounded-lg">
        {icons[type]}
      </div>

      {/* Text */}
      <div className="flex flex-col  leading-tight text-white">
        <p className={`font-semibold ${textColors[type]}`}>{title}</p>
        {description && <p className={`${descriptionColors[type]}`}>{description}</p>}
      </div>
    </div>

        <button
          onClick={() => onClose(id)}
          className="p-2 rounded-full text-gray-300 hover:bg-gray-100/20 hover:rotate-180 hover:text-amber-300 transition cursor-pointer"
        >
        <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
        </button>
      </div>
    </div>
  );
}
