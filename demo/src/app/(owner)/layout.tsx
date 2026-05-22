"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Wallet, Bell, LogOut, Home, Building2, Menu, X, MoreHorizontal } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants/routes';
import { clearDemoRoleCookie } from '@/lib/auth-client';
import { motion, AnimatePresence } from 'framer-motion';

const MENU_ITEMS = [
  { icon: Home, label: 'الرئيسية', href: ROUTES.ownerDashboard },
  { icon: Building2, label: 'الوحدات', href: ROUTES.ownerUnits },
  { icon: CalendarDays, label: 'الحجوزات', href: ROUTES.ownerBookings },
  { icon: Wallet, label: 'أرباحي', href: ROUTES.ownerEarnings },
  { icon: CalendarDays, label: 'التقويم', href: ROUTES.ownerCalendar, hiddenOnMobile: true },
  { icon: Bell, label: 'الإشعارات', href: ROUTES.ownerNotifications, hiddenOnMobile: true },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    clearDemoRoleCookie();
    router.push(ROUTES.authOwnerLogin);
    router.refresh();
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#F7F7F9] text-brand-950 overflow-hidden font-sans dir-rtl">
      
      {/* Mobile Sticky Header (0 - 640px) */}
      <header className="md:hidden flex items-center justify-between px-5 h-16 bg-white border-b border-gray-100 sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-black text-xl tracking-tight text-brand-950 flex items-center gap-1.5">
            Kaza
          </span>
          <span className="text-accent-600 text-[9px] font-bold uppercase tracking-widest bg-accent-50 px-2 py-1 rounded-md">مُلاك</span>
        </div>
        <button 
          type="button"
          onClick={() => setIsMobileMenuOpen(true)} 
          className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-brand-900 border border-brand-100"
        >
          <div className="text-xs font-bold">أ.م</div>
        </button>
      </header>

      {/* Sidebar: Tablet Icons (80px) -> Desktop Full (260px) */}
      <aside className="hidden md:flex flex-col w-[80px] lg:w-[260px] bg-white h-full z-20 relative border-l border-gray-100 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 shrink-0">
        
        {/* Logo Area */}
        <div className="h-20 lg:h-24 flex flex-col justify-center items-center lg:items-start lg:px-8 relative z-10 pt-2 lg:pt-4">
           <span className="font-black text-xl lg:text-2xl tracking-tight text-brand-950 lg:flex items-center gap-1.5 hidden">
             Kaza <span className="text-gray-400 font-medium">Booking</span>
           </span>
           <span className="font-black text-2xl text-brand-950 lg:hidden">KB</span>
           <span className="text-accent-600 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 lg:block hidden">بوابة المُلاك</span>
        </div>
        
        {/* Navigation */}
        <div className="flex-1 py-6 lg:px-5 px-3 flex flex-col gap-2 relative z-10 overflow-y-auto">
          {MENU_ITEMS.map((item, idx) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link key={idx} href={item.href} className={cn(
                "flex items-center justify-center lg:justify-start gap-4 lg:px-4 py-3.5 rounded-2xl transition-all duration-300 relative group",
                isActive 
                  ? "bg-gray-50 text-brand-950 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.02)]" 
                  : "text-gray-400 hover:text-brand-950 hover:bg-gray-50/50"
              )}>
                {isActive && (
                  <motion.div 
                    layoutId="active-indicator"
                    className="absolute right-1 lg:right-2 top-1/2 -translate-y-1/2 w-1 h-3 lg:w-1.5 lg:h-1.5 bg-accent-500 rounded-full lg:rounded-full"
                  />
                )}
                <item.icon className={cn("w-[22px] h-[22px] lg:w-5 lg:h-5 transition-transform duration-300 shrink-0", isActive ? "text-brand-950" : "group-hover:scale-110")} />
                <span className={cn("text-sm hidden lg:block truncate", isActive ? "font-black" : "font-medium")}>{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Profile Area */}
        <div className="p-4 lg:p-6 relative z-10 border-t border-gray-50 flex flex-col items-center lg:items-stretch">
          <div className="flex items-center lg:justify-between mb-4 lg:px-2 w-full justify-center">
             <div className="flex-col hidden lg:flex overflow-hidden">
               <span className="font-black text-sm text-brand-950 truncate">أحمد منصور</span>
               <span className="text-[11px] font-bold text-gray-400 mt-0.5 truncate">3 وحدات نشطة</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center font-bold text-brand-700 shrink-0">أ.م</div>
          </div>
          <button type="button" onClick={handleLogout} className="flex items-center justify-center gap-2 text-sm font-bold text-gray-400 hover:text-red-500 lg:hover:bg-red-50 lg:w-full w-10 h-10 lg:h-auto lg:py-3 rounded-full lg:rounded-xl transition-all" title="تسجيل الخروج">
            <LogOut className="w-[22px] h-[22px] lg:w-4 lg:h-4 shrink-0 px-0.5 lg:px-0 ml-0.5 lg:ml-0" />
            <span className="hidden lg:inline">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto relative pb-[112px] md:pb-0">
        <div className="px-4 pt-4 pb-2 md:p-8 lg:p-12 w-full max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation (0 - 640px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center px-2 pt-2 pb-2 h-[76px] z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
        <div className="flex w-full items-center justify-between px-2">
          {MENU_ITEMS.filter(item => !item.hiddenOnMobile).map((item, idx) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link key={idx} href={item.href} className="flex flex-col items-center justify-center w-full py-1 group">
                <div className={cn("flex flex-col items-center justify-center p-1.5 px-4 rounded-full transition-all duration-300", isActive ? "bg-brand-50 text-brand-950" : "text-gray-400")}>
                  <item.icon className={cn("w-5 h-5 mb-1 transition-transform", isActive ? "animate-pulse-once" : "")} strokeWidth={isActive ? 2.5 : 1.5} />
                  <span className={cn("text-[10px] tracking-tight", isActive ? "font-bold" : "font-medium")}>{item.label}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Mobile Settings/Profile Modal Sheet */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-brand-950/40 backdrop-blur-sm"
          >
            {/* Overlay click to close */}
            <div className="absolute inset-0" onClick={() => setIsMobileMenuOpen(false)} />
            
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full bg-white rounded-t-3xl p-6 relative z-10 max-h-[85vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
              
              <div className="flex items-center gap-4 mb-8 p-4 bg-brand-50/50 rounded-2xl border border-brand-50">
                <div className="w-14 h-14 rounded-full bg-white border border-brand-100 flex items-center justify-center font-bold text-xl text-brand-900 shadow-sm">أ.م</div>
                <div>
                  <h3 className="font-black text-lg text-brand-950">أحمد منصور</h3>
                  <p className="text-gray-500 text-sm font-medium">ahmed@example.com</p>
                </div>
              </div>

              <div className="space-y-2 mb-8">
                {MENU_ITEMS.filter(item => item.hiddenOnMobile).map((item, idx) => (
                  <Link key={idx} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 text-brand-900 transition-colors">
                    <div className="bg-brand-50 p-2.5 rounded-xl"><item.icon className="w-5 h-5 text-brand-600" /></div>
                    <span className="font-bold text-sm tracking-wide">{item.label}</span>
                  </Link>
                ))}
              </div>

              <button 
                onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                تسجيل الخروج
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
