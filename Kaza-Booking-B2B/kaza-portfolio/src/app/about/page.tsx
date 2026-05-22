"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Building2,
  Crown,
  Eye,
  Flag,
  Gem,
  Goal,
  Handshake,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const aboutCopy = {
  ar: {
    heroEyebrow: "About KAZA",
    heroTitle: "نحن شركة تشغيل ضيافة واستثمار عقاري وليست مجرد إدارة حجوزات.",
    heroBody:
      "KAZA تدير الوحدات السكنية والساحلية كأصول ضيافة عالية الأداء عبر نظام تشغيل فندقي متكامل: تجهيز، تسويق، تسعير، إدارة ضيوف، جودة، وصيانة مستمرة.",
    aboutTitle: "من نحن",
    aboutBody:
      "KAZA شريك تشغيلي للملاك والمطورين العقاريين الذين يريدون تحويل وحداتهم إلى أصول ضيافة مربحة ومستدامة. نحن نربط بين عقلية الفنادق الفاخرة والانضباط التشغيلي والاستراتيجية الاستثمارية.",
    missionTitle: "رسالتنا",
    missionBody:
      "تمكين الملاك من تحقيق أعلى عائد ممكن من وحداتهم عبر إدارة تشغيلية شفافة، وحماية مستمرة للأصل العقاري، وتجربة ضيافة تليق بقيمة الوحدة.",
    visionTitle: "رؤيتنا",
    visionBody:
      "أن تصبح KAZA المرجع الأول في إدارة الضيافة العقارية الفاخرة في مصر، وأن نعيد تعريف تشغيل الوحدات الخاصة بمعايير مؤسسية تضاهي الفنادق العالمية.",
    pillarsTitle: "كيف نعمل",
    pillars: [
      {
        title: "تشغيل فندقي دقيق",
        body: "SOPs واضحة، جودة قابلة للقياس، وإدارة يومية منظمة من أول الحجز حتى المغادرة.",
        icon: Flag,
      },
      {
        title: "تعظيم الإيراد",
        body: "تسعير ديناميكي، توزيع متعدد القنوات، وتحسين مستمر لمعدلات الإشغال وRevPAR.",
        icon: TrendingUp,
      },
      {
        title: "حماية الأصل",
        body: "متابعة حالة الوحدة، صيانة وقائية وتصحيحية، وضبط جودة مستمر يحافظ على قيمة الاستثمار.",
        icon: ShieldCheck,
      },
      {
        title: "علاقة شراكة حقيقية",
        body: "شفافية كاملة في البيانات والتقارير، وقرارات تشغيل مبنية على أداء فعلي لا على التخمين.",
        icon: Handshake,
      },
    ],
    leadershipTitle: "القيادة التنفيذية",
    leadershipBody:
      "تستند KAZA إلى خبرة قيادية تتجاوز 30 عامًا في تشغيل الفنادق والمنتجعات الدولية، افتتاحات من الصفر، إعادة هيكلة، وإدارة محافظ متعددة المواقع عبر مصر والشرق الأوسط وأفريقيا.",
    valuesTitle: "قيمنا",
    values: [
      { title: "الاحتراف", icon: Crown },
      { title: "الشفافية", icon: Eye },
      { title: "الانضباط", icon: Goal },
      { title: "اللمسة الفاخرة", icon: Gem },
    ],
    ctaTitle: "جاهز ترفع قيمة وحدتك وتشغيلها بمعيار فندقي؟",
    ctaBody: "فريق KAZA يراجع حالة الوحدة، فرص الإيراد، وخطة التشغيل الأنسب قبل الإطلاق.",
    ctaPrimary: "اطلب تقييم وحدتك",
    ctaSecondary: "العودة للرئيسية",
  },
  en: {
    heroEyebrow: "About KAZA",
    heroTitle: "We are a hospitality operations and asset-performance company, not a booking middleman.",
    heroBody:
      "KAZA operates residential and coastal units as high-performing hospitality assets through an integrated hotel-grade system: setup, marketing, pricing, guest management, quality control, and maintenance.",
    aboutTitle: "Who We Are",
    aboutBody:
      "KAZA is an operating partner for owners and real-estate developers who want to turn private units into profitable, sustainable hospitality assets. We combine luxury-hotel discipline with investment-focused execution.",
    missionTitle: "Our Mission",
    missionBody:
      "Enable property owners to unlock stronger returns through transparent operations, continuous asset protection, and a premium guest experience that matches the value of the property.",
    visionTitle: "Our Vision",
    visionBody:
      "To become Egypt's leading benchmark in premium hospitality asset management and redefine private-unit operations with institutional standards comparable to global hotels.",
    pillarsTitle: "How We Deliver",
    pillars: [
      {
        title: "Hotel-Grade Operations",
        body: "Clear SOPs, measurable quality, and disciplined day-to-day execution from booking to checkout.",
        icon: Flag,
      },
      {
        title: "Revenue Growth",
        body: "Dynamic pricing, multi-channel distribution, and ongoing optimization of occupancy and RevPAR.",
        icon: TrendingUp,
      },
      {
        title: "Asset Protection",
        body: "Property condition tracking, preventive and corrective maintenance, and strict quality control.",
        icon: ShieldCheck,
      },
      {
        title: "Real Partnership",
        body: "Transparent reporting and data-backed operating decisions, not guesswork.",
        icon: Handshake,
      },
    ],
    leadershipTitle: "Executive Leadership",
    leadershipBody:
      "KAZA is grounded in 30+ years of hospitality leadership across international hotels and resorts, full openings, restructurings, and multi-property operations across Egypt, the Middle East, and Africa.",
    valuesTitle: "Our Values",
    values: [
      { title: "Professionalism", icon: Crown },
      { title: "Transparency", icon: Eye },
      { title: "Discipline", icon: Goal },
      { title: "Luxury Mindset", icon: Gem },
    ],
    ctaTitle: "Ready to elevate your property's value with hotel-grade execution?",
    ctaBody: "KAZA evaluates your unit's condition, revenue potential, and best-fit operating strategy before launch.",
    ctaPrimary: "Request Property Evaluation",
    ctaSecondary: "Back to Home",
  },
} as const;

export default function AboutPage() {
  const { lang, dir } = useLang();
  const t = aboutCopy[lang];
  return (
    <main dir={dir} className="min-h-screen bg-kaza-pearl text-kaza-navy">
      <Header />
      <section className="relative overflow-hidden bg-kaza-navy text-white py-24 lg:py-32">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,#C5A059_0%,transparent_35%),radial-gradient(circle_at_80%_30%,#1A2E5B_0%,transparent_40%)]" />
        <div className="relative container mx-auto px-6 lg:px-12 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-4xl"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-kaza-gold/40 bg-kaza-gold/10 text-kaza-gold text-sm font-semibold">
              <Building2 className="w-4 h-4" />
              {t.heroEyebrow}
            </span>
            <h1 className="mt-6 text-4xl lg:text-6xl font-bold font-serif leading-tight">{t.heroTitle}</h1>
            <p className="mt-6 text-lg text-white/80 leading-relaxed">{t.heroBody}</p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-24">
        <div className="container mx-auto px-6 lg:px-12 max-w-6xl grid lg:grid-cols-2 gap-8">
          <motion.article
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl bg-white p-8 border border-gray-100 shadow-xl"
          >
            <h2 className="text-3xl font-serif font-bold mb-4">{t.aboutTitle}</h2>
            <p className="text-gray-600 leading-relaxed text-lg">{t.aboutBody}</p>
          </motion.article>

          <div className="grid gap-6">
            <motion.article
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
              className="rounded-3xl bg-gradient-to-br from-kaza-navy to-kaza-navy-light p-7 text-white shadow-xl"
            >
              <div className="inline-flex items-center gap-2 text-kaza-gold font-semibold mb-3">
                <Goal className="w-5 h-5" />
                {t.missionTitle}
              </div>
              <p className="text-white/85 leading-relaxed">{t.missionBody}</p>
            </motion.article>

            <motion.article
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="rounded-3xl bg-white p-7 border border-kaza-gold/20 shadow-xl"
            >
              <div className="inline-flex items-center gap-2 text-kaza-gold font-semibold mb-3">
                <Sparkles className="w-5 h-5" />
                {t.visionTitle}
              </div>
              <p className="text-gray-600 leading-relaxed">{t.visionBody}</p>
            </motion.article>
          </div>
        </div>
      </section>

      <section className="py-8 lg:py-16">
        <div className="container mx-auto px-6 lg:px-12 max-w-6xl">
          <h2 className="text-3xl lg:text-4xl font-serif font-bold mb-8">{t.pillarsTitle}</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {t.pillars.map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <motion.article
                  key={pillar.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="rounded-2xl bg-white p-6 border border-gray-100 shadow-md hover:shadow-xl transition-shadow"
                >
                  <div className="inline-flex p-3 rounded-xl bg-kaza-gold/10 text-kaza-gold mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-serif font-bold mb-2">{pillar.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{pillar.body}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-24 bg-kaza-navy text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] bg-[url('/mr-ashraf.png')] bg-cover bg-center" />
        <div className="relative container mx-auto px-6 lg:px-12 max-w-6xl grid lg:grid-cols-[1.1fr_1fr] gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, x: dir === "rtl" ? 25 : -25 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl overflow-hidden border border-kaza-gold/30 shadow-2xl"
          >
            <img src="/mr-ashraf.png" alt="Ashraf Khalil" className="w-full h-full object-cover" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: dir === "rtl" ? -25 : 25 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-kaza-gold/15 border border-kaza-gold/35 text-kaza-gold text-sm mb-4">
              <Crown className="w-4 h-4" />
              {t.leadershipTitle}
            </span>
            <p className="text-lg text-white/85 leading-relaxed">{t.leadershipBody}</p>
          </motion.div>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-6 lg:px-12 max-w-6xl">
          <h2 className="text-3xl lg:text-4xl font-serif font-bold mb-8">{t.valuesTitle}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {t.values.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-2xl bg-white border border-gray-100 p-5 text-center shadow-md"
                >
                  <div className="mx-auto mb-3 inline-flex p-3 rounded-xl bg-kaza-gold/10 text-kaza-gold">
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="font-semibold text-kaza-navy">{item.title}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="container mx-auto px-6 lg:px-12 max-w-6xl">
          <div className="rounded-3xl bg-gradient-to-r from-kaza-navy to-kaza-navy-light text-white p-8 lg:p-12 flex flex-col lg:flex-row gap-6 lg:gap-8 items-start lg:items-center justify-between">
            <div>
              <h3 className="text-3xl font-serif font-bold mb-3">{t.ctaTitle}</h3>
              <p className="text-white/80 max-w-2xl">{t.ctaBody}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/#contact" className="bg-kaza-gold hover:bg-kaza-gold-light text-kaza-navy font-bold px-6 py-3 rounded-full transition-colors">
                {t.ctaPrimary}
              </Link>
              <Link href="/" className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-3 rounded-full transition-colors">
                {t.ctaSecondary}
              </Link>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
