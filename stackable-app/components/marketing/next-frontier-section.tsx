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

export function NextFrontierSection() {
  return (
    <section id="academy" className="overflow-hidden bg-[#f9f9f8] px-4 py-24 dark:bg-[#08100d] md:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-20 lg:grid-cols-2">
        <SectionReveal className="relative order-2 lg:order-1">
          <div className="relative mx-auto max-w-xl">
            <motion.div
              whileHover={{ scale: 1.02, y: -6 }}
              className="relative z-10 ml-auto w-[78%] rounded-[1.8rem] border border-white/50 bg-white/85 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.11)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#cdeed6] dark:bg-[#123725]" />
                <div>
                  <div className="text-sm font-bold">Student Progress</div>
                  <div className="text-xs text-[#627176] dark:text-[#a9b8af]">Mathematics Tier 4</div>
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
            Stackable is built for modern institutions that need clean execution, strong visibility, and serious academic coordination. It is an SME-grade school management system designed to reduce friction, sharpen workflows, and improve learning outcomes across the whole institution.
          </p>

          <div className="mt-10 space-y-6">
            {benefits.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.title} whileHover={{ x: 6 }} className="flex items-start gap-4">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFC300]/15 text-[#785a00] dark:bg-[#FFC300]/10 dark:text-[#FFC300]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold">{item.title}</h3>
                    <p className="mt-1 text-sm leading-7 text-[#607076] dark:text-[#b7c5bc]">{item.body}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
