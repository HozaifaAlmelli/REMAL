"use client";

import { motion } from "framer-motion";
import {
  Armchair,
  BarChart3,
  Building2,
  Camera,
  Globe,
  Handshake,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { useLang, copy } from "@/context/LanguageContext";

const serviceIcons = {
  launch: Building2,
  furnishing: Armchair,
  revenue: TrendingUp,
  channels: Globe,
  marketing: Camera,
  guest: Handshake,
  housekeeping: Sparkles,
  maintenance: Wrench,
  reporting: BarChart3,
};

export default function ServicesSection() {
  const { lang, dir } = useLang();
  const t = copy[lang];

  return (
    <section id="services" dir={dir} className="bg-white py-24 lg:py-32">
      <div className="container mx-auto px-6 lg:px-12 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 max-w-3xl mx-auto"
        >
          <div className="inline-block px-4 py-1.5 rounded-full bg-kaza-gold/10 border border-kaza-gold/30 text-kaza-gold text-sm font-semibold mb-5">
            {t.servicesEyebrow}
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold font-serif mb-5 text-kaza-navy leading-tight">
            {t.servicesHeadline}
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed">{t.servicesBody}</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {t.services.map((service, i) => {
            const Icon = serviceIcons[service.icon as keyof typeof serviceIcons] ?? Building2;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ y: -6, boxShadow: "0 20px 50px rgba(11,27,61,0.12)" }}
                className="group p-7 rounded-2xl border border-gray-100 bg-kaza-pearl hover:border-kaza-gold/30 transition-all duration-300 cursor-default"
              >
                <div className="mb-5 inline-flex items-center justify-center rounded-xl bg-kaza-gold/10 p-3 text-kaza-gold">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-kaza-navy font-bold font-serif text-lg mb-3 group-hover:text-kaza-gold transition-colors">{service.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{service.body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
