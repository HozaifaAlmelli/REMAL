"use client";

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Wallet, ArrowDownCircle, ArrowUpRight, HandCoins } from 'lucide-react';

const OWNER_TRANSACTIONS = [
  { id: 1, unit: 'فيلا بانورامية بالدور 35', description: 'إيراد حجز #MB2309', total: 42500, myCut: 34000, type: 'credit', status: 'ready', date: '21 يوليو 2026' },
  { id: 2, unit: 'فيلا بانورامية بالدور 35', description: 'تحويل نقدي للمالك', total: 0, myCut: -85000, type: 'debit', status: 'paid', date: '1 يوليو 2026' },
  { id: 3, unit: 'فيلا بانورامية بالدور 35', description: 'إيراد حجز #MB1023', total: 106250, myCut: 85000, type: 'credit', status: 'paid', date: '28 يونيو 2026' }
];

export default function OwnerEarningsPage() {
  const [avgNightRate, setAvgNightRate] = React.useState(2500);
  const [occupiedNights, setOccupiedNights] = React.useState(15);

  const expectedRevenue = avgNightRate * occupiedNights;

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500 gap-6 md:gap-8">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">أرباحي ودفعاتي</h1>
          <p className="text-gray-500 font-medium">متابعة إيرادات حجوزاتك، ودفعاتك المحولة من Kaza Booking.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 shrink-0">
        <Card padding="lg" className="bg-white border-none shadow-soft">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl"><Wallet className="w-6 h-6" /></div>
            <div className="text-gray-500 font-medium">إجمالي المستحق لي</div>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 mb-2">EGP 34,000</div>
          <div className="flex items-center gap-1 text-sm text-emerald-600 font-medium">
             <span className="bg-emerald-50 px-2 py-0.5 rounded-full">+ 1 حجز مؤكد</span>
          </div>
        </Card>

        <Card padding="lg" className="bg-white border-none shadow-soft">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><HandCoins className="w-6 h-6" /></div>
            <div className="text-gray-500 font-medium">إجمالي ما تم تحويله بالكامل</div>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 mb-2">EGP 136,000</div>
          <div className="text-sm text-gray-400 font-medium">
            حتى آخر شهر
          </div>
        </Card>
      </div>

      <Card padding="none" className="bg-white border border-gray-100 shadow-soft rounded-3xl overflow-hidden shrink-0">
        <div className="p-5 md:p-8">
          <div className="text-center mb-6 md:mb-8">
            <h2 className="text-2xl md:text-4xl font-black text-brand-950 tracking-tight mb-2">احسب أرباحك الشهرية المتوقعة</h2>
            <p className="text-gray-500 font-medium">اختار متوسط سعر الليلة وعدد الليالي المحجوزة وشوف ناتج الأرباح فورًا.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-8 items-stretch">
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 md:p-6 space-y-7">
              <div>
                <div className="flex items-center justify-between mb-3 gap-3">
                  <p className="text-sm md:text-lg font-bold text-brand-950">متوسط سعر الليلة</p>
                  <p className="text-lg md:text-2xl font-black text-accent-600">{avgNightRate.toLocaleString()} EGP</p>
                </div>
                <input
                  type="range"
                  min={500}
                  max={10000}
                  step={100}
                  value={avgNightRate}
                  onChange={(event) => setAvgNightRate(Number(event.target.value))}
                  className="w-full h-2 accent-accent-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3 gap-3">
                  <p className="text-sm md:text-lg font-bold text-brand-950">عدد الليالي المتوقعة في الشهر</p>
                  <p className="text-lg md:text-2xl font-black text-accent-600">{occupiedNights} ليلة</p>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={occupiedNights}
                  onChange={(event) => setOccupiedNights(Number(event.target.value))}
                  className="w-full h-2 accent-accent-600 cursor-pointer"
                />
              </div>

              <p className="text-sm text-gray-400 font-medium">* الأرقام تقديرية وتختلف حسب نوع الوحدة، الموسم، ومعدل الطلب.</p>
            </div>

            <div className="rounded-2xl bg-brand-900 text-white p-5 md:p-8 flex flex-col justify-center text-center">
              <p className="text-lg md:text-3xl font-black mb-4">الأرباح الشهرية المتوقعة</p>
              <div className="text-4xl md:text-6xl font-black tracking-tight text-accent-400 mb-6">
                {expectedRevenue.toLocaleString()} <span className="text-white text-2xl md:text-4xl">EGP</span>
              </div>
              <button className="bg-white text-brand-900 font-bold py-3.5 px-6 rounded-full hover:bg-gray-100 transition-colors">
                اطلب تقييم فعلي لوحدتك
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card padding="none" className="bg-white flex-1 overflow-hidden shadow-soft flex flex-col border-none min-h-[320px]">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">سجل الحساب المالي</h2>
        </div>
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right">
            <thead className="bg-gray-50/50 text-gray-500 text-sm border-b border-gray-100">
              <tr>
                <th className="font-medium p-4 pl-6">التاريخ</th>
                <th className="font-medium p-4">الوصف</th>
                <th className="font-medium p-4">قيمة الإيراد بالكامل للوحدة</th>
                <th className="font-medium p-4">ربحي (بدون العمولة)</th>
                <th className="font-medium p-4">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
               {OWNER_TRANSACTIONS.map(txn => (
                 <tr key={txn.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 pl-6 font-medium text-gray-500">{txn.date}</td>
                    <td className="p-4">
                       <div className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                         {txn.type === 'debit' ? <ArrowDownCircle className="w-4 h-4 text-orange-500" /> : <ArrowUpRight className="w-4 h-4 text-emerald-500" />}
                         {txn.description}
                       </div>
                       <div className="text-xs text-gray-500 truncate max-w-[200px]">{txn.unit}</div>
                    </td>
                    <td className="p-4 text-gray-500 font-medium">{txn.type === 'debit' ? '-' : `EGP ${txn.total.toLocaleString()}`}</td>
                    <td className={`p-4 font-bold ${txn.type === 'debit' ? 'text-orange-600' : 'text-emerald-600'}`}>
                       {txn.type === 'debit' ? '-' : '+ '} EGP {Math.abs(txn.myCut).toLocaleString()}
                    </td>
                    <td className="p-4">
                       {txn.status === 'paid' ? 
                         <Badge variant="neutral">تم التسوية والتحويل</Badge> : 
                         <Badge variant="success">رصيد متاح</Badge>
                       }
                    </td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}