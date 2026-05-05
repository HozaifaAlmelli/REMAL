import Link from "next/link";
import {
  Check,
  PlayCircle,
  FileCheck,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";

export default function SmarHomePage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#F7F4EF] font-sans text-[#071321]"
    >
      {/* 1. NAVBAR */}
      <nav className="fixed left-1/2 top-4 z-50 w-[95%] max-w-7xl -translate-x-1/2 rounded-2xl border border-white/20 bg-white/70 shadow-sm backdrop-blur-md transition-all">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="text-2xl font-bold tracking-tight text-[#071321]">
            سمار
          </div>
          <div className="hidden items-center gap-8 text-sm font-medium md:flex">
            <Link href="#" className="transition-colors hover:text-blue-900">
              الرئيسية
            </Link>
            <Link href="#" className="transition-colors hover:text-blue-900">
              المناطق
            </Link>
            <Link href="#" className="transition-colors hover:text-blue-900">
              إزاي بنشتغل
            </Link>
            <Link href="#" className="transition-colors hover:text-blue-900">
              الأسئلة الشائعة
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="hidden rounded-full px-4 py-2 text-sm text-[#071321] transition-all hover:bg-black/5 sm:inline-flex"
            >
              واتساب
            </a>
            <button className="rounded-full bg-[#071321] px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-black/10 transition-all hover:bg-[#102033]">
              رشّحلي وحدة
            </button>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="relative flex h-[90vh] min-h-[600px] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#071321]/90 via-[#071321]/40 to-black/20" />
          <div className="absolute inset-0 z-0 bg-[#0B1623]" />
          <video
            autoPlay
            muted
            loop
            playsInline
            className="z-0 h-full w-full object-cover opacity-80"
            src="https://cdn.coverr.co/videos/coverr-waves-crashing-on-the-beach-4371/1080p.mp4"
          />
        </div>

        <div className="relative z-10 mt-16 max-w-4xl px-4 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white backdrop-blur-md">
            <ShieldCheck className="h-4 w-4 text-green-400" />
            <span>إقامات موثقة ومُختارة</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold leading-tight text-white drop-shadow-lg md:text-5xl lg:text-6xl">
            وحدات مختارة في العلمين والساحل،
            <br className="hidden md:block" /> تشوفها بفيديو فعلي قبل الحجز.
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/90 md:text-xl">
            ابعت تاريخك وعدد الأفراد وميزانيتك، وسمار ترشح لك 2–3 وحدات مناسبة
            من اختيارات موثقة للكابلز والعائلات الصغيرة.
          </p>

          <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button className="w-full rounded-full bg-white px-8 py-4 text-lg font-bold text-[#071321] shadow-xl transition-transform hover:-translate-y-1 hover:bg-gray-100 sm:w-auto">
              رشّحلي وحدة مناسبة
            </button>
            <button className="flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/20 px-8 py-4 text-lg font-medium text-white shadow-xl backdrop-blur-md transition-all hover:bg-white/30 sm:w-auto">
              تواصل واتساب
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-medium text-white/80 md:text-base">
            <div className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" /> فيديو فعلي للوحدة
            </div>
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" /> تفاصيل السعر قبل العربون
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5" /> ترشيحات حسب رحلتك
            </div>
          </div>
        </div>
      </section>

      {/* 3. QUICK QUALIFICATION FORM */}
      <section className="bg-[#FAF8F4] px-4 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="mb-4 text-3xl font-bold text-[#071321]">
              خلينا نرشحلك الوحدة الأنسب
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              جاوب على كام سؤال بسيط، ونبعتلك أفضل 2–3 اختيارات مناسبة لتاريخك
              وميزانيتك.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl shadow-black/5 md:p-12">
            <form className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  الاسم
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-gray-200 bg-[#F7F4EF]/50 p-4 outline-none transition-all focus:ring-2 focus:ring-[#071321]"
                  placeholder="الاسم الكريم"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  رقم الموبايل / واتساب
                </label>
                <input
                  type="tel"
                  className="w-full rounded-xl border border-gray-200 bg-[#F7F4EF]/50 p-4 outline-none transition-all focus:ring-2 focus:ring-[#071321]"
                  placeholder="+20 10X XXX XXXX"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  تاريخ الوصول - الخروج (تقريبي)
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-gray-200 bg-[#F7F4EF]/50 p-4 outline-none transition-all focus:ring-2 focus:ring-[#071321]"
                  placeholder="مثال: ١٤ يوليو - ١٨ يوليو"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  عدد الأفراد
                </label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-gray-200 bg-[#F7F4EF]/50 p-4 outline-none transition-all focus:ring-2 focus:ring-[#071321]"
                  placeholder="2 بالغين، 1 طفل"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  نوع الرحلة
                </label>
                <select className="w-full rounded-xl border border-gray-200 bg-[#F7F4EF]/50 p-4 text-gray-700 outline-none transition-all focus:ring-2 focus:ring-[#071321]">
                  <option>كابل / هاني مون</option>
                  <option>عائلة صغيرة</option>
                  <option>مجموعة أصدقاء (سيدات)</option>
                  <option>غيره</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  المنطقة المفضلة
                </label>
                <select className="w-full rounded-xl border border-gray-200 bg-[#F7F4EF]/50 p-4 text-gray-700 outline-none transition-all focus:ring-2 focus:ring-[#071321]">
                  <option>أبراج العلمين</option>
                  <option>مزارين</option>
                  <option>ذا جيت</option>
                  <option>بالم هيلز</option>
                  <option>مش محدد - اقترح لي</option>
                </select>
              </div>

              <div className="pt-6 md:col-span-2">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#071321] p-5 text-lg font-bold text-white shadow-lg shadow-black/10 transition-all hover:bg-[#102033]"
                >
                  ابعتلي الترشيحات المناسبة
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <p className="mt-4 text-center text-sm text-gray-500">
                  مش طلب حجز نهائي — هنرشحلك الأنسب الأول
                </p>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* 4. TRUST BLOCKS */}
      <section className="bg-white px-4 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-[#071321]">
              قبل أي عربون، لازم تشوف التفاصيل بوضوح
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            {[
              {
                icon: PlayCircle,
                title: "فيديو فعلي",
                desc: "شوف نفس الوحدة اللي هتحجزها، مش صور عامة أو قديمة.",
              },
              {
                icon: FileCheck,
                title: "تفاصيل السعر",
                desc: "نوضح السعر، العربون، وأي رسوم أو تأمين إن وجد قبل تأكيد الحجز.",
              },
              {
                icon: ShieldCheck,
                title: "قواعد واضحة",
                desc: "عدد الأفراد، check-in/out، وسياسة الإلغاء حسب كل وحدة.",
              },
              {
                icon: Check,
                title: "ترشيح مناسب",
                desc: "مش هنبعتلك 20 اختيار؛ هنرشحلك الأنسب حسب تاريخك وميزانيتك.",
              },
            ].map((block, i) => (
              <div
                key={i}
                className="rounded-3xl border border-gray-100 bg-[#F7F4EF]/50 p-8 transition-all hover:shadow-lg"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-100 bg-white text-[#071321] shadow-sm">
                  <block.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-[#071321]">
                  {block.title}
                </h3>
                <p className="leading-relaxed text-gray-600">{block.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FEATURED AREAS */}
      <section className="bg-[#FAF8F4] px-4 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 items-end justify-between md:flex">
            <div>
              <h2 className="mb-4 text-3xl font-bold text-[#071321]">
                اختيارات في أهم مناطق العلمين والساحل
              </h2>
              <p className="text-lg text-gray-600">
                نرشح لك وحدات حسب تاريخك وميزانيتك من مناطق مختارة.
              </p>
            </div>
            <button className="hidden border-b-2 border-[#071321] pb-1 font-semibold text-[#071321] md:block">
              عرض كل المناطق
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: "أبراج العلمين",
                for: "كابلز • هاني مون • Premium",
                img: "https://images.unsplash.com/photo-1544244015-0df2b7dce558?q=80&w=600&auto=format&fit=crop",
              },
              {
                name: "مزارين",
                for: "عائلات صغيرة • إقامة هادئة",
                img: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?q=80&w=600&auto=format&fit=crop",
              },
              {
                name: "ذا جيت",
                for: "Premium stays • Couples",
                img: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=600&auto=format&fit=crop",
              },
              {
                name: "بالم هيلز",
                for: "Families • Chalets",
                img: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?q=80&w=600&auto=format&fit=crop",
              },
            ].map((area, i) => (
              <div
                key={i}
                className="group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-3xl shadow-sm shadow-black/5"
              >
                <img
                  src={area.img}
                  alt={area.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 w-full p-6 text-white">
                  <h3 className="mb-2 text-2xl font-bold">{area.name}</h3>
                  <p className="mb-4 text-sm text-white/80">{area.for}</p>
                  <div className="inline-flex items-center gap-2 border-b border-white/40 pb-1 text-sm font-semibold transition-colors group-hover:border-white">
                    شوف المتاح <ArrowLeft className="h-4 w-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 13. FOOTER */}
      <footer className="bg-[#071321] px-4 py-16 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <h4 className="mb-4 text-2xl font-bold">سمار</h4>
            <p className="mb-6 max-w-sm leading-relaxed text-white/70">
              خدمة ترشيح وحجز إقامات مختارة في العلمين والساحل، تساعدك تشوف
              الوحدة بفيديو فعلي وتعرف تفاصيلها قبل الحجز.
            </p>
          </div>
          <div>
            <h5 className="mb-4 font-bold">روابط سريعة</h5>
            <ul className="space-y-3 text-white/70">
              <li>
                <Link href="#">الرئيسية</Link>
              </li>
              <li>
                <Link href="#">إزاي بنشتغل</Link>
              </li>
              <li>
                <Link href="#">الأسئلة الشائعة</Link>
              </li>
              <li>
                <Link href="#">شروط الحجز</Link>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="mb-4 font-bold">تواصل معنا</h5>
            <ul className="space-y-3 text-white/70">
              <li>واتساب: 01012345678</li>
              <li>انستجرام: smar.stays</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
