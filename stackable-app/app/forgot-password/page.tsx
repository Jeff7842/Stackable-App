"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify-icon/react";
import AuthShell from "@/components/auth/AuthShell";
import PinInput from "@/components/auth/PinInput";
import { PasswordRequirements, PasswordStrengthBar } from "@/components/auth/PasswordStrength";
import { useToast } from "@/components/toast/ToastProvider";
import { PASSWORD_RULES } from "@/lib/validation/auth";

type Step = "email" | "code" | "password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 60;

const inputBase =
  "w-full rounded-lg border indent-6 px-4 py-2 focus:ring-1 focus:outline-2 focus:outline-offset-2 duration-200";
const inputOk = "border-gray-300 focus:ring-[#f9ce33] focus:outline-[#ffe565be]";
const inputBad = "border-red-500 text-red-600 focus:ring-[#f93333] focus:outline-[#ff6565be]";
const primaryBtn =
  "w-full rounded-lg text-[18px] cursor-pointer text-center bg-[#FFF4C2] h-[45px] font-image font-medium text-black hover:bg-[#F9E38C] hover:scale-[1.02] active:text-[#7D6939] active:bg-[#ffefae] active:scale-[1.0] transition duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2";

const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name[0]}${"*".repeat(Math.max(1, name.length - 2))}${name.length > 1 ? name[name.length - 1] : ""}@${domain}`;
};

function Spinner() {
  return <Icon icon="lucide:loader-circle" width="20" height="20" className="animate-spin" />;
}

function ForgotPasswordFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [emailError, setEmailError] = useState("");
  const [sending, setSending] = useState(false);

  const [pinKey, setPinKey] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ── Step 1: send the code ────────────────────────────────────────────────
  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return setEmailError("Enter your email address.");
    if (!EMAIL_RE.test(value)) return setEmailError("Enter a valid email address.");

    setSending(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast({ type: "error", title: "Couldn't send the code", description: data?.error || "Please try again." });
        return;
      }
      setEmail(value);
      setPinKey((k) => k + 1);
      setCooldown(RESEND_SECONDS);
      setStep("code");
      showToast({
        type: "success",
        title: "Check your email",
        description: "If that email is registered, a 6-digit code is on its way.",
      });
    } catch {
      showToast({ type: "error", title: "Couldn't send the code", description: "Something went wrong. Please try again." });
    } finally {
      setSending(false);
    }
  };

  // ── Step 2: verify the code (runs by itself when the 6th digit is in) ────
  const verifyCode = async (code: string) => {
    if (verifying) return;
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.resetToken) {
        setCodeError(true);
        showToast({ type: "error", title: "Wrong code", description: data?.error || "That code is not right." });
        // Let the shake play, then clear the boxes and refocus the first one.
        setTimeout(() => {
          setCodeError(false);
          setPinKey((k) => k + 1);
        }, 700);
        return;
      }
      setResetToken(data.resetToken);
      setStep("password");
    } catch {
      showToast({ type: "error", title: "Couldn't check the code", description: "Something went wrong. Please try again." });
      setPinKey((k) => k + 1);
    } finally {
      setVerifying(false);
    }
  };

  // ── Step 3: save the new password ────────────────────────────────────────
  const allRulesMet = PASSWORD_RULES.every((r) => r.test(password));
  const matches = password.length > 0 && password === confirm;
  const confirmError = confirm.length > 0 && !matches ? "Passwords don't match." : "";

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRulesMet || !matches || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword: password, confirmPassword: confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast({ type: "error", title: "Password not changed", description: data?.error || "Please try again." });
        if (res.status === 401) {
          // The reset session ran out - start over.
          setPassword("");
          setConfirm("");
          setResetToken("");
          setStep("email");
        }
        return;
      }
      showToast({
        type: "success",
        title: "Password updated",
        description: "You've been signed out everywhere. Sign in with your new password.",
      });
      router.replace("/login"); // a fresh login page
    } catch {
      showToast({ type: "error", title: "Password not changed", description: "Something went wrong. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const reason = params.get("reason");

  return (
    <AuthShell>
      {step === "email" && (
        <form className="space-y-6" onSubmit={sendCode} noValidate>
          <div className="text-center">
            <h2 className="text-[32px] font-bold font-body">Forgot password?</h2>
            <p className="mt-1 text-sm text-gray-500">
              {reason === "change"
                ? "First time here? Enter your email and we'll send a code so you can choose your own password."
                : "Enter your email and we'll send you a 6-digit code."}
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="fp-email" className={`text-sm font-medium ${emailError ? "text-red-600" : "text-black"}`}>
              Email address
            </label>
            <div className={`relative w-full group ${emailError ? "animate-shake" : ""}`}>
              <Icon
                icon="lucide:mail"
                width="18"
                height="18"
                className={`absolute left-3 top-1/2 -translate-y-1/2 duration-300 ${
                  emailError ? "text-red-500" : "text-gray-600 group-focus-within:text-[#e3af2b]"
                }`}
              />
              <input
                id="fp-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                placeholder="stackable@example.com"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "fp-email-error" : undefined}
                className={`${inputBase} ${emailError ? inputBad : inputOk}`}
              />
            </div>
            {emailError && (
              <p id="fp-email-error" className="text-xs text-red-600">
                {emailError}
              </p>
            )}
          </div>

          <button type="submit" disabled={sending} className={primaryBtn}>
            {sending ? <Spinner /> : "Send code"}
          </button>
        </form>
      )}

      {step === "code" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-[32px] font-bold font-body">Check your email</h2>
            <p className="mt-1 text-sm text-gray-500">
              We sent a 6-digit code to <span className="font-medium text-gray-700">{maskEmail(email)}</span>. It expires
              in 10 minutes.
            </p>
          </div>

          <PinInput
            key={pinKey}
            length={6}
            groupSize={3}
            autoFocus
            disabled={verifying}
            error={codeError}
            onComplete={verifyCode}
          />

          <div className="h-5 text-center text-sm text-gray-500" aria-live="polite">
            {verifying ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Checking your code…
              </span>
            ) : cooldown > 0 ? (
              <>
                Didn&apos;t get it? You can ask again in{" "}
                <span className="font-semibold text-[#1D3D28] tabular-nums">{cooldown}s</span>
              </>
            ) : (
              <>
                Didn&apos;t get it?{" "}
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => sendCode()}
                  className="font-semibold text-[#1D3D28] hover:text-[#F9B233] transition cursor-pointer"
                >
                  Send a new code
                </button>
              </>
            )}
          </div>

          <p className="text-center text-sm">
            <button
              type="button"
              onClick={() => setStep("email")}
              className="text-gray-500 hover:text-black hover:underline duration-200 cursor-pointer"
            >
              Use a different email
            </button>
          </p>
        </div>
      )}

      {step === "password" && (
        <form className="space-y-5" onSubmit={savePassword} noValidate>
          <div className="text-center">
            <h2 className="text-[32px] font-bold font-body">New password</h2>
            <p className="mt-1 text-sm text-gray-500">Choose something strong. Your old password will stop working.</p>
          </div>

          {/* New password */}
          <div className="space-y-1">
            <label htmlFor="fp-new" className="text-sm font-medium text-black">
              New password
            </label>
            <div className="relative w-full group">
              <Icon
                icon="lucide:lock"
                width="18"
                height="18"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#e3af2b] duration-300"
              />
              <input
                id="fp-new"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className={`${inputBase} pr-10 ${inputOk}`}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#ECB938] transition cursor-pointer"
              >
                <Icon icon={showPw ? "lucide:eye-off" : "lucide:eye"} width="20" height="20" />
              </button>
            </div>
            <div className="pt-1">
              <PasswordStrengthBar password={password} />
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-1">
            <label htmlFor="fp-confirm" className={`text-sm font-medium ${confirmError ? "text-red-600" : "text-black"}`}>
              Confirm password
            </label>
            <div className="relative w-full group">
              <Icon
                icon="lucide:lock-keyhole"
                width="18"
                height="18"
                className={`absolute left-3 top-1/2 -translate-y-1/2 duration-300 ${
                  confirmError ? "text-red-500" : "text-gray-600 group-focus-within:text-[#e3af2b]"
                }`}
              />
              <input
                id="fp-confirm"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
                aria-invalid={!!confirmError}
                className={`${inputBase} pr-10 ${confirmError ? inputBad : inputOk}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#ECB938] transition cursor-pointer"
              >
                <Icon icon={showConfirm ? "lucide:eye-off" : "lucide:eye"} width="20" height="20" />
              </button>
            </div>
            {confirmError && <p className="text-xs text-red-600">{confirmError}</p>}
            <div className="pt-1">
              <PasswordStrengthBar password={confirm} showLabel={false} />
            </div>
          </div>

          <PasswordRequirements password={password} />

          <button type="submit" disabled={!allRulesMet || !matches || saving} className={primaryBtn}>
            {saving ? <Spinner /> : "Confirm new password"}
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-gray-500">
        <Link href="/login" className="inline-flex items-center gap-1 text-[#ECB938] font-medium hover:underline">
          <Icon icon="lucide:arrow-left" width="16" height="16" />
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

// useSearchParams needs a Suspense boundary for the production build.
export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordFlow />
    </Suspense>
  );
}
