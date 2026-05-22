"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useLang, copy } from "@/context/LanguageContext";

// Hotel brands from the CV — hardcoded, language-agnostic
const BRANDS = [
  "Mövenpick",
  "InterContinental",
  "Crowne Plaza",
  "Holiday Inn",
  "Rotana",
  "Millennium",
  "Coral Sea",
  "Tolip Galala",
  "Palm Hills",
];

const STATS = [
  { value: "30+", label: { ar: "سنة خبرة تنفيذية", en: "Years of Executive Experience" } },
  { value: "9+", label: { ar: "علامة فندقية عالمية", en: "Major Hospitality Brands" } },
  { value: "5", label: { ar: "قارات: مصر · الشرق الأوسط · أفريقيا · أمريكا · أوروبا", en: "Regions: Egypt · Middle East · Africa · USA · Europe" } },
];

export default function LeadershipSection() {
  const { lang, dir } = useLang();
  const t = copy[lang];

  return (
    <section id="why-kaza" dir={dir} className="bg-kaza-navy py-24 lg:py-32 relative overflow-hidden">
      {/* Subtle luxury background texture */}
      <div
        className="absolute inset-0 opacity-[0.04] bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&q=80&w=2000')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-kaza-navy via-kaza-navy to-kaza-navy-light/60" />

      <div className="relative z-10 container mx-auto px-6 lg:px-12 max-w-6xl">

        {/* ── EYEBROW + HEADLINE ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-block px-4 py-1.5 rounded-full bg-kaza-gold/15 border border-kaza-gold/30 text-kaza-gold text-sm font-semibold mb-6">
            {t.leaderEyebrow}
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold font-serif text-white leading-tight max-w-3xl mx-auto">
            {t.leaderHeadline}
          </h2>
        </motion.div>

        {/* ── STATS ROW ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-4 lg:gap-8 mb-16 max-w-3xl mx-auto"
        >
          {STATS.map((s) => (
            <div key={s.value} className="text-center border border-kaza-gold/20 rounded-2xl px-4 py-5 bg-white/5 backdrop-blur-sm">
              <p className="text-3xl lg:text-4xl font-bold font-serif text-kaza-gold">{s.value}</p>
              <p className="text-white/60 text-xs mt-1 leading-snug">{s.label[lang]}</p>
            </div>
          ))}
        </motion.div>

        {/* ── MAIN CONTENT: image + bullets ── */}
        <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-20 mb-20">

          {/* Image Column */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9 }}
            className="w-full lg:w-[38%] relative"
          >
            <div className="relative rounded-3xl overflow-hidden border border-kaza-gold/20 shadow-2xl shadow-black/40 aspect-[4/5]">
              <img
                src="/mr-ashraf.png"
                alt="KAZA Leadership"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-kaza-navy/80 via-transparent to-transparent" />
              {/* Name card inside image */}
              <div className="absolute bottom-0 start-0 end-0 p-6">
                <p className="text-kaza-gold font-bold text-lg font-serif">Ashraf Khalil</p>
                <p className="text-white/70 text-sm">
                  {lang === "ar" ? "الشريك التنفيذي — خبرة فندقية دولية" : "Executive Partner — International Hospitality"}
                </p>
              </div>
            </div>
            {/* Floating quote badge */}
            <motion.div
              initial={{ opacity: 0, x: lang === "ar" ? 20 : -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="absolute top-6 lg:top-8 bg-kaza-gold/10 backdrop-blur-xl border border-kaza-gold/30 px-5 py-4 rounded-2xl max-w-[180px] shadow-xl"
              style={dir === "rtl" ? { left: "-48px" } : { right: "-48px" }}
            >
              <p className="text-white text-xs leading-relaxed italic">
                {lang === "ar"
                  ? '"وحدتك ليست إيجار — هي أصل ضيافة يستحق الإدارة الاحترافية."'
                  : '"Your property is not a rental — it\'s a hospitality asset that deserves professional management."'}
              </p>
            </motion.div>
          </motion.div>

          {/* Bullets Column */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="flex-1 text-white"
          >
            <p className="text-gray-300 text-lg leading-relaxed mb-10">
              {t.leaderBody}
            </p>
            <ul className="space-y-5">
              {t.leaderBullets.map((b, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: dir === "rtl" ? -24 : 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-4 text-gray-200 text-[15px] leading-relaxed"
                >
                  <CheckCircle2 className="w-5 h-5 text-kaza-gold shrink-0 mt-0.5" />
                  <span>{b}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* ── BRANDS STRIP ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="border-t border-white/10 pt-12"
        >
          <p className="text-center text-white/40 text-xs tracking-widest uppercase mb-8 font-semibold">
            {lang === "ar"
              ? "علامات عالمية عمل معها فريق قيادتنا التنفيذية مباشرةً"
              : "International brands our leadership has directly operated with"}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {BRANDS.map((brand, i) => (
              <motion.div
                key={brand}
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="px-5 py-2.5 rounded-full border border-kaza-gold/25 bg-kaza-gold/[0.08] text-kaza-gold/90 text-sm font-semibold tracking-wide hover:border-kaza-gold/60 hover:bg-kaza-gold/15 transition-all duration-300 cursor-default"
              >
                {brand}
              </motion.div>
            ))}
          </div>
          <p className="text-center text-white/25 text-xs mt-8 italic max-w-xl mx-auto">
            {lang === "ar"
              ? "* هذه العلامات تمثل خبرة قيادية داخل الفريق التنفيذي لـ KAZA، لا علاقة مؤسسية مباشرة بين KAZA وتلك الشركات."
              : "* These brands represent direct leadership experience within KAZA's executive team — not a formal corporate affiliation with KAZA."}
          </p>
        </motion.div>

      </div>
    </section>
  );
}
