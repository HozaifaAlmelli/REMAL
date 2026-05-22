"use client";

import React, { createContext, useContext, useState } from "react";

export type Lang = "ar" | "en";

interface LanguageContextType {
  lang: Lang;
  toggleLang: () => void;
  dir: "rtl" | "ltr";
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  toggleLang: () => {},
  dir: "ltr",
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  const toggleLang = () => {
    setLang((prev) => (prev === "ar" ? "en" : "ar"));
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, dir: lang === "ar" ? "rtl" : "ltr" }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);

// ---- All site copy ----
export const copy = {
  ar: {
    // Hero
    heroEyebrow: "إدارة فندقية فاخرة للوحدات الساحلية والمصيفية",
    heroHeadline: "حوّل وحدتك في العلمين أو الساحل إلى أصل ضيافة مُدار باحتراف.",
    heroSub: "KAZA تدير وحدتك بنظام ضيافة فندقي متكامل: تسويق، تسعير ديناميكي، إدارة حجوزات، استقبال ضيوف، Housekeeping، صيانة، وتقارير مالية واضحة — بهدف تعظيم العائد مع الحفاظ على قيمة وحدتك.",
    heroCta1: "اطلب تقييم وحدتك",
    heroCta2: "تحدث مع فريق الشراكات",
    heroTrust: "تحت قيادة خبرة تنفيذية في إدارة الفنادق والمنتجعات الفاخرة، وعمليات ضيافة على مستوى علامات دولية ومشروعات كبرى.",

    // Authority
    authorityTitle: "خبرة Hospitality حقيقية وليست إدارة حجوزات فقط",
    authorityPoints: [
      "قيادة تنفيذية بخبرة تتجاوز 30 عامًا في الفنادق والمنتجعات الفاخرة.",
      "خبرة في تشغيل وإعادة هيكلة وافتتاح فنادق ومنتجعات 5 نجوم.",
      "خلفية في إدارة عمليات متعددة، Revenue Optimization، SOPs، وAsset Management.",
      "خبرة مرتبطة بعلامات مثل InterContinental، Crowne Plaza، Mövenpick، Holiday Inn، Palm Hills، وCoral Sea.",
    ],
    authorityBrands: ["InterContinental", "Crowne Plaza", "Mövenpick", "Holiday Inn", "Rotana", "Palm Hills", "Coral Sea"],

    // Problem
    problemHeadline: "امتلاك وحدة فاخرة لا يعني بالضرورة أنها تحقق أفضل عائد.",
    problemBody: "كثير من الوحدات الممتازة في العلمين والساحل تفقد جزءًا كبيرًا من فرصتها بسبب الإدارة العشوائية: تسعير غير دقيق، صور غير احترافية، حجوزات موسمية فقط، وغياب تقارير مالية واضحة.",
    problemPoints: [
      { title: "إشغال غير منتظم", body: "الوحدة متاحة لكن معدل الإشغال أقل من إمكانياتها الحقيقية." },
      { title: "تسعير عشوائي", body: "السعر يتحدد بالإحساس لا بالطلب والموسم والمنافسة." },
      { title: "ضغط يومي على المالك", body: "المالك يتعامل مع سماسرة أو ضيوف أو شكاوى بنفسه." },
      { title: "غياب الرقابة", body: "لا توجد متابعة دقيقة للتنظيف والصيانة والتسليم والاستلام." },
      { title: "لا تقارير واضحة", body: "لا توجد تقارير شهرية عن الإيرادات والمصاريف وصافي العائد." },
      { title: "استهلاك الوحدة", body: "الوحدة تستهلك مع الوقت بدون Brand Standards أو Quality Control." },
    ],

    // Solution
    solutionHeadline: "KAZA تدير وحدتك كأصل فندقي، لا كإعلان إيجار.",
    solutionBody: "نحن لا نكتفي بعرض وحدتك على الإنترنت. نحن نبني حولها نظام تشغيل كامل: positioning، تسعير، توزيع على قنوات الحجز، إدارة الضيوف، متابعة التشغيل، حماية التجربة، وتقارير مالية تساعدك ترى أداء وحدتك بوضوح.",
    solutionPromise: "We treat your property as our own.",
    solutionPoints: [
      { title: "التسعير الديناميكي", body: "تحليل يومي للسوق لرفع أو خفض السعر لضمان أعلى عائد سنوي ممكن." },
      { title: "تسويق احترافي متعدد القنوات", body: "ظهور على Airbnb، Booking.com، Expedia، وقنوات الحجز المباشر وB2C." },
      { title: "حماية الأصل والصيانة", body: "فحص دوري، واستلام وتسليم فندقي يحافظ على جودة وحدتك." },
      { title: "إدارة الضيوف بالكامل", body: "ردود فورية، تأهيل ضيوف، وإدارة التجربة من الوصول للمغادرة." },
      { title: "شفافية تامة", body: "بوابة للمالك تتيح لك متابعة الحجوزات والإيرادات والمصروفات بضغطة زر." },
      { title: "تقارير شهرية واضحة", body: "تقرير عن الإيرادات، المصاريف، نسب الإشغال، ومتوسط سعر الليلة." },
    ],

    // Services
    servicesEyebrow: "خدماتنا الكاملة",
    servicesHeadline: "نغطي دورة التشغيل بالكامل من أول تجهيز الوحدة حتى تقرير الأداء.",
    servicesBody: "كل ما يحتاجه المالك الذكي — من الإعداد للإطلاق حتى التقارير الشهرية — تحت إدارة واحدة متكاملة.",
    services: [
      { icon: "launch", title: "Property Launch & Setup", body: "نقيّم الوحدة، نحدد أفضل positioning لها، ونجهزها للظهور بشكل يليق بسعرها وموقعها." },
      { icon: "furnishing", title: "Luxury Furnishing & Full Setup", body: "لو وحدتك غير مفروشة، KAZA تتولى التأثيث والتجهيز بالكامل بمعايير ضيافة فاخرة: اختيار القطع، التنسيق، التجهيزات الأساسية، واللمسات النهائية الجاهزة للتشغيل." },
      { icon: "revenue", title: "Revenue Management & Dynamic Pricing", body: "نستخدم تسعيرًا ديناميكيًا حسب الموسم، أيام الأسبوع، الطلب، والمنافسة." },
      { icon: "channels", title: "Channel & Booking Management", body: "إدارة الظهور والحجوزات عبر Airbnb، Booking.com، Expedia، والحجوزات المباشرة." },
      { icon: "marketing", title: "Professional Marketing", body: "تصوير، محتوى، positioning، وإعلانات تساعد الضيف على الثقة في الوحدة." },
      { icon: "guest", title: "Guest Experience Management", body: "الرد على الاستفسارات، تأهيل الضيوف، تأكيد التفاصيل، ودعم أثناء الإقامة." },
      { icon: "housekeeping", title: "Housekeeping & Quality Control", body: "تنسيق التنظيف، checklists قبل وبعد الإقامة، وضمان مستوى ثابت للجودة." },
      { icon: "maintenance", title: "Maintenance Coordination", body: "متابعة الأعطال، التنسيق مع الفنيين، وتقليل أثر أي مشكلة على الوحدة." },
      { icon: "reporting", title: "Transparent Owner Reporting", body: "تقرير واضح عن الإيرادات، المصاريف، نسب الإشغال، ومتوسط سعر الليلة." },
    ],

    // Why Kaza
    whyEyebrow: "مقارنة سريعة",
    whyHeadline: "الفرق بين إدارة الحجوزات وإدارة الضيافة.",
    whyColFeature: "المعيار",
    whyColOthers: "الإدارة العشوائية",
    whyRows: [
      { old: "سعر ثابت أو تفاوضي", others: "سعر ثابت أو تفاوضي", kaza: "Dynamic Pricing حسب الطلب والموسم" },
      { old: "صور عادية أو غير كافية", kaza: "Presentation احترافي وتجربة موثقة" },
      { old: "الاعتماد على سمسار أو جروبات", others: "الاعتماد على سمسار أو جروبات", kaza: "Multi-channel distribution + Direct booking" },
      { old: "المالك يتابع التفاصيل بنفسه", others: "المالك يتابع التفاصيل بنفسه", kaza: "فريق يدير التشغيل والضيوف والمتابعة" },
      { old: "لا توجد تقارير واضحة", others: "لا توجد تقارير واضحة", kaza: "Owner reports وPerformance metrics" },
      { old: "الوحدة تستهلك بدون متابعة", others: "الوحدة تستهلك بدون متابعة", kaza: "Quality control وAsset protection" },
    ],
    whyColOld: "الإدارة العشوائية",
    whyColKaza: "KAZA",

    // Leadership
    leaderEyebrow: "من يقف وراء KAZA",
    leaderHeadline: "فريق قاد فنادق عالمية يدير الآن وحدتك بنفس المعايير.",
    leaderBody: "تقودنا خبرة تنفيذية تمتد لأكثر من 30 عامًا في إدارة الفنادق الفاخرة والمنتجعات الدولية، تشمل الافتتاحات من الصفر، إعادة الهيكلة التشغيلية، إدارة P&L، وتطوير معايير الضيافة الدولية عبر علامات تجارية كبرى في مصر والشرق الأوسط وأفريقيا. هذا ليس مكتب وساطة — هذا فريق يُدير وحدتك بعقلية مدير عام فندق خمس نجوم.",
    leaderBullets: [
      "خبرة تشغيلية مباشرة مع Mövenpick، InterContinental، Crowne Plaza، Holiday Inn، Rotana، وMillennium Hotels",
      "افتتاح وإعادة هيكلة منتجعات كبرى: Coral Sea، Tolip El Galala Majestic، وعمليات Palm Hills Hospitality",
      "إدارة P&L وإيرادات محافظ فندقية متعددة المواقع على المستوى الدولي",
      "تطوير وتطبيق SOPs ومعايير جودة الضيافة الدولية من الصفر",
      "إدارة علاقات الملاك والمستثمرين بمعايير مؤسسية احترافية",
      "تحويل وحدات متعثرة إلى أصول ضيافة مربحة ومستدامة",
    ],
    leadershipHeadline: "فريق قاد فنادق عالمية يدير الآن وحدتك بنفس المعايير.",
    leadershipBody: "تقودنا خبرة تنفيذية تمتد لأكثر من 30 عامًا في إدارة الفنادق الفاخرة والمنتجعات الدولية، تشمل الافتتاحات من الصفر، إعادة الهيكلة التشغيلية، إدارة P&L، وتطوير معايير الضيافة الدولية عبر علامات تجارية كبرى في مصر والشرق الأوسط وأفريقيا. هذا ليس مكتب وساطة — هذا فريق يُدير وحدتك بعقلية مدير عام فندق خمس نجوم.",
    leadershipBullets: [
      "خبرة تشغيلية مباشرة مع Mövenpick، InterContinental، Holiday Inn، Rotana، وMillennium Hotels",
      "افتتاح وإعادة هيكلة منتجعات كبرى: Coral Sea، Tolip El Galala Majestic، وعمليات Palm Hills Hospitality",
      "إدارة P&L وإيرادات محافظ فندقية متعددة المواقع على المستوى الدولي",
      "تطوير وتطبيق SOPs ومعايير جودة الضيافة الدولية من الصفر",
      "إدارة علاقات الملاك والمستثمرين بمعايير مؤسسية احترافية",
      "تحويل وحدات متعثرة إلى أصول ضيافة مربحة ومستدامة",
    ],

    // Process
    processEyebrow: "مسار الانضمام",
    processHeadline: "رحلة انضمام وحدتك إلى KAZA",
    steps: [
      { num: "01", title: "التواصل والاهتمام", body: "تملأ بيانات الوحدة أو تتواصل معنا لطلب تقييم مبدئي." },
      { num: "02", title: "تقييم الوحدة", body: "نراجع الموقع، نوع الوحدة، الحالة، الفرش، والإطلالة وقواعد المشروع." },
      { num: "03", title: "مراجعة العائد والجاهزية", body: "نحدد فرص العائد، نقاط التحسين، متطلبات التصوير والتسعير." },
      { num: "04", title: "هيكل الشراكة", body: "نتفق على نموذج الإدارة، المسؤوليات، الرسوم، والتقارير." },
      { num: "05", title: "الإطلاق والتجهيز", body: "نجهز الوحدة للتسويق: محتوى، قنوات، pricing، قواعد، وchecklists." },
      { num: "06", title: "الإدارة المستمرة", body: "نبدأ إدارة الحجوزات والضيوف والتقارير والتحسين المستمر." },
    ],
    processSteps: [
      { num: "01", title: "التواصل والاهتمام", body: "تملأ بيانات الوحدة أو تتواصل معنا لطلب تقييم مبدئي." },
      { num: "02", title: "تقييم الوحدة", body: "نراجع الموقع، نوع الوحدة، الحالة، الفرش، والإطلالة وقواعد المشروع." },
      { num: "03", title: "مراجعة العائد والجاهزية", body: "نحدد فرص العائد، نقاط التحسين، متطلبات التصوير والتسعير." },
      { num: "04", title: "هيكل الشراكة", body: "نتفق على نموذج الإدارة، المسؤوليات، الرسوم، والتقارير." },
      { num: "05", title: "الإطلاق والتجهيز", body: "نجهز الوحدة للتسويق: محتوى، قنوات، pricing، قواعد، وchecklists." },
      { num: "06", title: "الإدارة المستمرة", body: "نبدأ إدارة الحجوزات والضيوف والتقارير والتحسين المستمر." },
    ],

    // Final CTA
    ctaEyebrow: "ابدأ الآن",
    ctaHeadline: "هل وحدتك جاهزة لتصبح أصل ضيافة عالي الأداء؟",
    ctaBody: "إذا كنت تمتلك وحدة Premium في العلمين، الساحل، العين السخنة، القاهرة، أو وجهة سياحية راقية داخل مصر، يمكننا تقييم فرصتها التشغيلية والعائد المتوقع وطريقة إدارتها باحتراف.",
    ctaCta1: "اطلب تقييم وحدتك الآن",
    ctaCta2: "احجز مكالمة مع فريق KAZA",
    ctaMicrocopy: "التقييم الأولي لا يعني قبول كل الوحدات. نقبل فقط الوحدات القابلة للإدارة بمعايير KAZA.",
    finalHeadline: "هل وحدتك جاهزة لتصبح أصل ضيافة عالي الأداء؟",
    finalBody: "إذا كنت تمتلك وحدة Premium في العلمين، الساحل، العين السخنة، القاهرة، أو وجهة سياحية راقية داخل مصر، يمكننا تقييم فرصتها التشغيلية والعائد المتوقع وطريقة إدارتها باحتراف.",
    finalCta1: "اطلب تقييم وحدتك الآن",
    finalCta2: "احجز مكالمة مع فريق KAZA",
    finalMicro: "التقييم الأولي لا يعني قبول كل الوحدات. نقبل فقط الوحدات القابلة للإدارة بمعايير KAZA.",

    // Nav
    navLinks: ["مزايا الملاك", "خدماتنا", "لماذا KAZA", "من نحن", "تواصل معنا"],
    navPortal: "بوابة الملاك",
    navCta: "ابدأ الآن",

    // Form
    formTitle: "اطلب تقييم وحدتك",
    formName: "الاسم",
    formPhone: "رقم الهاتف / واتساب",
    formEmail: "البريد الإلكتروني",
    formLocation: "موقع الوحدة",
    formProject: "اسم المشروع / الكمباوند",
    formType: "نوع الوحدة",
    formUnitType: "نوع الوحدة (شاليه، فيلا، شقة...)",
    formMessage: "ملاحظات أو تفاصيل إضافية",
    formTypes: ["Studio", "1 BR", "2 BR", "3 BR", "Villa", "Chalet"],
    formSubmit: "أرسل الطلب",
    formNote: "سيتواصل معك فريق KAZA خلال 24 ساعة.",
    formPrivacy: "سيتواصل معك فريق KAZA خلال 24 ساعة. لن يتم مشاركة بياناتك مع أي طرف ثالث.",
  },
  en: {
    heroEyebrow: "Luxury Vacation Rental Management & Hospitality Services",
    heroHeadline: "Turn your premium property into a professionally managed hospitality asset.",
    heroSub: "KAZA manages premium vacation rentals through hotel-grade operations: dynamic pricing, professional marketing, multi-channel distribution, guest relations, housekeeping, maintenance coordination, and transparent owner reporting.",
    heroCta1: "Request a Property Evaluation",
    heroCta2: "Speak to Partnerships",
    heroTrust: "Led by senior hospitality expertise with experience across luxury hotels, resorts, openings, turnarounds, asset management, and large-scale operations.",

    authorityTitle: "Real hospitality leadership — not just booking management.",
    authorityPoints: [
      "30+ years of executive hospitality experience.",
      "Luxury hotel, resort, and multi-property operations background.",
      "Experience in hotel openings, repositioning, SOP implementation, and profitability growth.",
      "Leadership experience connected to InterContinental, Holiday Inn, Mövenpick, Palm Hills, and Coral Sea.",
    ],
    authorityBrands: ["InterContinental", "Mövenpick", "Holiday Inn", "Rotana", "Palm Hills", "Coral Sea"],

    problemHeadline: "Owning a premium property does not automatically mean it performs like one.",
    problemBody: "Many high-value units in New Alamein and the North Coast underperform because they are managed casually: inconsistent pricing, weak marketing, broker dependency, no performance reporting, and no structured hospitality standards.",
    problemPoints: [
      { title: "Low occupancy", body: "The unit is available but occupancy is below its real potential." },
      { title: "Pricing guesswork", body: "Rates set on intuition rather than demand, seasonality, and competition." },
      { title: "Daily owner stress", body: "The owner handles guests, complaints, cleaning, and coordination personally." },
      { title: "No quality control", body: "No structured housekeeping, maintenance, or handover process." },
      { title: "No financial visibility", body: "No clear monthly reporting on revenue, expenses, and net yield." },
      { title: "Asset depreciation", body: "Property wears down over time without brand standards or quality oversight." },
    ],

    solutionHeadline: "KAZA manages your property as a hospitality asset — not just a rental listing.",
    solutionBody: "We do more than publish your unit online. We build the operating system around it: positioning, pricing, distribution, guest experience, operations, quality control, and transparent reporting.",
    solutionPromise: "We treat your property as our own.",
    solutionPoints: [
      { title: "Dynamic Pricing", body: "Daily market analysis to optimize rates and maximize annual yield." },
      { title: "Professional Multi-Channel Marketing", body: "Visibility on Airbnb, Booking.com, Expedia, direct booking channels, and B2C marketplaces." },
      { title: "Asset Protection & Maintenance", body: "Regular inspections and hotel-grade handover process to protect your unit." },
      { title: "Full Guest Management", body: "Instant responses, guest screening, arrival coordination, and experience management." },
      { title: "Total Transparency", body: "Owner portal to track bookings, revenue, and expenses at any time." },
      { title: "Clear Monthly Reporting", body: "Revenue, expenses, occupancy rate, and ADR in one clear report." },
    ],

    servicesEyebrow: "Our Full Services",
    servicesHeadline: "A complete management system from property readiness to performance reporting.",
    servicesBody: "Everything a smart property owner needs — from launch to monthly reporting — under one integrated management system.",
    services: [
      { icon: "launch", title: "Property Launch & Setup", body: "We assess the property, define its positioning, identify readiness gaps, and prepare it for market." },
      { icon: "furnishing", title: "Luxury Furnishing & Full Setup", body: "If your unit is unfurnished, KAZA can handle the full hospitality-grade furnishing setup: furniture selection, styling, core equipment, and final readiness for premium guest operations." },
      { icon: "revenue", title: "Revenue Management & Dynamic Pricing", body: "We optimize pricing based on seasonality, demand, weekday/weekend patterns, and competitive context." },
      { icon: "channels", title: "Channel & Booking Management", body: "Distribution across Airbnb, Booking.com, Expedia, direct booking, and partner networks." },
      { icon: "marketing", title: "Professional Marketing", body: "Photography direction, content, positioning, and conversion-focused presentation." },
      { icon: "guest", title: "Guest Experience Management", body: "Inquiry handling, guest qualification, arrival coordination, stay support, and review management." },
      { icon: "housekeeping", title: "Housekeeping & Quality Control", body: "Cleaning coordination, readiness checklists, pre-arrival and post-departure checks." },
      { icon: "maintenance", title: "Maintenance Coordination", body: "Issue tracking, vendor coordination, and operational follow-up to protect the asset." },
      { icon: "reporting", title: "Transparent Owner Reporting", body: "Clear reporting on revenue, expenses, occupancy, ADR, and operational notes." },
    ],

    whyEyebrow: "Quick Comparison",
    whyHeadline: "The difference between managing bookings and managing hospitality.",
    whyColFeature: "Standard",
    whyColOthers: "Casual Management",
    whyRows: [
      { old: "Fixed or emotional pricing", others: "Fixed or emotional pricing", kaza: "Dynamic pricing and revenue optimization" },
      { old: "Weak photography & marketing", others: "Weak photography & marketing", kaza: "Professional presentation and verified experience" },
      { old: "Broker-led demand", others: "Broker-led demand", kaza: "Multi-channel distribution + Direct booking strategy" },
      { old: "Owner handles daily issues", others: "Owner handles daily issues", kaza: "Professional guest and operations management" },
      { old: "No performance visibility", others: "No performance visibility", kaza: "Transparent owner reporting" },
      { old: "Property wears down unmanaged", others: "Property wears down unmanaged", kaza: "Quality control and asset protection" },
    ],
    whyColOld: "Casual Management",
    whyColKaza: "KAZA",

    leaderEyebrow: "The Leadership Behind KAZA",
    leaderHeadline: "A team that ran world-class hotels now manages your property.",
    leaderBody: "KAZA is led by a hospitality executive with 30+ years of direct hands-on experience across luxury hotels, international resorts, multi-property portfolios, full hotel openings, operational restructuring, revenue optimization, and institutional asset management — spanning Egypt, the Middle East, and Africa. This is not a brokerage. This is hotel-grade operational leadership applied to your private property.",
    leaderBullets: [
      "Direct operational experience with Mövenpick, InterContinental, Crowne Plaza, Holiday Inn, Rotana & Millennium Hotels",
      "Led openings & full operations: Coral Sea, Tolip El Galala Majestic & Palm Hills Hospitality",
      "Multi-property P&L management, revenue optimization & financial performance across international markets",
      "International SOP development, brand standards & hospitality quality control implementation",
      "Owner and investor relations at institutional hospitality standards",
      "Hotel turnarounds: repositioning underperforming assets into profitable hospitality operations",
    ],
    leadershipHeadline: "A team that ran world-class hotels now manages your property.",
    leadershipBody: "KAZA is led by a hospitality executive with 30+ years of direct hands-on experience across luxury hotels, international resorts, multi-property portfolios, full hotel openings, operational restructuring, revenue optimization, and institutional asset management — spanning Egypt, the Middle East, and Africa. This is not a brokerage. This is hotel-grade operational leadership applied to your private property.",
    leadershipBullets: [
      "Direct operational experience with Mövenpick, InterContinental, Holiday Inn, Rotana & Millennium Hotels",
      "Led openings & full operations: Coral Sea, Tolip El Galala Majestic & Palm Hills Hospitality",
      "Multi-property P&L management, revenue optimization & financial performance across international markets",
      "International SOP development, brand standards & hospitality quality control implementation",
      "Owner and investor relations at institutional hospitality standards",
      "Hotel turnarounds: repositioning underperforming assets into profitable hospitality operations",
    ],

    processEyebrow: "The Onboarding Journey",
    processHeadline: "How your property joins KAZA",
    steps: [
      { num: "01", title: "Expression of Interest", body: "Submit your property details or request an initial discussion." },
      { num: "02", title: "Property Evaluation", body: "We review the location, type, condition, furnishing, view, and operational suitability." },
      { num: "03", title: "Revenue & Readiness Review", body: "We identify revenue opportunities, readiness gaps, pricing potential, and launch requirements." },
      { num: "04", title: "Partnership Structure", body: "We agree on the management model, responsibilities, fees, reporting, and payout timelines." },
      { num: "05", title: "Launch Setup", body: "We prepare the property for market: content, channels, pricing, rules, and checklists." },
      { num: "06", title: "Ongoing Management", body: "We manage bookings, guests, operations, reporting, and continuous optimization." },
    ],
    processSteps: [
      { num: "01", title: "Expression of Interest", body: "Submit your property details or request an initial discussion." },
      { num: "02", title: "Property Evaluation", body: "We review the location, type, condition, furnishing, view, and operational suitability." },
      { num: "03", title: "Revenue & Readiness Review", body: "We identify revenue opportunities, readiness gaps, pricing potential, and launch requirements." },
      { num: "04", title: "Partnership Structure", body: "We agree on the management model, responsibilities, fees, reporting, and payout timelines." },
      { num: "05", title: "Launch Setup", body: "We prepare the property for market: content, channels, pricing, rules, and checklists." },
      { num: "06", title: "Ongoing Management", body: "We manage bookings, guests, operations, reporting, and continuous optimization." },
    ],

    ctaEyebrow: "Start Now",
    ctaHeadline: "Is your property ready to become a high-performing hospitality asset?",
    ctaBody: "If you own a premium unit in New Alamein, the North Coast, Ain Sokhna, Cairo, or another premium Egyptian destination, KAZA can evaluate its revenue potential and fit for professional management.",
    ctaCta1: "Request a Property Evaluation",
    ctaCta2: "Book a Call with KAZA",
    ctaMicrocopy: "Initial evaluation does not guarantee acceptance. KAZA only accepts properties that meet its hospitality and quality standards.",
    finalHeadline: "Is your property ready to become a high-performing hospitality asset?",
    finalBody: "If you own a premium unit in New Alamein, the North Coast, Ain Sokhna, Cairo, or another premium Egyptian destination, KAZA can evaluate its revenue potential and fit for professional management.",
    finalCta1: "Request a Property Evaluation",
    finalCta2: "Book a Call with KAZA",
    finalMicro: "Initial evaluation does not guarantee acceptance. KAZA only accepts properties that meet its hospitality and quality standards.",

    navLinks: ["Owner Benefits", "Our Services", "Why KAZA", "About", "Contact"],
    navPortal: "Owner Portal",
    navCta: "Get Started",

    formTitle: "Request a Property Evaluation",
    formName: "Full Name",
    formPhone: "Phone / WhatsApp",
    formEmail: "Email Address",
    formLocation: "Property Location",
    formProject: "Project / Compound Name",
    formType: "Property Type",
    formUnitType: "Unit Type (Studio, Villa, Chalet...)",
    formMessage: "Additional notes or details",
    formTypes: ["Studio", "1 BR", "2 BR", "3 BR", "Villa", "Chalet"],
    formSubmit: "Send Request",
    formNote: "KAZA team will contact you within 24 hours.",
    formPrivacy: "KAZA team will contact you within 24 hours. Your data will never be shared with third parties.",
  },
} as const;
