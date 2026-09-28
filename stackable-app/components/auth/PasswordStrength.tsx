"use client";

import { Icon } from "@iconify-icon/react";
import { PASSWORD_LEVELS, PASSWORD_RULES, passwordScore } from "@/lib/validation/auth";

// Segment colours by score (1-5): red -> orange -> brand yellow -> lime -> green.
const SEGMENT_COLORS = ["#ef4444", "#f97316", "#ECB938", "#84cc16", "#30693E"];

/** The strength bar (one segment per rule passed) + the school-style level label. */
export function PasswordStrengthBar({ password, showLabel = true }: { password: string; showLabel?: boolean }) {
  const score = passwordScore(password);
  const color = score > 0 ? SEGMENT_COLORS[score - 1] : undefined;

  return (
    <div aria-live="polite">
      <div className="flex gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={score}>
        {PASSWORD_RULES.map((rule, i) => (
          <span
            key={rule.id}
            className="h-1.5 flex-1 rounded-full bg-gray-200 transition-colors duration-300"
            style={i < score ? { backgroundColor: color } : undefined}
          />
        ))}
      </div>
      {showLabel && (
        <p className="mt-1.5 text-xs text-gray-500">
          Level: <span className="font-semibold text-gray-800">{PASSWORD_LEVELS[score]}</span>
        </p>
      )}
    </div>
  );
}

/** "Your password must contain" checklist. Each rule ticks green as it is met. */
export function PasswordRequirements({ password }: { password: string }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-gray-800">Your password must contain:</h4>
      <ul className="space-y-1 text-sm">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(password);
          return (
            <li
              key={rule.id}
              className={`flex items-center gap-x-2 transition-colors duration-200 ${
                met ? "text-[#30693E]" : "text-gray-500"
              }`}
            >
              <Icon icon={met ? "lucide:check" : "lucide:x"} width="16" height="16" className="shrink-0" />
              <span>{rule.label}</span>
              <span className="sr-only">{met ? "(done)" : "(not yet)"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
