import React from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";
import { Navbar } from "@/components/layout/Navbar";
import {
  MapPin,
  Mail,
  Phone,
  ArrowLeft,
  Globe,
  MessageCircle,
  Hash,
} from "lucide-react";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-brand-900 selection:text-white">
      <Navbar />

      {/* Main App Container */}
      <main className="flex-1 w-full overflow-hidden">{children}</main>

      {/* Modern High-End Footer */}
      <footer className="w-full bg-brand-950 text-white pt-24 pb-12 relative overflow-hidden border-t border-brand-900/50 object-cover">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        <div className="absolute -top-[500px] -right-[500px] w-[1000px] h-[1000px] bg-white/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="container mx-auto px-6 relative z-10 w-full max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-16 lg:gap-8 mb-20 text-right">
            {/* Brand Section */}
            <div className="lg:col-span-5 flex flex-col items-start gap-8">
              <Link
                href="/"
                className="flex items-center gap-2 group w-full"
                dir="ltr"
              >
                <span className="font-black text-4xl tracking-tighter italic text-white flex items-center gap-2 transition-all duration-300 group-hover:text-gray-200">
                  Kaza Booking
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                </span>
              </Link>
              <p className="text-gray-400 text-lg leading-relaxed max-w-sm font-medium">
                بوابتك الحصرية لحياة الفخامة في الساحل الشمالي والعلمين الجديدة.
                نوفر لك وحدات موثقة بالفيديو لضمان أعلى درجات الشفافية.
              </p>

              {/* Social Links */}
              <div className="flex gap-4 items-center">
                <a
                  href="#"
                  className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white hover:text-brand-950 transition-all duration-300 transform hover:scale-110 border border-white/10"
                >
                  <Hash size={20} />
                </a>
                <a
                  href="#"
                  className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white hover:text-brand-950 transition-all duration-300 transform hover:scale-110 border border-white/10"
                >
                  <Globe size={20} />
                </a>
                <a
                  href="#"
                  className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white hover:text-brand-950 transition-all duration-300 transform hover:scale-110 border border-white/10"
                >
                  <MessageCircle size={20} />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="lg:col-span-3">
              <h3 className="text-white font-bold text-xl mb-6 flex items-center gap-2">
                روابط سريعة
              </h3>
              <ul className="flex flex-col gap-4 text-gray-400 font-medium">
                <li>
                  <Link
                    href="/"
                    className="hover:text-white transition-colors duration-300 flex items-center gap-2 group"
                  >
                    <ArrowLeft
                      size={16}
                      className="text-white/0 group-hover:text-white transition-all transform rtl:-scale-x-100"
                    />{" "}
                    الرئيسية
                  </Link>
                </li>
                <li>
                  <Link
                    href="/search"
                    className="hover:text-white transition-colors duration-300 flex items-center gap-2 group"
                  >
                    <ArrowLeft
                      size={16}
                      className="text-white/0 group-hover:text-white transition-all transform rtl:-scale-x-100"
                    />{" "}
                    الوجهات السياحية
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#how-it-works"
                    className="hover:text-white transition-colors duration-300 flex items-center gap-2 group"
                  >
                    <ArrowLeft
                      size={16}
                      className="text-white/0 group-hover:text-white transition-all transform rtl:-scale-x-100"
                    />{" "}
                    كيف نعمل
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#qualify"
                    className="hover:text-white transition-colors duration-300 flex items-center gap-2 group"
                  >
                    <ArrowLeft
                      size={16}
                      className="text-white/0 group-hover:text-white transition-all transform rtl:-scale-x-100"
                    />{" "}
                    اتصل بنا
                  </Link>
                </li>
                <li>
                  <Link
                    href={ROUTES.authClientLogin}
                    className="hover:text-white transition-colors duration-300 flex items-center gap-2 group"
                  >
                    <ArrowLeft
                      size={16}
                      className="text-white/0 group-hover:text-white transition-all transform rtl:-scale-x-100"
                    />{" "}
                    تسجيل الدخول
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div className="lg:col-span-4 bg-white/5 border border-white/10 rounded-[2rem] p-8 mt-4 lg:mt-0 shadow-2xl backdrop-blur-sm">
              <h3 className="text-white font-bold text-xl mb-6">
                ابقى على تواصل
              </h3>
              <ul className="flex flex-col gap-6 text-gray-300">
                <li className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/5">
                    <Phone size={18} className="text-white" />
                  </div>
                  <div className="flex flex-col pt-1">
                    <span className="text-sm text-gray-500 mb-1">
                      خدمة العملاء
                    </span>
                    <a
                      href="tel:+201000082960"
                      className="font-bold text-lg hover:text-white transition-colors"
                      dir="ltr"
                    >
                      +20 100 008 2960
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/5">
                    <Mail size={18} className="text-white" />
                  </div>
                  <div className="flex flex-col pt-1">
                    <span className="text-sm text-gray-500 mb-1">
                      البريد الإلكتروني
                    </span>
                    <a
                      href="mailto:info@kazabooking.com"
                      className="font-semibold hover:text-white transition-colors"
                    >
                      info@kazabooking.com
                    </a>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-right">
            <p className="text-gray-500 text-sm font-medium">
              جميع الحقوق محفوظة © {new Date().getFullYear()} Kaza Booking
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-500 font-medium">
              <Link href="#" className="hover:text-white transition-colors">
                الشروط والأحكام
              </Link>
              <span className="w-1 h-1 rounded-full bg-gray-700"></span>
              <Link href="#" className="hover:text-white transition-colors">
                سياسة الخصوصية
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
