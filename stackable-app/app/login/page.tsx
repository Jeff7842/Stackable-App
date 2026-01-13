"use client"

import { useState, useRef } from "react";
import Link from "next/link";
import Image from 'next/image';
import { useToast } from "../../components/toast/ToastProvider";

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

   const resetOtp = () => {
    setOtp(Array(length).fill(""));
    inputsRef.current = [];
  };
  

  return {
    otp,
    inputsRef,
    handleChange,
    handleKeyDown,
    handlePaste,
    getOtp,
    resetOtp,
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
  resetOtp,
} = UseOtp(5);

// eslint-disable-next-line react-hooks/rules-of-hooks
const [isOtpOpen, setIsOtpOpen] = useState(false);
// eslint-disable-next-line react-hooks/rules-of-hooks
const { showToast } = useToast();
const handleCloseOtp = () => {
  resetOtp();
  setIsOtpOpen(false);
};

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
          src="https://ceuppatdypoutimqdglm.supabase.co/storage/v1/object/public/Web-Images/Layer%2015.png"
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
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-1 focus:ring-[#f9ce33] focus:outline-[#ffed65be] focus:outline-2 focus:outline-offset-2"
            required
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
                focus:ring-1 focus:ring-[#f9ce33] focus:outline-[#ffed65be] focus:outline-2 focus:outline-offset-2"
               required
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
          <div className="grow border-t border-gray-200"></div>
          <span className="mx-4 text-xs text-gray-400 tracking-wide whitespace-nowrap">
            or sign in with
          </span>
          <div className="grow border-t border-gray-200"></div>
        </div>

        {/* Google button */}
        <button
          type="button"
          className="flex w-full h-[40px] items-center justify-center gap-3 rounded-lg border border-gray-300 py-2 hover:bg-black hover:text-white hover:font-[700] hover:scale-[1.02] transition"
        >
          <Image
            src="https://ceuppatdypoutimqdglm.supabase.co/storage/v1/object/public/Web-Images/google.png"
            alt="Google"
            className="h-5 w-5"
            width={5}
            height={5}
          />
          <span className="text-sm font-header font-medium">Sign in with Google</span>
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
      onClick={handleCloseOtp}
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
      onClick={handleCloseOtp}
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
      showToast({
          type: "error",
          title: "Please try again",
          description: "Invalid email or password",
        })
      return;
    }
    if (otpValue.length== 5) {
      showToast({
          type: "success",
          title: "Welcome Back!",
          description: "You have been successfully logged in.",
        });
        setIsOtpOpen(false);
        resetOtp();
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
                  focus:ring-1 focus:ring-[#f9ce33] focus:outline-[#ffed65be] focus:outline-2 focus:outline-offset-2 "
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
                   hover:bg-[#F9E38C] hover:scale-[1.02] transform
    transition-transform duration-1000"
      >
        Verify OTP
      </button>

    </form>
  </div>
</div>
</>
)}



</div>

  )
}

export default page