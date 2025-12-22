import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, X } from 'lucide-react';
import { DateRange } from 'react-day-picker';
interface TimeSlot {
  startTime: string;
  endTime: string;
}
interface WeeklyHours {
  [key: string]: {
    enabled: boolean;
    timeSlots: TimeSlot[];
    useBusinessHours?: boolean;
  };
}
interface BlockedDate {
  date: Date;
  endDate?: Date;
  reason?: string;
  isFullDay: boolean;
  startTime?: string;
  endTime?: string;
  stationId?: string;
}
const DAYS_OF_WEEK = [{
  key: 'sunday',
  name: 'יום ראשון'
}, {
  key: 'monday',
  name: 'יום שני'
}, {
  key: 'tuesday',
  name: 'יום שלישי'
}, {
  key: 'wednesday',
  name: 'יום רביעי'
}, {
  key: 'thursday',
  name: 'יום חמישי'
}, {
  key: 'friday',
  name: 'יום שישי'
}, {
  key: 'saturday',
  name: 'יום שבת'
}];
const MOCK_STATIONS = [{
  id: '1',
  name: 'עמדה 1 - יוסי'
}, {
  id: '2',
  name: 'עמדה 2 - דנה'
}, {
  id: '3',
  name: 'עמדה 3 - מיכל'
}];
const AvailabilityManagement = () => {
  const [businessHours, setBusinessHours] = useState<WeeklyHours>({
    sunday: {
      enabled: true,
      timeSlots: [{
        startTime: '09:00',
        endTime: '17:00'
      }]
    },
    monday: {
      enabled: true,
      timeSlots: [{
        startTime: '09:00',
        endTime: '17:00'
      }]
    },
    tuesday: {
      enabled: true,
      timeSlots: [{
        startTime: '09:00',
        endTime: '17:00'
      }]
    },
    wednesday: {
      enabled: true,
      timeSlots: [{
        startTime: '09:00',
        endTime: '17:00'
      }]
    },
    thursday: {
      enabled: true,
      timeSlots: [{
        startTime: '09:00',
        endTime: '17:00'
      }]
    },
    friday: {
      enabled: false,
      timeSlots: [{
        startTime: '09:00',
        endTime: '17:00'
      }]
    },
    saturday: {
      enabled: false,
      timeSlots: [{
        startTime: '09:00',
        endTime: '17:00'
      }]
    }
  });
  const [stationHours, setStationHours] = useState<{
    [stationId: string]: WeeklyHours;
  }>({});
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [businessBlockedDates, setBusinessBlockedDates] = useState<BlockedDate[]>([]);
  const [stationBlockedDates, setStationBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined);
  const [blockingDialogOpen, setBlockingDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [isFullDayBlock, setIsFullDayBlock] = useState(true);
  const [blockStartTime, setBlockStartTime] = useState('09:00');
  const [blockEndTime, setBlockEndTime] = useState('17:00');
  const [currentTab, setCurrentTab] = useState('business');
  const handleBusinessDayToggle = (dayKey: string, enabled: boolean) => {
    setBusinessHours(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        enabled
      }
    }));
  };
  const handleBusinessTimeChange = (dayKey: string, slotIndex: number, field: 'startTime' | 'endTime', value: string) => {
    setBusinessHours(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        timeSlots: prev[dayKey].timeSlots.map((slot, index) => index === slotIndex ? {
          ...slot,
          [field]: value
        } : slot)
      }
    }));
  };
  const addBusinessTimeSlot = (dayKey: string) => {
    setBusinessHours(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        timeSlots: [...prev[dayKey].timeSlots, {
          startTime: '09:00',
          endTime: '17:00'
        }]
      }
    }));
  };
  const removeBusinessTimeSlot = (dayKey: string, slotIndex: number) => {
    setBusinessHours(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        timeSlots: prev[dayKey].timeSlots.filter((_, index) => index !== slotIndex)
      }
    }));
  };
  const applyToAllBusinessDays = () => {
    const sundayHours = businessHours.sunday;
    const updatedHours = {
      ...businessHours
    };
    Object.keys(updatedHours).forEach(dayKey => {
      if (updatedHours[dayKey].enabled) {
        updatedHours[dayKey] = {
          ...updatedHours[dayKey],
          timeSlots: [...sundayHours.timeSlots]
        };
      }
    });
    setBusinessHours(updatedHours);
  };
  const getStationHours = (stationId: string): WeeklyHours => {
    if (!stationHours[stationId]) {
      const defaultHours: WeeklyHours = {};
      DAYS_OF_WEEK.forEach(day => {
        defaultHours[day.key] = {
          enabled: businessHours[day.key].enabled,
          timeSlots: [...businessHours[day.key].timeSlots],
          useBusinessHours: true
        };
      });
      return defaultHours;
    }
    return stationHours[stationId];
  };
  const handleStationDayToggle = (dayKey: string, enabled: boolean) => {
    if (!selectedStation) return;
    setStationHours(prev => ({
      ...prev,
      [selectedStation]: {
        ...getStationHours(selectedStation),
        [dayKey]: {
          ...getStationHours(selectedStation)[dayKey],
          enabled
        }
      }
    }));
  };
  const handleStationTimeChange = (dayKey: string, slotIndex: number, field: 'startTime' | 'endTime', value: string) => {
    if (!selectedStation) return;
    const currentHours = getStationHours(selectedStation);
    setStationHours(prev => ({
      ...prev,
      [selectedStation]: {
        ...currentHours,
        [dayKey]: {
          ...currentHours[dayKey],
          timeSlots: currentHours[dayKey].timeSlots.map((slot, index) => index === slotIndex ? {
            ...slot,
            [field]: value
          } : slot)
        }
      }
    }));
  };
  const addStationTimeSlot = (dayKey: string) => {
    if (!selectedStation) return;
    const currentHours = getStationHours(selectedStation);
    setStationHours(prev => ({
      ...prev,
      [selectedStation]: {
        ...currentHours,
        [dayKey]: {
          ...currentHours[dayKey],
          timeSlots: [...currentHours[dayKey].timeSlots, {
            startTime: '09:00',
            endTime: '17:00'
          }]
        }
      }
    }));
  };
  const removeStationTimeSlot = (dayKey: string, slotIndex: number) => {
    if (!selectedStation) return;
    const currentHours = getStationHours(selectedStation);
    setStationHours(prev => ({
      ...prev,
      [selectedStation]: {
        ...currentHours,
        [dayKey]: {
          ...currentHours[dayKey],
          timeSlots: currentHours[dayKey].timeSlots.filter((_, index) => index !== slotIndex)
        }
      }
    }));
  };
  const handleUseBusinessHours = (dayKey: string, useBusinessHours: boolean) => {
    if (!selectedStation) return;
    const currentStationHours = getStationHours(selectedStation);
    setStationHours(prev => ({
      ...prev,
      [selectedStation]: {
        ...currentStationHours,
        [dayKey]: {
          ...currentStationHours[dayKey],
          useBusinessHours,
          timeSlots: useBusinessHours ? [...businessHours[dayKey].timeSlots] : currentStationHours[dayKey].timeSlots
        }
      }
    }));
  };
  const handleDateSelect = (date: Date | DateRange | undefined) => {
    if (!date) return;
    if (date instanceof Date) {
      setSelectedDate(date);
      setSelectedRange(undefined);
    } else {
      setSelectedRange(date);
      setSelectedDate(date.from);
    }
    setBlockingDialogOpen(true);
  };
  const blockDate = () => {
    if (selectedDate) {
      const newBlock: BlockedDate = {
        date: selectedDate,
        endDate: selectedRange?.to || undefined,
        reason: blockReason,
        isFullDay: isFullDayBlock,
        startTime: isFullDayBlock ? undefined : blockStartTime,
        endTime: isFullDayBlock ? undefined : blockEndTime,
        stationId: currentTab === 'stations' ? selectedStation : undefined
      };
      if (currentTab === 'business') {
        setBusinessBlockedDates(prev => [...prev, newBlock]);
      } else {
        setStationBlockedDates(prev => [...prev, newBlock]);
      }
      setBlockingDialogOpen(false);
      setBlockReason('');
      setSelectedDate(undefined);
      setSelectedRange(undefined);
    }
  };
  const removeBlockedDate = (index: number, isBusinessBlock: boolean) => {
    if (isBusinessBlock) {
      setBusinessBlockedDates(prev => prev.filter((_, i) => i !== index));
    } else {
      setStationBlockedDates(prev => prev.filter((_, i) => i !== index && prev[i].stationId === selectedStation));
    }
  };
  const isDateBlocked = (date: Date) => {
    const businessBlocked = businessBlockedDates.some(blocked => {
      const blockStart = blocked.date;
      const blockEnd = blocked.endDate || blocked.date;
      return date >= blockStart && date <= blockEnd;
    });
    if (currentTab === 'business') {
      return businessBlocked;
    }
    const stationBlocked = stationBlockedDates.some(blocked => {
      if (blocked.stationId !== selectedStation) return false;
      const blockStart = blocked.date;
      const blockEnd = blocked.endDate || blocked.date;
      return date >= blockStart && date <= blockEnd;
    });
    return businessBlocked || stationBlocked;
  };
  const getBlockedDatesForCurrentView = () => {
    if (currentTab === 'business') {
      return businessBlockedDates;
    }
    return stationBlockedDates.filter(blocked => blocked.stationId === selectedStation);
  };
  const formatDateRange = (start: Date, end?: Date) => {
    if (!end || start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString('he-IL');
    }
    return `${start.toLocaleDateString('he-IL')} - ${end.toLocaleDateString('he-IL')}`;
  };
  return <div className="max-w-6xl mx-auto px-4 py-8" dir="rtl">
      <div className="mb-8 text-right">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">שעות הפעילות שלנו</h1>
        <p className="text-gray-600">כאן קובעים את שעות העבודה הקבועות וחוסמים תאריכים לחופשות או אירועים מיוחדים</p>
      </div>

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="business">זמינות כללית של העסק</TabsTrigger>
          <TabsTrigger value="stations">זמינות לפי עמדות</TabsTrigger>
        </TabsList>

        <TabsContent value="business">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Business Weekly Hours - Right Side */}
            <Card className="order-2">
              <CardHeader>
                <CardTitle className="text-right">שעות עבודה שבועיות</CardTitle>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={applyToAllBusinessDays} className="text-sm">
                    הגדר שעות אחידות והחל על הכל
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {DAYS_OF_WEEK.map(day => <div key={day.key} className="p-4 border rounded-lg text-right" dir="rtl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={businessHours[day.key].enabled} onCheckedChange={enabled => handleBusinessDayToggle(day.key, enabled)} />
                        <Label className="font-medium">{day.name}</Label>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {businessHours[day.key].enabled && <Button variant="ghost" size="sm" onClick={() => addBusinessTimeSlot(day.key)} className="p-1 h-6 w-6 rounded-full">
                            <Plus className="w-3 h-3" />
                          </Button>}
                      </div>
                    </div>
                    
                    {businessHours[day.key].enabled && <div className="space-y-2">
                        {businessHours[day.key].timeSlots.map((slot, slotIndex) => <div key={slotIndex} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">מ:</Label>
                              <Input type="time" value={slot.startTime} onChange={e => handleBusinessTimeChange(day.key, slotIndex, 'startTime', e.target.value)} className="w-32 text-center" dir="rtl" />
                              <Label className="text-sm">עד:</Label>
                              <Input type="time" value={slot.endTime} onChange={e => handleBusinessTimeChange(day.key, slotIndex, 'endTime', e.target.value)} className="w-32 text-center" dir="rtl" />
                            </div>
                            <div className="flex items-center gap-2">
                              {businessHours[day.key].timeSlots.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeBusinessTimeSlot(day.key, slotIndex)} className="p-1 h-6 w-6 rounded-full text-red-600 hover:text-red-800">
                                  <X className="w-3 h-3" />
                                </Button>}
                            </div>
                          </div>)}
                      </div>}
                  </div>)}
              </CardContent>
            </Card>

            {/* Business Date Blocking - Left Side */}
            <Card className="order-1">
              <CardHeader>
                <CardTitle className="text-right">חסימת זמנים מיוחדים</CardTitle>
                <p className="text-sm text-gray-600 text-right">צריכים לסגור את העסק ליום חופש או לחסום כמה שעות? עשו זאת כאן</p>
              </CardHeader>
              <CardContent>
                <Calendar mode="single" onSelect={handleDateSelect} className="w-full pointer-events-auto rounded-md border" modifiers={{
                blocked: date => isDateBlocked(date)
              }} modifiersStyles={{
                blocked: {
                  backgroundColor: '#fee2e2',
                  color: '#dc2626'
                }
              }} formatters={{
                formatWeekdayName: date => {
                  const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
                  return days[date.getDay()];
                },
                formatMonthCaption: date => {
                  const months = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
                  return `${months[date.getMonth()]} ${date.getFullYear()}`;
                }
              }} weekStartsOn={0} />
                
                {businessBlockedDates.length > 0 && <div className="mt-6">
                    <h3 className="font-medium mb-3 text-right">תאריכים חסומים:</h3>
                    <div className="space-y-2">
                      {businessBlockedDates.map((blocked, index) => <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                          <Button variant="ghost" size="sm" onClick={() => removeBlockedDate(index, true)} className="text-red-600 hover:text-red-800">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <div className="text-right">
                            <div className="font-medium">
                              {formatDateRange(blocked.date, blocked.endDate)}
                            </div>
                            {blocked.reason && <div className="text-sm text-gray-600">{blocked.reason}</div>}
                            {!blocked.isFullDay && <div className="text-sm text-gray-600">
                                {blocked.startTime} - {blocked.endTime}
                              </div>}
                          </div>
                        </div>)}
                    </div>
                  </div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stations">
          <div className="mb-6 text-right">
            <div className="max-w-md mx-auto">
              <Label className="text-lg font-medium block mb-3 text-right">ניהול זמינות עבור:</Label>
              <Select value={selectedStation} onValueChange={setSelectedStation}>
                <SelectTrigger className="w-full text-right">
                  <SelectValue placeholder="בחר עמדה לניהול" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_STATIONS.map(station => <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedStation && <div className="grid lg:grid-cols-2 gap-8">
              {/* Station Date Blocking - Left Side */}
              <Card className="order-1">
                <CardHeader>
                  <CardTitle className="text-right">
                    חופשות וחריגות של {MOCK_STATIONS.find(s => s.id === selectedStation)?.name}
                  </CardTitle>
                  <p className="text-sm text-gray-600 text-right">
                    כאן קובעים את שעות העבודה הקבועות וחוסמים תאריכים לחופשות או אירועים מיוחדים
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-end">
                    <Calendar mode="single" onSelect={handleDateSelect} className="w-full pointer-events-auto rounded-md border" modifiers={{
                    blocked: date => isDateBlocked(date),
                    businessClosed: date => businessBlockedDates.some(blocked => {
                      const blockStart = blocked.date;
                      const blockEnd = blocked.endDate || blocked.date;
                      return date >= blockStart && date <= blockEnd;
                    })
                  }} modifiersStyles={{
                    blocked: {
                      backgroundColor: '#dbeafe',
                      color: '#1e40af'
                    },
                    businessClosed: {
                      backgroundColor: '#f3f4f6',
                      color: '#6b7280'
                    }
                  }} formatters={{
                    formatWeekdayName: date => {
                      const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
                      return days[date.getDay()];
                    },
                    formatMonthCaption: date => {
                      const months = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
                      return `${months[date.getMonth()]} ${date.getFullYear()}`;
                    }
                  }} weekStartsOn={0} />
                  </div>
                  
                  {getBlockedDatesForCurrentView().length > 0 && <div className="mt-6">
                      <h3 className="font-medium mb-3 text-right">תאריכים חסומים:</h3>
                      <div className="space-y-2">
                        {getBlockedDatesForCurrentView().map((blocked, index) => <div key={index} className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                            <Button variant="ghost" size="sm" onClick={() => removeBlockedDate(index, false)} className="text-primary hover:text-primary">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <div className="text-right">
                              <div className="font-medium">
                                {formatDateRange(blocked.date, blocked.endDate)}
                              </div>
                              {blocked.reason && <div className="text-sm text-gray-600">{blocked.reason}</div>}
                              {!blocked.isFullDay && <div className="text-sm text-gray-600">
                                  {blocked.startTime} - {blocked.endTime}
                                </div>}
                            </div>
                          </div>)}
                      </div>
                    </div>}
                </CardContent>
              </Card>
              
              {/* Station Weekly Hours - Right Side */}
              <Card className="order-2">
                <CardHeader>
                  <CardTitle className="text-right">
                    שעות עבודה שבועיות של {MOCK_STATIONS.find(s => s.id === selectedStation)?.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {DAYS_OF_WEEK.map(day => {
                const currentStationHours = getStationHours(selectedStation);
                const dayHours = currentStationHours[day.key];
                return <div key={day.key} className="p-4 border rounded-lg" dir="rtl">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Switch checked={dayHours.enabled} onCheckedChange={enabled => handleStationDayToggle(day.key, enabled)} />
                            <Label className="font-medium text-right">{day.name}</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-sm text-right">השתמש בשעות העסק הכלליות</Label>
                            <Checkbox checked={dayHours.useBusinessHours} onCheckedChange={checked => handleUseBusinessHours(day.key, checked as boolean)} />
                          </div>
                        </div>
                        
                        {dayHours.enabled && dayHours.useBusinessHours && <div className="text-gray-500 text-sm text-right">
                            משתמש בשעות העסק הכלליות
                          </div>}
                        
                        {dayHours.enabled && !dayHours.useBusinessHours && <div className="space-y-2">
                            <div className="flex justify-end mb-2">
                              <Button variant="ghost" size="sm" onClick={() => addStationTimeSlot(day.key)} className="p-1 h-6 w-6 rounded-full">
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            {dayHours.timeSlots.map((slot, slotIndex) => <div key={slotIndex} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {dayHours.timeSlots.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeStationTimeSlot(day.key, slotIndex)} className="p-1 h-6 w-6 rounded-full text-red-600 hover:text-red-800">
                                      <X className="w-3 h-3" />
                                    </Button>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input type="time" value={slot.endTime} onChange={e => handleStationTimeChange(day.key, slotIndex, 'endTime', e.target.value)} className="w-20 text-center" dir="rtl" />
                                  <Label className="text-sm">עד:</Label>
                                  <Input type="time" value={slot.startTime} onChange={e => handleStationTimeChange(day.key, slotIndex, 'startTime', e.target.value)} className="w-20 text-center" dir="rtl" />
                                  <Label className="text-sm">מ:</Label>
                                </div>
                              </div>)}
                          </div>}
                      </div>;
              })}
                </CardContent>
              </Card>
            </div>}

          {!selectedStation && <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">בחר עמדה מהרשימה כדי להתחיל לנהל את הזמינות הפרטנית שלה</p>
              </CardContent>
            </Card>}
        </TabsContent>
      </Tabs>

      {/* Date Blocking Dialog */}
      <Dialog open={blockingDialogOpen} onOpenChange={setBlockingDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">
              {selectedRange?.from && selectedRange?.to ? `חסימת זמינות מ-${selectedRange.from.toLocaleDateString('he-IL')} עד ${selectedRange.to.toLocaleDateString('he-IL')}` : `חסימת זמינות ליום ${selectedDate?.toLocaleDateString('he-IL')}`}
              {currentTab === 'stations' && selectedStation && <div className="text-sm font-normal text-gray-600 mt-1">
                  עבור {MOCK_STATIONS.find(s => s.id === selectedStation)?.name}
                </div>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason" className="text-right block mb-2">סיבה (אופציונלי)</Label>
              <Input id="reason" value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder='למשל: "חופשה", "שיפוצים"' className="text-right" dir="rtl" />
            </div>
            
            <div className="flex items-center justify-end gap-2">
              <Label>חסום את כל היום</Label>
              <Switch checked={isFullDayBlock} onCheckedChange={setIsFullDayBlock} />
            </div>
            
            {!isFullDayBlock && <div className="flex items-center justify-end gap-2">
                <Label>מ:</Label>
                <Input type="time" value={blockStartTime} onChange={e => setBlockStartTime(e.target.value)} className="w-32 text-center" dir="rtl" />
                <Label>עד:</Label>
                <Input type="time" value={blockEndTime} onChange={e => setBlockEndTime(e.target.value)} className="w-32 text-center" dir="rtl" />
              </div>}
            
            <div className="flex justify-end gap-2">
              <Button onClick={blockDate}>
                חסום זמן
              </Button>
              <Button variant="outline" onClick={() => setBlockingDialogOpen(false)}>
                ביטול
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};
export default AvailabilityManagement;
