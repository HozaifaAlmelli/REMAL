"use client";

import React from "react";
import Link from "next/link";
import { useLang, copy } from "@/context/LanguageContext";

export default function Footer() {
  const { lang, dir } = useLang();
  const t = copy[lang];

  const NAV_HREFS = ["#benefits", "#services", "#why-kaza", "/about", "#contact"];

  return (
    <footer dir={dir} className="bg-kaza-navy text-white mt-12">
      <div className="container mx-auto px-6 lg:px-12 py-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <div className="text-2xl font-serif font-bold tracking-widest">KAZA</div>
          <p className="mt-3 text-white/80 max-w-md text-sm">{t.heroSub || ""}</p>
        </div>

        <nav className="flex gap-6 flex-wrap">
          {t.navLinks.map((label, i) => {
            const href = NAV_HREFS[i] || "/";
            return (
              <Link key={label} href={href} className="text-sm text-white/80 hover:text-kaza-gold">
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="text-sm text-white/70">© {new Date().getFullYear()} KAZA. All rights reserved.</div>
      </div>
    </footer>
  );
}
