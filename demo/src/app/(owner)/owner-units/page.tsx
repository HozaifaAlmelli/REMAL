import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MOCK_UNITS } from '@/lib/mock-data';
import { Building2, Star, Wallet } from 'lucide-react';

export default function OwnerUnitsPage() {
  const ownerUnits = MOCK_UNITS.filter((unit) => unit.owner.name === 'أحمد منصور');

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end gap-4 md:gap-6 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">وحداتي</h1>
          <p className="text-gray-500 font-medium">نسخة عرض بسيطة لوحدات المالك مع badges للحالة والتقييم.</p>
        </div>
        <Badge variant="success" className="px-4 py-2 text-sm">{ownerUnits.length} وحدات</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ownerUnits.map((unit) => (
          <Card key={unit.id} className="overflow-hidden">
            <img src={unit.images[0]} alt={unit.name} className="h-48 w-full object-cover rounded-xl mb-5" />
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{unit.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{unit.type} • {unit.capacity} ضيوف</p>
              </div>
              <Badge variant={unit.status === 'active' ? 'success' : 'warning'}>{unit.status === 'active' ? 'نشطة' : 'موقوفة'}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> {unit.bedrooms} غرف</span>
              <span className="flex items-center gap-2"><Star className="w-4 h-4 text-amber-500 fill-amber-500" /> {unit.rating}</span>
              <span className="flex items-center gap-2"><Wallet className="w-4 h-4" /> EGP {unit.basePrice.toLocaleString()}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}