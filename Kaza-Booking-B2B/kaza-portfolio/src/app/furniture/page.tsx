"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLang, copy } from "@/context/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CheckCircle2, ArrowLeft, ArrowRight, X, ChevronLeft, ChevronRight, Eye } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const SECTOR_KEY = "furniture";
const HERO_IMAGE = "/kaza-furniture/kaza-furniture-1.jpeg";
const MAIN_IMAGE = "/kaza-furniture/kaza-furniture-2.jpeg";

const GALLERY_IMAGES = Array.from({ length: 27 }, (_, i) => `/kaza-furniture/kaza-furniture-${i + 1}.jpeg`);
const PEGASUS_GALLERY_IMAGES = [
  "/pegasus-kitchen/pegasus/KITCHEN-page4-image1.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page5-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page5-image4.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page6-image1.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page7-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page7-image4.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page8-image1.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page9-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page9-image4.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page10-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page11-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page12-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page13-image1.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page14-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page15-image1.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page16-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page17-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page18-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page19-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page19-image4.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page20-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page21-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page22-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page22-image4.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page23-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page23-image4.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page24-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page25-image2.jpg",
  "/pegasus-kitchen/pegasus/KITCHEN-page26-image2.jpg"
];

export default function FurniturePage() {
  const [mounted, setMounted] = useState(false);
  
  // Kaza Gallery States
  const [kazaVisibleCount, setKazaVisibleCount] = useState(8);
  const [activeKazaIndex, setActiveKazaIndex] = useState<number | null>(null);
  
  // Pegasus Gallery States
  const [pegasusVisibleCount, setPegasusVisibleCount] = useState(8);
  const [activePegasusIndex, setActivePegasusIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const { lang, dir } = useLang();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    const ctx = gsap.context(() => {
      // Parallax Hero
      gsap.to(".sector-hero-bg", {
        y: "20%",
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      // Metrics counter staggered fade-in up
      gsap.fromTo(".metric-card",
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ".metrics-grid",
            start: "top 85%",
            toggleActions: "play none none none"
          }
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [mounted]);

  // Handle keyboard events for Kaza lightbox
  useEffect(() => {
    if (activeKazaIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveKazaIndex(null);
      } else if (e.key === "ArrowRight") {
        setActiveKazaIndex((prev) => (prev !== null ? (prev + 1) % GALLERY_IMAGES.length : null));
      } else if (e.key === "ArrowLeft") {
        setActiveKazaIndex((prev) => (prev !== null ? (prev - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length : null));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeKazaIndex]);

  // Handle keyboard events for Pegasus lightbox
  useEffect(() => {
    if (activePegasusIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActivePegasusIndex(null);
      } else if (e.key === "ArrowRight") {
        setActivePegasusIndex((prev) => (prev !== null ? (prev + 1) % PEGASUS_GALLERY_IMAGES.length : null));
      } else if (e.key === "ArrowLeft") {
        setActivePegasusIndex((prev) => (prev !== null ? (prev - 1 + PEGASUS_GALLERY_IMAGES.length) % PEGASUS_GALLERY_IMAGES.length : null));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePegasusIndex]);

  const triggerResize = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("resize"));
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-kaza-navy flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-kaza-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  const t = copy[lang];
  const sectorData = ((t as any).sectors?.[SECTOR_KEY]) || {};
  const features = sectorData.features || [];

  return (
    <main dir={dir} className="min-h-screen bg-kaza-pearl text-kaza-navy flex flex-col justify-between">
      <div>
        <Header />

        {/* Parallax Hero */}
        <section ref={containerRef} className="relative h-[60vh] w-full overflow-hidden flex items-center justify-center pt-20">
          <div className="sector-hero-bg absolute inset-0 z-0 w-full h-[120%] -top-[10%]">
            <div className="absolute inset-0 bg-gradient-to-b from-kaza-navy/85 via-kaza-navy/60 to-kaza-navy/90 z-10" />
            <Image
              src={HERO_IMAGE}
              alt={sectorData.title || "KAZA Furniture"}
              fill
              priority
              className="object-cover object-center"
              sizes="100vw"
            />
          </div>

          <div className="relative z-20 flex flex-col items-center max-w-4xl mx-auto px-6 text-center text-kaza-pearl">
            <motion.span
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-4 inline-block px-4 py-1 rounded-full border border-kaza-gold/30 bg-kaza-gold/15 text-kaza-gold text-xs font-semibold tracking-wider uppercase"
            >
              {lang === "ar" ? "قطاعات KAZA المميزة" : "KAZA Specialized Sectors"}
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 font-serif leading-tight drop-shadow-md"
            >
              {sectorData.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="max-w-2xl text-base md:text-lg leading-relaxed text-gray-200"
            >
              {sectorData.heroSubtitle}
            </motion.p>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-20 lg:py-24">
          <div className="container mx-auto px-6 lg:px-12 max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Copywriting */}
              <motion.div
                initial={{ opacity: 0, x: dir === "rtl" ? 40 : -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
              >
                <span className="text-kaza-gold text-xs font-bold uppercase tracking-widest block mb-3">
                  {lang === "ar" ? "عن الخدمة التشغيلية" : "Operational Overview"}
                </span>
                <h2 className="text-3xl lg:text-4xl font-bold font-serif mb-6 text-kaza-navy leading-tight">
                  {lang === "ar"
                    ? `إعادة تعريف خدمات ${sectorData.title} بمعايير فندقية`
                    : `Redefining ${sectorData.title} with luxury hotel-grade operations`}
                </h2>
                <p className="text-gray-600 text-lg leading-relaxed mb-8">
                  {sectorData.aboutSection}
                </p>

                <ul className="space-y-4">
                  {features.map((feature: string, idx: number) => (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0, x: dir === "rtl" ? -15 : 15 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-start gap-3.5 text-gray-700"
                    >
                      <CheckCircle2 className="w-5.5 h-5.5 text-kaza-gold shrink-0 mt-0.5" />
                      <span className="text-base md:text-lg leading-relaxed">{feature}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>

              {/* Imagery */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="relative aspect-video lg:aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border border-kaza-gold/25"
              >
                <Image
                  src={MAIN_IMAGE}
                  alt={sectorData.title || "KAZA Furniture"}
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-700"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  onLoad={triggerResize}
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Dynamic Gallery Showcase */}
        <section className="py-16 lg:py-24 bg-kaza-navy text-kaza-pearl">
          <div className="container mx-auto px-6 lg:px-12 max-w-7xl">
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <span className="text-kaza-gold text-xs font-bold uppercase tracking-widest block mb-3">
                {lang === "ar" ? "معرض التصاميم" : "Design Showcase"}
              </span>
              <h2 className="text-3xl lg:text-5xl font-bold font-serif mb-4 text-white">
                {lang === "ar" ? "معرض كازا للأثاث" : "KAZA Furniture Gallery"}
              </h2>
              <p className="text-gray-400 text-sm md:text-base leading-relaxed">
                {lang === "ar"
                  ? "تصفح مجموعة من أرقى وحدات كازا المجهزة بأحدث تصاميم وتجهيزات كازا للأثاث الفاخر."
                  : "Explore our curated collection of premium units furnished with luxury KAZA designs and custom setups."}
              </p>
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
              <AnimatePresence>
                {GALLERY_IMAGES.slice(0, kazaVisibleCount).map((imgUrl, index) => (
                  <motion.div
                    key={imgUrl}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4 }}
                    className="group relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-kaza-navy-light cursor-pointer shadow-lg hover:shadow-2xl"
                    onClick={() => setActiveKazaIndex(index)}
                  >
                    <Image
                      src={imgUrl}
                      alt={`KAZA Furniture ${index + 1}`}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      onLoad={triggerResize}
                    />
                    <div className="absolute inset-0 bg-kaza-navy/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="bg-kaza-gold text-kaza-navy p-3 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-md">
                        <Eye className="w-5 h-5" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Load More Button */}
            {kazaVisibleCount < GALLERY_IMAGES.length && (
              <div className="text-center mt-12">
                <button
                  onClick={() => setKazaVisibleCount((prev) => Math.min(prev + 8, GALLERY_IMAGES.length))}
                  className="bg-transparent hover:bg-kaza-gold text-kaza-gold hover:text-kaza-navy border border-kaza-gold hover:border-kaza-gold-light font-bold px-8 py-3.5 rounded-full transition-all duration-300 inline-flex items-center gap-2 transform hover:-translate-y-0.5"
                >
                  <span>{lang === "ar" ? "عرض المزيد من التصاميم" : "Show More Designs"}</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Pegasus Kitchens & Dressings Section */}
        <section className="py-20 lg:py-32 bg-kaza-pearl text-kaza-navy relative overflow-hidden border-t border-gray-100">
          <div className="container mx-auto px-6 lg:px-12 max-w-7xl">
            
            {/* Hero/Introduction Block */}
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-center mb-24">
              {/* Left Column: Brand Info */}
              <motion.div
                className="lg:col-span-5"
                initial={{ opacity: 0, x: dir === "rtl" ? 40 : -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                <span className="text-kaza-gold text-xs font-bold uppercase tracking-widest block mb-3">
                  {lang === "ar" ? "بيجاسوس هوم" : "Pegasus Home Partner"}
                </span>
                <h2 className="text-3xl lg:text-5xl font-bold font-serif mb-6 text-kaza-navy leading-tight">
                  {t.pegasusSection.overview.title}
                </h2>
                <p className="text-gray-655 text-base md:text-lg leading-relaxed mb-8">
                  {t.pegasusSection.overview.description}
                </p>

                {/* Commitments List */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-kaza-gold shrink-0 mt-1" />
                    <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                      {t.pegasusSection.commitments.productionScale}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-kaza-gold shrink-0 mt-1" />
                    <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                      {t.pegasusSection.commitments.hub}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-kaza-gold shrink-0 mt-1" />
                    <p className="text-sm md:text-base text-gray-700 leading-relaxed font-semibold">
                      {t.pegasusSection.commitments.turnaround}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-kaza-gold shrink-0 mt-1" />
                    <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                      {t.pegasusSection.commitments.qa}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Right Column: Hero Visual and Slogan */}
              <motion.div
                className="lg:col-span-7 flex flex-col gap-6"
                initial={{ opacity: 0, x: dir === "rtl" ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                <div className="relative aspect-[16/9] w-full rounded-3xl overflow-hidden shadow-2xl border border-kaza-gold/20 bg-gray-50">
                  <Image
                    src="/pegasus-kitchen/pegasus/KITCHEN-page8-image1.jpg"
                    alt={t.pegasusSection.overview.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    loading="lazy"
                    onLoad={triggerResize}
                  />
                </div>
                <div className="text-center lg:text-end italic text-kaza-navy/70 text-base md:text-lg font-serif">
                  &ldquo;{t.pegasusSection.philosophies.transformation}&rdquo;
                </div>
              </motion.div>
            </div>

            {/* Philosophy & Social Proof Dashboard */}
            <div className="metrics-grid grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-24">
              {/* Counter Card 1 */}
              <div className="metric-card bg-white p-8 rounded-3xl border border-gray-100 shadow-lg flex flex-col justify-center items-center text-center relative overflow-hidden group hover:border-kaza-gold/30 transition-all duration-300">
                <span className="text-kaza-gold text-xs font-bold uppercase tracking-widest mb-3 block">
                  {t.pegasusSection.metrics.audienceLabel}
                </span>
                <span className="text-3xl lg:text-4xl font-bold font-serif text-kaza-navy mb-4 block">
                  {t.pegasusSection.metrics.audienceVal}
                </span>
                <p className="text-gray-500 text-sm italic">
                  {t.pegasusSection.slogans.modernLiving}
                </p>
              </div>

              {/* Counter Card 2 */}
              <div className="metric-card bg-gradient-to-br from-kaza-navy to-kaza-navy-light text-white p-8 rounded-3xl shadow-lg flex flex-col justify-center items-center text-center relative overflow-hidden group border border-white/5 transition-all duration-300">
                <span className="text-kaza-gold text-xs font-bold uppercase tracking-widest mb-3 block">
                  {t.pegasusSection.metrics.outputLabel}
                </span>
                <span className="text-3xl lg:text-4xl font-bold font-serif text-white mb-4 block">
                  {t.pegasusSection.metrics.outputVal}
                </span>
                <p className="text-gray-300 text-sm italic">
                  {t.pegasusSection.slogans.styleMeets}
                </p>
              </div>

              {/* Counter Card 3 */}
              <div className="metric-card bg-white p-8 rounded-3xl border border-gray-100 shadow-lg flex flex-col justify-center items-center text-center relative overflow-hidden group hover:border-kaza-gold/30 transition-all duration-300">
                <span className="text-kaza-gold text-xs font-bold uppercase tracking-widest mb-3 block">
                  {t.pegasusSection.metrics.satisfactionLabel}
                </span>
                <span className="text-3xl lg:text-4xl font-bold font-serif text-kaza-navy mb-4 block">
                  {t.pegasusSection.metrics.satisfactionVal}
                </span>
                <p className="text-gray-500 text-sm italic">
                  {t.pegasusSection.slogans.kindServices}
                </p>
              </div>
            </div>

            {/* Lookbook Visual Grid */}
            <div className="mb-24">
              <div className="text-center mb-16 max-w-2xl mx-auto">
                <span className="text-kaza-gold text-xs font-bold uppercase tracking-widest block mb-3">
                  {lang === "ar" ? "كتالوج التصاميم والاستلهام" : "Design Lookbook"}
                </span>
                <h3 className="text-3xl lg:text-4xl font-bold font-serif text-kaza-navy mb-4">
                  {t.pegasusSection.philosophies.minimalist}
                </h3>
                <p className="text-gray-500 text-sm md:text-base">
                  {t.pegasusSection.philosophies.lighting}
                </p>
              </div>

              {/* Asymmetric Gallery Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 items-stretch">
                {/* Lookbook Item 1 */}
                <motion.div
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-kaza-navy-light shadow-xl aspect-[4/5] w-full"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  <Image
                    src="/pegasus-kitchen/pegasus/KITCHEN-page5-image2.jpg"
                    alt={t.pegasusSection.characteristics.lighting}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    sizes="(max-width: 768px) 100vw, 25vw"
                    loading="lazy"
                    onLoad={triggerResize}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-kaza-navy via-kaza-navy/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 select-none">
                    <p className="text-white text-xs md:text-sm font-medium leading-relaxed text-start">
                      {t.pegasusSection.characteristics.lighting}
                    </p>
                  </div>
                </motion.div>

                {/* Lookbook Item 2 */}
                <motion.div
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-kaza-navy-light shadow-xl aspect-square w-full lg:self-center"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <Image
                    src="/pegasus-kitchen/pegasus/KITCHEN-page7-image2.jpg"
                    alt={t.pegasusSection.characteristics.materials}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    sizes="(max-width: 768px) 100vw, 25vw"
                    loading="lazy"
                    onLoad={triggerResize}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-kaza-navy via-kaza-navy/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 select-none">
                    <p className="text-white text-xs md:text-sm font-medium leading-relaxed text-start">
                      {t.pegasusSection.characteristics.materials}
                    </p>
                  </div>
                </motion.div>

                {/* Lookbook Item 3 */}
                <motion.div
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-kaza-navy-light shadow-xl aspect-[4/5] w-full"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <Image
                    src="/pegasus-kitchen/pegasus/KITCHEN-page9-image2.jpg"
                    alt={t.pegasusSection.characteristics.hidden}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    sizes="(max-width: 768px) 100vw, 25vw"
                    loading="lazy"
                    onLoad={triggerResize}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-kaza-navy via-kaza-navy/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 select-none">
                    <p className="text-white text-xs md:text-sm font-medium leading-relaxed text-start">
                      {t.pegasusSection.characteristics.hidden}
                    </p>
                  </div>
                </motion.div>

                {/* Lookbook Item 4 */}
                <motion.div
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-kaza-navy-light shadow-xl aspect-square w-full lg:self-center"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <Image
                    src="/pegasus-kitchen/pegasus/KITCHEN-page11-image2.jpg"
                    alt={t.pegasusSection.characteristics.islands}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    sizes="(max-width: 768px) 100vw, 25vw"
                    loading="lazy"
                    onLoad={triggerResize}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-kaza-navy via-kaza-navy/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 select-none">
                    <p className="text-white text-xs md:text-sm font-medium leading-relaxed text-start">
                      {t.pegasusSection.characteristics.islands}
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Pegasus Gallery Showcase */}
            <div className="mb-24">
              <div className="text-center mb-16 max-w-2xl mx-auto">
                <span className="text-kaza-gold text-xs font-bold uppercase tracking-widest block mb-3">
                  {lang === "ar" ? "معرض مطابخ بيجاسوس" : "Pegasus Kitchens Showcase"}
                </span>
                <h3 className="text-3xl lg:text-4xl font-bold font-serif text-kaza-navy mb-4">
                  {lang === "ar" ? "معرض الصور الكامل للمشاريع" : "Complete Project Gallery"}
                </h3>
                <p className="text-gray-500 text-sm md:text-base">
                  {lang === "ar"
                    ? "تصفح الكتالوج الكامل والحلول المتكاملة للمطابخ وغرف الملابس الفاخرة المصنعة لبيجاسوس."
                    : "Browse the complete collection and integrated solutions for luxury kitchens and dressings manufactured by Pegasus."}
                </p>
              </div>

              {/* Pegasus Gallery Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
                <AnimatePresence>
                  {PEGASUS_GALLERY_IMAGES.slice(0, pegasusVisibleCount).map((imgUrl, index) => (
                    <motion.div
                      key={imgUrl}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.4 }}
                      className="group relative aspect-square rounded-2xl overflow-hidden border border-gray-150 bg-white cursor-pointer shadow-md hover:shadow-xl"
                      onClick={() => setActivePegasusIndex(index)}
                    >
                      <Image
                        src={imgUrl}
                        alt={`Pegasus Kitchen ${index + 1}`}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        onLoad={triggerResize}
                      />
                      <div className="absolute inset-0 bg-kaza-navy/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="bg-kaza-gold text-kaza-navy p-3 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-md">
                          <Eye className="w-5 h-5" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Pegasus Load More Button */}
              {pegasusVisibleCount < PEGASUS_GALLERY_IMAGES.length && (
                <div className="text-center mt-12">
                  <button
                    onClick={() => setPegasusVisibleCount((prev) => Math.min(prev + 8, PEGASUS_GALLERY_IMAGES.length))}
                    className="bg-transparent hover:bg-kaza-navy text-kaza-navy hover:text-kaza-pearl border border-kaza-navy hover:border-kaza-navy-light font-bold px-8 py-3.5 rounded-full transition-all duration-300 inline-flex items-center gap-2 transform hover:-translate-y-0.5"
                  >
                    <span>{lang === "ar" ? "عرض المزيد من تصاميم بيجاسوس" : "Show More Pegasus Designs"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Corporate Info Footer Strip */}
            <motion.div
              className="bg-kaza-navy text-kaza-pearl rounded-3xl p-8 lg:p-12 border border-white/10 shadow-2xl relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(197,160,89,0.1),transparent_50%)]" />
              <div className="relative z-10 grid lg:grid-cols-3 gap-8 items-center text-center lg:text-start">
                {/* Showroom Address */}
                <div className="flex flex-col gap-2">
                  <span className="text-kaza-gold text-xs font-bold uppercase tracking-wider">
                    {t.pegasusSection.contact.addressLabel}
                  </span>
                  <p className="text-sm md:text-base text-gray-300 leading-relaxed max-w-sm mx-auto lg:mx-0">
                    {t.pegasusSection.contact.addressVal}
                  </p>
                </div>
                
                {/* Direct Connection */}
                <div className="flex flex-col gap-2 text-center">
                  <span className="text-kaza-gold text-xs font-bold uppercase tracking-wider">
                    {lang === "ar" ? "اتصال مباشر" : "Direct Line"}
                  </span>
                  <a
                    href={`tel:${t.pegasusSection.contact.phone}`}
                    className="text-2xl font-bold font-serif hover:text-kaza-gold transition-colors tracking-wide inline-block"
                  >
                    {t.pegasusSection.contact.phone}
                  </a>
                </div>

                {/* Website Portal */}
                <div className="flex flex-col gap-2 text-center lg:text-end">
                  <span className="text-kaza-gold text-xs font-bold uppercase tracking-wider block">
                    {lang === "ar" ? "الموقع الإلكتروني" : "Official Website"}
                  </span>
                  <a
                    href={`https://${t.pegasusSection.contact.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center lg:justify-end gap-2 text-base font-medium hover:text-kaza-gold transition-colors"
                  >
                    <span>{t.pegasusSection.contact.website}</span>
                    {dir === "rtl" ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </a>
                </div>
              </div>
            </motion.div>

          </div>
        </section>

        {/* Kaza Lightbox Modal */}
        <AnimatePresence>
          {activeKazaIndex !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-kaza-navy/95 backdrop-blur-md flex items-center justify-center p-4 select-none"
              onClick={() => setActiveKazaIndex(null)}
            >
              {/* Close Button */}
              <button
                className="absolute top-6 right-6 text-white/80 hover:text-kaza-gold p-2 transition-colors cursor-pointer bg-white/5 rounded-full border border-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveKazaIndex(null);
                }}
                aria-label="Close Lightbox"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Prev Button */}
              <button
                className="absolute left-6 text-white/80 hover:text-kaza-gold p-3 transition-colors cursor-pointer bg-white/5 rounded-full border border-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveKazaIndex((prev) => (prev !== null ? (prev - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length : null));
                }}
                aria-label="Previous Image"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>

              {/* Next Button */}
              <button
                className="absolute right-6 text-white/80 hover:text-kaza-gold p-3 transition-colors cursor-pointer bg-white/5 rounded-full border border-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveKazaIndex((prev) => (prev !== null ? (prev + 1) % GALLERY_IMAGES.length : null));
                }}
                aria-label="Next Image"
              >
                <ChevronRight className="w-8 h-8" />
              </button>

              {/* Lightbox Content Container */}
              <div
                className="relative max-w-4xl max-h-[80vh] w-full h-full flex flex-col items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative w-full h-full">
                  <Image
                    src={GALLERY_IMAGES[activeKazaIndex]}
                    alt={`KAZA Furniture Design ${activeKazaIndex + 1}`}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    priority
                  />
                </div>
                {/* Caption / Progress */}
                <div className="absolute bottom-[-40px] text-center text-white">
                  <p className="text-sm font-medium tracking-wide">
                    {lang === "ar"
                      ? `تصميم كازا للأثاث ${activeKazaIndex + 1} من ${GALLERY_IMAGES.length}`
                      : `KAZA Furniture Design ${activeKazaIndex + 1} of ${GALLERY_IMAGES.length}`}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pegasus Lightbox Modal */}
        <AnimatePresence>
          {activePegasusIndex !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-kaza-navy/95 backdrop-blur-md flex items-center justify-center p-4 select-none"
              onClick={() => setActivePegasusIndex(null)}
            >
              {/* Close Button */}
              <button
                className="absolute top-6 right-6 text-white/80 hover:text-kaza-gold p-2 transition-colors cursor-pointer bg-white/5 rounded-full border border-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePegasusIndex(null);
                }}
                aria-label="Close Lightbox"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Prev Button */}
              <button
                className="absolute left-6 text-white/80 hover:text-kaza-gold p-3 transition-colors cursor-pointer bg-white/5 rounded-full border border-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePegasusIndex((prev) => (prev !== null ? (prev - 1 + PEGASUS_GALLERY_IMAGES.length) % PEGASUS_GALLERY_IMAGES.length : null));
                }}
                aria-label="Previous Image"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>

              {/* Next Button */}
              <button
                className="absolute right-6 text-white/80 hover:text-kaza-gold p-3 transition-colors cursor-pointer bg-white/5 rounded-full border border-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePegasusIndex((prev) => (prev !== null ? (prev + 1) % PEGASUS_GALLERY_IMAGES.length : null));
                }}
                aria-label="Next Image"
              >
                <ChevronRight className="w-8 h-8" />
              </button>

              {/* Lightbox Content Container */}
              <div
                className="relative max-w-4xl max-h-[80vh] w-full h-full flex flex-col items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative w-full h-full">
                  <Image
                    src={PEGASUS_GALLERY_IMAGES[activePegasusIndex]}
                    alt={`Pegasus Kitchen Design ${activePegasusIndex + 1}`}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    priority
                  />
                </div>
                {/* Caption / Progress */}
                <div className="absolute bottom-[-40px] text-center text-white">
                  <p className="text-sm font-medium tracking-wide">
                    {lang === "ar"
                      ? `تصميم بيجاسوس للمطابخ ${activePegasusIndex + 1} من ${PEGASUS_GALLERY_IMAGES.length}`
                      : `Pegasus Kitchen Design ${activePegasusIndex + 1} of ${PEGASUS_GALLERY_IMAGES.length}`}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA Banner */}
        <section className="pb-24 lg:pb-32">
          <div className="container mx-auto px-6 lg:px-12 max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-3xl bg-gradient-to-r from-kaza-navy to-kaza-navy-light text-white p-8 lg:p-14 text-center flex flex-col items-center relative overflow-hidden shadow-xl"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(197,160,89,0.15),transparent_60%)]" />
              
              <div className="relative z-10 flex flex-col items-center">
                <span className="text-kaza-gold text-xs font-semibold uppercase tracking-wider mb-4">
                  {lang === "ar" ? "ارفع أداء وحدتك اليوم" : "Elevate Your Asset Today"}
                </span>
                <h3 className="text-2xl md:text-3.5xl font-serif font-bold mb-4 leading-tight max-w-2xl">
                  {lang === "ar"
                    ? `هل ترغب في إدارة وتشغيل ${sectorData.title} لوحدتك باحترافية؟`
                    : `Partner with KAZA for premium ${sectorData.title} operations.`}
                </h3>
                <p className="text-white/80 max-w-xl text-sm md:text-base mb-8 leading-relaxed">
                  {lang === "ar"
                    ? "ابدأ بتزويدنا ببيانات عقارك، وسيتواصل معك فريق الشراكات والتقييم الفني لـ KAZA."
                    : "Request an initial operational evaluation. Our luxury hospitality specialists will guide you through onboarding."}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full sm:w-auto">
                  <Link
                    href="/#contact"
                    className="w-full sm:w-auto bg-kaza-gold hover:bg-kaza-gold-light text-kaza-navy font-bold px-8 py-3.5 rounded-full transition-all text-center inline-flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
                  >
                    <span>{sectorData.ctaText}</span>
                    {dir === "rtl" ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </Link>
                  <Link
                    href="/"
                    className="w-full sm:w-auto bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium px-8 py-3.5 rounded-full transition-all text-center"
                  >
                    {lang === "ar" ? "العودة للرئيسية" : "Back to Home"}
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  );
}
