"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { useLang, copy } from "@/context/LanguageContext";

export default function WhyKazaSection() {
  const { lang, dir } = useLang();
  const t = copy[lang];

  return (
    <section id="benefits" dir={dir} className="bg-kaza-pearl py-24 lg:py-32">
      <div className="container mx-auto px-6 lg:px-12 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14 max-w-3xl mx-auto"
        >
          <div className="inline-block px-4 py-1.5 rounded-full bg-kaza-navy/5 border border-kaza-navy/10 text-kaza-navy text-sm font-semibold mb-5">
            {t.whyEyebrow}
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold font-serif mb-5 text-kaza-navy leading-tight">
            {t.whyHeadline}
          </h2>
        </motion.div>

        {/* Comparison Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-lg">
          {/* Header Row */}
          <div className="grid grid-cols-[1fr_1fr] bg-kaza-navy text-white text-sm font-bold">
            <div className="p-4 text-center border-e border-white/10 text-red-300">{t.whyColOthers}</div>
            <div className="p-4 text-center text-kaza-gold">{t.whyColKaza}</div>
          </div>

          {/* Data Rows */}
          {t.whyRows.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: dir === "rtl" ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`grid grid-cols-[1fr_1fr] text-sm ${i % 2 === 0 ? "bg-white" : "bg-kaza-pearl/60"} hover:bg-kaza-gold/5 transition-colors border-t border-gray-100`}
            >
              <div className="p-4 text-center text-gray-500 flex items-center justify-center gap-1.5 border-e border-gray-100">
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{row.old}</span>
              </div>
              <div className="p-4 text-center text-kaza-navy font-medium flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-kaza-gold shrink-0" />
                <span>{row.kaza}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
