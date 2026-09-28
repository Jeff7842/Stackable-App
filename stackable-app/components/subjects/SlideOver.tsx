"use client";

/**
 * SubjectSlideOver - thin adapter kept so existing import sites keep working
 * with the exact same props. All rendering is delegated to the shared Drawer
 * (components/ui/Drawer.tsx). New code should use <Drawer> directly.
 */
import type { ReactNode } from "react";
import { Drawer } from "@/components/ui/Drawer";

type SubjectSlideOverProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
};

export default function SubjectSlideOver({
  open,
  title,
  subtitle,
  onClose,
  children,
  widthClass = "max-w-[820px]",
}: SubjectSlideOverProps) {
  return (
    <Drawer open={open} onClose={onClose} title={title} subtitle={subtitle} widthClass={widthClass}>
      {children}
    </Drawer>
  );
}
