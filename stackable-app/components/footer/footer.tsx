"use client";

import React, { useMemo } from "react";
import {
  ArrowRight,
  Mail,
  MapPin,
  Phone,
  Youtube,
  Facebook,
  Linkedin,
  Instagram,
} from "lucide-react";
import Image from "next/image";
import { Icon } from '@iconify-icon/react';

import "../css/footer.css";


export function Footer() {
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <footer id="pricing" className="bg-[#123b2c] px-4 pb-10 pt-16 text-white dark:bg-[#07120d] md:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-15 md:grid-cols-[285px_minmax(0,1fr)]">
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

              <div id="newsletter" className="mt-10">
              <h4 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#FFC300] indent-2.5">Subscribe</h4>
              <div className="mt-5 rounded-full border w-75 md:w-full border-white/12.5 bg-white/8.5 p-1.5 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="Your email"
                    className="h-8 w-full bg-transparent px-4 rounded-full text-sm text-white placeholder:text-white/40 outline-none"
                  />
                  <button className="group inline-flex h-8 w-9  px-3 items-center justify-center rounded-full bg-[#FFC300] text-[#251a00] transition-transform hover:scale-105 hover:text-[#f9f9f8] hover:bg-[#785a00] hover:scale-1.02 duration-300">
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 duration-800" />
                  </button>
                </div>
              </div>
            </div>
            </div>

          <div className=" grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-4 mt-5 mr-5">
            <div className="">
              <h4 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#FFC300]">Platform</h4>
              <div className="mt-5 space-y-3 text-sm text-white/70">
                <a href="#story" className="block transition-transform hover:translate-x-1 hover:text-[#FFC300] duration-500 ">For Schools</a>
                <a href="#benefits" className="block transition-transform hover:translate-x-1 hover:text-[#FFC300] duration-500 ">For Guardians</a>
                <a href="#academy" className="block transition-transform hover:translate-x-1 hover:text-[#FFC300] duration-500 ">For Teachers</a>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#FFC300]">Company</h4>
              <div className="mt-5 space-y-3 text-sm text-white/70 duration-500 ">
                <a href="#story" className="block transition-transform hover:translate-x-1 hover:text-[#FFC300] duration-500  ">Our Story</a>
                <a href="#library" className="block transition-transform hover:translate-x-1 hover:text-[#FFC300] duration-500 ">Support</a>
                <a href="#pricing" className="block transition-transform hover:translate-x-1 hover:text-[#FFC300] duration-500 ">Kyfaru Network</a>
                <a href="#pricing" className="block transition-transform hover:translate-x-1 hover:text-[#FFC300] duration-500 ">Careers</a>
              </div>
            </div>

            <div className="pt-8">
              <h4 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#FFC300]">Solutions</h4>
              <div className="mt-5 space-y-3 text-sm text-white/70 duration-500 ">
                <a href="#story" className="block transition-transform hover:translate-x-1 hover:text-[#FFC300] duration-500  ">Academy Portal</a>
                <a href="#library" className="block transition-transform hover:translate-x-1 hover:text-[#FFC300] duration-500 ">Grading Core</a>
                <a href="#pricing" className="block transition-transform hover:translate-x-1 hover:text-[#FFC300] duration-500 ">Admissions Hub</a>
              </div>
            </div>

            <div className="pt-8">
  <h4 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#FFC300]">
    Reach Stackable
  </h4>

  <div className="mt-5 space-y-4 text-sm text-white/70">
    <p
      
      className="group flex items-center gap-3 hover:text-[#FFC300]"
    >
      <Mail className="h-4 w-4 shrink-0" />
      <a href="mailto:hello@stackable.co.ke" className="hover:text-[#FFC300] transition-all duration-500">hello@stackable.co.ke</a>
    </p>

    <div className="flex items-center gap-3">
      <MapPin className="h-4 w-4 shrink-0 text-white/70" />
      <span>Nairobi, Kenya</span>
    </div>

    <p
      
      className="group flex items-center gap-3 hover:text-[#FFC300] transition-all duration-500"
    >
      <Phone className="h-4 w-4 shrink-0" />
      <span>Hotline: <a href="tel:+254700123456" className="hover:text-[#FFC300] transition-all duration-500 hover:translate-x-1">+254 700 123 456</a></span>
    </p>

    <div className="footer-social pt-4">
      <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/45">
        Socials
      </p>

      <div className="footer-social-icon-grid space-x-3 flex gap-3.5 items-center h-auto align-middle pt-1">
        <a
          href="https://youtube.com/@stackable"
          target="_blank"
          rel="noopener noreferrer"
          className="group footer-social-icon flex items-center gap-3 transition-colors duration-500 hover:text-[#FFC300]"
        >
          <Icon icon="mingcute:youtube-fill" width="24" height="24" className="w-5 h-5 shrink-0"/>
          
        </a>

        <a
          href="https://facebook.com/stackable"
          target="_blank"
          rel="noopener noreferrer"
          className="group footer-social-icon flex items-center gap-3 transition-colors duration-500 hover:text-[#FFC300]"
        >
          <Icon icon="gg:facebook" width="24" height="24" className="h-5 w-5 shrink-0"/>
        </a>

        <a
          href="https://linkedin.com/company/stackable"
          target="_blank"
          rel="noopener noreferrer"
          className="group footer-social-icon flex items-center gap-3 transition-colors duration-500 hover:text-[#FFC300]"
        >
          <Icon icon="ri:linkedin-fill" width="24" height="24" className="h-5 w-5 shrink-0"/>
        </a>

        <a
          href="https://instagram.com/stackable"
          target="_blank"
          rel="noopener noreferrer"
          className="group footer-social-icon flex items-center gap-3 transition-colors duration-500 hover:text-[#FFC300]"
        >
          <Icon icon="mdi:instagram" width="24" height="24" className="w-5 h-5 shrink-0"/>
        </a>
      </div>
    </div>
  </div>
</div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#FFC300]">Legal</h4>
              <div className="mt-5 space-y-3 text-sm text-white/70 duration-500 ">
                <a href="#story" className="block transition-transform hover:translate-x-1 hover:text-[#FFC300] duration-500  ">Institutional Privacy</a>
                <a href="#library" className="block transition-transform hover:translate-x-1 hover:text-[#FFC300] duration-500 ">Governance</a>
                <a href="#pricing" className="block transition-transform hover:translate-x-1 hover:text-[#FFC300] duration-500 ">Academic Standards</a>
              </div>
            </div>
          </div>

            
          </div>

          <div className="mt-14 flex flex-col justify-between gap-4 border-t text-center border-white/10 pt-8 text-xs uppercase tracking-[0.12em] text-white/45 md:flex-row items-center">
            <p className="text-white/70">© {year} Stackable. All rights reserved.</p>
            <div className="flex items-center text-center flex-wrap gap-5 justify-center">
              <a href="#" className="hover:text-[#FFC300] duration-300">Privacy Policy</a>
              <a href="#" className="hover:text-[#FFC300] duration-300">Terms of Service</a>
              <a href="#" className="hover:text-[#FFC300] duration-300">Cookie Policy</a>
              <a href="#" className="hover:text-[#FFC300] duration-300">Legal</a>
            </div>
          </div>
        </div>
      </footer>
  );
}