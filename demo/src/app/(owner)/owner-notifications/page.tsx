import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MOCK_NOTIFICATIONS } from '@/lib/mock-data';
import { Bell, CheckCircle2 } from 'lucide-react';

export default function OwnerNotificationsPage() {
  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end gap-4 md:gap-6 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">الإشعارات</h1>
          <p className="text-gray-500 font-medium">تنبيهات جاهزة للعرض مع badges للحالة المقروءة.</p>
        </div>
        <Badge variant="warning" className="px-4 py-2 text-sm">{MOCK_NOTIFICATIONS.filter((notification) => notification.unread).length} غير مقروء</Badge>
      </div>

      <Card>
        <div className="space-y-4">
          {MOCK_NOTIFICATIONS.map((notification) => (
            <div key={notification.id} className="flex items-start justify-between gap-3 md:gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-brand-600 shadow-sm">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">{notification.title}</div>
                  <div className="text-sm text-gray-500 mt-1">{notification.description}</div>
                  <div className="text-xs text-gray-400 mt-2">{notification.time}</div>
                </div>
              </div>
              <Badge variant={notification.unread ? 'warning' : 'success'} className="shrink-0">{notification.unread ? 'Unread' : 'Read'}</Badge>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-emerald-700 font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            كل التنبيهات التجريبية جاهزة للعرض
          </div>
        </div>
      </Card>
    </div>
  );
}