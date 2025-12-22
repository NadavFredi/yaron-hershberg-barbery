
import { Card, CardContent } from '@/components/ui/card';
import { CalendarIcon, Users, Clock, CheckCircle } from 'lucide-react';
import { Appointment } from '@/types';
import { stations } from '@/data/mockData';

interface StatsCardsProps {
  dayAppointments: Appointment[];
}

const StatsCards = ({ dayAppointments }: StatsCardsProps) => {
  const confirmedAppointments = dayAppointments.filter(apt => apt.status === 'מאושר').length;
  const pendingAppointments = dayAppointments.filter(apt => apt.status === 'ממתין').length;

  return (
    <div className="lg:col-span-4 grid md:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-primary/20 rounded-lg">
              <CalendarIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">תורים היום</p>
              <p className="text-2xl font-bold text-gray-900">{dayAppointments.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">תורים מאושרים</p>
              <p className="text-2xl font-bold text-gray-900">{confirmedAppointments}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">ממתינים לאישור</p>
              <p className="text-2xl font-bold text-gray-900">{pendingAppointments}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">עמדות פעילות</p>
              <p className="text-2xl font-bold text-gray-900">{stations.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsCards;
