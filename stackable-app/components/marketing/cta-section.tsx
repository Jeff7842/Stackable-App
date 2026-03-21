"use client";

import {
  SectionReveal,
  RippleButton,
} from "@/components/marketing/core";


export function CTASection() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0f432d,#0a6b38)] px-4 py-24 text-white dark:bg-[linear-gradient(135deg,#082217,#0b4a28)] md:px-6 lg:px-8">
      <div className="absolute inset-0 opacity-15">
        <img src="/images/newsletter-pattern.jpg" alt="Pattern background" className="h-full w-full object-cover" />
      </div>
      <div className="relative mx-auto max-w-4xl text-center">
        <SectionReveal>
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Ready to <span className="text-[#FFC300]">Stack</span> Your Future?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/75 md:text-lg">
            Join forward-thinking institutions moving beyond fragmented systems into a smarter, connected school operating layer.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <RippleButton
              href="https://stackable.kyfaru.com/login"
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
  );
}