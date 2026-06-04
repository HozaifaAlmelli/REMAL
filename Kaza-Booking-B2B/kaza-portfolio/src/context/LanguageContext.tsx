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
    navSectors: "القطاعات",
    sectorsMenu: {
      booking: "كازا للحجوزات",
      beach: "كازا للشاطئ",
      breakfast: "كازا للإفطار",
      restaurant: "كازا للمطعم",
      furniture: "كازا للأثاث"
    },

    // Sectors
    sectors: {
      booking: {
        title: "كازا لإدارة الحجوزات المتكاملة",
        heroSubtitle: "عظّم عوائدك من خلال أنظمة حجز آلية ومتعددة القنوات وبمعايير ضيافة خمس نجوم.",
        aboutSection: "تدمج كازا KAZA قوائم الوحدات عبر إير بي إن بي، وبوكينج، وإكسبيديا، وقنوات الحجز المباشر لمنع تكرار الحجوزات وتعظيم نسب الإشغال ديناميكيًا.",
        features: [
          "المزامنة متعددة القنوات: تحديثات فورية لتوفر الوحدات عبر جميع مواقع السفر العالمية.",
          "محرك الحجز المباشر: حجوزات خالية من العمولات عبر شبكة كازا الخاصة.",
          "إدارة التقويم الذكية: فحص مرن للضيوف وتنسيق تلقائي للتقاويم المتاحة."
        ],
        ctaText: "اطلب تقييم تكامل الحجوزات"
      },
      beach: {
        title: "كازا لتشغيل الوحدات الساحلية والشاطئية",
        heroSubtitle: "حوّل الفيلات والشاليهات الشاطئية إلى أصول ضيافة فاخرة ذات عوائد مرتفعة.",
        aboutSection: "تتطلب الإيجارات الساحلية رعاية متخصصة. توفر كازا KAZA إدارة متكاملة مخصصة للعقارات الساحلية الراقية في العلمين والساحل والسخنة لضمان الصيانة المثالية ورضا الضيوف.",
        features: [
          "الحماية والصيانة من الرطوبة والملوحة: رعاية استباقية ضد الرطوبة وتآكل الشواطئ.",
          "إدارة مستلزمات الشاطئ: تجهيز كامل لمستلزمات الشاطئ الفاخرة والمناشف والضيافة الخارجية.",
          "تعظيم العائد الموسمي: تسعير ديناميكي للاستفادة القصوى من مواسم الصيف والعطلات الأسبوعية."
        ],
        ctaText: "اطلب تقييم إدارة وحدة ساحلية"
      },
      breakfast: {
        title: "كازا لخدمات الفطور والطهي داخل الفيلات",
        heroSubtitle: "قدّم لضيوفك وجبات فطور فندقية فاخرة من فئة الخمس نجوم مباشرة إلى موائدهم.",
        aboutSection: "تبدأ تجربة الضيافة المميزة من الصباح الباكر. توفر كازا KAZA خدمات تقديم فطور منسقة وخيارات طهي داخل الوحدة لتمييز عقارك عن الإيجارات العادية.",
        features: [
          "سلال الفطور المنسقة: مكونات طازجة وفاخرة يتم تسليمها يومياً للضيوف.",
          "تجربة الشيف الخاص: إعداد طعام مخصص داخل الفيلا بواسطة طهاة محترفين بمعايير الفنادق.",
          "خطط وجبات مرنة: خيارات أساسية وفاخرة تلبي الاحتياجات الغذائية المفضلة للضيوف."
        ],
        ctaText: "استكشف تكامل خدمات الطعام"
      },
      restaurant: {
        title: "كازا لشراكات المطاعم وتجارب الطهي",
        heroSubtitle: "مزايا حصرية ووصول خاص لأرقى المطاعم لضيوف عقارك الفاخر.",
        aboutSection: "نتعاون مع المطاعم المحلية الكبرى لتقديم حجوزات ذات أولوية لضيوف كازا KAZA، وخدمة التوصيل الحصرية من قوائم طعام راقية، وتنسيق فعاليات تناول طعام خاصة لتعزيز مستوى الإقامة.",
        features: [
          "حجوزات كبار الشخصيات (VIP): مقاعد مضمونة وحجز ذو أولوية في أرقى مطاعم المنطقة.",
          "قوائم طعام حصرية بالوحدة: قوائم طعام منسقة خصيصاً من طهاة المطاعم الشريكة تُوصل للوحدة.",
          "فعاليات تناول طعام خاصة: تنسيق بوفيهات وحفلات عشاء خاصة للمناسبات داخل الفيلا."
        ],
        ctaText: "اطلب تفاصيل برنامج الشراكات"
      },
      furniture: {
        title: "كازا للأثاث والتجهيز الداخلي",
        heroSubtitle: "حوّل الوحدات الفارغة إلى مساحات ضيافة مذهلة وذات أداء تشغيلي مرتفع بتصميم متكامل وتجهيزات أثاث راقية.",
        aboutSection: "التصميم يحدد مستوى الطلب. يعمل قسم كازا للأثاث والتجهيز الداخلي مع مصممي ديكور محترفين لتجهيز وتوريد وتركيب أثاث فاخر عالي التحمل ومحسن للتشغيل التجاري.",
        features: [
          "حزم كازا للأثاث المتكاملة (مفتاح باليد): تنسيق كامل للمخططات، المشتريات، التوصيل، والتركيب.",
          "متانة تجارية فندقية: أقمشة ومواد راقية مصممة لتحمل تشغيل الإيجارات المتكرر.",
          "تنسيق داخلي جذاب للصور: تنسيق جمالي استراتيجي لتعزيز معدلات الحجز عبر الإنترنت."
        ],
        ctaText: "اطلب مقايسة كازا للأثاث والتجهيز"
      }
    },
    pegasusSection: {
      slogans: {
        modernLiving: "مُصمم للحياة العصرية",
        styleMeets: "حيث تتقاطع الأناقة مع تفاصيل الحياة اليومية",
        kindServices: "دائماً في خدمتكم بأرقى المعايير"
      },
      overview: {
        title: "بيجاسوس للمطابخ والدريسنج",
        description: "تعتبر شركة بيجاسوس للمطابخ والدريسنج واحدة من أبرز الشركات الرائدة في تصميم وتصنيع المطابخ، والمتخصصة في الخزائن المخصصة وحلول الأثاث المدمج. تجمع الشركة بسلاسة بين الحرفية الفاخرة وجماليات التصميم الحديث والتقليدي المصممة خصيصاً لتتناسب مع المخططات المعمارية الفريدة وتفضيلات العملاء النخبوية."
      },
      commitments: {
        productionScale: "حجم الإنتاج: تدير الشركة أحد أكبر المصانع المتخصصة في إنتاج المطابخ الفاخرة، غرف الملابس (Dressings)، وقطع الأثاث الفاخرة.",
        hub: "مركز التصنيع: يقع المصنع الرئيسي في موقع استراتيجي في القاهرة، جمهورية مصر العربية.",
        turnaround: "سرعة التنفيذ: نضمن التسليم والتركيب بجودة فائقة خلال ٢١ يوماً فقط من تاريخ توقيع العقد.",
        qa: "ضمان الجودة: تقديم شهادة ضمان رسمية ومعتمدة لجميع المنتجات وقطع الأثاث التي يتم تسليمها."
      },
      philosophies: {
        minimalist: "لمسات بسيطة: تفاصيل أقل، أناقة أكثر",
        lighting: "حيث تصنع الإضاءة أبعاد المكان",
        transformation: "شكل منزلك بلمسة مفعمة بالأناقة"
      },
      metrics: {
        audienceLabel: "متابعون على منصات التواصل",
        audienceVal: "١١٠ ألف+ متابع",
        outputLabel: "حجم الإنتاج والكتالوج",
        outputVal: "أكثر من ١٥٠ ألف منتج",
        satisfactionLabel: "نسبة رضا العملاء",
        satisfactionVal: "٤.٧ / ٥.٠ تقييمات إيجابية"
      },
      characteristics: {
        lighting: "إضاءة تأكيدية ساحرة: دمج مكثف لأنظمة إضاءة LED المخصصة أسفل الخزائن، وداخل وحدات العرض الزجاجية، والمطورة في مسارات الأسقف لتعميق الإحساس بالفراغ.",
        materials: "خامات استثنائية فاخرة: استخدام تشطيبات اللاكيه عالية اللمعان، أسطح رخامية سوداء متباينة، وخلفيات مذهلة من رخام الأونيكس الذهبي المضاء من الخلف.",
        hidden: "مساحات الخدمة المخفية: هندسة فراغية مبتكرة تعتمد على أبواب جرارة خشبية مفرغة (Slatted) مصممة لإخفاء الأجهزة العملية مثل الغسالات، المجففات، وأحواض الخدمة بأناقة تامة.",
        islands: "طاولات المطبخ المركزية (Islands): جزر وسطية واسعة مجهزة بمواقد مدمجة، أسطح متساوية، وامتداد هيكلي مخصص ليكون ركناً راقياً للإفطار."
      },
      contact: {
        addressLabel: "عنوان المعرض",
        addressVal: "سيلفر ستار مول، محور محمد نجيب، القاهرة الجديدة، مصر",
        phone: "٠١٠٥٠٧٠٠٠٤٤",
        website: "www.pegasuskitchens.com"
      }
    },

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
    beachPage: {
      hero: {
        title: "إدارة تشغيل الشواطئ والمناطق الساحلية",
        subtitle: "لمحات من تجارب تشغيل وإدارة وجهاتنا الساحلية الفاخرة."
      },
      ctaButton: "اكتشف المزيد على إنستاجرام",
      videoSection: {
        title: "أبرز لقطات إنستاجرام",
        subtitle: "شاهد كواليس عملياتنا الحية وخبرتنا في تشغيل الشواطئ والمناطق الساحلية."
      }
    },
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
    navSectors: "Sectors",
    sectorsMenu: {
      booking: "KAZA Booking",
      beach: "KAZA Beach",
      breakfast: "KAZA Breakfast",
      restaurant: "KAZA Restaurant",
      furniture: "KAZA Furniture"
    },

    // Sectors
    sectors: {
      booking: {
        title: "KAZA Booking Operations",
        heroSubtitle: "Maximize yield with automated, multi-channel booking systems and five-star hospitality standards.",
        aboutSection: "KAZA integrates property listings across Airbnb, Booking.com, Expedia, and direct B2C channels. We eliminate double-bookings and optimize occupancy dynamically.",
        features: [
          "Multi-Channel Sync: Real-time availability updates across all global travel sites.",
          "Direct Booking Engine: Commission-free reservations via KAZA's proprietary network.",
          "Smart Calendar Management: Flexible guest screening and automated calendar blockages."
        ],
        ctaText: "Request a Booking Integration Evaluation"
      },
      beach: {
        title: "KAZA Beach & Coastal Operations",
        heroSubtitle: "Turn your coastal villas and beachfront chalets into premium, high-yield hospitality assets.",
        aboutSection: "Coastal rentals require specialized care. KAZA offers end-to-end management tailored for high-end coastal properties in Alamein, North Coast, and Sokhna, ensuring pristine maintenance and premium guest satisfaction.",
        features: [
          "Saltwater Protection & Maintenance: Preemptive care against coastal humidity and salt air corrosion.",
          "Beach Amenities Management: Full setup of premium beach gear, towels, and outdoor hospitality.",
          "Seasonal Yield Maximization: Dynamic pricing to capitalize on peak summer seasons and weekend escapes."
        ],
        ctaText: "Request Coastal Property Management Evaluation"
      },
      breakfast: {
        title: "KAZA In-Villa Breakfast & Dining",
        heroSubtitle: "Deliver standard-setting, five-star hotel breakfasts directly to your guests' dining tables.",
        aboutSection: "A signature hospitality experience starts in the morning. KAZA provides curated breakfast catering and chef-prepared in-villa dining options that set your property apart from casual rental listings.",
        features: [
          "Curated Breakfast Baskets: Gourmet, locally sourced ingredients delivered fresh daily.",
          "Private Chef Experience: Customized in-villa culinary preparation by professional hotel-grade chefs.",
          "Flexible Meal Plans: Standard and premium options tailored to guest dietary requirements and preferences."
        ],
        ctaText: "Explore Dining Service Integrations"
      },
      restaurant: {
        title: "KAZA Restaurant Partnerships",
        heroSubtitle: "Exclusive culinary access and dining privileges for premium vacation rentals.",
        aboutSection: "We partner with leading local restaurants and culinary hot spots to offer KAZA guests priority reservations, in-unit delivery from elite menus, and bespoke dining events, elevating the value of your property's concierge service.",
        features: [
          "VIP Reservations: Guaranteed seating and priority booking at the destination's top-tier restaurants.",
          "Exclusive In-Unit Menus: Access to specially curated chef menus delivered directly to the property.",
          "Bespoke Dining Events: Tailored catering and micro-events coordination for special occasions."
        ],
        ctaText: "Request Partnership Program Details"
      },
      furniture: {
        title: "KAZA Furniture & Interior Setup",
        heroSubtitle: "Transform empty units into stunning, high-performance hospitality spaces with turn-key design and custom furniture services.",
        aboutSection: "Design dictates demand. KAZA's furniture and interior design department works with professional interior designers to curate, procure, and install high-durability, luxury furniture and equipment optimized for commercial rental operations.",
        features: [
          "Turn-key KAZA Furniture Packages: Complete layout curation, purchase, delivery, and setup.",
          "Commercial-Grade Durability: High-end fabrics and materials designed to withstand vacation wear.",
          "Photogenic Interior Styling: Strategic aesthetic placement to maximize listing click-through rates."
        ],
        ctaText: "Request a KAZA Furniture Quote"
      }
    },
    pegasusSection: {
      slogans: {
        modernLiving: "Designed for modern living",
        styleMeets: "Where style meets everyday living",
        kindServices: "Always in your kind services"
      },
      overview: {
        title: "Pegasus Kitchens & Dressings",
        description: "Pegasus Kitchens & Dressings is a prominent kitchen design and manufacturing firm specializing in bespoke cabinetry and fitted furniture solutions. The company seamlessly blends premium craftsmanship with modern and traditional design aesthetics tailored to complement unique architectural layouts and client preferences."
      },
      commitments: {
        productionScale: "Scale of Production: Operates one of the largest manufacturing facilities dedicated to producing high-end kitchens, dressings, and general furniture pieces.",
        hub: "Manufacturing Hub: The primary factory is strategically located in Cairo, Egypt.",
        turnaround: "Rapid Turnaround Time: Promises premium-quality delivery and installation within 21 days from the date of contract signing.",
        qa: "Quality Assurance: Offers an official warranty across all delivered products and furniture items."
      },
      philosophies: {
        minimalist: "Simple Touch & Less Details, More elegance",
        lighting: "Where lighting creates spaces",
        transformation: "Shape your Home with a Touch of Elegance"
      },
      metrics: {
        audienceLabel: "Social Media Audience",
        audienceVal: "110k+ Followers",
        outputLabel: "Product Output / Catalog",
        outputVal: "Over 150k Products",
        satisfactionLabel: "Customer Satisfaction",
        satisfactionVal: "4.7 / 5.0 Good Reviews"
      },
      characteristics: {
        lighting: "Dramatic Accent Lighting: Extensive integration of custom LED strip lighting under cabinets, within glass display units, and built into ceiling tracks to amplify depth.",
        materials: "Premium Materials: Inclusion of high-gloss lacquer finishes, contrasting black stone countertops, and striking backlit golden onyx/marble backsplashes.",
        hidden: "Concealed Utility Spaces: Custom spatial architecture featuring slatted sliding doors designed to elegantly conceal functional appliances like washing machines, dryers, and service sinks.",
        islands: "Modern Kitchen Islands: Spacious center islands built with integrated hobs, flush countertop surfaces, and extended structural breakfast bars."
      },
      contact: {
        addressLabel: "Showroom Address",
        addressVal: "Silver Star Mall, Mohamed Naguib Axis, New Cairo, Egypt",
        phone: "01050700044",
        website: "www.pegasuskitchens.com"
      }
    },

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
    beachPage: {
      hero: {
        title: "Coastal & Beachfront Operations",
        subtitle: "Curated moments from our premium managed coastal escapes."
      },
      ctaButton: "Explore More on Instagram",
      videoSection: {
        title: "Instagram Video Highlights",
        subtitle: "Watch behind-the-scenes moments of our beachfront operations."
      }
    },
  },
} as const;
