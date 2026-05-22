"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { MOCK_UNITS } from '@/lib/mock-data';
import { CalendarIcon, ChevronLeft, ChevronRight, Lock, CalendarDays, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OwnerCalendarPage() {
  const myUnits = MOCK_UNITS.filter(u => u.owner.name === 'أحمد منصور');
  const [selectedUnit, setSelectedUnit] = useState<string | null>(myUnits[0]?.id || null);

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-7xl mx-auto pb-6 gap-6 md:gap-8">
      <div className="shrink-0 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 mb-3">
             <span className="w-2 h-2 rounded-full bg-brand-500"></span>
             <span className="text-xs font-bold text-brand-700">إدارة الإشغال</span>
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-brand-950 mb-2 tracking-tight">تقويم الوحدات</h1>
          <p className="text-gray-500 font-medium md:text-lg">متابعة الحجوزات المؤكدة والأيام المغلقة لوحداتك بشكل تفاعلي.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 flex-1 min-h-0 overflow-hidden custom-scrollbar">
        {/* Left Col - Units List */}
        <div className="w-full lg:w-80 flex flex-row lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto pr-1 pb-2 lg:pb-0 shrink-0 custom-scrollbar">
          <h3 className="font-black text-brand-950 px-1 hidden lg:block mb-2">وحداتي النشطة</h3>
          {myUnits.map((u) => {
             const isSelected = selectedUnit === u.id;
             return (
               <motion.div 
                 whileHover={{ scale: 1.02 }}
                 whileTap={{ scale: 0.98 }}
                 onClick={() => setSelectedUnit(u.id)}
                 key={u.id} 
                 className={`p-3 min-w-[240px] lg:min-w-0 rounded-[1.5rem] cursor-pointer transition-all border-2 relative overflow-hidden ${
                   isSelected 
                     ? 'bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] border-brand-950' 
                     : 'bg-white/50 border-transparent hover:border-gray-200 opacity-70 hover:opacity-100'
                 }`}
               >
                  {isSelected && (
                    <div className="absolute top-4 right-4 z-10 bg-brand-950 text-white rounded-full p-1.5">
                      <Key className="w-3 h-3" />
                    </div>
                  )}
                  <img src={u.images[0]} className={`w-full h-28 object-cover rounded-xl mb-3 transition-all ${isSelected ? 'scale-105' : ''}`} alt="unit" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 rounded-[1.5rem] pointer-events-none"></div>
                  
                  <div className="relative z-10 px-1">
                    <div className={`font-black text-sm mb-1 line-clamp-1 ${isSelected ? 'text-brand-950' : 'text-gray-900'}`}>{u.name}</div>
                    <div className="text-xs text-brand-600 font-bold">{u.type}</div>
                  </div>
               </motion.div>
             );
          })}
        </div>

        {/* Right Col - Premium Calendar Mock */}
        <Card padding="none" className="bg-white flex-1 overflow-hidden shadow-sm flex flex-col border border-gray-100 p-6 lg:p-8 rounded-[2rem]">
           <AnimatePresence mode="wait">
             {!selectedUnit ? (
               <motion.div 
                 key="empty"
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.95 }}
                 className="flex-1 flex flex-col items-center justify-center text-center p-8"
               >
                 <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                   <CalendarDays className="w-8 h-8 text-gray-400" />
                 </div>
                 <h2 className="text-2xl font-black text-brand-950 mb-2">اختر وحدة لعرض التقويم</h2>
                 <p className="text-gray-500 font-medium">يرجى اختيار إحدى وحداتك من القائمة الجانبية لمعرفة تفاصيل الأيام المتاحة والمحجوزة.</p>
               </motion.div>
             ) : (
               <motion.div 
                 key="calendar"
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 className="flex flex-col h-full"
               >
                 <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
                    <h2 className="text-2xl font-black text-brand-950 tracking-tight">يوليو 2026</h2>
                    <div className="flex gap-3">
                       <button className="p-3 rounded-xl bg-gray-50 text-gray-600 hover:bg-brand-950 hover:text-white transition-colors shadow-sm"><ChevronRight className="w-5 h-5" /></button>
                       <button className="p-3 rounded-xl bg-gray-50 text-gray-600 hover:bg-brand-950 hover:text-white transition-colors shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
                    </div>
                 </div>

                 {/* Calendar Grid Header */}
                 <div className="grid grid-cols-7 gap-2 lg:gap-4 mb-4 text-center">
                   {['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'].map(d => (
                      <div key={d} className="text-sm font-bold text-gray-400 uppercase tracking-widest">{d}</div>
                   ))}
                 </div>
                 
                 <div className="grid grid-cols-7 gap-2 lg:gap-4 flex-1 override-calendar-grid">
                   {/* Empty days placeholder */}
                   {Array.from({length: 3}).map((_, i) => <div key={`empty-${i}`} className="bg-transparent" />)}
                   
                   {/* Days 1-31 */}
                   {Array.from({length: 31}).map((_, i) => {
                     const day = i + 1;
                     const isBooked = (day >= 20 && day <= 25) || (day >= 28 && day <= 30);
                     const isBlocked = (day >= 10 && day <= 12);
                     
                     return (
                       <motion.div 
                         whileHover={{ scale: 1.05, y: -2 }}
                         key={day} 
                         className={`rounded-[1.25rem] border-2 flex flex-col p-2 lg:p-3 transition-all cursor-pointer overflow-hidden relative group ${
                           isBooked ? 'bg-[#ECFDF5] border-[#A7F3D0] shadow-[0_4px_14px_rgba(16,185,129,0.1)]' :
                           isBlocked ? 'bg-gray-50 border-gray-200' :
                           'bg-white hover:border-brand-300 border-gray-100 hover:shadow-md'
                         }`}
                       >
                          <div className={`text-sm lg:text-base font-black mb-1 ${isBooked ? 'text-emerald-700' : isBlocked ? 'text-gray-400' : 'text-brand-950'}`}>{day}</div>
                          
                          {isBooked && (
                             <div className="mt-auto bg-emerald-500 text-white text-[10px] lg:text-xs font-bold px-2 py-1.5 rounded-lg truncate text-center shadow-sm">
                               محجوز
                             </div>
                          )}
                          {isBlocked && (
                             <div className="mt-auto bg-gray-200 text-gray-500 text-[10px] lg:text-xs font-bold px-2 py-1.5 rounded-lg flex items-center justify-center gap-1">
                               <Lock className="w-3 h-3" />
                               <span className="hidden lg:inline">مغلق</span>
                             </div>
                          )}
                          {!isBooked && !isBlocked && (
                             <div className="mt-auto text-gray-300 text-[10px] font-bold px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity text-center">
                               متاح
                             </div>
                          )}
                       </motion.div>
                     )
                   })}
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
        </Card>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 20px;
        }
      `}</style>
    </div>
  );
}