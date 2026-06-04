"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";
import { useLang, copy } from "@/context/LanguageContext";

gsap.registerPlugin(ScrollTrigger);

export default function HeroSection() {
  const container = useRef<HTMLDivElement>(null);
  const { lang, dir } = useLang();
  const t = copy[lang];

  function scrollToContactForm() {
    const target = document.querySelector("#contact-form");
    if (!target) return;
    const offset = 80;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  useEffect(() => {
    if (!container.current) return;
    const ctx = gsap.context(() => {
      gsap.to(".hero-bg", {
        y: "20%",
        ease: "none",
        scrollTrigger: {
          trigger: container.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true,
        }
      });
    }, container);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={container} dir={dir} className="relative h-screen w-full overflow-hidden flex items-center justify-center pt-20">
      <div className="hero-bg absolute inset-0 z-0 w-full h-[120%] -top-[10%]">
        <div className="absolute inset-0 bg-gradient-to-b from-kaza-navy/80 via-kaza-navy/55 to-kaza-navy/90 z-10" />
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero.png')" }}
        />
      </div>

      <div className="relative z-20 flex flex-col items-center max-w-5xl mx-auto px-6 text-center text-kaza-pearl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-5 inline-block px-5 py-1.5 rounded-full border border-kaza-gold/40 bg-kaza-gold/10 backdrop-blur-sm text-kaza-gold text-sm font-semibold tracking-wider"
        >
          {t.heroEyebrow}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 font-serif leading-tight drop-shadow-lg"
        >
          {lang === "ar" ? (
            <>حوّل وحدتك في العلمين أو الساحل إلى <span className="text-kaza-gold">أصل ضيافة مُدار باحتراف.</span></>
          ) : (
            <>Turn your premium property into a <span className="text-kaza-gold">professionally managed hospitality asset.</span></>
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="max-w-2xl text-base md:text-lg leading-relaxed mb-10 text-gray-200"
        >
          {t.heroSub}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
        >
          <button
            onClick={scrollToContactForm}
            className="w-full sm:w-auto bg-kaza-gold hover:bg-kaza-gold-light text-kaza-navy font-bold py-4 px-10 rounded-full transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-kaza-gold/20"
          >
            {t.heroCta1}
          </button>
          <button className="w-full sm:w-auto bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white font-bold py-4 px-10 rounded-full transition-all duration-300">
            {t.heroCta2}
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-8 text-xs text-white/50 max-w-lg leading-relaxed"
        >
          {t.heroTrust}
        </motion.p>
      </div>

      <div className="absolute bottom-0 w-full bg-kaza-navy/60 backdrop-blur-xl border-t border-white/10 py-4 z-20">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 font-serif text-xs tracking-widest text-kaza-gold/70 uppercase">
            <span className="text-white/40 text-xs">Executive Experience:</span>
            {t.authorityBrands.map((b) => <span key={b}>{b}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}
