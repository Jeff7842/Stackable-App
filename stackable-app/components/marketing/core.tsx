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

export const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Our Story", href: "#story" },
  { label: "Library", href: "#library" },
  { label: "Academy", href: "#academy" },
  { label: "Benefits", href: "#benefits" },
  { label: "Pricing", href: "#pricing" },
];

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

export function Navbar() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const [menuOpen, setMenuOpen] = useState(false);
  const dark = resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-[#08100d]/75">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6 lg:px-8">
        <a href="#home" className="flex items-center gap-3">
          <img
            src={dark ? "/branding/symbol-light.webp" : "/branding/symbol-dark.webp"}
            alt="Stackable symbol"
            className="h-10 w-10 object-contain"
          />
          <img src="/branding/main-logo.webp" alt="Stackable Academy" className="hidden h-8 object-contain sm:block" />
          <span className="text-sm font-extrabold tracking-tight sm:hidden">Stackable Academy</span>
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium tracking-tight text-[#355045] transition-colors hover:text-[#108548] dark:text-[#cad8cf] dark:hover:text-[#FFC300]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button
            onClick={() => setTheme(dark ? "light" : "dark")}
            aria-label="Toggle theme"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#108548]/20 bg-white/65 text-[#108548] transition-all hover:border-[#FFC300] hover:bg-[#FFC300]/10 dark:border-white/10 dark:bg-white/5 dark:text-[#FFC300]"
          >
            {mounted && dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <a
            href="https://stackable.kyfaru.com/login"
            className="rounded-full border border-[#108548] bg-transparent px-5 py-2.5 text-sm font-semibold text-[#108548] transition-all hover:border-[#FFC300] hover:bg-[#FFC300] hover:text-[#108548] dark:border-[#38c172] dark:text-[#86efac] dark:hover:border-[#FFC300] dark:hover:bg-[#FFC300] dark:hover:text-[#1B4332]"
          >
            Login
          </a>

          <a
            href="https://stackable.kyfaru.com/login"
            className="rounded-full border border-[#108548] bg-[#108548] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(16,133,72,0.15)] transition-all hover:border-[#FFC300] hover:bg-[rgba(255,195,0,0.2)] hover:text-[#FFC300] hover:shadow-[0_0_0_1px_rgba(255,195,0,0.4),0_0_18px_rgba(255,195,0,0.28)]"
          >
            Get Started
          </a>
        </div>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/70 md:hidden dark:border-white/10 dark:bg-white/5"
          aria-label="Open menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-black/5 bg-white/90 px-4 pb-5 pt-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1511]/95 md:hidden"
          >
            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-[#355045] transition-colors hover:bg-[#108548]/10 hover:text-[#108548] dark:text-[#d7e3dc]"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => setTheme(dark ? "light" : "dark")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#108548]/20 bg-white/65 text-[#108548] dark:border-white/10 dark:bg-white/5 dark:text-[#FFC300]"
                >
                  {mounted && dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                <a
                  href="https://stackable.kyfaru.com/login"
                  className="flex-1 rounded-full border border-[#108548] px-4 py-3 text-center text-sm font-semibold text-[#108548] dark:text-[#9be4b3]"
                >
                  Login
                </a>
                <a
                  href="https://stackable.kyfaru.com/login"
                  className="flex-1 rounded-full border border-[#108548] bg-[#108548] px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Get Started
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
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
