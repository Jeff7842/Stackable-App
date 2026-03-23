"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  GraduationCap,
  Building2,
  Users,
  ShieldCheck,
  Layers3,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Navbar } from "@/components/navbar/navbar";
import { Footer } from "@/components/footer/footer";
import Image from "next/image";
import { useTheme } from "next-themes";
import "@/components/css/main.css";

/**
 * Stackable Academy Landing Page
 *
 * Drop this into a Next.js app as a client component, e.g.:
 * app/(marketing)/page.tsx
 *
 * Tailwind + Framer Motion required.
 * Asset paths expected in /public:
 * - /logos/main-logo.webp
 * - /logos/symbol-light.webp
 * - /logos/symbol-dark.webp
 * - /images/hero-learning-space.jpg
 * - /images/philosophy-team.jpg
 * - /images/library-stack.jpg
 * - /images/newsletter-pattern.jpg
 */

const palette = {
  darkGreen: "#1B4332",
  green: "#108548",
  yellow: "#FFC300",
  darkGold: "#251a00",
  brightGold: "#785a00",
  slate: "#535d60",
  offWhite: "#f9f9f8",
  blackish: "#0e1512",
};

const stakeholderCards = [
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
];

const ecosystemCards = [
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
];

const benefits = [
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
];

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted;
}

function RippleButton({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
}) {
  const [ripples, setRipples] = useState<
    Array<{ x: number; y: number; id: number }>
  >([]);

  const onClick = (
    e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    setRipples((prev) => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 700);
  };

  const shared = cn(
    "relative isolate inline-flex items-center justify-center overflow-hidden rounded-full will-change-transform active:scale-[0.98]",
    className,
  );

  const content = (
    <>
      <span className="relative z-10 flex items-center justify-center">
        {children}
      </span>

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
      <motion.a
        href={href}
        onClick={onClick}
        className={shared}
        whileHover={{ y: -4, scale: 1.006 }}
        transition={{ duration: 0.02, ease: [0.22, 1, 0.36, 1] }}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      className={shared}
      whileHover={{ y: -4, scale: 1.00 }}
      transition={{ duration: 0.02, ease: [0.22, 1, 0.36, 1] }}
    >
      {content}
    </motion.button>
  );
}

function CountUp({
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

function SectionReveal({
  children,
  className = "",
  delay = 0,
  duration = 0.75,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ 
        duration,
        delay,
        ease: [0.32, 1, 0.46, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function StackableAcademyLandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const mounted = useMounted();
  const year = useMemo(() => new Date().getFullYear(), []);
  const dark = mounted && resolvedTheme === "dark";

  const toggleTheme = () => {
    setTheme(dark ? "light" : "dark");
  };

  return (
    <div className="min-h-screen bg-[#f9f9f8] text-[#111714] transition-colors duration-300 dark:bg-[#08100d] dark:text-[#edf4ee] font-main">
      <Navbar />

      <main>
        <section
          id="home"
          className="relative overflow-hidden px-4 pb-24 pt-14 md:px-6 lg:px-8 lg:pb-28 lg:pt-16"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,133,72,0.18),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(255,195,0,0.18),transparent_35%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(16,133,72,0.45),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(255,195,0,0.12),transparent_35%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-12">
            <SectionReveal className="relative z-10 lg:col-span-7"
            delay={0.20}
  duration={1.5}>
              <div 
              className="mb-6 inline-flex items-center gap-3 rounded-full border border-[#108548]/10 bg-white/55 px-4 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#108548] shadow-[0_0_16px_rgba(16,133,72,0.85)]">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#108548]/60" />
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#355045] dark:text-[#dce8e1]">
                  A New Era of Education
                </span>
              </div>

              <motion.div
              initial={{ opacity: 0,  y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.2 }}
  transition={{ duration: 1, delay: 0.30, ease: [0.22, 1, 0.36, 1] }}
  >

              <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.92] tracking-[-0.05em] text-[#111714] md:text-7xl lg:text-[5.5rem] dark:text-white">
                Architecting
                <span className="block italic text-[#785a00] dark:text-[#FFC300]">
                  Intelligence.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-[#556267] md:text-lg dark:text-[#b9c8bf]">
                The future of school management is not a dashboard. It is a
                connected operating system. Stackable brings directors,
                administrators, teachers, guardians, and learners into one
                platform where work becomes lighter and learning becomes
                sharper, faster, and more engaging.
              </p>
              </motion.div>

              <motion.div 
              initial={{ opacity: 0,  y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.2 }}
  transition={{ duration: 1, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="mt-9 flex flex-wrap gap-4">
                <RippleButton
                  href="#story"
                  className="bg-[#FFC300] group px-7 py-4 text-sm font-extrabold text-[#251a00] shadow-[0_18px_40px_rgba(255,195,0,0.18)] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(255,195,0,0.24)] transition-shadow duration-500"
                >
                  <span className="inline-flex items-center">
    Explore the Platform
    <ArrowUpRight className="ml-2 h-0 w-0 opacity-0 -mr-2 text-[#1B4332] -translate-x-1 transition-all duration-800 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:mr-0 group-hover:w-5 group-hover:h-5 group-hover:translate-x-1.5 group-hover:opacity-100" />
  </span>
                </RippleButton>

                <RippleButton
                  href="#academy"
                  className="group border border-black/10 bg-white/65 px-7 py-4 text-sm font-bold text-[#1B4332] backdrop-blur-xl over:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 ease-[cubic-bezier(0.22,1,0.36,1)] transition-colors duration-500"
                >
                  <span className="inline-flex items-center">
                    Our Methodology
                    <ArrowRight className="ml-2 h-5 w-5 opacity-0 -mr-7 text-[#FFC300] -translate-x-2 transition-all duration-800 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:mr-0.5 group-hover:translate-x-2 group-hover:opacity-100" />
                  </span>
                </RippleButton>
              </motion.div>
            </SectionReveal>

            <SectionReveal className="relative lg:col-span-5"
            delay={0.65}
  duration={2.55}>
              <motion.div
  initial={{ opacity: 0,  y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.2 }}
  transition={{ duration: 1, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
  className="relative mx-auto max-w-[34rem]"
>
                <div className="overflow-hidden rounded-[2rem] border border-white/40 bg-white/60 shadow-[0_30px_80px_rgba(15,23,20,0.15)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 duration-700">
                  <div className="aspect-[4/5] overflow-hidden rounded-[2rem]">
                    <img
                      src={
                        dark
                          ? "/images/landing-page-image-five-night.png"
                          : "/images/landing-page-image-five.png"
                      }
                      alt="Stackable Academy hero learning environment"
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                    />
                  </div>
                </div>

                <motion.div
  initial={{ opacity: 0, y:36, scale: 1.00 }}
                  whileInView={{ opacity: 1, y: -6, scale: 1.02 }}
                  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 2.0, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute -bottom-8 sm:-left-8 left-0 rounded-2xl border border-white/50 bg-white/85 p-5 shadow-[0_22px_60px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1511]/85"
                >
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#785a00] dark:text-[#FFC300]">
                    Live Metric
                  </div>
                  <div className="mt-1 text-3xl font-extrabold tracking-tight">
                    <CountUp value={94.2} suffix="%" decimals={1} />
                  </div>
                  <p className="mt-1 max-w-[13rem] text-sm text-[#56656a] dark:text-[#b4c2b9]">
                    Efficiency increase in academic reporting and institutional
                    operations.
                  </p>
                </motion.div>
              </motion.div>
            </SectionReveal>
          </div>
        </section>

        <section
          id="story"
          className="bg-[#f0f2ef] px-4 py-24 dark:bg-[#0d1613] md:px-6 lg:px-8"
        >
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
                      isGold &&
                        "border-[#7a5b00]/10 bg-[#9e7800] text-[#211600]",
                      isGlass &&
                        "border-white/50 bg-white/55 backdrop-blur-xl dark:border-white/10 dark:bg-white/5",
                      !isDark &&
                        !isGold &&
                        !isGlass &&
                        "border-black/5 bg-white text-[#111714] dark:border-white/10 dark:bg-[#101916] dark:text-white",
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
                        <h3
                          className={cn(
                            "text-3xl font-bold tracking-tight",
                            card.title === "Guardians"
                              ? "text-[#FFC300] dark:text-white"
                              : card.title === "Educators"
                                ? "text-[#f9f9f8] dark:text-[#251a00]"
                                : "text-[#111714] dark:text-white",
                          )}
                        >
                          {card.title}
                        </h3>
                        <p
                          className={cn(
                            "mt-4 max-w-xl text-sm leading-7",
                            isDark
                              ? "text-white/80"
                              : isGold
                                ? "text-[#f1f1f1] dark:text-[#fffefb]"
                                : "text-[#617075] dark:text-[#b8c7be]",
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
                                ? "rounded-full border border-[#3f2d00]/15 bg-white/25 text-[#2b1f04] backdrop-blur-xl"
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
                          src="/images/library.webp"
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

        <section
          id="academy"
          className="overflow-hidden bg-[#f9f9f8] px-4 py-24 dark:bg-[#08100d] md:px-6 lg:px-8"
        >
          <div className="mx-auto grid max-w-7xl items-center gap-20 lg:grid-cols-2">
            <SectionReveal className="relative order-2 lg:order-1">
              <div className="relative mx-auto max-w-xl">
                <motion.div
                  whileHover={{ scale: 1.02, y: -6 }}
                  className="relative z-10 ml-auto w-[78%] rounded-[1.8rem] border border-white/50 bg-white/85 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.11)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#cdeed6] dark:bg-[#123725]">
                      <Image
                        src={
                          dark
                            ? "/images/profil-picture-two.png"
                            : "/images/profil-picture-four.png"
                        }
                        className="w-full h-full rounded-full object-cover duration-300"
                        alt=""
                        width={250}
                        height={250}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-bold">Student Progress</div>
                      <div className="text-xs text-[#627176] dark:text-[#a9b8af]">
                        Mathematics Tier 4
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 h-2.5 rounded-full bg-black/5 dark:bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: "75%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full rounded-full bg-[#785a00] dark:bg-[#FFC300]"
                    />
                  </div>
                </motion.div>

                <div className="absolute -top-10 left-0 w-[68%] rounded-[1.8rem] border border-black/5 bg-white/55 p-6 opacity-70 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-black/5 dark:bg-white/10" />
                    <div className="h-3 w-28 rounded-full bg-black/10 dark:bg-white/10" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-2 rounded-full bg-black/7 dark:bg-white/10" />
                    <div className="h-2 w-4/5 rounded-full bg-black/7 dark:bg-white/10" />
                  </div>
                </div>
              </div>
            </SectionReveal>

            <SectionReveal className="order-1 lg:order-2">
              <h2 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
                Engineered for the
                <span className="block text-[#108548]">Next Frontier.</span>
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[#5d6b70] md:text-lg dark:text-[#b7c6bd]">
                Stackable is built for modern institutions that need clean
                execution, strong visibility, and serious academic coordination.
                It is an SME-grade school management system designed to reduce
                friction, sharpen workflows, and improve learning outcomes
                across the whole institution.
              </p>

              <div className="mt-10 space-y-6">
                {benefits.map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.title}
                      whileHover={{ x: 6 }}
                      className="flex items-start gap-4"
                    >
                      <div className="inline-flex h-10 w-12 items-center justify-center p-2.5 rounded-xl bg-[#FFC300]/15 text-[#785a00] dark:bg-[#FFC300]/10 dark:text-[#FFC300]">
                        <Icon className="h-24 w-24" />
                      </div>
                      <div>
                        <h3 className="font-bold">{item.title}</h3>
                        <p className="mt-1 text-sm leading-7 text-[#607076] dark:text-[#b7c5bc]">
                          {item.body}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </SectionReveal>
          </div>
        </section>

        <section
          id="benefits"
          className="bg-[#eef1ef] px-4 py-24 dark:bg-[#0d1613] md:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <SectionReveal className="mb-16 text-center">
              <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
                Empowering the Ecosystem
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-[#5e6c71] dark:text-[#b7c5bd]">
                Specific modules designed for every pillar of the academic
                community.
              </p>
            </SectionReveal>

            <div className="grid grid-cols-1 gap-7 md:grid-cols-12">
              {ecosystemCards.map((card, index) => {
                const Icon = card.icon;
                const spanClass = card.wide
                  ? "md:col-span-8"
                  : card.full
                    ? "md:col-span-12"
                    : "md:col-span-4";
                return (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.55, delay: index * 0.07 }}
                    whileHover={{ y: -8 }}
                    className={cn(
                      "overflow-hidden rounded-[2rem] p-8 md:p-10 shadow-[0_18px_40px_rgba(0,0,0,0.06)]",
                      spanClass,
                      card.bg,
                      card.text,
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-full flex-col justify-between",
                        card.full && "md:flex-row md:items-end md:gap-10",
                      )}
                    >
                      <div className={cn(card.full && "md:max-w-3xl")}>
                        <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/35 text-current shadow-sm backdrop-blur-lg dark:bg-white/8">
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className="mb-4 block text-[10px] font-extrabold uppercase tracking-[0.22em] opacity-75">
                          {card.eyebrow}
                        </span>
                        <h3 className="text-3xl font-extrabold leading-tight md:text-4xl">
                          {card.title}
                        </h3>
                        <p className="mt-4 max-w-2xl text-sm leading-7 opacity-80 md:text-base">
                          {card.body}
                        </p>

                        {card.cta && (
                          <RippleButton
                            href="#pricing"
                            className="mt-8 bg-[#09140f] px-6 py-3 text-sm font-bold text-white dark:bg-[#f5f8f6] dark:text-[#0c1712]"
                          >
                            {card.cta}
                          </RippleButton>
                        )}
                      </div>

                      {card.stats && (
                        <div className="mt-8 grid grid-cols-2 gap-4 md:mt-0">
                          {card.stats.map((stat) => (
                            <div
                              key={stat.label}
                              className="rounded-2xl bg-white/50 px-6 py-5 text-center shadow-sm backdrop-blur-xl dark:bg-white/7"
                            >
                              <div className="text-3xl font-extrabold tracking-tight">
                                <CountUp
                                  value={stat.value}
                                  suffix={stat.suffix}
                                />
                              </div>
                              <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-70">
                                {stat.label}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="library"
          className="bg-[#f9f9f8] px-4 py-24 dark:bg-[#08100d] md:px-6 lg:px-8"
        >
          <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
            <SectionReveal className="relative">
              <div className="relative overflow-hidden rounded-[2rem] bg-[#123728] shadow-[0_26px_60px_rgba(10,24,18,0.18)]">
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,23,16,0.2),rgba(8,23,16,0.55))]" />
                <img
                  src="/images/board-meeting-two.png"
                  alt="School leadership and educators"
                  className="aspect-[4/5] h-full w-full object-cover opacity-75 mix-blend-screen"
                />
              </div>

              <motion.div
                whileHover={{ y: -6, rotate: 0 }}
                className="absolute -top-5 right-0 rounded-2xl bg-[#FFC300] px-6 py-5 text-[#251a00] shadow-[0_18px_38px_rgba(255,195,0,0.25)] md:-top-6 md:right-4"
              >
                <div className="text-4xl font-extrabold leading-none">
                  <CountUp value={99.8} suffix="%" decimals={1} />
                </div>
                <div className="mt-2 max-w-[10rem] text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-75">
                  Operational efficiency for academy partners
                </div>
              </motion.div>
            </SectionReveal>

            <SectionReveal>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.35em] text-[#785a00] dark:text-[#FFC300]">
                The Philosophy
              </span>
              <h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
                Technology doesn&apos;t replace the educator; it liberates the
                architect.
              </h2>
              <p className="philosophy-description mt-6 max-w-2xl text-base leading-8 text-[#5d6a70] md:text-lg dark:text-[#b5c4bb]">
                Stackable treats learning as a structured process. The platform
                provides the scaffolding — reports, automation, analytics,
                communication, class control, and administrative precision — so
                educators can focus on what actually matters: teaching,
                mentoring, and learner growth.
              </p>

              <div className="mt-10 grid gap-8 sm:grid-cols-2">
                <div>
                  <h3 className="font-bold text-[#785a00] dark:text-[#FFC300]">
                    Automated Rigor
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[#627177] dark:text-[#b2c1b8]">
                    Precise tracking of performance, attendance, homework, CATs,
                    exams, and academic reporting.
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-[#785a00] dark:text-[#FFC300]">
                    Seamless Integration
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[#627177] dark:text-[#b2c1b8]">
                    Designed to fit the real institutional workflow without
                    turning the school into a software experiment.
                  </p>
                </div>
              </div>
            </SectionReveal>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0f432d,#0a6b38)] px-4 py-24 text-white dark:bg-[linear-gradient(135deg,#082217,#0b4a28)] md:px-6 lg:px-8">
          <div className="absolute inset-0 opacity-15">
            <img
              src="/images/ready2.jpg"
              alt="Pattern background"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="relative mx-auto max-w-4xl text-center">
            <SectionReveal>
              <h2 className=" CTA-header text-4xl font-extrabold leading-tight tracking-tight md:text-6xl tetx-[#f9f9f8] dark:text[#f9f9f8]">
                Ready to <span className="text-[#FFC300]">Stack</span> Your
                Future?
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/75 md:text-lg">
                Join forward-thinking institutions moving beyond fragmented
                systems into a smarter, connected school operating layer.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <RippleButton
                  href="/login"
                  className="bg-[#FFC300] px-8 py-4 text-sm font-extrabold text-[#251a00] shadow-[0_16px_36px_rgba(255,195,0,0.25)] hover:-translate-y-1"
                >
                  Request a Demo
                </RippleButton>
                <RippleButton
                  href="#newsletter"
                  className="border border-white/20 bg-white/5 px-8 py-4 text-sm font-bold text-white backdrop-blur-xl hover:-translate-y-1 hover:bg-white/10"
                >
                  Contact Sales
                </RippleButton>
              </div>
            </SectionReveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
