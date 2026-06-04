"use client";

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLang, copy } from "@/context/LanguageContext";
import { Calendar, Palmtree, Coffee, Utensils, Sofa } from "lucide-react";

interface SectorsDropdownProps {
  isOpen: boolean;
}

const SECTORS = [
  { key: "booking", href: "/booking", icon: Calendar },
  { key: "beach", href: "/beach", icon: Palmtree },
  { key: "breakfast", href: "/breakfast", icon: Coffee },
  { key: "restaurant", href: "/restaurant", icon: Utensils },
  { key: "furniture", href: "/furniture", icon: Sofa },
] as const;

export default function SectorsDropdown({ isOpen }: SectorsDropdownProps) {
  const { lang, dir } = useLang();
  const t = copy[lang];

  // Safeguard in case translations are not fully loaded during initial hydration
  const sectorsMenuData = (t as any).sectorsMenu || {};

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute top-full left-1/2 -translate-x-1/2 z-50 mt-2 w-72 rounded-xl bg-kaza-navy/95 backdrop-blur-md p-4 shadow-2xl border border-kaza-navy-light"
          role="menu"
          aria-label="Sectors Menu"
        >
          <div className="space-y-1">
            {SECTORS.map((sector) => {
              const Icon = sector.icon;
              const labelName = sectorsMenuData[sector.key] || sector.key;
              return (
                <Link
                  key={sector.key}
                  href={sector.href}
                  className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-white/80 transition-all hover:bg-white/10 hover:text-kaza-gold"
                  role="menuitem"
                >
                  <Icon className="h-4.5 w-4.5 shrink-0 text-kaza-gold" />
                  <span className="text-sm font-medium tracking-wide">
                    {labelName}
                  </span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
