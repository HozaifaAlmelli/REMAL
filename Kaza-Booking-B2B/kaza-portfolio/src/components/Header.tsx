"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { copy } from "@/context/LanguageContext";

// Matches navLinks order: Benefits, Services, Why KAZA, About, Contact
const NAV_HREFS = ["#benefits", "#services", "#why-kaza", "/about", "#contact"];

function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  // Hash links: smooth-scroll. Full-path links (e.g. /about) should navigate normally.
  if (href.startsWith("#")) {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      const offset = 80; // header height
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { lang, toggleLang, dir } = useLang();
  const t = copy[lang];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      dir={dir}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-kaza-navy/95 backdrop-blur-md py-4 shadow-lg" : "bg-transparent py-6"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="container mx-auto px-6 lg:px-12 flex justify-between items-center">
        {/* Logo */}
        <div className="text-2xl font-serif font-bold text-white tracking-widest">
          KAZA
        </div>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-white/90">
          {t.navLinks.map((link, i) => (
            <a
              key={link}
              href={NAV_HREFS[i]}
              onClick={(e) => handleNavClick(e, NAV_HREFS[i])}
              className="hover:text-kaza-gold transition-colors cursor-pointer"
            >
              {link}
            </a>
          ))}
        </nav>

        {/* Portals & CTA */}
        <div className="flex items-center gap-4">
          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            className="hidden sm:block text-white/70 hover:text-kaza-gold text-xs font-bold tracking-widest border border-white/20 px-3 py-1.5 rounded-full transition-all hover:border-kaza-gold/50"
          >
            {lang === "ar" ? "EN" : "عربي"}
          </button>
          <a
            href="https://demo-jade-beta.vercel.app/owner-dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:block text-white hover:text-kaza-gold text-sm font-medium transition-colors"
          >
            {t.navPortal}
          </a>
          <a
            href="#contact"
            onClick={(e) => handleNavClick(e, "#contact")}
            className="bg-kaza-gold hover:bg-kaza-gold-light text-kaza-navy px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            {t.navCta}
          </a>
        </div>
      </div>
    </motion.header>
  );
}