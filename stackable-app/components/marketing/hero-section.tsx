"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CreditCard,
  GraduationCap,
  Layers3,
  Menu,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { useTheme } from "next-themes";

export const brand = {
  darkGreen: "#1B4332",
  green: "#108548",
  yellow: "#FFC300",
  darkGold: "#251a00",
  brightGold: "#785a00",
  slate: "#535d60",
  offWhite: "#f9f9f8",
  blackish: "#0e1512",
};

export const stakeholderCards = [
  {
    title: "Institutions",
    body: "Command-center visibility for directors, school heads, and administrators. Unify operations, reporting, finances, classes, curriculum tracking, and resource planning in one disciplined operating layer.",
    cta: "Institutional Access",
    icon: Building2,
    tone: "light",
    className: "md:col-span-2",
  },
  {
    title: "Guardians",
    body: "A transparent window into growth. Access attendance, performance, behavior insights, fee status, and timely communication through a refined family experience.",
    cta: "Stay Connected",
    icon: Users,
    tone: "dark",
    className: "md:col-span-1",
  },
  {
    title: "Educators",
    body: "Digital workflows that respect the teacher’s craft. Automate grading, manage lessons, track learner progress, and reduce administrative drag without flattening pedagogy.",
    cta: "Open Workspace",
    icon: GraduationCap,
    tone: "gold",
    className: "md:col-span-1",
  },
  {
    title: "The Digital Lexicon",
    body: "Every learner profile becomes a living academic document — results, attendance, behavior, reports, payments, communication, and progression mapped in one operational memory.",
    cta: "Explore the library",
    icon: BookOpen,
    tone: "glass",
    className: "md:col-span-2",
  },
] as const;

export const ecosystemCards = [
  {
    eyebrow: "For Parents",
    title: "Insight & Growth",
    body: "Real-time visibility into learner development with actionable metrics, attendance tracking, payment awareness, and direct school communication.",
    cta: "View Dashboard",
    icon: Users,
    bg: "bg-[#f4d88a] dark:bg-[#6b5207]",
    text: "text-[#251a00] dark:text-[#fff7dd]",
  },
  {
    eyebrow: "For Teachers",
    title: "Augmented Pedagogy",
    body: "Automated grading, lesson planning, class insights, AI assistance, and progress architecture that gives time back to the educator.",
    cta: "Explore Toolkit",
    icon: GraduationCap,
    bg: "bg-[linear-gradient(135deg,rgba(110,244,156,0.9),rgba(16,133,72,0.8))] dark:bg-[linear-gradient(135deg,rgba(18,102,59,1),rgba(11,69,39,1))]",
    text: "text-[#06210f] dark:text-[#ebfff2]",
    wide: true,
  },
  {
    eyebrow: "For Admins",
    title: "Institutional Command",
    body: "Harmonize operations, academics, staff, classes, library, reporting, examinations, and communication into a single source of truth.",
    icon: BarChart3,
    stats: [
      { value: 100, suffix: "%", label: "Security compliance" },
      { value: 40, suffix: "ms", label: "Latency avg" },
    ],
    bg: "bg-[#dfe5e7] dark:bg-[#1c2426]",
    text: "text-[#101617] dark:text-[#eef5f7]",
    full: true,
  },
] as const;

export const benefits = [
  {
    title: "Modularity by Design",
    body: "Enable only the modules your institution needs, from admissions and academics to exams, finance, library, communication, and AI workflows.",
    icon: Layers3,
  },
  {
    title: "Data Sovereignty",
    body: "Strong access control, role boundaries, encrypted data handling, audit-friendly workflows, and privacy-first operational architecture.",
    icon: ShieldCheck,
  },
] as const;

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function RippleButton({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
}) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const onClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples((prev) => [...prev, { x, y, id }]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 700);
  };

  const shared = cn(
    "relative isolate inline-flex items-center justify-center overflow-hidden rounded-full transition-all duration-300 active:scale-[0.98]",
    className,
  );

  const content = (
    <>
      {children}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute h-5 w-5 rounded-full bg-white/35 animate-[ripple_700ms_ease-out_forwards]"
          style={{ left: r.x, top: r.y }}
        />
      ))}
    </>
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} className={shared}>
        {content}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={shared}>
      {content}
    </button>
  );
}

export function CountUp({
  value,
  suffix = "",
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let frame = 0;
    const duration = 1200;
    const started = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export function SectionReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}





export function HeroSection() {
  return (
    <section id="home" className="relative overflow-hidden px-4 pb-24 pt-14 md:px-6 lg:px-8 lg:pb-28 lg:pt-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,133,72,0.18),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(255,195,0,0.18),transparent_35%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(16,133,72,0.25),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(255,195,0,0.12),transparent_35%)]" />
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-12">
        <SectionReveal className="relative z-10 lg:col-span-7">
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[#108548]/10 bg-white/55 px-4 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#108548] shadow-[0_0_16px_rgba(16,133,72,0.85)]">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#108548]/60" />
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#355045] dark:text-[#dce8e1]">
              A New Era of Education
            </span>
          </div>

          <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.92] tracking-[-0.05em] text-[#111714] md:text-7xl lg:text-[5.5rem] dark:text-white">
            Architecting
            <span className="block italic text-[#785a00] dark:text-[#FFC300]">Intelligence.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-[#556267] md:text-lg dark:text-[#b9c8bf]">
            The future of school management is not a dashboard. It is a connected operating system. Stackable brings directors, administrators, teachers, guardians, and learners into one platform where work becomes lighter and learning becomes sharper, faster, and more engaging.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <RippleButton
              href="#story"
              className="bg-[#FFC300] px-7 py-4 text-sm font-extrabold text-[#251a00] shadow-[0_18px_40px_rgba(255,195,0,0.18)] hover:-translate-y-1 hover:shadow-[0_22px_46px_rgba(255,195,0,0.24)]"
            >
              Explore the Platform
            </RippleButton>

            <RippleButton
              href="#academy"
              className="border border-black/10 bg-white/65 px-7 py-4 text-sm font-bold text-[#1B4332] backdrop-blur-xl hover:-translate-y-1 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              Our Methodology
            </RippleButton>
          </div>
        </SectionReveal>

        <SectionReveal className="relative lg:col-span-5">
          <div className="relative mx-auto max-w-[34rem]">
            <div className="overflow-hidden rounded-[2rem] border border-white/40 bg-white/60 shadow-[0_30px_80px_rgba(15,23,20,0.15)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
              <div className="aspect-[4/5] overflow-hidden rounded-[2rem]">
                <img
                  src="/images/hero-learning-space.jpg"
                  alt="Stackable Academy hero learning environment"
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                />
              </div>
            </div>

            <motion.div
              whileHover={{ y: -6, scale: 1.02 }}
              className="absolute -bottom-8 left-0 rounded-2xl border border-white/50 bg-white/80 p-5 shadow-[0_22px_60px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1511]/85"
            >
              <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#785a00] dark:text-[#FFC300]">
                Live Metric
              </div>
              <div className="mt-1 text-3xl font-extrabold tracking-tight">
                <CountUp value={94.2} suffix="%" decimals={1} />
              </div>
              <p className="mt-1 max-w-[13rem] text-sm text-[#56656a] dark:text-[#b4c2b9]">
                Efficiency increase in academic reporting and institutional operations.
              </p>
            </motion.div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}