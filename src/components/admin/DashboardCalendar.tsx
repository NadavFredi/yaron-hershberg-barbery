
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';

interface DashboardCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date | undefined) => void;
}

const DashboardCalendar = ({ selectedDate, onDateSelect }: DashboardCalendarProps) => {
  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="text-lg">לוח שנה</CardTitle>
      </CardHeader>
      <CardContent>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onDateSelect}
          className="pointer-events-auto"
        />
      </CardContent>
    </Card>
  );
};

export default DashboardCalendar;
