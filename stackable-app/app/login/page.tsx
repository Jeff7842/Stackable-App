"use client"

import { useState, useRef } from "react";
import Link from "next/link";
import Image from 'next/image';

function UseOtp(length = 5) {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(""));
  const inputsRef = useRef<HTMLInputElement[]>([]);

  const handleChange = (value: string, index: number) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);

    if (pasted.length === length) {
      setOtp(pasted.split(""));
      inputsRef.current[length - 1]?.focus();
    }
  };

  const getOtp = () => otp.join("");

  

  return {
    otp,
    inputsRef,
    handleChange,
    handleKeyDown,
    handlePaste,
    getOtp,
  };
}



const page = () => {


  const {
  otp,
  inputsRef,
  handleChange,
  handleKeyDown,
  handlePaste,
  getOtp,
} = UseOtp(6);

// eslint-disable-next-line react-hooks/rules-of-hooks
const [isOtpOpen, setIsOtpOpen] = useState(false);

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-white text-black">
  {/* LEFT SIDE – IMAGE + OVERLAY */}
  <div className="relative hidden md:flex items-center justify-center bg-[#515244] rounded-[12px]">
    
    {/* Background image */}
    <div className="absolute inset-0 overflow-hidden mt-10">
    <Image src="https://ceuppatdypoutimqdglm.supabase.co/storage/v1/object/public/Web-Images/Teacher%20laptop%202-Picsart-AiImageEnhancer.png"
      alt="Teacher"
      className="absolute inset-0 w-full h-full object-cover"
      width={500}
      height={500}
    />
</div>
    {/* Dark overlay */}
<div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(255,255,255,0)_0%,rgba(81,82,68,0.9)_55%,rgba(81,82,68,1)_70%)] mb-80">
</div>

    {/* Overlay text */}
    <div className="relative z-10 px-10 text-center text-white mb-116 w-full">
      <h2 className="text-[86px] font-normal leading-tight font-image">
        Built for better <br />
        <span className="text-[#F9B233]">learning</span>
      </h2>
      <div className="absolute z-10 px-10   top-[-160px] left-[90px]">
      <Image src="https://ceuppatdypoutimqdglm.supabase.co/storage/v1/object/public/Web-Images/Eclipse.png" alt=""  width={400}
      height={400} />
    </div>
    </div>
  </div>

  {/* RIGHT SIDE – FORM */}
  <div className="flex items-center justify-center px-6">
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="flex justify-center mb-12">
        <Image
          src="https://ceuppatdypoutimqdglm.supabase.co/storage/v1/object/public/Web-Images/Artboard%203.png"
          alt="Stackable logo"
          className="h-22"
          width={0}
      height={0}
      sizes="4vw"
      style={{ width: 'auto', height: 'auto' }}
        />
      </div>

      {/* Form */}
      <form className="space-y-6">
        <div className="text-center">
          <h2 className="text-[32px] font-bold font-body">Sign In</h2>
          <p className="mt-1 text-sm text-gray-500 font-Inter">
            Sign in if you already have an account
          </p>
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Email address</label>
          <input
            type="email"
            placeholder="stackable@example.com"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-[#F9B233]"
          />
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Password</label>
          <div className="relative w-full">
  <input
    type="password"
    placeholder="••••••••••"
    className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10
               focus:outline-none focus:ring-1 focus:ring-[#F9B233]"
  />

  <svg
    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5
               text-gray-500 hover:text-[#F9B233] transition cursor-pointer"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 12c0 1.2-4.03 6-9 6s-9-4.8-9-6c0-1.2 4.03-6 9-6s9 4.8 9 6Z" />
    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
</div>

        </div>

        {/* Submit */}
        <button
        onClick={() => setIsOtpOpen(true)}
          type="button"
          className="w-full rounded-lg text-[18px] text-center bg-[#FFF4C2] h-[45px] font-image font-medium text-black hover:bg-[#F9E38C] hover:scale-[1.02] hover:font-bold hover:text-[#7D6939] transition"
        >
          Continue
        </button>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="mx-4 text-xs text-gray-400 tracking-wide whitespace-nowrap">
            or sign in with
          </span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        {/* Google button */}
        <button
          type="button"
          className="flex w-full h-[40px] items-center justify-center gap-3 rounded-lg border border-gray-300 py-2 hover:bg-black hover:text-white hover:font-[700] hover:scale-[1.02] transition"
        >
          <img
            src="https://ceuppatdypoutimqdglm.supabase.co/storage/v1/object/public/Web-Images/google.png"
            alt="Google"
            className="h-5 w-5"
          />
          <span className="text-sm font-header font-[500]">Sign in with Google</span>
        </button>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          Don&apos;t have access?{" "}
          <Link
            href="/request-demo"
            className="text-[#F9B233] font-medium hover:underline"
          >
            Request demo
          </Link>
        </p>
      </form>
    </div>
  </div>
  
  {isOtpOpen && (
  <>
  
    {/* Overlay */}
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      onClick={() => setIsOtpOpen(false)}
    />

    {/* Modal */}
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()} // ⛔ prevent overlay close
      >

    {/* Close Icon */}
    <button
      type="button"
      className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
      aria-label="Close"
      onClick={() => setIsOtpOpen(false)}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <form
  onSubmit={(e) => {
    e.preventDefault();
    const otpValue = getOtp();

    if (otpValue.length !== 5) {
      alert("Incomplete OTP");
      return;
    }

    console.log("OTP Submitted:", otpValue);
  }}
  className="space-y-6"
>

      {/* Icon */}
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF4C2]">
          <svg
            className="h-10 w-10 text-[#F9B233]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 9h5m3 0h2M7 12h2m3 0h5M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-6.616a1 1 0 0 0-.67.257l-2.88 2.592A.5.5 0 0 1 8 18.477V17a1 1 0 0 0-1-1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
            />
          </svg>
        </div>
      </div>

      {/* Text */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#F9B233]">
          Enter verification code
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter the 5-digit code sent to your email and phone number
        </p>
      </div>

      {/* OTP Inputs */}
      <div className="flex justify-center gap-3" onPaste={handlePaste}>
  {otp.map((digit, index) => (
    <input
      key={index}
      ref={(el) => {
        if (el) inputsRef.current[index] = el;
      }}
      type="text"
      inputMode="numeric"
      maxLength={1}
      value={digit}
      onChange={(e) => handleChange(e.target.value, index)}
      onKeyDown={(e) => handleKeyDown(e, index)}
      className="h-14 w-14 rounded-xl border border-gray-300 text-center text-2xl font-semibold
                 focus:border-[#F9B233] focus:ring-2 focus:ring-[#F9B233]/40 transition"
    />
  ))}
</div>

      {/* Resend */}
      <p className="text-center text-sm text-gray-500">
        Didn’t get a code?{" "}
        <span className="font-semibold text-[#1D3D28] hover:text-[#F9B233] transition cursor-pointer">
          Resend
        </span>
      </p>

      {/* Button */}
      <button
        type="submit"
        className="w-full rounded-xl bg-[#FFF4C2] py-3 text-lg font-medium text-black
                   hover:bg-[#F9E38C] hover:scale-[1.02]
                   transition"
      >
        Verify OTP
      </button>

    </form>
  </div>
</div>
</>
)}

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

export default page