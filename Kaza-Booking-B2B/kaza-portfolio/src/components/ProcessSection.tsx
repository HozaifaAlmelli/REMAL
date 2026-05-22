"use client";

import { motion } from "framer-motion";
import { useLang, copy } from "@/context/LanguageContext";

export default function ProcessSection() {
  const { lang, dir } = useLang();
  const t = copy[lang];

  return (
    <section dir={dir} className="bg-white py-24 lg:py-32">
      <div className="container mx-auto px-6 lg:px-12 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 max-w-3xl mx-auto"
        >
          <div className="inline-block px-4 py-1.5 rounded-full bg-kaza-gold/10 border border-kaza-gold/30 text-kaza-gold text-sm font-semibold mb-5">
            {t.processEyebrow}
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold font-serif mb-5 text-kaza-navy leading-tight">
            {t.processHeadline}
          </h2>
        </motion.div>

        <div className="relative">
          {/* Connector line */}
          <div className="hidden lg:block absolute top-12 start-[4.5rem] end-[4.5rem] h-px bg-kaza-gold/20" />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {t.steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.1 }}
                className="relative group p-7 rounded-2xl border border-gray-100 bg-kaza-pearl hover:border-kaza-gold/40 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-kaza-gold font-serif text-4xl font-bold opacity-40 group-hover:opacity-80 transition-opacity">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="w-10 h-10 rounded-full bg-kaza-navy/5 group-hover:bg-kaza-gold/10 flex items-center justify-center transition-colors">
                    <div className="w-2.5 h-2.5 rounded-full bg-kaza-gold/60" />
                  </div>
                </div>
                <h3 className="text-kaza-navy font-bold font-serif text-lg mb-3 leading-snug">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
