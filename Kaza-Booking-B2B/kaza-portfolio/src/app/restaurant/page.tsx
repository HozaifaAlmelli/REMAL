"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLang, copy } from "@/context/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const SECTOR_KEY = "restaurant";
const IMAGE_URL = "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&q=80&w=1200";

export default function RestaurantPage() {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang, dir } = useLang();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    const ctx = gsap.context(() => {
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
    }, containerRef);

    return () => ctx.revert();
  }, [mounted]);

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
              src={IMAGE_URL}
              alt={sectorData.title || "Restaurant"}
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
              {lang === "ar" ? "قطاعات KAZA المميزه" : "KAZA Specialized Sectors"}
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
        <section className="py-20 lg:py-28">
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
                  src={IMAGE_URL}
                  alt={sectorData.title || "Restaurant"}
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-700"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </motion.div>
            </div>
          </div>
        </section>

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
