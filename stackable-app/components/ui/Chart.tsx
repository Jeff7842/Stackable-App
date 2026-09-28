"use client";

/**
 * Chart primitives - ONE place that turns the design tokens into ApexCharts colours,
 * so every chart in the dashboard (dev console, teacher, student, parent, admin) looks
 * the same and follows light/dark mode automatically.
 *
 *   const theme = useChartTheme();                      // token colours, updates on theme toggle
 *   <DonutChart data={[{ label: "Teachers", value: 12 }, ...]} centerValue="48" centerLabel="Users" />
 *   <RingChart value={92} label="Attendance" />          // single progress ring, 0-100
 *   <BarChart categories={["Mon","Tue"]} series={[{ name: "Present", data: [20, 22] }]} />
 *   <AreaChart categories={terms} series={[{ name: "Average", data: [61, 68, 72] }]} yMax={100} />
 *
 * Rules baked in: no gradients (solid fills only), faint dashed gridlines, tooltips follow
 * the current mode, colours come from CSS variables (no hex in pages), charts render
 * client-side only (ApexCharts needs the DOM) and show a skeleton-height placeholder first.
 * Add-only file in components/ui: not exported from the barrel; import it directly:
 *   import { DonutChart, useChartTheme } from "@/components/ui/Chart";
 */
import dynamic from "next/dynamic";
import { useMemo, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

const ApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[8rem] w-full animate-shimmer rounded-xl bg-recessed" />,
});

type ApexOptions = ApexCharts.ApexOptions;

export type ChartTheme = {
  mode: "light" | "dark";
  primary: string;
  primaryTint: string;
  accent: string;
  info: string;
  success: string;
  warning: string;
  danger: string;
  ink: string;
  inkSoft: string;
  muted: string;
  grid: string;
  surface: string;
  recessed: string;
  /** Categorical series colours, calm first, gold last (gold is the "one thing to look at"). */
  palette: string[];
};

// Only used on the server / before the DOM is available; charts are client-only anyway.
const FALLBACK: ChartTheme = {
  mode: "light",
  primary: "#108548",
  primaryTint: "#dcf0e4",
  accent: "#ffc300",
  info: "#005faf",
  success: "#0f7440",
  warning: "#a15c07",
  danger: "#ba1a1a",
  ink: "#191c1e",
  inkSoft: "#394245",
  muted: "#5d6a70",
  grid: "rgba(6, 78, 59, 0.12)",
  surface: "#ffffff",
  recessed: "#f1f3f1",
  palette: ["#108548", "#005faf", "#0f7440", "#a15c07", "#5d6a70", "#ffc300"],
};

function readVar(style: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = style.getPropertyValue(name).trim();
  return value || fallback;
}

function readTheme(): ChartTheme {
  if (typeof document === "undefined") return FALLBACK;
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const primary = readVar(style, "--primary", FALLBACK.primary);
  const info = readVar(style, "--info", FALLBACK.info);
  const success = readVar(style, "--success", FALLBACK.success);
  const warning = readVar(style, "--warning", FALLBACK.warning);
  const muted = readVar(style, "--muted", FALLBACK.muted);
  const accent = readVar(style, "--accent", FALLBACK.accent);
  return {
    mode: root.classList.contains("dark") ? "dark" : "light",
    primary,
    primaryTint: readVar(style, "--primary-tint", FALLBACK.primaryTint),
    accent,
    info,
    success,
    warning,
    danger: readVar(style, "--danger", FALLBACK.danger),
    ink: readVar(style, "--ink", FALLBACK.ink),
    inkSoft: readVar(style, "--ink-soft", FALLBACK.inkSoft),
    muted,
    // The hairline token is ~6% opacity: too faint for gridlines. ApexCharts cannot parse color-mix(),
    // so use a plain rgba per mode.
    grid: root.classList.contains("dark") ? "rgba(255, 255, 255, 0.1)" : "rgba(16, 32, 24, 0.1)",
    surface: readVar(style, "--surface", FALLBACK.surface),
    recessed: readVar(style, "--recessed", FALLBACK.recessed),
    palette: [primary, info, success, warning, muted, accent],
  };
}

// next-themes toggles the `dark` class on <html>; watch it so charts re-colour live.
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
  return () => observer.disconnect();
}
const snapshot = () => (document.documentElement.classList.contains("dark") ? "dark" : "light");
const serverSnapshot = () => "light";

/** Token colours for charts. Re-reads the CSS variables whenever light/dark flips. */
export function useChartTheme(): ChartTheme {
  const mode = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  // `mode` is the cache key: the variables only change when the theme class changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readTheme(), [mode]);
}

/** Options every chart shares: no toolbar, inherit the UI font, faint dashed grid, mode-aware tooltip. */
export function baseOptions(theme: ChartTheme): ApexOptions {
  return {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "inherit",
      foreColor: theme.muted,
      background: "transparent",
      animations: { enabled: true, speed: 500 },
      parentHeightOffset: 0,
    },
    theme: { mode: theme.mode },
    grid: { borderColor: theme.grid, strokeDashArray: 4, padding: { left: 8, right: 8 } },
    tooltip: { theme: theme.mode },
    dataLabels: { enabled: false },
    legend: { show: false },
    fill: { type: "solid" },
    noData: { text: "No data yet", style: { color: theme.muted } },
    states: { hover: { filter: { type: "none" } }, active: { filter: { type: "none" } } },
  };
}

type Frame = { className?: string; height?: number | string };

// ── Donut ─────────────────────────────────────────────────────────────────────
export type DonutDatum = { label: string; value: number; color?: string };

export function DonutChart({
  data,
  centerValue,
  centerLabel,
  height = 200,
  className,
}: Frame & { data: DonutDatum[]; centerValue?: string; centerLabel?: string }) {
  const theme = useChartTheme();
  const options = useMemo<ApexOptions>(
    () => ({
      ...baseOptions(theme),
      labels: data.map((d) => d.label),
      colors: data.map((d, i) => d.color ?? theme.palette[i % theme.palette.length]),
      stroke: { width: 3, colors: [theme.surface] },
      plotOptions: {
        pie: {
          donut: {
            size: "72%",
            labels: {
              show: Boolean(centerValue),
              name: { show: Boolean(centerLabel), color: theme.muted, fontSize: "12px", offsetY: 18 },
              value: { show: true, color: theme.ink, fontSize: "26px", fontWeight: 600, offsetY: -12 },
              total: {
                show: Boolean(centerValue),
                label: centerLabel ?? "Total",
                color: theme.muted,
                fontSize: "12px",
                formatter: () => centerValue ?? "",
              },
            },
          },
        },
      },
    }),
    [theme, data, centerValue, centerLabel],
  );
  const series = useMemo(() => data.map((d) => d.value), [data]);
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ApexChart type="donut" options={options} series={series} height="100%" />
    </div>
  );
}

// ── Ring (single progress value) ──────────────────────────────────────────────
export function RingChart({
  value,
  label,
  color,
  height = 160,
  className,
}: Frame & { value: number | null; label?: string; color?: string }) {
  const theme = useChartTheme();
  const clamped = value == null ? 0 : Math.max(0, Math.min(100, value));
  const options = useMemo<ApexOptions>(
    () => ({
      ...baseOptions(theme),
      colors: [color ?? theme.primary],
      stroke: { lineCap: "round" },
      plotOptions: {
        radialBar: {
          hollow: { size: "64%" },
          track: { background: theme.recessed, strokeWidth: "100%" },
          dataLabels: {
            name: { show: Boolean(label), color: theme.muted, fontSize: "11px", offsetY: 22 },
            value: {
              color: theme.ink,
              fontSize: "24px",
              fontWeight: 600,
              offsetY: label ? -12 : 8,
              formatter: () => (value == null ? "-" : `${Math.round(clamped)}%`),
            },
          },
        },
      },
      labels: [label ?? ""],
    }),
    [theme, color, label, value, clamped],
  );
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ApexChart type="radialBar" options={options} series={[clamped]} height="100%" />
    </div>
  );
}

// ── Bar ───────────────────────────────────────────────────────────────────────
export type ChartSeries = { name: string; data: number[]; color?: string };

export function BarChart({
  categories,
  series,
  horizontal = false,
  stacked = false,
  height = 220,
  yMax,
  className,
}: Frame & { categories: string[]; series: ChartSeries[]; horizontal?: boolean; stacked?: boolean; yMax?: number }) {
  const theme = useChartTheme();
  const options = useMemo<ApexOptions>(
    () => ({
      ...baseOptions(theme),
      colors: series.map((s, i) => s.color ?? theme.palette[i % theme.palette.length]),
      chart: { ...baseOptions(theme).chart, type: "bar", stacked },
      plotOptions: { bar: { horizontal, borderRadius: 6, columnWidth: "48%", barHeight: "56%" } },
      stroke: { show: false },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: theme.muted } },
      },
      yaxis: { max: yMax, min: 0, labels: { style: { colors: theme.muted } } },
      legend: { show: series.length > 1, position: "top", horizontalAlign: "left", labels: { colors: theme.inkSoft } },
    }),
    [theme, categories, series, horizontal, stacked, yMax],
  );
  const apexSeries = useMemo(() => series.map(({ name, data }) => ({ name, data })), [series]);
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ApexChart type="bar" options={options} series={apexSeries} height="100%" />
    </div>
  );
}

// ── Area / line ───────────────────────────────────────────────────────────────
export function AreaChart({
  categories,
  series,
  height = 220,
  yMax,
  yMin = 0,
  className,
}: Frame & { categories: string[]; series: ChartSeries[]; yMax?: number; yMin?: number }) {
  const theme = useChartTheme();
  const options = useMemo<ApexOptions>(
    () => ({
      ...baseOptions(theme),
      colors: series.map((s, i) => s.color ?? theme.palette[i % theme.palette.length]),
      stroke: { curve: "smooth", width: 3 },
      // Solid, very light fill under the line (NOT a gradient).
      fill: { type: "solid", opacity: 0.1 },
      markers: { size: 4, strokeWidth: 2, strokeColors: theme.surface, hover: { size: 6 } },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: theme.muted } },
      },
      yaxis: { max: yMax, min: yMin, labels: { style: { colors: theme.muted } } },
      legend: { show: series.length > 1, position: "top", horizontalAlign: "left", labels: { colors: theme.inkSoft } },
    }),
    [theme, categories, series, yMax, yMin],
  );
  const apexSeries = useMemo(() => series.map(({ name, data }) => ({ name, data })), [series]);
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ApexChart type="area" options={options} series={apexSeries} height="100%" />
    </div>
  );
}
