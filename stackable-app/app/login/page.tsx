"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
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

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
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

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [email, setEmail] = useState("");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [password, setPassword] = useState("");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [authError, setAuthError] = useState(false);

  const handleContinue = () => {
    // replace this with API / auth call later
    const credentialsAreValid =
      email === "admin@stackable.com" && password === "123456";

    if (!credentialsAreValid) {
      setAuthError(true);

      return;
    }

    // ✅ success → proceed to OTP
    setIsOtpOpen(true);
  };

  const onEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (authError) setAuthError(false);
  };

  const onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (authError) setAuthError(false);
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [visible, setVisible] = useState(false);
function EyeOpen() {
  return (<svg
    className={` hover:text-gray-500 transition cursor-pointer ${
                    authError ? "text-red-500" : "text-[#ECB938]"
                  }`}
      xmlns="http://www.w3.org/2000/svg"
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
      <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

function EyeClosed() {
  return (
    <svg
                  className={` hover:text-gray-500 transition cursor-pointer  ${
                    authError ? "text-red-500" : "text-[#ECB938]"
                  }`}
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
  );
}


  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-white text-black">
      {/* LEFT SIDE – IMAGE + OVERLAY */}
      <div className="relative hidden md:flex items-center justify-center bg-[#394245] rounded-[12px]">
        {/* Background image */}
        <div className="absolute inset-0 overflow-hidden mt-10">
          <Image
            src="/images/teacher.png"
            alt="Teacher"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            width={500}
            height={500}
          />
        </div>
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(255,255,255,0)_0%,rgba(57,66,69,0.9)_55%,rgba(57,66,69,1)_70%)] mb-80 pointer-events-none"></div>

        {/* Overlay text */}
        <div className="relative z-10 px-10 text-center text-white mb-116 w-full">
          <h2 className="text-[86px] font-normal leading-tight font-image">
            Built for better <br />
            <span className="text-[#ECB938]">learning</span>
          </h2>
          <div className="absolute inset-0 z-10 flex items-center justify-center -translate-y-1/4 pointer-events-none">
            <Image
              src="/images/Eclipse.png"
              alt=""
              width={500}
              height={500}
              className="w-[62vw] max-w-[420px] min-w-[200px] h-auto"
            />
          </div>
        </div>
      </div>

      {/* RIGHT SIDE – FORM */}
      <div className="flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8 mt-[-20px] w-full h-22">
            <Image
              src="/logos/stackable-symbol.webp"
              alt="Stackable logo"
              className="h-auto"
              width={600}
              height={600}
              sizes="70vw"
              style={{ width: "auto", height: "66" }}
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
            {authError && (
              <div className="mb-4 rounded-lg border text-center border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
                Invalid email address or password. Try again.
              </div>
            )}
            {/* Email */}
            <div className={`space-y-1 ${authError ? "animate-shake" : ""}`}>
              <label
                className={`text-sm font-medium ${
                  authError ? "text-red-600" : "text-black"
                }`}
              >
                Email address
              </label>
              <div className="relative w-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`icon icon-tabler icons-tabler-outline icon-tabler-user text-gray-600 peer-invalid:text-red-500 absolute left-3 top-1/2 -translate-y-1/2 ${
                    authError ? "text-red-500" : "text-gray-600"
                  }`}
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />
                  <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
                </svg>
                <input
                  type="email"
                  onChange={(e) => onEmailChange(e)}
                  placeholder="stackable@example.com"
                  className={`w-full rounded-lg border indent-6 border-gray-300 px-4 py-2 focus:ring-1  focus:outline-2 focus:outline-offset-2
            ${
              authError
                ? "border-red-500 border-1 text-red-600 focus:ring-[#f93333] focus:outline-[#ff6565be]"
                : "border-gray-300 focus:ring-[#f9ce33] focus:outline-[#ffe565be]"
            }`}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className={`space-y-1 mt-[-10px] ${authError ? "animate-shake" : ""}`}>
              <label
                className={`text-sm font-medium ${
                  authError ? "text-red-600" : "text-black"
                }`}
              >
                Password
              </label>
              <div className="relative w-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`icon icon-tabler icons-tabler-outline icon-tabler-lock text-gray-600  invalid:text-red-600 absolute left-3 top-1/2 -translate-y-1/2  ${
                    authError ? "text-red-500" : "text-gray-600"
                  }`}
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6" />
                  <path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
                  <path d="M8 11v-4a4 4 0 1 1 8 0v4" />
                </svg>
                <input
                  type={visible ? "text" : "password"}
                  placeholder="••••••••••"
                  onChange={(e) => onPasswordChange(e)}
                  className={`w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 indent-6
                focus:ring-1 focus:outline-2 focus:outline-offset-2
                ${
                  authError
                    ? "border-red-500 border-1 text-red-600 focus:ring-[#f93333] focus:outline-[#ff6565be]"
                    : "border-gray-300 focus:ring-[#f9ce33] focus:outline-[#ffe565be]"
                }`}
                  required
                />
                <button 
                type="button"
                onClick={() => setVisible(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5
                transition cursor-pointer hover:text-[#ffcd78]">

                {visible ? <EyeOpen /> : <EyeClosed />}
                
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleContinue}
              type="button"
              className="w-full rounded-lg text-[18px] cursor-pointer text-center bg-[#FFF4C2] h-[45px] font-image font-medium text-black hover:bg-[#F9E38C] hover:scale-[1.02] active:text-[#7D6939] active:bg-[#ffefae] active:scale-[1.0]  transition-300"
            >
              Continue
            </button>

            <div className="mt-[-15px] ">
              <div className="mt-10px translate-y-1/2 ml-[10px]"><label
  htmlFor="hr"
  className="flex flex-row items-center font-medium text-sm gap-2.5 text-gray-600"
>
  <input id="hr" type="checkbox" className="peer hidden" />
  <div
    className="h-4 w-4 flex rounded-sm border border-[#f9ce33] light:bg-[#e8e8e8] dark:bg-[#ffffff] peer-checked:bg-[#ECB938] transition"
  >
    <svg
      fill="none"
      viewBox="0 0 24 24"
      className="w-5 h-5 light:stroke-[#e8e8e8] dark:stroke-[#ffffff] checked:text-[#ECB938] items-center justify-center m-auto -translate-y-1/8"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 12.6111L8.92308 17.5L20 6.5"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
    </svg>
  </div>
  Remember me
</label>
</div>
<div><p className="text-right text-sm mt-[-10px] mb-[30px] ">
              <Link
                href="/forgot-passoword"
                className="text-[#ECB938] hover:text-[#F9E38C] font-medium hover:underline"
              >
                Forgot password?
              </Link>
            </p></div>
            
</div>
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
              className="flex w-full h-[40px] items-center cursor-pointer justify-center gap-3 rounded-lg border border-gray-300 py-2 hover:bg-black hover:text-white active:bg-black active:text-[#ebebebf1]  hover:scale-[1.02] active:scale-[1.0]  transition-300"
            >
              <Image
                src="https://ceuppatdypoutimqdglm.supabase.co/storage/v1/object/public/Web-Images/google.png"
                alt="Google"
                className="h-5 w-5"
                width={5}
                height={5}
              />
              <span className="text-sm font-header font-medium">
                Sign in with Google
              </span>
            </button>

            {/* Footer */}
            <p className="text-center text-sm text-gray-500">
              Don&apos;t have access?{" "}
              <Link
                href="/request-demo"
                className="text-[#ECB938] font-medium hover:underline"
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
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
                    });
                    return;
                  }
                  if (otpValue.length == 5) {
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
                <div
                  className="flex justify-center gap-3"
                  onPaste={handlePaste}
                >
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
    transition-transform duration-200 active:bg-[#ffefae] active:scale-[1] active:text-[#7D6939]"
                >
                  Verify OTP
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default page;
