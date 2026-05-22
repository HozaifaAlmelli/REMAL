"use client";

import { motion } from "framer-motion";
import { useLang, copy } from "@/context/LanguageContext";
import { CheckCircle2 } from "lucide-react";

export default function AuthorityStrip() {
  const { lang, dir } = useLang();
  const t = copy[lang];

  return (
    <section dir={dir} className="bg-kaza-navy py-16 border-y border-white/10">
      <div className="container mx-auto px-6 lg:px-12 max-w-6xl">
        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-kaza-gold font-serif text-xl lg:text-2xl font-bold mb-10"
        >
          {t.authorityTitle}
        </motion.h3>
        <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {t.authorityPoints.map((point, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-3 text-white/80 text-sm lg:text-base"
            >
              <CheckCircle2 className="w-5 h-5 text-kaza-gold shrink-0 mt-0.5" />
              <span>{point}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
