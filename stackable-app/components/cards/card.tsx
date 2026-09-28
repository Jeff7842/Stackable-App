'use client'

/**
 * StatCard - KPI tile (default export, kept at this path for existing imports).
 *
 *   <StatCard icon={<Icon icon="solar:users-group-rounded-linear" width={20} />}
 *             value="1,578" label="Active students" delta="+2.1%" deltaStatus="positive"
 *             sparkline={[4, 6, 5, 8, 9, 12]} animate />
 *
 * Legacy props still work: `iconBg` / `iconColor` accept any Tailwind classes
 * (the old call sites pass e.g. "bg-green-100" / "text-[#108548]"); when they
 * are omitted the tile uses design tokens. New optional props:
 * - `sparkline`: tiny inline trend line, one flat stroke colour (no gradient).
 * - `animate`: count-up when `value` looks numeric ("1,234", "KES 12,300",
 *   "85%", "4.2"). Anything else (dates, "12 of 40", text) renders as-is.
 * `delta` is optional now; the pill is hidden when it is empty.
 */
import React from "react"
import { cn } from "@/lib/cn"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"
import { Icon } from "@/components/ui/Icon"

type StatCardProps = {
  icon: React.ReactNode
  value: string | number
  label: string
  delta?: string
  iconBg?: string
  iconColor?: string
  deltaStatus?: "positive" | "negative" | "neutral"
  sparkline?: number[]
  animate?: boolean
  className?: string
}

const DELTA_STYLES = {
  positive: "bg-success-tint text-success",
  negative: "bg-danger-tint text-danger",
  neutral: "bg-recessed text-ink-soft",
} as const

const DELTA_ICON = {
  positive: "solar:arrow-right-up-linear",
  negative: "solar:arrow-right-down-linear",
  neutral: null,
} as const

/**
 * Split "KES 12,300" / "1,234" / "85%" / "4.2" into prefix / number / suffix.
 * Returns null unless the string is clearly a single number so that dates,
 * ranges and free text are never animated.
 */
function parseNumericValue(value: string | number) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null
    const decimals = (String(value).split(".")[1] ?? "").length
    return { prefix: "", target: value, suffix: "", decimals, grouping: true }
  }
  const match = /^([^\d\-+]{0,5}?)(-?\d[\d,]*(?:\.\d+)?)(\s?(?:%|[kKmMbB]|pts?)?)$/.exec(value.trim())
  if (!match) return null
  const [, prefix, digits, suffix] = match
  const target = Number(digits.replace(/,/g, ""))
  if (!Number.isFinite(target)) return null
  return {
    prefix,
    target,
    suffix,
    decimals: (digits.split(".")[1] ?? "").length,
    grouping: digits.includes(","),
  }
}

/** Flat single-colour polyline; colour comes from the parent's text colour. */
function Sparkline({ points, className }: { points: number[]; className?: string }) {
  const clean = points.filter((p) => Number.isFinite(p))
  if (clean.length < 2) return null
  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const span = max - min || 1
  const coords = clean
    .map((p, i) => {
      const x = (i / (clean.length - 1)) * 100
      const y = max === min ? 16 : 30 - ((p - min) / span) * 28
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className={cn("h-8 w-24 shrink-0 overflow-visible", className)}
    >
      <polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default function StatCard({
  icon,
  value,
  label,
  delta,
  iconBg = "bg-primary-tint",
  iconColor = "text-primary-ink",
  deltaStatus = "neutral",
  sparkline,
  animate = false,
  className,
}: StatCardProps) {
  const parsed = animate ? parseNumericValue(value) : null
  const deltaIcon = DELTA_ICON[deltaStatus]

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-5 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost",
        // v4 translate utilities animate the `translate` property (not `transform`)
        "transition-[translate,box-shadow] duration-300 ease-standard hover:-translate-y-0.5 hover:shadow-lift",
        className,
      )}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-3">
        <div className={cn("flex size-10 items-center justify-center rounded-full", iconBg)}>
          <div className={iconColor}>{icon}</div>
        </div>

        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
              DELTA_STYLES[deltaStatus],
            )}
          >
            {deltaIcon ? <Icon icon={deltaIcon} width={14} /> : null}
            {delta}
          </span>
        ) : null}
      </div>

      {/* Metric */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-soft">{label}</p>
          <p className="mt-1 truncate font-display text-3xl font-semibold tracking-tight text-ink tabular-nums">
            {parsed ? (
              <AnimatedNumber
                value={parsed.target}
                prefix={parsed.prefix}
                suffix={parsed.suffix}
                decimals={parsed.decimals}
                grouping={parsed.grouping}
              />
            ) : (
              value
            )}
          </p>
        </div>
        {sparkline ? (
          <Sparkline points={sparkline} className={deltaStatus === "negative" ? "text-danger" : "text-primary"} />
        ) : null}
      </div>
    </div>
  )
}
