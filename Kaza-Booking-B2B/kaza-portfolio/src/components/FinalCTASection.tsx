"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useLang, copy } from "@/context/LanguageContext";

export default function FinalCTASection() {
  const { lang, dir } = useLang();
  const t = copy[lang];

  const [formData, setFormData] = useState({
    name: "", phone: "", email: "", unitType: "", location: "", message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 50);
  }

  return (
    <section id="contact" dir={dir} className="bg-kaza-navy py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center opacity-5" />

      <div className="relative z-10 container mx-auto px-6 lg:px-12 max-w-6xl">
        <div className="flex flex-col lg:flex-row items-start gap-16 lg:gap-24">
          {/* Left: CTA Copy */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex-1 text-white"
          >
            <div className="inline-block px-4 py-1.5 rounded-full bg-kaza-gold/15 border border-kaza-gold/30 text-kaza-gold text-sm font-semibold mb-6">
              {t.ctaEyebrow}
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold font-serif mb-7 leading-tight">
              {t.ctaHeadline}
            </h2>
            <p className="text-gray-300 text-lg leading-relaxed mb-10">
              {t.ctaBody}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#contact-form"
                className="inline-block bg-kaza-gold hover:bg-kaza-gold-light text-kaza-navy font-bold py-4 px-10 rounded-full transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-kaza-gold/20 text-center"
              >
                {t.ctaCta1}
              </a>
              <a
                href="#"
                className="inline-block bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white font-bold py-4 px-10 rounded-full transition-all duration-300 text-center"
              >
                {t.ctaCta2}
              </a>
            </div>
            <p className="mt-6 text-white/40 text-xs max-w-sm leading-relaxed">{t.ctaMicrocopy}</p>
          </motion.div>

          {/* Right: Contact Form */}
          <motion.div
            id="contact-form"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex-1 w-full"
          >
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 lg:p-10">
              <h3 className="text-white font-serif font-bold text-2xl mb-7">{t.formTitle}</h3>

              {submitted ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">✅</div>
                  <p className="text-kaza-gold font-bold text-xl mb-2">{lang === "ar" ? "شكراً!" : "Thank you!"}</p>
                  <p className="text-gray-300">{lang === "ar" ? "سيتواصل معك فريقنا خلال 24 ساعة." : "Our team will contact you within 24 hours."}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input
                      required name="name" value={formData.name} onChange={handleChange}
                      placeholder={t.formName}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-kaza-gold/50 focus:bg-white/8 transition-all"
                    />
                    <input
                      required name="phone" value={formData.phone} onChange={handleChange}
                      placeholder={t.formPhone} type="tel"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-kaza-gold/50 transition-all"
                    />
                  </div>
                  <input
                    name="email" value={formData.email} onChange={handleChange}
                    placeholder={t.formEmail} type="email"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-kaza-gold/50 transition-all"
                  />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input
                      name="unitType" value={formData.unitType} onChange={handleChange}
                      placeholder={t.formUnitType}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-kaza-gold/50 transition-all"
                    />
                    <input
                      name="location" value={formData.location} onChange={handleChange}
                      placeholder={t.formLocation}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-kaza-gold/50 transition-all"
                    />
                  </div>
                  <textarea
                    name="message" value={formData.message} onChange={handleChange}
                    placeholder={t.formMessage} rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-kaza-gold/50 transition-all resize-none"
                  />
                  <button
                    type="submit"
                    className="w-full bg-kaza-gold hover:bg-kaza-gold-light text-kaza-navy font-bold py-4 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-kaza-gold/20"
                  >
                    {t.formSubmit}
                  </button>
                  <p className="text-center text-white/30 text-xs">{t.formPrivacy}</p>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
