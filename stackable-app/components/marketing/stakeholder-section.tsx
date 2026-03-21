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



export function StakeholderSection() {
  return (
    <section id="story" className="bg-[#f0f2ef] px-4 py-24 dark:bg-[#0d1613] md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionReveal className="mb-14 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-[#111714] md:text-5xl dark:text-white">
            The Stakeholder Ecosystem
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-[#5b686c] dark:text-[#b8c6bd]">
            Designed for every stakeholder in the academic journey.
          </p>
        </SectionReveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {stakeholderCards.map((card, index) => {
            const Icon = card.icon;
            const isDark = card.tone === "dark";
            const isGold = card.tone === "gold";
            const isGlass = card.tone === "glass";
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.55, delay: index * 0.06 }}
                whileHover={{ y: -10, scale: 1.01 }}
                className={cn(
                  "group relative overflow-hidden rounded-[1.9rem] border p-8 md:p-10",
                  card.className,
                  isDark && "border-[#123226] bg-[#174732] text-white",
                  isGold && "border-[#7a5b00]/10 bg-[#9e7800] text-[#211600]",
                  isGlass && "border-white/50 bg-white/55 backdrop-blur-xl dark:border-white/10 dark:bg-white/5",
                  !isDark && !isGold && !isGlass && "border-black/5 bg-white text-[#111714] dark:border-white/10 dark:bg-[#101916] dark:text-white",
                )}
              >
                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div>
                    <div
                      className={cn(
                        "mb-7 inline-flex h-12 w-12 items-center justify-center rounded-2xl",
                        isDark
                          ? "bg-white/10 text-[#FFC300]"
                          : isGold
                            ? "bg-[#211600]/10 text-[#211600]"
                            : "bg-[#108548]/10 text-[#108548] dark:bg-[#FFC300]/10 dark:text-[#FFC300]",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-3xl font-bold tracking-tight">{card.title}</h3>
                    <p
                      className={cn(
                        "mt-4 max-w-xl text-sm leading-7",
                        isDark ? "text-white/80" : isGold ? "text-[#3d2b00]" : "text-[#617075] dark:text-[#b8c7be]",
                      )}
                    >
                      {card.body}
                    </p>
                  </div>

                  <div className="mt-10">
                    <RippleButton
                      href="#academy"
                      className={cn(
                        "px-5 py-3 text-sm font-bold",
                        isDark
                          ? "bg-transparent text-[#FFC300] hover:translate-y-[-2px]"
                          : isGold
                            ? "rounded-full border border-[#3f2d00]/15 bg-white/25 text-[#251a00] backdrop-blur-xl"
                            : isGlass
                              ? "rounded-full border border-[#108548]/10 bg-[#108548]/8 text-[#1B4332] dark:border-white/10 dark:bg-white/5 dark:text-white"
                              : "rounded-full bg-[#1B4332] text-white",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {card.cta} <ArrowRight className="h-4 w-4" />
                      </span>
                    </RippleButton>
                  </div>
                </div>

                {isGlass && (
                  <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 md:block">
                    <div className="h-full w-full bg-[linear-gradient(180deg,rgba(16,133,72,0.06),rgba(255,195,0,0.08))]" />
                    <img
                      src="/images/library-stack.jpg"
                      alt="Library stack"
                      className="absolute bottom-5 right-5 h-32 w-44 rounded-2xl object-cover opacity-95 shadow-xl"
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}