"use client";

import React, { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import {
  CountUp,
  SectionReveal,
  RippleButton,
  benefits,
  ecosystemCards,
} from "@/components/marketing/core";

export function PhilosophySection() {
  return (
    <>
      <SectionReveal className="relative">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#123728] shadow-[0_26px_60px_rgba(10,24,18,0.18)]">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,23,16,0.2),rgba(8,23,16,0.55))]" />
            <img
                src="/images/philosophy-team.jpg"
                alt="School leadership and educators"
                className="aspect-[4/5] h-full w-full object-cover opacity-75 mix-blend-screen" />
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
    </SectionReveal><SectionReveal>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.35em] text-[#785a00] dark:text-[#FFC300]">
                The Philosophy
            </span>
            <h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
                Technology doesn&apos;t replace the educator; it liberates the architect.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#5d6a70] md:text-lg dark:text-[#b5c4bb]">
                Stackable treats learning as a structured process. The platform provides the scaffolding — reports, automation, analytics, communication, class control, and administrative precision — so educators can focus on what actually matters: teaching, mentoring, and learner growth.
            </p>

            <div className="mt-10 grid gap-8 sm:grid-cols-2">
                <div>
                    <h3 className="font-bold text-[#111714] dark:text-white">Automated Rigor</h3>
                    <p className="mt-2 text-sm leading-7 text-[#627177] dark:text-[#b2c1b8]">
                        Precise tracking of performance, attendance, homework, CATs, exams, and academic reporting.
                    </p>
                </div>
                <div>
                    <h3 className="font-bold text-[#111714] dark:text-white">Seamless Integration</h3>
                    <p className="mt-2 text-sm leading-7 text-[#627177] dark:text-[#b2c1b8]">
                        Designed to fit the real institutional workflow without turning the school into a software experiment.
                    </p>
                </div>
            </div>
        </SectionReveal>
    </>
  );
}