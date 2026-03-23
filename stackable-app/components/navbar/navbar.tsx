"use client";

import React, { useEffect, useRef, useState } from "react";
import { BookOpen,
  ChevronDown,
  Menu,
  Moon,
  Newspaper,
  Sun,
  X, } from "lucide-react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";

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

type NavLeafLink = {
  label: string;
  href: string;
};

type NavChildLink = NavLeafLink & {
  icon: React.ComponentType<{ className?: string }>;
};

type NavDropdownLink = {
  label: string;
  children: NavChildLink[];
};

type NavLink = NavLeafLink | NavDropdownLink;

export const navLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Our Story", href: "/our-story" },
  { label: "Contact Us", href: "/contact" },
  {
    label: "Resources",
    children: [
      { label: "Library", href: "/library", icon: BookOpen },
      { label: "Blog", href: "/blog", icon: Newspaper },
    ],
  },
  { label: "Academy", href: "/academy" },
  { label: "Benefits", href: "/benefits" },
  { label: "Pricing", href: "/pricing" },
];

function hasChildren(link: NavLink): link is NavDropdownLink {
  return "children" in link;
}



export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const dark = mounted && resolvedTheme === "dark";

  const toggleTheme = () => {
    setTheme(dark ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-[#08100d]/75">
      <div className="mx-auto flex items-center justify-between px-4 py-4 md:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
            <div className="hidden sm:block">
          <Image
            src={dark ?  "/logos/gardient-symbol.webp" : "/logos/stackable-symbol.webp" }
            alt="Stackable symbol"
            className="h-14 w-auto object-contain"
            width={1028}
            height={1028}
          />
          </div>
          <div className="sm:hidden block">
            <Image
              src={dark ? "/logos/gardient-symbol.webp" : "/logos/stackable-symbol.webp" }
              alt="Stackable Academy"
              className="h-12 w-auto object-contain"
              width={1028}
              height={1028}
            />
          </div>
          <span className="text-sm font-extrabold tracking-tight sm:hidden">
            Stackable
          </span>
        </Link>

        <nav className="hidden items-center gap-10 lg:gap-12.5 md:flex">
  {navLinks.map((link) => {
    if (hasChildren(link)) {
      return (
        <div key={link.label} className="group relative">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm font-medium tracking-tight text-[#355045] transition-colors hover:text-[#108548] dark:text-[#cad8cf] dark:hover:text-[#FFC300]"
          >
            <span>{link.label}</span>
            <ChevronDown className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
          </button>

          <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 w-56 -translate-x-1/2 opacity-0 transition-all duration-300 group-hover:pointer-events-auto group-hover:opacity-100">
            <div className="rounded-2xl border border-black/8 bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-[#101915]">
              {link.children.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#355045] transition-all duration-300 hover:bg-[#108548]/8 hover:text-[#108548] dark:text-[#d7e3dc] dark:hover:bg-white/5 dark:hover:text-[#FFC300]"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#108548]/10 text-[#108548] dark:bg-[#FFC300]/10 dark:text-[#FFC300]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return (
      <Link
        key={link.label}
        href={link.href}
        className="text-sm font-medium tracking-tight text-[#355045] transition-colors hover:text-[#108548] dark:text-[#cad8cf] dark:hover:text-[#FFC300]"
      >
        {link.label}
      </Link>
    );
  })}
</nav>

        <div className="items-center flex md:gap-10 right-0 relative">
          <div className="md:pr-12.5 md:ml-[-15px]">
        <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="inline-flex  h-11 w-11 items-center justify-center rounded-full border border-[#108548]/20 bg-white/65 text-[#108548] transition-all hover:border-[#FFC300] hover:bg-[#FFC300]/10 dark:border-white/10 dark:bg-white/5 dark:text-[#FFC300]"
          >
            {!mounted ? null : dark ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
          </div>

        <div className="hidden items-center gap-6 md:flex">

          
              <div className="inline-flex items-center gap-3">
            <a
              href="/login"
              className="rounded-full border border-[#108548] bg-transparent px-5 py-2.5 text-sm font-semibold text-[#108548] transition-all hover:border-[#FFC300] hover:bg-[#FFC300] hover:text-[#108548] dark:border-[#38c172] dark:text-[#86efac] dark:hover:border-[#FFC300] dark:hover:bg-[#FFC300] dark:hover:text-[#1B4332]"
            >
              Login
            </a>

            <a
              href="/login"
              className="rounded-full border border-[#108548] bg-[#108548] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(16,133,72,0.15)] transition-all hover:border-[#FFC300] hover:bg-[rgba(255,195,0,0.2)] hover:text-[#FFC300] hover:shadow-[0_0_0_1px_rgba(255,195,0,0.4),0_0_18px_rgba(255,195,0,0.28)]"
            >
              Get Started
            </a>
          </div>
        </div></div>
        
        

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
              {navLinks.map((link) => {
  if (hasChildren(link)) {
    return (
      <div key={link.label} className="rounded-xl border border-black/5 p-2 dark:border-white/10">
        <div className="mb-2 flex items-center gap-2 px-2 py-1 text-sm font-semibold text-[#355045] dark:text-[#d7e3dc]">
          <span>{link.label}</span>
          <ChevronDown className="h-4 w-4" />
        </div>

        <div className="flex flex-col gap-1">
          {link.children.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[#355045] transition-all duration-300 hover:bg-[#108548]/10 hover:text-[#108548] dark:text-[#d7e3dc]"
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Link
      key={link.label}
      href={link.href}
      onClick={() => setMenuOpen(false)}
      className="rounded-xl px-3 py-2 text-sm font-medium text-[#355045] transition-colors hover:bg-[#108548]/10 hover:text-[#108548] dark:text-[#d7e3dc]"
    >
      {link.label}
    </Link>
  );
})}

              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={toggleTheme}
                  className="hidden md:inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#108548]/20 bg-white/65 text-[#108548] dark:border-white/10 dark:bg-white/5 dark:text-[#FFC300]"
                >
                  {!mounted ? null : dark ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </button>

                <div className="inline-flex flex-1 items-center gap-3">
                  <a
                    href="/login"
                    className="flex-1 rounded-full border border-[#108548] px-4 py-3 text-center text-sm font-semibold text-[#108548] dark:text-[#9be4b3]"
                  >
                    Login
                  </a>
                  <a
                    href="/login"
                    className="flex-1 rounded-full border border-[#108548] bg-[#108548] px-4 py-3 text-center text-sm font-semibold text-white"
                  >
                    Get Started
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}



