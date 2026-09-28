/* eslint-disable react-hooks/rules-of-hooks */
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@iconify-icon/react";
import AuthShell from "@/components/auth/AuthShell";
import Checkbox from "@/components/auth/Checkbox";
import { safeNextPath } from "@/lib/api/session";
import { useToast } from "../../components/toast/ToastProvider";
import { useRouter } from "next/navigation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The server no longer hands the browser a userId: the OTP step is tied to a signed cookie.
type PendingUser = {
  firstName: string;
  email: string;
  maskedEmail: string;
  mustChangePassword: boolean;
} | null;

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
  
const generatePageKey = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    otp,
    inputsRef,
    handleChange,
    handleKeyDown,
    handlePaste,
    getOtp,
    resetOtp,
    generatePageKey,
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
    generatePageKey,
  } = UseOtp(5);


  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0); // seconds
const [resendAttempts, setResendAttempts] = useState(0); // successful resend count


  const [pendingUser, setPendingUser] = useState<PendingUser>(null);

  const [welcomeName, setWelcomeName] = useState("");

  const { showToast } = useToast();
  const handleCloseOtp = () => {
    resetOtp();
    setIsOtpOpen(false);
  };


  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [authError, setAuthError] = useState(false);
  const [remember, setRemember] = useState(false);
  // Per-field messages shown under the inputs (empty / malformed). Wrong credentials use the toast.
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const emailInvalid = !!fieldErrors.email || authError;
  const passwordInvalid = !!fieldErrors.password || authError;

  const handleContinue = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSubmittingLogin) return;

    // Nothing to send? Say so on the field itself - no request, no spinner.
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    else if (!EMAIL_RE.test(email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    if (nextErrors.email || nextErrors.password) {
      setFieldErrors(nextErrors);
      setAuthError(false);
      return;
    }

    try {
      setIsSubmittingLogin(true);
      setAuthError(false);
      setFieldErrors({});

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Red inputs + a toast with the server's real reason (bad password, inactive account, rate limit...).
        setAuthError(res.status === 401);
        showToast({
          type: "error",
          title: res.status === 401 ? "Sign in failed" : "Couldn't sign you in",
          description: data?.error || "Login failed. Please try again.",
        });
        return;
      }

      setPendingUser({
        firstName: data.firstName,
        email: data.email,
        maskedEmail: data.maskedEmail,
        mustChangePassword: data.mustChangePassword,
      });

      setIsOtpOpen(true);
      showToast({
        type: "success",
        title: "OTP sent",
        description: `We sent a verification code to ${data.maskedEmail}.`,
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Couldn't sign you in",
        description: "Something went wrong. Check your connection and try again.",
      });
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
  e.preventDefault();

  const otpValue = getOtp();

  if (!pendingUser) {
    showToast({
      type: "error",
      title: "Session lost",
      description: "Please sign in again.",
    });
    setIsOtpOpen(false);
    return;
  }

  if (otpValue.length !== 5) {
    showToast({
      type: "error",
      title: "Enter the full code",
      description: "Type all 5 digits of the code we sent you.",
    });
    return;
  }

  try {
    setIsSubmittingOtp(true);

    // No userId: the server knows which code this is from the signed cookie set at sign-in.
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp: otpValue, remember }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast({
        type: "error",
        title: "Verification failed",
        description: data?.error || "Invalid or expired OTP.",
      });
      // Out of attempts, or the code/session expired: back to the password step.
      if (data?.attemptsLeft === 0 || (res.status === 401 && /sign in again/i.test(data?.error ?? ""))) {
        setIsOtpOpen(false);
        resetOtp();
      }
      return;
    }

    setWelcomeName(data?.user?.firstName || pendingUser.firstName);

    showToast({
      type: "success",
      title: "Welcome Back!",
      description: "You have been successfully logged in.",
    });

    setIsOtpOpen(false);
    resetOtp();

    // Step 1: Loader
    setPageKey(generatePageKey());
    setIsAuthTransitioning(true);

    // Step 2: Welcome screen
    setTimeout(() => {
      setShowWelcome(true);
    }, 1800);

    // Step 3: Redirect to the dashboard for this user's role (the server decides where).
    // The proxy sends signed-out visitors here as /login?next=<page>. Honour it only if it is a safe
    // same-origin path (open-redirect guard), and never over a forced password change.
    const wanted = data?.user?.mustChangePassword
      ? null
      : safeNextPath(new URLSearchParams(window.location.search).get("next"));
    const redirectTo: string = wanted ?? data?.redirectTo ?? "/login";
    setTimeout(() => {
      router.replace(redirectTo);
    }, 2500);
  } catch (error) {
    showToast({
      type: "error",
      title: "Verification failed",
      description: "Something went wrong while verifying your OTP.",
    });
  } finally {
    setIsSubmittingOtp(false);
  }
};

  const handleResendOtp = async () => {
    if (!pendingUser) return;

     if (isResendingOtp || resendCooldown > 0) return;

    if (resendAttempts >= 5) {
    showToast({
      type: "error",
      title: "Too many resend attempts",
      description:
        "This looks like a serious issue. Please contact your provider for assistance.",
    });
    return;
  }

    try {
      setIsResendingOtp(true);
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // the signed cookie identifies the code
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast({
          type: "error",
          title: "Resend failed",
          description: data?.error || "Could not resend OTP.",
        });
        // The server enforces the wait; mirror it on the button.
        if (res.status === 429 && typeof data?.retryAfter === "number") setResendCooldown(data.retryAfter);
        if (res.status === 401) {
          setIsOtpOpen(false);
          resetOtp();
        }
        return;
      }

      resetOtp();

      const nextAttempts = resendAttempts + 1;
    setResendAttempts(nextAttempts);

    // First successful resend = 30s
    // Second successful resend = 60s
    // Then keep increasing by 30s
    const nextCooldown = nextAttempts * 30;
    setResendCooldown(nextCooldown);

      showToast({
        type: "success",
        title: "OTP Resent",
        description: `A new code has been sent to ${data.maskedEmail}.`,
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Resend failed",
        description: "Something went wrong while resending your OTP.",
      });
    } finally {
      setIsResendingOtp(false);
    }
  };

  const onEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (authError) setAuthError(false);
    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
  };

  const onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (authError) setAuthError(false);
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
  };


  const [visible, setVisible] = useState(false);
function EyeOpen() {
  return (<svg
    className={` hover:text-[#ECB938] transition duration-300 cursor-pointer ${
                    authError ? "text-red-500" : "text-gray-600"
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
                  className={` hover:text-[#ECB938] transition duration-300 cursor-pointer  ${
                    authError ? "text-red-500" : "text-gray-500"
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

const router = useRouter();

const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
const [showWelcome, setShowWelcome] = useState(false);

// mock user – later replace from API / JWT
const firstName = "User";
const [pageKey, setPageKey] = useState(() => generatePageKey());


useEffect(() => {
  if (!isOtpOpen) return;

  // Initial cooldown when OTP modal opens
  setResendCooldown(15);
  setResendAttempts(0);
}, [isOtpOpen]);

useEffect(() => {
  if (resendCooldown <= 0) return;

  const interval = setInterval(() => {
    setResendCooldown((prev) => {
      if (prev <= 1) {
        clearInterval(interval);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [resendCooldown]);

const formatCooldown = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

  return (
    <AuthShell key={pageKey}>
          {/* Form */}
          <form className="space-y-6" onSubmit={handleContinue} noValidate>
            <div className="text-center">
              <h2 className="text-[32px] font-bold font-body">Sign In</h2>
              <p className="mt-1 text-sm text-gray-500 font-Inter">
                Sign in if you already have an account
              </p>
            </div>
            {/* Email */}
            <div className={`space-y-1 ${emailInvalid ? "animate-shake" : ""}`}>
              <label
                htmlFor="login-email"
                className={`text-sm font-medium ${
                  emailInvalid ? "text-red-600" : "text-black"
                }`}
              >
                Email address
              </label>
              <div className="relative w-full group">
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
                    emailInvalid ? "text-red-500" : "text-gray-600 group-focus-within:text-[#e3af2b] duration-300"
                  }`}
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />
                  <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
                </svg>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  onChange={(e) => onEmailChange(e)}
                  placeholder="stackable@example.com"
                  aria-invalid={emailInvalid}
                  aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                  className={`w-full rounded-lg border indent-6 border-gray-300 px-4 py-2 focus:ring-1  focus:outline-2 focus:outline-offset-2
            ${
              emailInvalid
                ? "border-red-500 border-1 text-red-600 focus:ring-[#f93333] focus:outline-[#ff6565be]"
                : "border-gray-300 focus:ring-[#f9ce33] focus:outline-[#ffe565be] duration-200"
            }`}
                />
              </div>
              {fieldErrors.email && (
                <p id="login-email-error" className="text-xs text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className={`space-y-1 mt-[-10px] ${passwordInvalid ? "animate-shake" : ""}`}>
              <label
                htmlFor="login-password"
                className={`text-sm font-medium ${
                  passwordInvalid ? "text-red-600" : "text-black"
                }`}
              >
                Password
              </label>
              <div className="relative w-full group">
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
                    passwordInvalid ? "text-red-500" : "text-gray-600 group-focus-within:text-[#e3af2b] duration-300"
                  }`}
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6" />
                  <path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
                  <path d="M8 11v-4a4 4 0 1 1 8 0v4" />
                </svg>
                <input
                  id="login-password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  onChange={(e) => onPasswordChange(e)}
                  aria-invalid={passwordInvalid}
                  aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                  className={`w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 indent-6
                focus:ring-1 focus:outline-2 focus:outline-offset-2
                ${
                  passwordInvalid
                    ? "border-red-500 border-1 text-red-600 focus:ring-[#f93333] focus:outline-[#ff6565be]"
                    : "border-gray-300 focus:ring-[#f9ce33] focus:outline-[#ffe565be] duration-200"
                }`}
                />
                <button 
                type="button"
                onClick={() => setVisible((v: boolean) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5
                transition cursor-pointer hover:text-[#ffcd78]">

                {visible ? <EyeOpen /> : <EyeClosed />}

                </button>
              </div>
              {fieldErrors.password && (
                <p id="login-password-error" className="text-xs text-red-600">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
            disabled={isSubmittingLogin}
              className="w-full rounded-lg text-[18px] cursor-pointer text-center bg-[#FFF4C2] h-[45px] font-image font-medium text-black hover:bg-[#F9E38C] hover:scale-[1.02] active:text-[#7D6939] active:bg-[#ffefae] active:scale-[1.0]  transition-300 duration-300"
            >
            {isSubmittingLogin ?  (<> 
      <span className="relative flex items-center align-middle text-center  justify-center w-full h-5">
  <span className="relative w-5 h-5">
    <span
      className="absolute inset-0 rounded-full border-[2px] border-gray-100/10 border-r-[#848484] border-b-[#848484] animate-spin"
      style={{ animationDuration: "3s" }}
    />
    <span
      className="absolute inset-0 rounded-full border-[2px] border-gray-100/10 border-t-[#a9a9a9] animate-spin"
      style={{ animationDuration: "1.5s", animationDirection: "reverse" }}
    />
    <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#a9a9a9]/10 via-transparent to-[#a9a9a9]/5 animate-pulse blur-[2px]" />
  </span>
</span>
</>) : "Continue"}
            </button>

            <div className="mt-[-15px] ">
              <div className="mt-10px translate-y-1/2 ml-[10px] w-fit"><label
  htmlFor="hr"
  className="flex flex-row items-center font-medium text-sm gap-2.5 text-gray-600"
>
  <Checkbox
    id="hr"
    checked={remember}
    onChange={(e) => setRemember(e.target.checked)}
  />
  Remember me
</label>
</div>
<div><p className="text-right text-sm mt-[-10px] mb-[30px] ">
              <Link
                href="/forgot-password"
                className="text-[#ECB938] hover:text-[#b49b36] font-medium hover:underline duration-200"
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
              className="flex w-full h-[40px] items-center cursor-pointer justify-center gap-3 rounded-lg border border-gray-300 py-2 hover:bg-black hover:text-white active:bg-black active:text-[#ebebebf1]  hover:scale-[1.02] active:scale-[1.0]  transition duration-300 ">
              <Icon icon="logos:google-icon" width="20" height="20" />
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
              
                onSubmit={handleVerifyOtp}
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
                    Enter the 5-digit code sent to your email
                  </p>
                </div>

                {/* OTP Inputs */}
                <div
                  className="flex justify-center gap-3"
                  onPaste={handlePaste}
                >
                  {otp.map((digit: string, index: number) => (
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
  Didn’t get it?{" "}

  {isResendingOtp ? (
    <span className="inline-flex items-center align-middle">
      <span className="relative flex items-center justify-center w-full h-5">
        <span className="relative w-3 h-3">
          <span
            className="absolute inset-0 rounded-full border-[2px] border-gray-100/10 border-r-[#108a00] border-b-[#108a00] animate-spin"
            style={{ animationDuration: "3s" }}
          />
          <span
            className="absolute inset-0 rounded-full border-[2px] border-gray-100/10 border-t-[#d3ffcd] animate-spin"
            style={{ animationDuration: "4.5s" }}
          />
          <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#108a00]/10 via-transparent to-[#108a00]/5 animate-pulse blur-[2px]" />
        </span>
      </span>
    </span>
  ) : resendCooldown > 0 ? (
    <span className="font-semibold text-[#1D3D28] tabular-nums">
      {formatCooldown(resendCooldown)}
    </span>
  ) : (
    <button
      type="button"
      onClick={handleResendOtp}
      className="font-semibold text-[#1D3D28] hover:text-[#F9B233] transition cursor-pointer"
    >
      Send again
    </button>
  )}
</p>

                {/* Button */}
                <button
                  type="submit"
                  disabled={isSubmittingOtp}
                  className="w-full rounded-xl bg-[#FFF4C2] py-3 text-lg font-medium text-black
                   hover:bg-[#F9E38C] hover:scale-[1.02] transform
    transition-transform duration-200 active:bg-[#ffefae] active:scale-[1] active:text-[#7D6939]"
                >
                  {isSubmittingOtp ? <> 
      <span className="relative flex items-center align-middle text-center justify-center w-full h-5">
  <span className="relative w-5 h-5">
    <span
      className="absolute inset-0 rounded-full border-[2px] border-gray-100/10 border-r-[#242424] border-b-[#242424] animate-spin"
      style={{ animationDuration: "3s" }}
    />
    <span
      className="absolute inset-0 rounded-full border-[2px] border-gray-100/10 border-t-[#383838] animate-spin"
      style={{ animationDuration: "1.5s", animationDirection: "reverse" }}
    />
    <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#383838]/10 via-transparent to-[#383838]/5 animate-pulse blur-[2px]" />
  </span>
</span>
</> : "Verify OTP"}
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {isAuthTransitioning && !showWelcome && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#F7F9E2]">
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-row gap-2">
  <div className="w-4 h-4 rounded-full bg-[#ECB938] animate-bounce"></div>
  <div
    className="w-4 h-4 rounded-full bg-[#475051] animate-bounce [animation-delay:-.3s]"
  ></div>
  <div
    className="w-4 h-4 rounded-full bg-[#326B3F] animate-bounce [animation-delay:-.5s]"
  ></div>
</div>
      <p className="text-sm text-gray-500 tracking-wide">
        Securing your session…
      </p>
    </div>
  </div>
)}


{showWelcome && (
  <div className="fixed inset-0 z-110 flex items-center text-center justify-center bg-[#F7F9E2] h-[100vh] w-full">
    <h1 className="text-[64px] font-bold text-black">
      Welcome back{" "}
      <span className="text-[#30693E]">{welcomeName || pendingUser?.firstName || "User"}!</span>
    </h1>
  </div>
)}

    </AuthShell>
  );
};

export default page;