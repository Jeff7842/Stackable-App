"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  GraduationCap,
  Users,
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


export const ecosystemCards = [
  {
    eyebrow: "For Parents",
    title: "Insight & Growth",
    body: "Real-time visibility into learner development with actionable metrics, attendance tracking, payment awareness, and direct school communication.",
    cta: "View Dashboard",
    icon: Users,
    bg: "bg-[#f4d88a] dark:bg-[#6b5207]",
    text: "text-[#251a00] dark:text-[#fff7dd]",
    full: false,
  },
  {
    eyebrow: "For Teachers",
    title: "Augmented Pedagogy",
    body: "Automated grading, lesson planning, class insights, AI assistance, and progress architecture that gives time back to the educator.",
    cta: "Explore Toolkit",
    icon: GraduationCap,
    bg: "bg-[linear-gradient(135deg,rgba(110,244,156,0.9),rgba(16,133,72,0.8))] dark:bg-[linear-gradient(135deg,rgba(18,102,59,1),rgba(11,69,39,1))]",
    text: "text-[#06210f] dark:text-[#ebfff2]",
    full: true,
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

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
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

export function EmpoweringEcosystemSection() {
  return (
    <section id="benefits" className="bg-[#eef1ef] px-4 py-24 dark:bg-[#0d1613] md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionReveal className="mb-16 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">Empowering the Ecosystem</h2>
          <p className="mx-auto mt-4 max-w-2xl text-[#5e6c71] dark:text-[#b7c5bd]">
            Specific modules designed for every pillar of the academic community.
          </p>
        </SectionReveal>

        <div className="grid grid-cols-1 gap-7 md:grid-cols-12">
          {ecosystemCards.map((card, index) => {
            const Icon = card.icon;
            const spanClass = card.full? "md:col-span-8" : "md:col-span-4";
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55, delay: index * 0.07 }}
                whileHover={{ y: -8 }}
                className={`${spanClass} overflow-hidden rounded-[2rem] p-8 shadow-[0_18px_40px_rgba(0,0,0,0.06)] md:p-10 ${card.bg} ${card.text}`}
              >
                <div className={`flex h-full flex-col justify-between`}>
                  <div>
                    <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/35 text-current shadow-sm backdrop-blur-lg dark:bg-white/8">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="mb-4 block text-[10px] font-extrabold uppercase tracking-[0.22em] opacity-75">
                      {card.eyebrow}
                    </span>
                    <h3 className="text-3xl font-extrabold leading-tight md:text-4xl">{card.title}</h3>
                    <p className="mt-4 max-w-2xl text-sm leading-7 opacity-80 md:text-base">{card.body}</p>

                    {"cta" in card && card.cta ? (
                      <RippleButton
                        href="#pricing"
                        className="mt-8 bg-[#09140f] px-6 py-3 text-sm font-bold text-white dark:bg-[#f5f8f6] dark:text-[#0c1712]"
                      >
                        {card.cta}
                      </RippleButton>
                    ) : null}
                  </div>

                  {"stats" in card && card.stats ? (
                    <div className="mt-8 grid grid-cols-2 gap-4 md:mt-0">
                      {card.stats.map((stat) => (
                        <div key={stat.label} className="rounded-2xl bg-white/50 px-6 py-5 text-center shadow-sm backdrop-blur-xl dark:bg-white/7">
                          <div className="text-3xl font-extrabold tracking-tight">
                            <CountUp value={stat.value} suffix={stat.suffix} />
                          </div>
                          <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-70">
                            {stat.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}