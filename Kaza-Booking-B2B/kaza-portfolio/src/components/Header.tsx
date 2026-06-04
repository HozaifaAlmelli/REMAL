"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang, copy } from "@/context/LanguageContext";
import SectorsDropdown from "./SectorsDropdown";
import { Menu, X, ChevronDown } from "lucide-react";

// Matches navLinks order: Benefits, Services, Why KAZA, About, Contact
const NAV_HREFS = ["#benefits", "#services", "#why-kaza", "/about", "#contact"];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sectorsAccordionOpen, setSectorsAccordionOpen] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const { lang, toggleLang, dir } = useLang();
  const t = copy[lang];

  // Safeguard translation
  const sectorsLabel = (t as any).navSectors || "Sectors";
  const sectorsMenuData = (t as any).sectorsMenu || {};

  const sectorRoutes = ["/booking", "/beach", "/breakfast", "/restaurant", "/furniture"];
  const isSectorActive = sectorRoutes.includes(pathname);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle body scroll locking when mobile menu is active
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      if ((window as any).lenis) (window as any).lenis.stop();
    } else {
      document.body.style.overflow = "";
      if ((window as any).lenis) (window as any).lenis.start();
    }
    return () => {
      document.body.style.overflow = "";
      if ((window as any).lenis) (window as any).lenis.start();
    };
  }, [mobileMenuOpen]);

  // Close mobile menu if window resizes to desktop width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Debounced Hover Handlers for Desktop Dropdown
  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setDropdownOpen(true);
    }, 150);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setDropdownOpen(false);
    }, 150);
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      if (pathname === "/") {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          const offset = 80; // header height
          const top = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: "smooth" });
        }
      }
    }
  };

  const getLinkHref = (href: string) => {
    if (href.startsWith("#")) {
      return pathname === "/" ? href : `/${href}`;
    }
    return href;
  };

  // Structured links list for injection
  const desktopLinks = [
    { label: t.navLinks[0], href: NAV_HREFS[0] },
    { label: t.navLinks[1], href: NAV_HREFS[1] },
    { label: t.navLinks[2], href: NAV_HREFS[2] },
    { isSectors: true },
    { label: t.navLinks[3], href: NAV_HREFS[3] },
    { label: t.navLinks[4], href: NAV_HREFS[4] },
  ];

  const mobileSectors = [
    { key: "booking", label: sectorsMenuData.booking || "Booking", href: "/booking" },
    { key: "beach", label: sectorsMenuData.beach || "Beach", href: "/beach" },
    { key: "breakfast", label: sectorsMenuData.breakfast || "Breakfast", href: "/breakfast" },
    { key: "restaurant", label: sectorsMenuData.restaurant || "Restaurant", href: "/restaurant" },
    { key: "furniture", label: sectorsMenuData.furniture || "Furniture", href: "/furniture" },
  ];

  return (
    <>
      <motion.header
        dir={dir}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || mobileMenuOpen ? "bg-kaza-navy/95 backdrop-blur-md py-4 shadow-lg" : "bg-transparent py-6"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="text-2xl font-serif font-bold text-white tracking-widest cursor-pointer whitespace-nowrap">
            KAZA
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 2xl:gap-10 text-xs xl:text-sm font-medium text-white/90 whitespace-nowrap">
            {desktopLinks.map((item, i) => {
              if (item.isSectors) {
                return (
                  <div
                    key="sectors"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className="relative py-2"
                  >
                    <button
                      aria-haspopup="true"
                      aria-expanded={dropdownOpen}
                      className={`flex items-center gap-1 transition-colors cursor-pointer font-medium whitespace-nowrap ${
                        isSectorActive || dropdownOpen ? "text-kaza-gold" : "hover:text-kaza-gold text-white/90"
                      }`}
                    >
                      <span>{sectorsLabel}</span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          dropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <SectorsDropdown isOpen={dropdownOpen} />
                  </div>
                );
              }

              return (
                <a
                  key={item.label}
                  href={getLinkHref(item.href || "/")}
                  onClick={(e) => handleNavClick(e, item.href || "/")}
                  className={`hover:text-kaza-gold transition-colors cursor-pointer whitespace-nowrap ${
                    pathname === item.href ? "text-kaza-gold" : ""
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Portals & CTA */}
          <div className="flex items-center gap-3.5 xl:gap-5 shrink-0">
            {/* Language Toggle */}
            <button
              onClick={toggleLang}
              className="hidden sm:block text-white/70 hover:text-kaza-gold text-[10px] xl:text-xs font-bold tracking-widest border border-white/20 px-3 py-1.5 rounded-full transition-all hover:border-kaza-gold/50 whitespace-nowrap"
            >
              {lang === "ar" ? "EN" : "عربي"}
            </button>
            <a
              href="https://demo-3p09xh5p0-ravensolutions2-2927s-projects.vercel.app/owner-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:block text-white hover:text-kaza-gold text-xs xl:text-sm font-medium transition-colors whitespace-nowrap"
            >
              {t.navPortal}
            </a>
            <a
              href={pathname === "/" ? "#contact" : "/#contact"}
              onClick={(e) => handleNavClick(e, "#contact")}
              className="bg-kaza-gold hover:bg-kaza-gold-light text-kaza-navy px-5 py-2.5 rounded-full text-xs xl:text-sm font-bold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 whitespace-nowrap shrink-0"
            >
              {t.navCta}
            </a>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-white/90 hover:text-kaza-gold p-1 focus:outline-none"
              aria-label="Toggle Mobile Menu"
            >
              {mobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Nav Overlay Panel */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            dir={dir}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "100vh" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="fixed inset-0 z-40 bg-kaza-navy text-white pt-24 pb-8 px-6 flex flex-col justify-between overflow-y-auto lg:hidden"
          >
            <div className="flex flex-col gap-6 text-lg font-medium mt-4">
              {/* Standard mobile links */}
              <a
                href={getLinkHref(NAV_HREFS[0])}
                onClick={(e) => {
                  handleNavClick(e, NAV_HREFS[0]);
                  setMobileMenuOpen(false);
                }}
                className="hover:text-kaza-gold py-1.5 border-b border-white/5"
              >
                {t.navLinks[0]}
              </a>
              <a
                href={getLinkHref(NAV_HREFS[1])}
                onClick={(e) => {
                  handleNavClick(e, NAV_HREFS[1]);
                  setMobileMenuOpen(false);
                }}
                className="hover:text-kaza-gold py-1.5 border-b border-white/5"
              >
                {t.navLinks[1]}
              </a>
              <a
                href={getLinkHref(NAV_HREFS[2])}
                onClick={(e) => {
                  handleNavClick(e, NAV_HREFS[2]);
                  setMobileMenuOpen(false);
                }}
                className="hover:text-kaza-gold py-1.5 border-b border-white/5"
              >
                {t.navLinks[2]}
              </a>

              {/* Sectors Accordion */}
              <div className="border-b border-white/5 py-1.5">
                <button
                  onClick={() => setSectorsAccordionOpen(!sectorsAccordionOpen)}
                  className={`flex items-center justify-between w-full hover:text-kaza-gold font-medium text-lg ${
                    isSectorActive || sectorsAccordionOpen ? "text-kaza-gold" : ""
                  }`}
                >
                  <span>{sectorsLabel}</span>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform duration-200 ${
                      sectorsAccordionOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{
                    height: sectorsAccordionOpen ? "auto" : 0,
                    opacity: sectorsAccordionOpen ? 1 : 0,
                  }}
                  transition={{ duration: 0.3 }}
                  className={`overflow-hidden space-y-3 mt-3 border-white/10 ${
                    dir === "rtl" ? "border-r pr-4 pl-0" : "border-l pl-4 pr-0"
                  }`}
                >
                  {mobileSectors.map((sector) => (
                    <Link
                      key={sector.key}
                      href={sector.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block py-1 text-sm ${
                        pathname === sector.href ? "text-kaza-gold font-bold" : "text-white/70 hover:text-kaza-gold"
                      }`}
                    >
                      {sector.label}
                    </Link>
                  ))}
                </motion.div>
              </div>

              {/* Rest of standard mobile links */}
              <a
                href={getLinkHref(NAV_HREFS[3])}
                onClick={(e) => {
                  handleNavClick(e, NAV_HREFS[3]);
                  setMobileMenuOpen(false);
                }}
                className="hover:text-kaza-gold py-1.5 border-b border-white/5"
              >
                {t.navLinks[3]}
              </a>
              <a
                href={getLinkHref(NAV_HREFS[4])}
                onClick={(e) => {
                  handleNavClick(e, NAV_HREFS[4]);
                  setMobileMenuOpen(false);
                }}
                className="hover:text-kaza-gold py-1.5 border-b border-white/5"
              >
                {t.navLinks[4]}
              </a>
            </div>

            {/* Mobile Footer Area inside Drawer */}
            <div className="flex flex-col gap-5 mt-12 border-t border-white/10 pt-6">
              <a
                href="https://demo-3p09xh5p0-ravensolutions2-2927s-projects.vercel.app/owner-dashboard"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="text-white hover:text-kaza-gold text-base font-medium text-center"
              >
                {t.navPortal}
              </a>
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    toggleLang();
                    setMobileMenuOpen(false);
                  }}
                  className="text-white/80 hover:text-kaza-gold text-sm font-bold tracking-widest border border-white/20 px-5 py-2 rounded-full transition-all"
                >
                  {lang === "ar" ? "English Version" : "النسخة العربية"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}