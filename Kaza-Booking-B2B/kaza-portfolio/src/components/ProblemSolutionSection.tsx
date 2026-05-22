"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { useLang, copy } from "@/context/LanguageContext";

export default function ProblemSolutionSection() {
  const { lang, dir } = useLang();
  const t = copy[lang];
  return (
    <section dir={dir} className="bg-kaza-pearl py-24 lg:py-32 relative overflow-hidden">
      <div className="container mx-auto px-6 lg:px-12 max-w-7xl">

        {/* PROBLEM */}
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24 mb-32">
          <motion.div
            initial={{ opacity: 0, x: dir === "rtl" ? 50 : -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="flex-1 w-full relative h-[40vh] lg:h-[60vh] order-2 lg:order-1"
          >
            <div className="absolute inset-0 bg-gray-200 rounded-3xl overflow-hidden shadow-2xl">
              <img src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=1000" alt="Problem" className="w-full h-full object-cover grayscale mix-blend-multiply opacity-80" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: dir === "rtl" ? -50 : 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="flex-1 order-1 lg:order-2"
          >
            <div className="inline-block px-4 py-1.5 rounded-full bg-red-100 text-red-700 text-sm font-semibold mb-6">
              {lang === "ar" ? "الواقع المؤلم" : "The Real Problem"}
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold font-serif mb-8 text-kaza-navy leading-tight">
              {t.problemHeadline}
            </h2>
            <ul className="space-y-5 mb-10">
              {t.problemPoints.map((p, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: dir === "rtl" ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-4 p-4 rounded-xl hover:bg-white transition-colors border border-transparent hover:border-gray-100 hover:shadow-sm text-lg text-gray-700"
                >
                  <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-1" />
                  <div>
                    <strong className="block text-gray-900 mb-1">{p.title}</strong>
                    {p.body}
                  </div>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* SOLUTION */}
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24 relative rounded-3xl bg-kaza-navy text-white p-8 lg:p-16 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center opacity-10 mix-blend-overlay" />

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="flex-1 z-10"
          >
            <div className="inline-block px-4 py-1.5 rounded-full bg-kaza-gold/20 border border-kaza-gold/30 text-kaza-gold text-sm font-semibold mb-6">
              {lang === "ar" ? "الحل الفندقي" : "The Hospitality Solution"}
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold font-serif mb-8 text-white leading-tight">
              {t.solutionHeadline}
            </h2>
            <ul className="space-y-5 mb-10">
              {t.solutionPoints.map((p, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: dir === "rtl" ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 text-lg text-gray-300"
                >
                  <CheckCircle2 className="w-6 h-6 text-kaza-gold shrink-0 mt-1" />
                  <div>
                    <strong className="block text-white mb-1">{p.title}</strong>
                    {p.body}
                  </div>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="flex-1 w-full relative h-[40vh] lg:h-[60vh] z-10"
          >
            <div className="absolute inset-0 bg-kaza-gold/20 rounded-2xl overflow-hidden shadow-2xl border border-kaza-gold/30">
              <img src="https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&q=80&w=1000" alt="Solution" className="w-full h-full object-cover" />
            </div>
            <div className="absolute bottom-4 inset-x-4 bg-kaza-navy/80 backdrop-blur-md rounded-xl p-3 text-center border border-kaza-gold/20">
              <p className="text-kaza-gold font-serif italic text-sm">{t.solutionPromise}</p>
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
}