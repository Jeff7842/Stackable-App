import React from 'react'

const toastsmaple = () => {
  return (
    <div>
        
{/* Error Toast */}
<div className="flex flex-col gap-2 w-60 sm:w-72 text-[10px] sm:text-xs z-50">
  <div
    className="
      error-alert cursor-default flex items-center justify-between
      w-full h-12 sm:h-14 rounded-lg
      bg-gradient-to-r from-rose-600 to-red-700
      px-[10px]
      shadow-lg shadow-red-900/40
    "
  >
    <div className="flex gap-2">
      {/* Icon wrapper */}
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

      {/* Text */}
      <div className="leading-tight">
        <p className="text-[#fff200] font-semibold">
          Please try again
        </p>
        <p className="text-red-100/90">
          This is the description part
        </p>
      </div>
    </div>

    {/* Close button */}
    <button
      className="
        text-red-100/90
        hover:text-white
        hover:bg-white/10
        p-1 rounded-md
        transition-colors
        
      "
      
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18 18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
</div>


{/* Success Toast */}
<div className="flex flex-col gap-2 w-60 sm:w-72 text-[10px] sm:text-xs z-50">
  <div
    className="
      cursor-default flex items-center justify-between
      w-full h-12 sm:h-14 rounded-lg
      bg-gradient-to-r from-[#08bd38] to-emerald-700
      px-[10px] shadow-lg shadow-emerald-900/30
    "
  >
    <div className="flex gap-2">
      {/* Icon wrapper */}
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

      {/* Text */}
      <div className="leading-tight">
        <p className="text-white text-[12px] font-semibold">
          Done successfully
        </p>
        <p className="text-emerald-100/80">
          This is the description section
        </p>
      </div>
    </div>

    {/* Close button */}
    <button
      className="
        text-emerald-100/90
        hover:text-white
        hover:bg-white/10
        p-1 rounded-md
        transition-colors
      "
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18 18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
</div>

{/*Notifiaction Toast*/}

<div className="flex flex-col gap-2 w-60 sm:w-72 text-[10px] sm:text-xs z-50">
  <div
    className="
      info-alert cursor-default flex items-center justify-between
      w-full h-12 sm:h-14 rounded-lg
      bg-gradient-to-r from-sky-600 to-blue-700
      px-[10px]
      shadow-lg shadow-blue-900/30
    "
  >
    <div className="flex gap-2">

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


      <div className="leading-tight">
        <p className="text-white font-semibold">
          You have a message
        </p>
        <p className="text-blue-100/80">
          Click to see the message…
        </p>
      </div>
    </div>

    <button
      className="
        text-blue-100/90
        hover:text-white
        hover:bg-white/10
        p-1 rounded-md
        transition-colors
      "
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M6 18 18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
</div>

{/* Warning Toast */}
<div className="flex flex-col gap-2 w-60 sm:w-72 text-[10px] sm:text-xs z-50">
  <div
    className="
      warning-alert cursor-default flex items-center justify-between
      w-full h-12 sm:h-14 rounded-lg
      bg-gradient-to-r from-amber-500 to-orange-600
      px-[10px]
      shadow-lg shadow-orange-900/40
    "
  >
    <div className="flex gap-2">
      {/* Icon wrapper */}
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

      {/* Text */}
      <div className="leading-tight">
        <p className="text-white font-semibold">
          Action recommended
        </p>
        <p className="text-amber-100/85">
          Please review this before continuing
        </p>
      </div>
    </div>

    {/* Close button */}
    <button
      className="
        text-amber-100/90
        hover:text-white
        hover:bg-white/10
        p-1 rounded-md
        transition-colors
      "
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18 18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
</div>

    </div>
  )
}

export default toastsmaple