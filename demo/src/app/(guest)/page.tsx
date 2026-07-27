"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { FeaturedUnits } from "@/components/sections/FeaturedUnits";
import {
  MapPin,
  ArrowRight,
  Video,
  ShieldCheck,
  Wallet,
  Sparkles,
  MessageSquare,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LeadForm } from "@/components/sections/LeadForm";

export default function HomePage() {
  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" as const },
    },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  return (
    <div className="w-full overflow-hidden bg-background">
      {/* 1. Hero Section - Premium Light Mode */}
      <section className="relative min-h-[100dvh] pt-32 pb-32 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[#f8f9fa]">
          <motion.video
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          >
            <source src="/hero.mp4" type="video/mp4" />
          </motion.video>
          {/* Subtle dark gradient overlay to frame the elements and give a premium feel */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
        </div>

        <div className="relative z-20 text-center px-4 sm:px-6 w-full max-w-5xl mx-auto flex flex-col items-center mt-8 md:mt-0">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex flex-col items-center w-full"
          >
            <motion.div
              variants={fadeInUp}
              className="mb-6 md:mb-8 overflow-hidden rounded-full p-[1px] bg-white/20 shadow-sm backdrop-blur-md"
            >
              <div className="bg-black/40 px-5 py-2 md:px-6 md:py-2 rounded-full flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500"></span>
                </span>
                <span className="text-white text-[11px] sm:text-xs lg:text-sm font-bold tracking-wide mt-1">
                  اكتشف الإقامة في الساحل الشمالي
                </span>
              </div>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[4rem] font-black text-white mb-5 md:mb-6 tracking-tight leading-[1.35] md:leading-[1.2] drop-shadow-md px-2"
            >
              وحدات مختارة في العلمين والساحل
              <br />
              <span className="text-brand-300">
                تشوفها بفيديو فعلي قبل ما تحجز
              </span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-sm sm:text-base md:text-xl text-gray-200 mb-8 md:mb-12 font-medium max-w-2xl leading-relaxed drop-shadow-md px-4"
            >
              ابعت تاريخك وعدد الأفراد وميزانيتك، ونرشحلك 2–3 وحدات مناسبة
              بتفاصيل واضحة قبل أي عربون.
            </motion.p>

            {/* CTAs - Funnel Aligned */}
            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full px-4 sm:px-0 justify-center items-center mb-10 md:mb-12"
            >
              <Link href="#qualify" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto rounded-[1.25rem] md:rounded-full px-10 md:px-12 h-14 md:h-16 text-base md:text-lg bg-brand-600 text-white hover:bg-brand-700 font-bold shadow-[0_12px_30px_rgba(0,0,0,0.15)] transition-all hover:scale-105 group border-none"
                >
                  رشّحلي وحدة مناسبة
                </Button>
              </Link>
              <Link
                href="https://wa.me/201000082960"
                target="_blank"
                className="w-full sm:w-auto"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto rounded-[1.25rem] md:rounded-full px-8 md:px-10 h-14 md:h-16 text-base md:text-lg font-bold transition-all group bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-5 h-5 text-[#25D366] group-hover:scale-110 transition-transform" />
                  <span>تواصل واتساب</span>
                </Button>
              </Link>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              variants={fadeInUp}
              className="flex flex-col md:flex-row justify-center items-center gap-4 text-white/90 text-xs sm:text-sm font-bold w-full max-w-4xl drop-shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-full backdrop-blur-sm border border-white/10">
                  <Video size={16} className="text-brand-300" />
                </div>
                <span>فيديو فعلي لنفس الوحدة</span>
              </div>
              <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-white/40"></div>
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-full backdrop-blur-sm border border-white/10">
                  <Wallet size={16} className="text-brand-300" />
                </div>
                <span>تفاصيل السعر بدقة</span>
              </div>
              <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-white/40"></div>
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-full backdrop-blur-sm border border-white/10">
                  <ShieldCheck size={16} className="text-brand-300" />
                </div>
                <span>ترشيح مناسب بدل عشوائية</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 2. Quick Qualification Form Section */}
      <section
        id="qualify"
        className="py-20 md:py-24 -mt-24 md:-mt-32 relative z-30"
      >
        <div className="container mx-auto px-6 max-w-4xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <LeadForm />
          </motion.div>
        </div>
      </section>

      {/* 3. Trust Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-black text-brand-950 mb-6 tracking-tight">
              قبل أي عربون، لازم تشوف التفاصيل بوضوح
            </h2>
            <p className="text-gray-500 text-lg font-medium">
              نحن نؤمن بالشفافية الكاملة. لا وعود وهمية، فقط إقامة موثقة
              بالتفاصيل.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: "فيديو فعلي",
                icon: Video,
                desc: "شوف نفس الوحدة اللي هتحجزها، مش صور عامة أو قديمة.",
              },
              {
                title: "تفاصيل السعر",
                icon: Wallet,
                desc: "نوضح السعر، العربون، وأي رسوم أو تأمين إن وجد قبل تأكيد الحجز.",
              },
              {
                title: "قواعد واضحة",
                icon: Shield,
                desc: "عدد الأفراد، check-in/out، وسياسة الإلغاء حسب كل وحدة.",
              },
              {
                title: "ترشيح مناسب",
                icon: Sparkles,
                desc: "مش هنبعتلك 20 اختيار؛ هنرشحلك الأنسب حسب تاريخك وميزانيتك.",
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUp}
                className="bg-surface p-8 rounded-[2rem] border border-brand-50 hover:shadow-soft transition-all text-center group"
              >
                <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand-900 border border-brand-100 group-hover:bg-brand-900 group-hover:text-white transition-colors">
                  <item.icon size={28} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-black text-brand-950 mb-4 tracking-tighter">
                  {item.title}
                </h3>
                <p className="text-gray-500 text-sm font-medium leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Problem Section */}
      <section className="py-24 bg-brand-50 relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
            >
              <h2 className="text-4xl md:text-5xl font-black text-brand-950 mb-6 leading-tight tracking-tighter">
                الحجز من الجروبات والسماسرة ممكن يبقى مرهق ومقلق
              </h2>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                صور كتير، أسعار مش واضحة، وحدات ممكن تكون مش متاحة، وقواعد بتظهر
                في آخر لحظة.
                <span className="block mt-4 font-bold text-brand-950">
                  Kaza Booking بتخلي الحجز أوضح: إقامة مختارة، فيديو فعلي،
                  تفاصيل واضحة، وخطوات منظمة.
                </span>
              </p>
              <Button
                size="lg"
                className="rounded-full px-10 bg-brand-900 hover:bg-brand-800 transition-colors text-white font-bold h-14 shadow-soft"
              >
                ابدأ بترشيح مناسب
              </Button>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="relative aspect-square bg-surface rounded-[3rem] p-4 shadow-premium"
            >
              <img
                src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2070&auto=format&fit=crop"
                className="w-full h-full object-cover rounded-[2.5rem]"
                alt="Problem solving"
              />
              <div className="absolute -bottom-6 -left-6 bg-accent-500 text-white p-6 rounded-3xl shadow-xl max-w-xs">
                <p className="font-bold text-sm">
                  «كنا قلقانين من صور السوشيال ميديا، بس Kaza Booking بعتتلنا
                  فيديو فعلي وريحونا جداً.»
                </p>
                <p className="text-[10px] uppercase tracking-widest font-black mt-2 opacity-80">
                  — عميل موثق
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 5. How Smar Works Section */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-black text-brand-950 mb-6">
              إزاي الحجز بيتم مع Kaza Booking؟
            </h2>
            <p className="text-gray-500 text-lg">
              خطوات بسيطة تضمن لك راحة البال قبل الوصول.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-16 gap-x-12">
            {[
              {
                id: 1,
                title: "ابعت تفاصيل رحلتك",
                desc: "التاريخ، عدد الأفراد، نوع الرحلة، والميزانية التقريبية.",
              },
              {
                id: 2,
                title: "نرشحلك 2–3 وحدات مناسبة",
                desc: "مش بنغرقك باختيارات كتير، بنرشح الأنسب حسب طلبك.",
              },
              {
                id: 3,
                title: "تستلم Trust Pack",
                desc: "فيديو فعلي، صور، تفاصيل السعر، القواعد، وتفاصيل الوصول.",
              },
              {
                id: 4,
                title: "تختار الوحدة المناسبة",
                desc: "بعد ما تشوف التفاصيل وتطمن وتتأكد إنها دي اللي محتاجها.",
              },
              {
                id: 5,
                title: "تأكد الحجز بالعربون",
                desc: "بعد توضيح كافة خطوات الدفع والتأكيد الرسمية.",
              },
              {
                id: 6,
                title: "متابعة حتى الوصول",
                desc: "نتابع معاك تفاصيل الـ check-in ونضمن استلامك للوحدة.",
              },
            ].map((step) => (
              <motion.div
                key={step.id}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUp}
                className="flex gap-6 items-start"
              >
                <div className="w-14 h-14 rounded-2xl bg-brand-900 text-white flex items-center justify-center font-black text-2xl shrink-0 shadow-soft">
                  {step.id}
                </div>
                <div className="pt-1">
                  <h3 className="text-xl font-bold text-brand-950 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-500 text-sm font-medium leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Featured Projects Section */}
      <section className="py-24 bg-brand-950 text-white overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6 text-right">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="max-w-2xl"
            >
              <h2 className="text-3xl md:text-5xl font-black mb-6">
                أهم مشروعات العلمين والساحل
              </h2>
              <p className="text-brand-200 text-lg">
                نرشح لك وحدات حسب تاريخك وميزانيتك من مشروعات مختارة.
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {[
              {
                id: "abraj",
                name: "أبراج العلمين",
                best: "كابلز • هاني مون • Premium",
                desc: "إقامات مناسبة لمن يبحث عن إطلالة وموقع مميز.",
                imgUrl:
                  "https://www.property-eg.com/wp-content/uploads/2025/12/%D8%A7%D8%A8%D8%B1%D8%A7%D8%AC-%D8%A7%D9%84%D8%B9%D9%84%D9%85%D9%8A%D9%86-%D8%A7%D9%84%D8%AC%D8%AF%D9%8A%D8%AF%D8%A9-%D9%85%D8%B4%D8%B1%D9%88%D8%B9-2.jpg",
              },
              {
                id: "mazarine",
                name: "مزارين",
                best: "عائلات صغيرة • إقامة هادئة",
                desc: "اختيارات مناسبة للعائلات والرحلات الهادية.",
                imgUrl:
                  "https://ipgegypt.com/storage/5cf/f9b/6e0/5cff9b6e0a77d793062295.jpg",
              },
              {
                id: "gate",
                name: "ذا جيت",
                best: "Premium stays • Couples",
                desc: "إقامات أرقى لمن يبحث عن تجربة Weekend فريدة.",
                imgUrl:
                  "https://cbe-realestate-egypt.fsn1.your-objectstorage.com/new-images-size/the-gate-tower/600-600/the-gate-tower-2.jpg",
              },
              {
                id: "palm",
                name: "بالم هيلز",
                best: "Families • Chalets",
                desc: "اختيارات مناسبة للعائلات والرحلات الأطول.",
                imgUrl:
                  "https://manazil.com.eg/wp-content/uploads/2024/03/%D8%A8%D8%A7%D9%84%D9%85-%D9%87%D9%8A%D9%84%D8%B2-%D8%A7%D9%84%D8%B9%D9%84%D9%85%D9%8A%D9%86-%D8%A7%D9%84%D8%AC%D8%AF%D9%8A%D8%AF%D8%A9-3.jpg",
              },
            ].map((project) => (
              <motion.div
                key={project.id}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUp}
                className="relative h-[480px] rounded-[2.5rem] overflow-hidden group cursor-pointer shadow-premium"
              >
                <Link
                  href={`/search?project=${project.id}`}
                  className="absolute inset-0 flex flex-col justify-end p-8"
                >
                  {/* Background Image */}
                  <img
                    src={project.imgUrl}
                    alt={project.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/60 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-100" />

                  {/* Content */}
                  <div className="relative z-10 w-full translate-y-4 group-hover:translate-y-0 transition-transform duration-500 text-right">
                    <div className="flex justify-between items-end mb-3">
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center -rotate-45 group-hover:rotate-0 transition-transform duration-500">
                        <ArrowRight
                          className="text-white w-5 h-5"
                          strokeWidth={1.5}
                        />
                      </div>
                      <h3 className="text-3xl font-black text-white tracking-tighter">
                        {project.name}
                      </h3>
                    </div>
                    <p className="text-white/80 text-sm font-medium mb-6 leading-relaxed line-clamp-2">
                      {project.desc}
                    </p>

                    <div className="pt-6 border-t border-white/20 flex flex-col gap-1 items-end">
                      <p className="text-[10px] uppercase font-black text-accent-400 tracking-wider">
                        Best For
                      </p>
                      <p className="text-sm font-bold text-white tracking-tight">
                        {project.best}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Unit Cards Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-brand-950 mb-16">
            وحدات مختارة وجاهزة للحجز
          </h2>
          <FeaturedUnits />
        </div>
      </section>

      {/* 8. Trust Pack Section */}
      <section className="py-24 bg-[#F7F7F9]">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="order-2 md:order-1"
            >
              <div className="bg-white p-8 rounded-[3rem] shadow-premium space-y-6">
                <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                  <div className="w-12 h-12 bg-accent-50 rounded-full flex items-center justify-center text-accent-600">
                    <Video size={24} />
                  </div>
                  <span className="font-black text-brand-950">
                    فيديو فعلي للوحدة
                  </span>
                </div>
                <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                    <Wallet size={24} />
                  </div>
                  <span className="font-black text-brand-950">
                    تفاصيل السعر والعربون
                  </span>
                </div>
                <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                    <Shield size={24} />
                  </div>
                  <span className="font-black text-brand-950">
                    القواعد وسياسة الإلغاء
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-purple-600">
                    <MapPin size={24} />
                  </div>
                  <span className="font-black text-brand-950">
                    الموقع وتفاصيل الوصول
                  </span>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="order-1 md:order-2"
            >
              <h2 className="text-3xl md:text-5xl font-black text-brand-950 mb-6 tracking-tight">
                إيه هو Trust Pack؟
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-8">
                قبل ما تدفع أي عربون، Kaza Booking بتبعتلك «Trust Pack» كامل
                للوحدة المناسبة لك. ده بيحتوي على كل المعلومات الأساسية اللي
                تخليك تختار وأنت مطمّن تماماً.
              </p>
              <Button
                size="lg"
                className="rounded-full px-10 bg-brand-950 text-white font-bold h-14"
              >
                اطلب Trust Pack للوحدة المناسبة
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 9. Segments Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="bg-accent-50 p-12 rounded-[3rem] border border-accent-100"
            >
              <h3 className="text-2xl font-black text-brand-950 mb-4">
                للكابلز والهاني مون
              </h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                اختيارات هادية ومختارة في العلمين والساحل، تشوفها بفيديو فعلي
                وتعرف تفاصيلها قبل الحجز.
              </p>
              <Button className="rounded-full bg-brand-950 text-white px-8">
                رشّحلي وحدة للهاني مون
              </Button>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="bg-brand-50 p-12 rounded-[3rem] border border-brand-100"
            >
              <h3 className="text-2xl font-black text-brand-950 mb-4">
                للعائلات الصغيرة
              </h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                وحدات مناسبة حسب عدد الأفراد، المساحة، والقواعد، عشان رحلة
                الأسرة تبقى أوضح من البداية.
              </p>
              <Button className="rounded-full bg-brand-950 text-white px-8">
                رشّحلي وحدة للعائلة
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 10. FAQ Section */}
      <section className="py-24 bg-white border-t border-gray-100">
        <div className="container mx-auto px-6 max-w-4xl">
          <h2 className="text-3xl md:text-5xl font-black text-brand-950 mb-16 text-center">
            أسئلة مهمة قبل الحجز
          </h2>
          <div className="space-y-6">
            {[
              {
                q: "هل الصور والفيديوهات حقيقية؟",
                a: "نعم، بنبعتلك فيديو فعلي للوحدة قبل أي عربون، عشان تشوف نفس الوحدة اللي هتحجزها.",
              },
              {
                q: "هل السعر نهائي؟",
                a: "بنوضح لك تفاصيل السعر كاملة قبل الحجز، وأي تأمين أو رسوم إضافية إن وجدت حسب الوحدة والتاريخ.",
              },
              {
                q: "هل لازم أدفع عربون؟",
                a: "تأكيد الحجز بيتم بالعربون بعد ما تراجع الفيديو والتفاصيل والقواعد. طريقة الدفع وخطوات التأكيد بتكون واضحة قبل أي تحويل.",
              },
              {
                q: "هل العربون قابل للاسترداد؟",
                a: "سياسة الإلغاء والاسترداد تختلف حسب الوحدة والتاريخ. بنوضحها لك بوضوح في الـ Trust Pack قبل تأكيد الحجز.",
              },
            ].map((faq, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUp}
                className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100"
              >
                <h3 className="text-xl font-bold text-brand-950 mb-4 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-sm shrink-0 font-black">
                    ؟
                  </span>
                  {faq.q}
                </h3>
                <p className="text-gray-500 font-medium leading-relaxed pr-11">
                  {faq.a}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 11. Final CTA */}
      <section className="py-24 bg-brand-950 text-white">
        <div className="container mx-auto px-6 text-center max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-black mb-8 tracking-tight">
            إقامتك أوضح قبل ما تحجز
          </h2>
          <p className="text-brand-200 text-lg mb-12">
            شوف الوحدة، اعرف التفاصيل، واختار وأنت مطمّن مع Kaza Booking.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              size="lg"
              className="rounded-full px-12 bg-accent-500 hover:bg-accent-600 text-white font-black h-16 shadow-premium"
            >
              رشّحلي وحدة مناسبة
            </Button>
            <Link href="https://wa.me/201000082960">
              <Button
                size="lg"
                className="rounded-full px-12 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black h-16"
              >
                تواصل واتساب
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
