"use client";

import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MOCK_BOOKINGS, MOCK_UNITS } from '@/lib/mock-data';
import { CalendarDays, Clock3, CheckCircle2, Inbox, CalendarPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'booked', label: 'Soft Hold' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
] as const;

function getStatusInfo(status: string) {
  switch (status) {
    case 'booked': return { label: 'Soft Hold', variant: 'warning' as const };
    case 'confirmed': return { label: 'Confirmed', variant: 'info' as const };
    case 'completed': return { label: 'Completed', variant: 'success' as const };
    default: return { label: status, variant: 'neutral' as const };
  }
}

export default function OwnerBookingsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');

  const bookings = useMemo(() => {
    const base = MOCK_BOOKINGS.filter((booking) => booking.unitId === 'u1' || booking.unitId === 'u2');
    return filter === 'all' ? base : base.filter((booking) => booking.status === filter);
  }, [filter]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-6 md:pb-20 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6 bg-white p-5 md:p-8 rounded-[2rem] shadow-sm border border-gray-100">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 mb-3">
             <span className="w-2 h-2 rounded-full bg-brand-500"></span>
             <span className="text-xs font-bold text-brand-700">إدارة الحجوزات</span>
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-brand-950 mb-2">سجل حجوزاتي</h1>
          <p className="text-gray-500 font-medium md:text-lg">تتبع جميع الحجوزات الحالية، السابقة، والمعتمدة لوحداتك.</p>
        </div>
        <div className="bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100 text-center min-w-[140px]">
           <div className="text-sm font-bold text-gray-400 mb-1">إجمالي الحجوزات</div>
           <div className="text-3xl font-black text-brand-950">{bookings.length}</div>
        </div>
      </div>

      {/* Modern Filter Tabs */}
      <div className="flex overflow-x-auto custom-scrollbar pb-2 gap-2">
        {FILTERS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as 'all' | 'booked' | 'confirmed' | 'completed')}
            className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap border ${
              filter === tab.id 
                ? 'bg-brand-950 text-white border-brand-950 shadow-md' 
                : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-brand-950 border-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings List or Premium Empty State */}
      <div className="min-h-[320px] md:min-h-[400px]">
        <AnimatePresence mode="wait">
          {bookings.length > 0 ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 gap-6"
            >
              {bookings.map((booking, idx) => {
                const statusInfo = getStatusInfo(booking.status);
                const unit = MOCK_UNITS.find((u) => u.id === booking.unitId);

                return (
                  <motion.div 
                    key={booking.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <Card className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-[2rem] border border-gray-100 hover:border-brand-200 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] bg-white group cursor-pointer">
                      <div className="flex items-center gap-6 w-full md:w-auto">
                         <img src={unit?.images[0]} alt={unit?.name} className="w-24 h-24 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform duration-300" />
                         <div>
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h2 className="text-xl font-black text-brand-950">{booking.client}</h2>
                              <Badge variant={statusInfo.variant} className="font-bold">{statusInfo.label}</Badge>
                            </div>
                            <div className="text-sm font-bold text-brand-600 mb-3">{unit?.name}</div>
                            
                            <div className="flex items-center gap-5 text-sm font-medium text-gray-500 flex-wrap">
                              <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl"><CalendarDays className="w-4 h-4 text-gray-400" /> {booking.checkIn} - {booking.checkOut}</span>
                              <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl"><Clock3 className="w-4 h-4 text-gray-400" /> {booking.nights} ليالي</span>
                              <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl"><CheckCircle2 className="w-4 h-4" /> {booking.guests} ضيوف</span>
                            </div>
                         </div>
                      </div>
                      
                      <div className="w-full md:w-auto flex flex-row md:flex-col justify-between items-center md:items-end pt-4 border-t md:border-t-0 md:pt-0 border-gray-100">
                        <div className="text-sm font-bold text-gray-400 mb-1">صافي الأرباح المتوقعة</div>
                        <div className="text-2xl lg:text-3xl font-black text-brand-950 tracking-tight">EGP {booking.ownerNet.toLocaleString()}</div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            /* Premium Empty State */
            <motion.div 
               key="empty"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white rounded-[2.5rem] border border-dashed border-gray-200 mt-6"
            >
               <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 relative">
                 <div className="absolute inset-0 bg-brand-50 rounded-full animate-ping opacity-50"></div>
                 <Inbox className="w-10 h-10 text-gray-400 relative z-10" />
               </div>
               <h3 className="text-2xl font-black text-brand-950 mb-3">لا توجد حجوزات تطابق الفلتر</h3>
               <p className="text-gray-500 font-medium max-w-md mx-auto mb-8 leading-relaxed">
                 لم نتمكن من العثور على أي حجوزات في التبويب الحالي للحالة 
                 <span className="inline-block px-2 py-1 mx-2 bg-gray-100 rounded-lg text-brand-950 font-bold">
                   {FILTERS.find(f => f.id === filter)?.label}
                 </span>
                 تأكد من تعديل الفلاتر أو متابعة تقويم الوحدات الخاص بك.
               </p>
               <button 
                 onClick={() => setFilter('all')}
                 className="flex items-center gap-2 bg-brand-950 text-white px-8 py-3.5 rounded-2xl font-bold hover:bg-brand-800 transition-colors shadow-lg hover:-translate-y-1"
               >
                 <CalendarPlus className="w-5 h-5" />
                 عرض جميع الحجوزات
               </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}