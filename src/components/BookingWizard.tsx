
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { CalendarIcon, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BookingStep } from '@/types';
import { treatmentTypes, services, timeMatrix, adminAvailability, appointments, stations } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';

const BookingWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [bookingData, setBookingData] = useState<BookingStep>({
    serviceId: '',
    treatmentTypeId: '',
  });
  const [availableSlots, setAvailableSlots] = useState<{ time: string; stationId: string }[]>([]);

  const selectedService = services.find(s => s.id === bookingData.serviceId);
  const selectedTreatmentType = treatmentTypes.find(b => b.id === bookingData.treatmentTypeId);

  const calculateAvailableSlots = (date: Date) => {
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // Convert Sunday=0 to Sunday=7
    const availability = adminAvailability.find(a => a.dayOfWeek === dayOfWeek && a.isActive);
    
    if (!availability) return [];

    // Get possible durations for this service+treatmentType combination
    const possibleTimes = timeMatrix.filter(tm => 
      tm.serviceId === bookingData.serviceId && tm.treatmentTypeId === bookingData.treatmentTypeId
    );

    const slots: { time: string; stationId: string }[] = [];
    const startHour = parseInt(availability.startTime.split(':')[0]);
    const endHour = parseInt(availability.endTime.split(':')[0]);

    // Check each station and time slot
    possibleTimes.forEach(pt => {
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const slotStart = new Date(date);
          slotStart.setHours(hour, minute, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + pt.durationMinutes * 60000);

          // Check if this slot conflicts with existing appointments
          const conflict = appointments.some(apt => {
            if (apt.stationId !== pt.stationId) return false;
            const aptStart = new Date(apt.startTime);
            const aptEnd = new Date(apt.endTime);
            return (slotStart < aptEnd && slotEnd > aptStart);
          });

          if (!conflict && slotEnd.getHours() <= endHour) {
            slots.push({ time: timeStr, stationId: pt.stationId });
          }
        }
      }
    });

    return slots.sort((a, b) => a.time.localeCompare(b.time));
  };

  const handleServiceTreatmentTypeNext = () => {
    if (!bookingData.serviceId || !bookingData.treatmentTypeId) {
      toast({
        title: "שגיאה",
        description: "אנא בחר שירות וסגנון מועדף",
        variant: "destructive"
      });
      return;
    }
    setCurrentStep(2);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setBookingData({ ...bookingData, selectedDate: date });
    const slots = calculateAvailableSlots(date);
    setAvailableSlots(slots);
  };

  const handleTimeSelect = (time: string, stationId: string) => {
    setBookingData({ ...bookingData, selectedTime: time });
    setCurrentStep(3);
  };

  const handleBookingSubmit = () => {
    if (!bookingData.customerName || !bookingData.customerPhone || !bookingData.treatmentName) {
      toast({
        title: "שגיאה",
        description: "אנא מלא את כל השדות הנדרשים",
        variant: "destructive"
      });
      return;
    }

    // Here would be the actual booking logic
    toast({
      title: "התור נקבע בהצלחה!",
      description: `התור של ${bookingData.treatmentName} נקבע ל-${format(bookingData.selectedDate!, 'dd/MM/yyyy', { locale: he })} בשעה ${bookingData.selectedTime}`,
    });

    // Reset wizard
    setCurrentStep(4);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Progress Indicator */}
      <div className="flex justify-center space-x-4 mb-8">
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
              currentStep >= step
                ? "bg-primary text-primary-foreground border-primary"
                : "border-gray-300 text-gray-500"
            )}
          >
            {currentStep > step ? <CheckCircle className="w-5 h-5" /> : step}
          </div>
        ))}
      </div>

      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">בחירת שירות וסגנון מועדף</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>איזה שירות תרצו?</Label>
              <Select value={bookingData.serviceId} onValueChange={(value) => setBookingData({...bookingData, serviceId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר שירות" />
                </SelectTrigger>
                <SelectContent>
                  {services.map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>איזה סגנון טיפול תרצה?</Label>
              <Select value={bookingData.treatmentTypeId} onValueChange={(value) => setBookingData({...bookingData, treatmentTypeId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר גזע" />
                </SelectTrigger>
                <SelectContent>
                  {treatmentTypes.map(treatmentType => (
                    <SelectItem key={treatmentType.id} value={treatmentType.id}>
                      {treatmentType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleServiceTreatmentTypeNext} className="w-full">
              המשך לבחירת תאריך ושעה
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">בחירת תאריך ושעה</CardTitle>
            <p className="text-center text-muted-foreground">
              {selectedService?.name} עבור {selectedTreatmentType?.name}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>בחר תאריך</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-right font-normal",
                      !bookingData.selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {bookingData.selectedDate ? (
                      format(bookingData.selectedDate, "PPP", { locale: he })
                    ) : (
                      <span>בחר תאריך</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={bookingData.selectedDate}
                    onSelect={handleDateSelect}
                    disabled={(date) =>
                      date < new Date() || date.getDay() === 0 // Disable past dates and Sundays
                    }
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {availableSlots.length > 0 && (
              <div className="space-y-2">
                <Label>שעות פנויות</Label>
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      onClick={() => handleTimeSelect(slot.time, slot.stationId)}
                      className="hover:bg-primary hover:text-primary-foreground"
                    >
                      {slot.time}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {bookingData.selectedDate && availableSlots.length === 0 && (
              <p className="text-center text-muted-foreground">
                אין שעות פנויות בתאריך זה. אנא בחר תאריך אחר.
              </p>
            )}

            <Button 
              variant="outline" 
              onClick={() => setCurrentStep(1)}
              className="w-full"
            >
              חזור לשלב הקודם
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">פרטים אישיים</CardTitle>
            <p className="text-center text-muted-foreground">
              {selectedService?.name} • {selectedTreatmentType?.name}<br/>
              {bookingData.selectedDate && format(bookingData.selectedDate, "PPP", { locale: he })} בשעה {bookingData.selectedTime}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="customerName">שם מלא *</Label>
              <Input
                id="customerName"
                value={bookingData.customerName || ''}
                onChange={(e) => setBookingData({...bookingData, customerName: e.target.value})}
                placeholder="הכנס את שמך המלא"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerPhone">טלפון *</Label>
              <Input
                id="customerPhone"
                value={bookingData.customerPhone || ''}
                onChange={(e) => setBookingData({...bookingData, customerPhone: e.target.value})}
                placeholder="052-1234567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="treatmentName">שם הלקוח *</Label>
              <Input
                id="treatmentName"
                value={bookingData.treatmentName || ''}
                onChange={(e) => setBookingData({...bookingData, treatmentName: e.target.value})}
                placeholder="הכנס את שם הלקוח"
              />
            </div>

            <div className="space-y-2">
              <Button onClick={handleBookingSubmit} className="w-full">
                קבע תור
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(2)}
                className="w-full"
              >
                חזור לבחירת תאריך
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl text-green-600">התור נקבע בהצלחה!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
            <div className="space-y-2">
              <p className="text-lg font-semibold">התור של {bookingData.treatmentName} נקבע</p>
              <p className="text-muted-foreground">
                {selectedService?.name} • {selectedTreatmentType?.name}<br/>
                {bookingData.selectedDate && format(bookingData.selectedDate, "PPP", { locale: he })} בשעה {bookingData.selectedTime}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              אימייל אישור נשלח אליך, ונציג יצור איתך קשר לפני התור.
            </p>
            <Button 
              onClick={() => {
                setCurrentStep(1);
                setBookingData({ serviceId: '', treatmentTypeId: '' });
                setAvailableSlots([]);
              }}
              className="w-full"
            >
              קבע תור נוסף
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BookingWizard;
