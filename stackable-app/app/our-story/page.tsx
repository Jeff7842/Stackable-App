"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Cpu,
  GraduationCap,
  Landmark,
  Layers3,
  Quote,
  ShieldCheck,
  Sparkles,
  Target,
  Waypoints,
} from "lucide-react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/navbar/navbar";
import { Footer } from "@/components/footer/footer";
import {
  RippleButton,
  SectionReveal,
  CountUp,
  cn,
} from "@/components/navbar/navbar";
import "@/components/css/main.css";

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

const pillars = [
  {
    title: "Academic Depth",
    body: "Providing a comprehensive framework for curriculum management and student progress tracking that respects the nuance of learning.",
    icon: BookOpen,
    iconTone:
      "bg-[#108548]/10 text-[#108548] dark:bg-[#108548]/15 dark:text-[#7ce3a5]",
  },
  {
    title: "Stackable Modules",
    body: "Customize your experience. Like building blocks, our features stack together to create a unique ecosystem for every institution.",
    icon: Layers3,
    iconTone:
      "bg-[#FFC300]/14 text-[#785a00] dark:bg-[#FFC300]/12 dark:text-[#FFC300]",
  },
  {
    title: "Global Synergy",
    body: "Connected to the Kyfaru network, providing global insights and technological updates that keep you ahead of the curve.",
    icon: Sparkles,
    iconTone:
      "bg-[#FFC300]/10 text-[#d1a100] dark:bg-[#FFC300]/10 dark:text-[#FFD44D]",
  },
];

const legacyCards = [
  {
    title: "Founded in Tradition",
    body: "Kyfaru's core values of integrity and growth drive every algorithm we build.",
    icon: Landmark,
  },
  {
    title: "Precision Logic",
    body: "We treat learning as an engineering challenge, solved with architectural grace.",
    icon: Target,
  },
  {
    title: "Systemic Growth",
    body: "Integrated modules designed to stack perfectly with modern career goals.",
    icon: Waypoints,
  },
];

const lexiconCards = [
  {
    number: "01",
    title: "Modular Design",
    body: "Courses that connect like architectural blocks, building a custom foundation of expertise.",
    tone: "plain",
  },
  {
    number: "02",
    title: "Technological Integration",
    body: "Our platform does not just teach tech; it lives within it. We leverage Kyfaru’s proprietary engines to ensure zero-friction learning.",
    tone: "feature",
  },
  {
    number: "03",
    title: "Heritage",
    body: "Rooted in Kyfaru's mission to bridge the gap between potential and performance.",
    tone: "gold",
  },
  {
    number: "04",
    title: "Futurism",
    body: "Anticipating the needs of the workforce ten years before they arrive.",
    tone: "soft",
  },
];

const visionItems = [
  {
    number: "01",
    title: "Universal Access",
    body: "Deploying intelligent educational infrastructure to underserved regions with resilient, scalable digital delivery.",
  },
  {
    number: "02",
    title: "Neural Integration",
    body: "Developing ethical AI systems that support institutions, educators, and learners with precision guidance.",
  },
  {
    number: "03",
    title: "Eco-Campus Grid",
    body: "Transitioning partner ecosystems toward sustainable, efficient, and future-ready academic operations by 2030.",
  },
];

function EditorialCard({
  title,
  body,
  icon: Icon,
  className,
}: {
  title: string;
  body: string;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      className={cn(
        "rounded-[1.9rem] border border-app bg-surface p-7 shadow-[0_18px_40px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFC300]/12 text-[#785a00] dark:bg-[#FFC300]/10 dark:text-[#FFC300]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-xl font-extrabold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-muted">{body}</p>
    </motion.div>
  );
}

function LexiconCard({
  item,
  active,
  onActivate,
}: {
  item: (typeof lexiconCards)[number];
  active: boolean;
  onActivate: () => void;
}) {
  const isFeature = item.tone === "feature";
  const isGold = item.tone === "gold";
  const isSoft = item.tone === "soft";

  return (
    <motion.button
      type="button"
      onClick={onActivate}
      whileHover={{ y: -8 }}
      className={cn(
        "group relative overflow-hidden rounded-[2rem] border text-left transition-all duration-500",
        active
          ? "md:col-span-2 md:row-span-1 min-h-[20rem] p-10"
          : "min-h-[16rem] p-8",
        isFeature &&
          "bg-[linear-gradient(135deg,#3c7057,#244a39)] text-white border-[#2f5f49]",
        isGold &&
          "bg-[#e8bb31] text-[#251a00] border-[#d8ab22] dark:bg-[#d0a114]",
        isSoft &&
          "bg-[#eceeec] text-[#111714] border-[#dde1dd] dark:bg-[#141d19] dark:text-[#edf4ee] dark:border-white/10",
        !isFeature &&
          !isGold &&
          !isSoft &&
          "bg-surface text-app border-app",
      )}
    >
      <div className="mt-10 relative z-10 flex h-full flex-col">
        <div>
          <div
            className={cn(
              "text-5xl font-extrabold tracking-[-0.06em]",
              isFeature
                ? "text-[#d6e8de]"
                : isGold
                  ? "text-[#785a00]"
                  : "text-[#9c7300] dark:text-[#FFC300]",
            )}
          >
            {item.number}
          </div>

          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">
            {item.title}
          </h3>
        </div>

        <p
          className={cn(
            "mt-2 max-w-xl text-sm leading-7",
            isFeature
              ? "text-white/80"
              : isGold
                ? "text-[#4f3a00]"
                : "text-muted",
          )}
        >
          {item.body}
        </p>
      </div>

      {active && (
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-14 left-8 h-36 w-36 rounded-full bg-[#FFC300]/20 blur-3xl" />
        </div>
      )}
    </motion.button>
  );
}

export default function OurStoryPage() {
  const [activeLexicon, setActiveLexicon] = useState(1);
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="min-h-screen bg-app text-app font-main">
      <Navbar />

      <main className="overflow-hidden">
        {/* HERO */}
        <section
  id="home"
  className="relative min-h-[92svh] overflow-hidden"
>
  {/* Background image */}
  <div
    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-70"
    style={{ backgroundImage: "url('/images/teachers-and-students.png')" }}
  />

  {/* Gradient overlay */}
  <div className="absolute backdrop-blur-x0.5 inset-0 bg-[linear-gradient(180deg,#174d38_0%,#326c55_22%,#6e8f7c_44%,#d9ded9_78%,transparent_100%)] dark:bg-[linear-gradient(180deg,#0d2c1f_0%,#184731_20%,#416b58_44%,#16231d_78%,transparent_100%)] opacity-82" />

  {/* Radial glow */}
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,195,0,0.12),transparent_22%)]" />

  {/* Content */}
          <div className="relative mx-auto flex min-h-[92svh] max-w-7xl items-center justify-center px-4 py-28 text-center md:px-6 lg:px-8">
            <SectionReveal className="w-full">
              <p className="mb-6 text-[11px] font-extrabold uppercase tracking-[0.28em] text-[#ffd65b]">
                Established by Kyfaru Company
              </p>

              <h1 className="mx-auto max-w-4xl text-5xl font-extrabold leading-[0.92] tracking-[-0.06em] text-white md:text-7xl lg:text-[5.5rem]">
                The Heritage
                <br />
                <span className="inline-flex items-baseline gap-3">
                  <span className="italic text-[#FFC300]">of</span>
                  <span>Knowledge</span>
                </span>
              </h1>

              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="mt-36 flex flex-col items-center gap-3"
              >
                <div className="flex items-center gap-2 text-[#ffd65b]">
                  
                  <span className="text-[10px] font-bold uppercase tracking-[0.26em]">
                    Scroll Down
                  </span>
                </div>
                <div className="h-20 w-px bg-[#ffd65b]" />
              </motion.div>
            </SectionReveal>
          </div>
        </section>

        {/* BUILT TO ELEVATE */}
        <section
          id="story"
          className="relative px-4 py-24 md:px-6 lg:px-8 lg:py-28"
        >
          <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-12">
            <SectionReveal className="lg:col-span-7">
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[#108548]/12 bg-white/70 px-4 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#108548] shadow-[0_0_16px_rgba(16,133,72,0.9)]">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#108548]/60" />
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#355045] dark:text-[#dce8e1]">
                 Since 2025 . A Branch of Kyfaru
                </span>
              </div>

              <h2 className="max-w-3xl text-5xl font-[500] leading-[0.92] tracking-[-0.05em] md:text-7xl lg:text-[5.2rem] font-secondary-title">
                Built to{" "}
                <span className="text-[#108548] underline decoration-[0.35rem] italic decoration-[#FFC300] underline-offset-[10px]">
                  Elevate
                </span>
                <br />
                Education.
              </h2>

              <p className="mt-7 max-w-2xl text-base leading-8 text-muted md:text-lg">
                Stackable is more than a platform; it is an architectural shift
                in how academies operate. As a branch of Kyfaru, we fuse elite
                technology with academic rigor and institutional precision.
              </p>

              <div className="mt-10">
                <RippleButton
                  href="#dna"
                  className="group bg-[#343d42] dark:bg-[#d0a114] px-7 py-4 text-sm font-extrabold text-white dark:text-[#f9f9f9] shadow-[0_18px_40px_rgba(17,23,20,0.12)]"
                >
                  <span className="inline-flex items-center">
                    Discover the Synergy
                    <ArrowRight className="ml-2 h-5 w-5 translate-x-0 opacity-50 transition-all duration-500 group-hover:translate-x-1.5 group-hover:opacity-100 text-[#f9f9f9] dark:text-[#785a00]" />
                  </span>
                </RippleButton>
              </div>
            </SectionReveal>

            <SectionReveal className="lg:col-span-5">
              <div className="relative mx-auto max-w-[34rem]">
                <div className="absolute inset-5 rounded-[3rem] bg-[#e8d39a] rotate-[7deg] dark:bg-[#4b3f12]/55" />
                <div className="relative overflow-hidden rounded-[3rem] border-[8px] border-white bg-white shadow-[0_26px_70px_rgba(16,22,19,0.14)] rotate-[-4deg] dark:border-white/10 dark:bg-[#0f1714]">
                  <div className="relative aspect-[4/5]">
                    <Image
                      src="/images/landing-page-image-five.png"
                      alt="Students collaborating in a modern learning space"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(16,133,72,0.18),rgba(16,133,72,0.38))]" />
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8 }}
                  className="absolute -bottom-8 left-0 rounded-[1.8rem] border border-white/60 bg-white/90 p-5 shadow-[0_22px_60px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1511]/88"
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#108548]/10 text-[#108548] dark:bg-[#108548]/20 dark:text-[#7ce3a5]">
                      <Cpu className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#108548] dark:text-[#8de4af]">
                      Kyfaru DNA
                    </span>
                  </div>
                  <p className="mt-3 max-w-[18rem] text-sm leading-6 text-[#4e595d] dark:text-[#c3d0c8]">
                    “Engineering the future of academic institutions with
                    precision and intent.”
                  </p>
                </motion.div>
              </div>
            </SectionReveal>
          </div>
        </section>

        {/* DNA */}
        <section
          id="dna"
          className="relative bg-surface px-4 py-24 md:px-6 lg:px-8"
        >
          <div className="absolute right-0 top-0 opacity-[0.04] dark:opacity-[0.05]">
            <div className="translate-x-10 -translate-y-4 text-[18rem] font-black text-[#1B4332]">
              A
            </div>
          </div>

          <div className="mx-auto grid max-w-7xl items-center gap-20 lg:grid-cols-2">
            <SectionReveal className="order-2 lg:order-1">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-5">
                  <div className="relative h-72 overflow-hidden rounded-[1.8rem] border-[4px] border-white shadow-[0_22px_50px_rgba(0,0,0,0.08)] [clip-path:polygon(12%_0%,100%_0%,88%_100%,0%_100%)] dark:border-white/10">
                    <Image
                      src="/images/parent-daughter-learning.png"
                      alt="Modern institution building"
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="aspect-square rounded-[1.4rem] bg-[#108548] p-8 text-white shadow-[0_20px_46px_rgba(16,133,72,0.18)]">
                    <div className="flex h-full flex-col justify-end">
                      <div className="text-5xl font-extrabold tracking-[-0.05em]">
                        <CountUp value={99} suffix="%" />
                      </div>
                      <div className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/75">
                        Efficiency Rate
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 pt-10">
                  <div className="aspect-square rounded-[1.4rem] bg-[#e5b637] p-8 text-[#251a00] shadow-[0_20px_46px_rgba(236,185,56,0.18)]">
                    <div className="flex h-full flex-col justify-end">
                      <div className="text-5xl font-extrabold tracking-[-0.05em]">
                        24/7
                      </div>
                      <div className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#5a4200]">
                        Live Integration
                      </div>
                    </div>
                  </div>

                  <div className="relative h-72 overflow-hidden rounded-[1.8rem] border-[4px] border-white shadow-[0_22px_50px_rgba(0,0,0,0.08)] [clip-path:polygon(12%_0%,100%_0%,88%_100%,0%_100%)] dark:border-white/10">
                    <Image
                      src="/images/board-meeting-two.png"
                      alt="Students in collaborative study"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            </SectionReveal>

            <SectionReveal className="order-1 lg:order-2">
              <h2 className="text-4xl font-extrabold tracking-tight text-[#000000] dark:text-[#108548] md:text-6xl">
                The Kyfaru <a className="text-[#FFC300] font-secondary-title font-600">DNA</a>.
              </h2>

              <p className="mt-6 max-w-2xl text-base leading-8 text-muted md:text-lg">
                As a specialized branch of Kyfaru, Stackable inherits a legacy
                of robust engineering. We believe that technology should not
                just be an add-on to education. It should be part of the
                foundation on which academic excellence is built.
              </p>

              <div className="mt-10 space-y-4">
                <motion.div
                  whileHover={{ x: 6 }}
                  className="flex items-start gap-4 rounded-[1.35rem] border border-[#108548]/10 bg-[#108548]/5 p-5 dark:border-[#108548]/20 dark:bg-[#108548]/10"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#108548]/10 text-[#108548] dark:bg-[#108548]/20 dark:text-[#8fe1b1]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold">Technological Edge</h3>
                    <p className="mt-1 text-sm leading-7 text-muted">
                      Leveraging AI and predictive analytics to manage student
                      pathways.
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ x: 6 }}
                  className="flex items-start gap-4 rounded-[1.35rem] border border-[#FFC300]/10 bg-[#FFC300]/5 p-5 dark:border-[#FFC300]/18 dark:bg-[#FFC300]/8"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFC300]/10 text-[#b98900] dark:bg-[#FFC300]/12 dark:text-[#FFD44D]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold">Institutional Security</h3>
                    <p className="mt-1 text-sm leading-7 text-muted">
                      Bank-grade protection for your most valuable academic
                      records and operational data.
                    </p>
                  </div>
                </motion.div>
              </div>
            </SectionReveal>
          </div>
        </section>

        {/* CORE PILLARS */}
        <section className="bg-app px-4 py-24 md:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionReveal className="mb-16 text-center">
              <h2 className="text-4xl font-extrabold tracking-tight md:text-6xl">
                Our Core Pillars
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted md:text-base">
                Empowering growth through innovation, community, mentorship, and practical learning that prepares every student for tomorrow.
              </p>
            </SectionReveal>

            <div className="grid gap-7 md:grid-cols-3">
              {pillars.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.55, delay: index * 0.08 }}
                    whileHover={{ y: -10 }}
                    className="rounded-[2rem] border border-app bg-surface p-8 shadow-[0_18px_40px_rgba(0,0,0,0.04)]"
                  >
                    <div
                      className={cn(
                        "mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl",
                        item.iconTone,
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-2xl font-extrabold tracking-tight">
                      {item.title}
                    </h3>
                    <p className="mt-4 text-sm leading-7 text-muted">
                      {item.body}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* A KYFARU LEGACY */}
        <section className="bg-surface-muted px-4 py-24 md:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <SectionReveal>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#785a00] dark:text-[#FFC300]">
                  History
                </span>
                <h2 className="mt-4 text-4xl font-extrabold tracking-tight md:text-6xl">
                  A Kyfaru Legacy
                </h2>
              </SectionReveal>

              <SectionReveal>
                <p className="max-w-xs text-sm italic leading-7 text-muted">
                  “The foundation of every great civilization is the education
                  of its youth.”
                </p>
              </SectionReveal>
            </div>

            <div className="grid gap-6 md:h-[40rem] md:grid-cols-12">
              <SectionReveal className="md:col-span-7">
                <div className="group relative flex h-full min-h-[18rem] flex-col justify-end overflow-hidden rounded-[2.3rem] border border-app bg-surface p-10 shadow-[0_18px_40px_rgba(0,0,0,0.04)]">
                  <div className="absolute right-8 top-8 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#108548]/8 text-[#108548] dark:bg-[#108548]/14 dark:text-[#8be0af]">
                    <Landmark className="h-7 w-7" />
                  </div>

                  <h3 className="text-2xl font-extrabold tracking-tight">
                    The Institutional Anchor
                  </h3>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                    As a Kyfaru Company initiative, Stackable Academy inherits
                    decades of expertise in systemic architectural design and
                    data integrity. We build for longevity, not just for the
                    present.
                  </p>
                </div>
              </SectionReveal>

              <SectionReveal className="md:col-span-5">
                <div className="flex h-full min-h-[18rem] flex-col justify-center rounded-[2.3rem] bg-[#3f6a53] dark:bg-[#174732] p-10 text-white">
                  <div className="text-5xl font-extrabold tracking-[-0.05em] text-[#FFC300]">
                    20+
                  </div>
                  <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d7ebdd]">
                    Years of Systemic Innovation
                  </p>
                  <p className="mt-5 max-w-sm text-sm leading-7 text-white/78">
                    Founded on the principle that knowledge should be modular,
                    accessible, and indestructible.
                  </p>
                </div>
              </SectionReveal>

              <SectionReveal className="md:col-span-5">
                <motion.a
                  href="#vision"
                  whileHover={{ y: -6 }}
                  className="group relative flex h-full min-h-[15rem] items-center justify-between overflow-hidden rounded-[2.3rem] bg-[#e4b52e] p-10 text-[#251a00]"
                >
                  <div className="absolute inset-0">
                    <Image
                      src="/images/landing-page-image-five.png"
                      alt="Governance visual"
                      fill
                      className="object-cover opacity-20 mix-blend-multiply"
                    />
                  </div>
                  <span className="relative z-10 max-w-[14rem] text-xl font-extrabold tracking-tight">
                    Explore our Governance
                  </span>
                  <ArrowRight className="relative z-10 h-6 w-6 transition-transform duration-500 group-hover:translate-x-2" />
                </motion.a>
              </SectionReveal>

              <SectionReveal className="md:col-span-7">
                <div className="flex h-full min-h-[15rem] items-center gap-6 rounded-[2.3rem] border border-app bg-[#e6ebe8] p-8 dark:bg-[#141d19]">
                  <div className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-[#108548] dark:bg-[#1b2822] dark:text-[#9ee5bb]">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium leading-7 text-muted">
                    Standardized excellence across international campuses,
                    institutions, and academic ecosystems.
                  </p>
                </div>
              </SectionReveal>
            </div>
          </div>
        </section>

        {/* QUOTE */}
        <section className="relative overflow-hidden bg-[linear-gradient(30deg,rgba(110,244,156,0.9),rgba(16,133,72,0.8))] px-4 py-24 text-white md:px-6 lg:px-8">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
          </div>

          <div className="relative mx-auto max-w-4xl text-center">
            <SectionReveal>
              <div className="mx-auto mb-8 inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/8 text-[#FFC300]">
                <Quote className="h-8 w-8" />
              </div>

              <p className="text-3xl font-normal font-secondary-title italic dark:text-white/80 leading-tight md:text-5xl">
                “We didn&apos;t build an academy; we designed a vessel for the
                continuous evolution of the human mind.”
              </p>

              <div className="mt-10">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#FFC300]">
                  Lead Architect
                </p>
                <p className="mt-2 text-sm text-white/70">
                  Kyfaru Global Design Lab
                </p>
              </div>
            </SectionReveal>
          </div>
        </section>

        {/* LEXICON */}
        <section className="bg-app px-4 py-24 md:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionReveal className="mb-14 text-center">
              <h2 className="text-4xl font-extrabold tracking-tight md:text-6xl">
                The Lexicon of Success
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted md:text-base">
                Defining the standards of 21st-century intelligence through the
                Stackable methodology.
              </p>
            </SectionReveal>

            <div className="grid gap-6 md:grid-cols-4">
              {lexiconCards.map((item, index) => (
                <LexiconCard
                  key={item.number}
                  item={item}
                  active={activeLexicon === index}
                  onActivate={() => setActiveLexicon(index)}
                />
              ))}
            </div>
          </div>
        </section>

        

        {/* VISION 2030 */}
        <section
          id="vision"
          className="relative overflow-hidden bg-[#1B4332] px-4 py-24 text-white md:px-6 lg:px-8"
        >
          <div className="absolute right-[-8rem] top-[-8rem] h-80 w-80 rounded-full bg-[#FFC300]/10 blur-3xl" />
          <div className="absolute bottom-[-10rem] left-[-8rem] h-96 w-96 rounded-full bg-white/6 blur-3xl" />

          <div className="relative mx-auto max-w-7xl">
            <SectionReveal className="mx-auto mb-16 max-w-4xl text-center">
              <h2 className="text-5xl font-[500] font-secondary-title tracking-[-0.05em] md:text-7xl text-[#ffc300]">
                Vision 2030
              </h2>
              <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-white/78 md:text-lg">
                By the end of the decade, Stackable Academy aims to bridge the
                global digital divide, providing the infrastructure for a
                unified, intelligence-driven academic ecosystem.
              </p>
            </SectionReveal>

            <div className="grid gap-10 md:grid-cols-3">
              {visionItems.map((item, index) => (
                <motion.div
                  key={item.number}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.55, delay: index * 0.08 }}
                  whileHover={{ y: -8 }}
                  className="border-l border-white/14 px-7 py-4"
                >
                  <div className="text-5xl font-extrabold tracking-[-0.05em] text-[#FFC300]">
                    {item.number}
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold uppercase tracking-[0.08em] text-white">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-white/70">
                    {item.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* READY TO STACK YOUR SUCCESS */}
        <section className="bg-app px-4 py-24 md:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionReveal>
              <div className="relative overflow-hidden rounded-[3rem] bg-[linear-gradient(155deg,#c5e8d0_0%,#d5edf2_64%,#f5d18c_96%,#f0e07b_150%)] p-10 shadow-[0_24px_60px_rgba(14,21,18,0.12)] md:p-14 lg:p-16 dark:bg-[linear-gradient(155deg,#183428_10%,#174333_40%,#6a5b12_90%)]">
                <div className="absolute -left-14 -top-14 h-48 w-48 rounded-full bg-white/25 blur-3xl dark:bg-white/8" />
                <div className="absolute -bottom-16 right-0 h-56 w-56 rounded-full bg-[#FFC300]/20 blur-3xl" />

                <div className="relative grid items-center gap-10 md:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <h2 className="max-w-2xl text-4xl font-[500] font-secondary-title leading-[0.95] tracking-[-0.05em] text-[#06210f] md:text-6xl dark:text-white">
                      Ready to stack your success?
                    </h2>
                    <p className="mt-7 text-sm font-medium uppercase tracking-[0.18em] text-[#108548] dark:text-[#b6e8c9]">
                      Join the next generation of academic management.
                    </p>
                  </div>

                  <div className="flex justify-start md:justify-end">
                    <RippleButton
                      href="/login"
                      className="group bg-[#108548] px-8 py-5 text-sm font-extrabold text-white shadow-[0_18px_40px_rgba(16,133,72,0.24)]"
                    >
                      <span className="inline-flex items-center gap-3">
                        Request a Demo
                        <ArrowUpRight className="h-5 w-5 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" />
                      </span>
                    </RippleButton>
                  </div>
                </div>
              </div>
            </SectionReveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}