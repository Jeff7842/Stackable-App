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
            const spanClass = card.wide ? "md:col-span-8" : "md:col-span-4";
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