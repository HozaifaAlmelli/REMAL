"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";

export default function ROICalculator() {
  const [nights, setNights] = useState(15);
  const [rate, setRate] = useState(2500);
  const [animatedRevenue, setAnimatedRevenue] = useState(0);
  const { lang, dir } = useLang();

  const totalRevenue = nights * rate;

  useEffect(() => {
    let start = animatedRevenue;
    const end = totalRevenue;
    if (start === end) return;
    const steps = 30;
    let current = start;
    const increment = (end - start) / steps;
    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        setAnimatedRevenue(end);
        clearInterval(timer);
      } else {
        setAnimatedRevenue(Math.ceil(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [totalRevenue]);

  const labels = {
    ar: {
      heading: "احسب العائد المتوقع لوحدتك",
      sub: "تسعير ذكي وإشغال مدروس يعني عائداً شهرياً أقوى",
      rateLabel: "متوسط سعر الليلة (جنيه)",
      rateUnit: "ج.م",
      nightsLabel: "ليالي الإشغال المتوقعة شهرياً",
      nightsUnit: "ليلة",
      note: "* الأرقام تقريبية وتعتمد على الوحدة والموقع والسوق.",
      resultLabel: "العائد الشهري المتوقع",
      currency: "ج.م",
      cta: "اطلب تقييم فعلي لوحدتك",
    },
    en: {
      heading: "Calculate Your Expected Monthly Revenue",
      sub: "Smart pricing and managed occupancy means stronger monthly returns",
      rateLabel: "Average Nightly Rate (EGP)",
      rateUnit: "EGP",
      nightsLabel: "Expected Occupied Nights / Month",
      nightsUnit: "nights",
      note: "* Figures are estimates based on property, location, and market conditions.",
      resultLabel: "Expected Monthly Revenue",
      currency: "EGP",
      cta: "Request an Actual Property Evaluation",
    },
  };
  const l = labels[lang];

  return (
    <section dir={dir} className="py-24 bg-white text-kaza-navy relative overflow-hidden">
      <div className="container mx-auto px-6 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold font-serif mb-4">{l.heading}</h2>
          <p className="text-xl text-gray-600">{l.sub}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-3xl shadow-2xl p-8 lg:p-12 border border-gray-100 flex flex-col lg:flex-row gap-12"
        >
          <div className="flex-1 space-y-10">
            <div>
              <div className="flex justify-between mb-2 font-bold">
                <span>{l.rateLabel}</span>
                <span className="text-kaza-gold">{rate.toLocaleString()} {l.rateUnit}</span>
              </div>
              <input
                type="range" min="1000" max="50000" step="500"
                value={rate} onChange={(e) => setRate(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-kaza-gold"
              />
            </div>
            <div>
              <div className="flex justify-between mb-2 font-bold">
                <span>{l.nightsLabel}</span>
                <span className="text-kaza-gold">{nights} {l.nightsUnit}</span>
              </div>
              <input
                type="range" min="5" max="30" step="1"
                value={nights} onChange={(e) => setNights(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-kaza-gold"
              />
            </div>
            <p className="text-sm text-gray-500 italic mt-6">{l.note}</p>
          </div>

          <div className="flex-1 bg-kaza-navy rounded-2xl p-8 text-white flex flex-col items-center justify-center text-center">
            <h3 className="text-xl opacity-80 mb-2">{l.resultLabel}</h3>
            <div className="text-5xl lg:text-6xl font-bold font-serif text-kaza-gold mb-6 shrink-0 h-16">
              {animatedRevenue.toLocaleString()} <span className="text-2xl text-kaza-pearl">{l.currency}</span>
            </div>
            <button className="w-full bg-white hover:bg-gray-100 text-kaza-navy font-bold py-4 px-8 rounded-full transition-all duration-300 transform hover:scale-105">
              {l.cta}
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
