'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { CalendarDays, Wallet, Building2, ChevronLeft, BellRing, ArrowUpRight } from 'lucide-react';
import { MOCK_UNITS, MOCK_BOOKINGS } from '@/lib/mock-data';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/Badge';

export default function OwnerDashboard() {
  const ownerUnits = MOCK_UNITS.filter(u => u.owner.name === 'أحمد منصور');
  const ownerUnitIds = ownerUnits.map(u => u.id);
  const ownerBookings = MOCK_BOOKINGS.filter(b => ownerUnitIds.includes(b.unitId));

  const totalEarnings = ownerBookings.reduce((sum, b) => sum + (b.ownerNet || 0), 0);
  const totalNights = ownerBookings.reduce((sum, b) => sum + b.nights, 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="w-full space-y-5 md:space-y-10 pb-6 md:pb-12">
      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        
        {/* Sleek Header (Desktop only - Mobile has navbar header) */}
        <motion.header variants={itemVariants} className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-10 lg:mb-16">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 mb-4">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold text-brand-900 tracking-widest uppercase">محفظتك نشطة</span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-brand-950 tracking-tighter">مرحباً بك، أ. أحمد منصور</h1>
            <p className="text-gray-500 text-base md:text-lg mt-2 font-medium">إليك نظرة عامة على أداء عقاراتك.</p>
          </div>
          
          <button className="flex items-center gap-2 bg-white border border-brand-50 shadow-sm hover:shadow-md transition-shadow px-6 py-3.5 rounded-2xl font-bold text-brand-900">
            <BellRing className="w-5 h-5 text-accent-600" strokeWidth={1.5} />
            <span>الإشعارات <span className="bg-brand-50 text-brand-900 px-2 py-0.5 rounded-md mr-1">2</span></span>
          </button>
        </motion.header>

        {/* Mobile Header Greeting */}
        <motion.div variants={itemVariants} className="md:hidden mb-4">
          <p className="text-gray-500 text-sm font-medium mb-1">مرحباً بعودتك، احمد</p>
          <h1 className="text-2xl font-black text-brand-950 tracking-tight">نظرة عامة على محفظتك</h1>
        </motion.div>

        {/* Premium Stats Row - Grid cols 2 on mobile */}
        <motion.div variants={containerVariants} className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-12">
          
          {/* Main Balance Card */}
          <motion.div variants={itemVariants} className="col-span-2 md:col-span-1">
            <Card className="bg-brand-900 text-white border-0 shadow-lg relative overflow-hidden h-full rounded-2xl md:rounded-3xl p-5 md:p-8 flex flex-col justify-between">
               <div className="absolute -right-10 -top-10 w-40 h-40 bg-accent-500/20 rounded-full blur-3xl hidden md:block"></div>
               <div className="relative z-10 flex flex-col h-full justify-between gap-4 md:gap-6">
                 <div className="flex items-center justify-between">
                   <div className="p-2 md:p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
                     <Wallet className="w-5 h-5 md:w-6 md:h-6 text-accent-400" strokeWidth={1.5} />
                   </div>
                   <Badge className="bg-emerald-500/20 text-emerald-300 border-none tracking-tight text-[10px] md:text-xs font-bold">+12%</Badge>
                 </div>
                 <div>
                   <p className="text-brand-200/80 font-bold mb-1 md:mb-2 text-[10px] uppercase tracking-widest">إجمالي الأرباح المستحقة</p>
                   <div className="text-3xl md:text-5xl font-black tracking-tighter flex items-end gap-2">
                     <span className="text-lg md:text-2xl text-brand-300 mb-1">EGP</span>
                     {(totalEarnings || 124500).toLocaleString()}
                   </div>
                 </div>
               </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className="">
            <Card className="bg-white border border-gray-100 shadow-sm h-full rounded-2xl md:rounded-3xl p-4 md:p-8 flex flex-col justify-between hover:shadow-md transition-all gap-4 md:gap-6">
              <div className="flex items-center justify-between">
                <div className="p-2 md:p-2.5 bg-brand-50 rounded-xl">
                  <CalendarDays className="w-5 h-5 md:w-6 md:h-6 text-brand-600" strokeWidth={1.5} />
                </div>
              </div>
              <div>
                <p className="text-gray-400 font-bold mb-1 md:mb-2 text-[9px] md:text-[10px] uppercase tracking-widest">ليالي تم حجزها</p>
                <div className="text-2xl md:text-5xl font-black text-brand-950 tracking-tighter">
                  {totalNights || 18} <span className="text-xs md:text-xl text-gray-400 font-bold">ليلة</span>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className="">
            <Card className="bg-white border border-gray-100 shadow-sm h-full rounded-2xl md:rounded-3xl p-4 md:p-8 flex flex-col justify-between hover:shadow-md transition-all gap-4 md:gap-6">
              <div className="flex items-center justify-between">
                <div className="p-2 md:p-2.5 bg-accent-50 rounded-xl">
                  <Building2 className="w-5 h-5 md:w-6 md:h-6 text-accent-600" strokeWidth={1.5} />
                </div>
              </div>
              <div>
                <p className="text-gray-400 font-bold mb-1 md:mb-2 text-[9px] md:text-[10px] uppercase tracking-widest">الوحدات النشطة</p>
                <div className="text-2xl md:text-5xl font-black text-brand-950 tracking-tighter">
                  {ownerUnits.length || 3} <span className="text-xs md:text-xl text-gray-400 font-bold">وحدات</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>

        {/* Modern Upcoming Bookings */}
        <motion.div variants={itemVariants} className="mt-6 md:mt-16">
          <div className="flex justify-between items-center mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-black text-brand-900 tracking-tight">أحدث الحجوزات</h2>
            <button className="text-accent-600 bg-accent-50 px-3 py-1.5 rounded-full text-xs md:text-sm font-bold flex items-center gap-1 hover:bg-accent-100 transition-colors">
              عرض الكل <ChevronLeft className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 md:gap-6">
            {(ownerBookings.length > 0 ? ownerBookings : [
              { id: '1', unitId: 'u1', client: 'محمود سعد', checkIn: '20 يوليو', checkOut: '25 يوليو', ownerNet: 26000, status: 'confirmed' },
              { id: '2', unitId: 'u6', client: 'سارة العبد', checkIn: '28 يوليو', checkOut: '31 يوليو', ownerNet: 18000, status: 'booked' }
            ]).map((booking, idx) => {
              const unit = ownerUnits.find(u => u.id === booking.unitId) || ownerUnits[0];
              return (
                <div key={idx} className="bg-white p-3 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3 md:gap-6 hover:shadow-md transition-all group">
                  <div className="w-full md:w-32 h-20 md:h-32 rounded-xl overflow-hidden shrink-0 bg-gray-100 relative">
                    <img src={unit?.images?.[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop'} alt="Unit" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute top-1 right-1 md:hidden">
                       <Badge className="bg-emerald-50 text-emerald-700 border-none font-bold shrink-0 px-1 py-0.5 text-[8px] uppercase tracking-wider">مؤكد</Badge>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1 md:mb-2">
                        <h3 className="font-bold text-[12px] md:text-lg text-brand-900 line-clamp-1">{unit?.name || 'فيلا بمارينا'}</h3>
                        <Badge className="hidden md:flex bg-emerald-50 text-emerald-700 border-none font-bold shrink-0 px-3 tracking-tight">مؤكد</Badge>
                      </div>
                      <p className="text-gray-500 text-[10px] md:text-sm font-medium mb-1 truncate">العميل: <span className="font-bold text-gray-900">{booking.client}</span></p>
                      <p className="text-gray-400 text-[9px] md:text-sm flex items-center justify-start gap-1"><CalendarDays className="w-3 h-3 shrink-0" /> <span className="truncate">{booking.checkIn} — {booking.checkOut}</span></p>
                    </div>
                    <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-gray-50 flex items-center justify-between">
                      <div>
                        <p className="text-[8px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">الصافي</p>
                        <p className="font-black text-brand-950 text-xs md:text-2xl tracking-tighter">EGP {booking.ownerNet.toLocaleString()}</p>
                      </div>
                      <button className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 hover:bg-brand-100 hover:scale-105 transition-all">
                        <ArrowUpRight className="w-5 h-5 -rotate-90 rtl:rotate-0" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
