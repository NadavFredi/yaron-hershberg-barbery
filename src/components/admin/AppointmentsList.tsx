
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Appointment } from '@/types';

interface AppointmentsListProps {
  selectedDate: Date;
  dayAppointments: Appointment[];
  viewMode: 'day' | 'week';
  onViewModeChange: (mode: 'day' | 'week') => void;
}

const AppointmentsList = ({ 
  selectedDate, 
  dayAppointments, 
  viewMode, 
  onViewModeChange 
}: AppointmentsListProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'מאושר': return 'bg-green-100 text-green-800';
      case 'ממתין': return 'bg-yellow-100 text-yellow-800';
      case 'בוטל': return 'bg-red-100 text-red-800';
      case 'הושלם': return 'bg-primary/20 text-primary';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStationColor = (stationId: string) => {
    const colors = [
      'bg-primary/20 text-purple-800',
      'bg-green-100 text-green-800',
      'bg-primary/20 text-primary',
    ];
    return colors[parseInt(stationId) - 1] || colors[0];
  };

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">
            לוח זמנים - {format(selectedDate, 'PPP', { locale: he })}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('day')}
            >
              יום
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('week')}
            >
              שבוע
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {dayAppointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              אין תורים מתוכננים לתאריך זה
            </div>
          ) : (
            dayAppointments
              .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
              .map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold">
                        {format(new Date(appointment.startTime), 'HH:mm')}
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(appointment.endTime), 'HH:mm')}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{appointment.customerName}</h4>
                        <Badge className={cn("text-xs", getStatusColor(appointment.status))}>
                          {appointment.status}
                        </Badge>
                        <Badge className={cn("text-xs", getStationColor(appointment.stationId))}>
                          {appointment.stationName}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">{appointment.dogName}</span>
                        <span className="mx-2">•</span>
                        <span>{appointment.serviceName}</span>
                        <span className="mx-2">•</span>
                        <span>{appointment.customerPhone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default">
                      ערוך
                    </Button>
                    <Button size="sm" variant="outline">
                      ביטול
                    </Button>
                  </div>
                </div>
              ))
          )}
        </div>
        
        <div className="mt-6 pt-4 border-t">
          <Button className="w-full" variant="outline">
            + צור תור חדש
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppointmentsList;
