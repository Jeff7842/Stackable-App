"use client";

import React, { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import Image from "next/image";


export function Footer() {
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <footer id="pricing" className="bg-[#123b2c] px-4 pb-10 pt-16 text-white dark:bg-[#07120d] md:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <div className="flex w-full items-center justify-start gap-3">
  <div className="inline-flex h-20 w-20 items-center justify-center">
    <Image
      src="/logos/Symbol.webp"
      alt="Stackable logo"
      width={1000}
      height={1000}
      className="h-full w-full object-contain"
    />
  </div>
<div className="inline-flex h-auto w-40 items-center justify-center">
    <Image
      src="/logos/light-text.webp"
      alt="Stackable logo"
      width={1500}
      height={1500}
      className="h-full w-full object-contain"
    />
  </div>
</div>
              <p className="mt-5 max-w-xs text-sm leading-7 text-white/70">
                Building the operational foundation for smarter schools, better coordination, and stronger academic execution at scale.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#FFC300]">Platform</h4>
              <div className="mt-5 space-y-3 text-sm text-white/70">
                <a href="#story" className="block transition-transform hover:translate-x-1 hover:text-white">For Schools</a>
                <a href="#benefits" className="block transition-transform hover:translate-x-1 hover:text-white">For Guardians</a>
                <a href="#academy" className="block transition-transform hover:translate-x-1 hover:text-white">For Teachers</a>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#FFC300]">Company</h4>
              <div className="mt-5 space-y-3 text-sm text-white/70">
                <a href="#story" className="block transition-transform hover:translate-x-1 hover:text-white">Our Story</a>
                <a href="#library" className="block transition-transform hover:translate-x-1 hover:text-white">Support</a>
                <a href="#pricing" className="block transition-transform hover:translate-x-1 hover:text-white">Press Kit</a>
              </div>
            </div>

            <div id="newsletter">
              <h4 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#FFC300]">Subscribe</h4>
              <div className="mt-5 rounded-full border border-white/10 bg-white/5 p-1.5 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="Your email"
                    className="h-12 w-full bg-transparent px-4 text-sm text-white placeholder:text-white/40 outline-none"
                  />
                  <button className="inline-flex h-12 w-12 p-4 items-center justify-center rounded-full bg-[#FFC300] text-[#251a00] transition-transform hover:scale-105 hover:bg-[#f9f9f8] hover:scale-1.02">
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-xs uppercase tracking-[0.12em] text-white/45 md:flex-row md:items-center">
            <p>© {year} Stackable Academy. All rights reserved.</p>
            <div className="flex flex-wrap gap-5">
              <a href="#" className="hover:text-white">Privacy Policy</a>
              <a href="#" className="hover:text-white">Terms of Service</a>
              <a href="#" className="hover:text-white">Cookie Policy</a>
              <a href="#" className="hover:text-white">Legal</a>
            </div>
          </div>
        </div>
      </footer>
  );
}