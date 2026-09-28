"use client";

// Lets a signed-in user enroll an authenticator app (TOTP) as a second sign-in
// method, alongside the always-available email code. Re-running this flow is
// safe — enable() replaces any previous (unconfirmed or confirmed) secret.
import { useState } from "react";
import { Icon } from "@iconify-icon/react";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth/client";
import { useToast } from "@/components/toast/ToastProvider";

type Stage = "idle" | "confirm" | "done";

export default function TwoFactorSetup() {
  const [stage, setStage] = useState<Stage>("idle");
  const [password, setPassword] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const startEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    try {
      setBusy(true);
      const { data, error } = await authClient.twoFactor.enable({ password });
      if (error || !data) {
        showToast({
          type: "error",
          title: "Couldn't start setup",
          description: error?.message || "Check your password and try again.",
        });
        return;
      }
      setBackupCodes(data.backupCodes);
      setQrDataUrl(await QRCode.toDataURL(data.totpURI));
      setPassword("");
      setStage("confirm");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    try {
      setBusy(true);
      const { error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) {
        showToast({
          type: "error",
          title: "Invalid code",
          description: error.message || "That code didn't match. Try again.",
        });
        return;
      }
      setStage("done");
      showToast({
        type: "success",
        title: "Authenticator app enabled",
        description: "You can now choose it at sign-in, alongside the emailed code.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#326B3F] text-white">
          <Icon icon="lucide:shield-check" width="20" height="20" />
        </div>
        <div>
          <p className="font-semibold text-[#1D3D28]">Authenticator app</p>
          <p className="text-xs text-gray-500">Google Authenticator, Authy, or similar</p>
        </div>
      </div>

      {stage === "idle" && (
        <form onSubmit={startEnroll} className="mt-4 space-y-3">
          <label htmlFor="2fa-password" className="text-sm font-medium text-black">
            Confirm your password to begin
          </label>
          <input
            id="2fa-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-1 focus:ring-[#f9ce33] focus:outline-2 focus:outline-[#ffe565be]"
          />
          <button
            type="submit"
            disabled={busy || !password}
            className="rounded-lg bg-[#326B3F] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a5934] disabled:opacity-60 cursor-pointer"
          >
            {busy ? "Starting…" : "Set up authenticator app"}
          </button>
        </form>
      )}

      {stage === "confirm" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-600">
            Scan this with your authenticator app, then enter the 6-digit code it shows.
          </p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Authenticator QR code" className="h-44 w-44 rounded-lg border border-gray-200" />
          )}

          {backupCodes.length > 0 && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-700">
                Backup codes — save these somewhere safe, each works once if you lose your device:
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs text-gray-800">
                {backupCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={confirmEnroll} className="space-y-3">
            <label htmlFor="2fa-confirm-code" className="text-sm font-medium text-black">
              6-digit code
            </label>
            <input
              id="2fa-confirm-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-widest focus:ring-1 focus:ring-[#f9ce33] focus:outline-2 focus:outline-[#ffe565be]"
            />
            <div>
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="rounded-lg bg-[#326B3F] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a5934] disabled:opacity-60 cursor-pointer"
              >
                {busy ? "Confirming…" : "Confirm and enable"}
              </button>
            </div>
          </form>
        </div>
      )}

      {stage === "done" && (
        <p className="mt-4 flex items-center gap-2 text-sm text-[#326B3F]">
          <Icon icon="lucide:check-circle" width="18" height="18" />
          Authenticator app is set up.
        </p>
      )}
    </div>
  );
}
