
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Trash2, Plus, Link, Loader2 } from 'lucide-react';
import { useStations, useUpdateStation, useCreateStation, useDeleteStation } from '@/hooks/useStations';
import { useToast } from '@/hooks/use-toast';
import InlineEditText from './InlineEditText';
import InlineEditNumber from './InlineEditNumber';

const StationsManagement = () => {
  const [newStationName, setNewStationName] = useState('');
  const [newStationInterval, setNewStationInterval] = useState('60');
  const [isAddingStation, setIsAddingStation] = useState(false);
  const { toast } = useToast();

  const { data: stations, isLoading, error } = useStations();
  const updateStationMutation = useUpdateStation();
  const createStationMutation = useCreateStation();
  const deleteStationMutation = useDeleteStation();

  const handleStatusToggle = async (stationId: string, newStatus: boolean) => {
    try {
      await updateStationMutation.mutateAsync({
        id: stationId,
        updates: { is_active: newStatus }
      });
      
      toast({
        title: newStatus ? "עמדה הופעלה" : "עמדה הושבתה",
        description: "השינוי נשמר בהצלחה",
      });
    } catch (error) {
      console.error('Error updating station status:', error);
      toast({
        title: "שגיאה בעדכון העמדה",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    }
  };

  const handleUpdateStationName = async (stationId: string, newName: string) => {
    try {
      await updateStationMutation.mutateAsync({
        id: stationId,
        updates: { name: newName }
      });
      
      toast({
        title: "שם העמדה עודכן",
        description: `השם עודכן בהצלחה ל"${newName}"`,
      });
    } catch (error) {
      console.error('Error updating station name:', error);
      toast({
        title: "שגיאה בעדכון השם",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateBreakTime = async (stationId: string, newBreakTime: number) => {
    try {
      console.log('🔄 עדכון זמן הפסקה בין תורים', { stationId, newBreakTime });
      await updateStationMutation.mutateAsync({
        id: stationId,
        updates: { break_between_appointments: newBreakTime }
      });
      
      toast({
        title: "הפסקה בין תורים עודכנה",
        description: `הוגדר ל-${newBreakTime} דקות`,
      });
    } catch (error) {
      console.error('Error updating break time:', error);
      toast({
        title: "שגיאה בעדכון הזמן",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateSlotInterval = async (stationId: string, newInterval: number) => {
    try {
      console.log('🔄 עדכון מרווח תורים לעמדה', { stationId, newInterval });
      await updateStationMutation.mutateAsync({
        id: stationId,
        updates: { slot_interval_minutes: newInterval }
      });

      toast({
        title: "מרווח התורים עודכן",
        description: `התורים יוצעו כעת כל ${newInterval} דקות`,
      });
    } catch (error) {
      console.error('Error updating slot interval:', error);
      toast({
        title: "שגיאה בעדכון מרווח התורים",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleAddStation = async () => {
    if (!newStationName.trim()) return;

    const parsedInterval = parseInt(newStationInterval, 10);
    if (!Number.isFinite(parsedInterval) || parsedInterval <= 0) {
      toast({
        title: "ערך לא תקין",
        description: "נא להגדיר מרווח תורים גדול מאפס",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('➕ יצירת עמדה חדשה', { name: newStationName.trim(), slotInterval: parsedInterval });
      await createStationMutation.mutateAsync({
        name: newStationName.trim(),
        slot_interval_minutes: parsedInterval
      });
      
      toast({
        title: "עמדה נוצרה בהצלחה",
        description: `העמדה "${newStationName}" נוספה למערכת`,
      });
      
      setNewStationName('');
      setNewStationInterval('60');
      setIsAddingStation(false);
    } catch (error) {
      console.error('Error creating station:', error);
      toast({
        title: "שגיאה ביצירת העמדה",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    }
  };

  const handleDeleteStation = async (stationId: string, stationName: string) => {
    try {
      await deleteStationMutation.mutateAsync(stationId);
      
      toast({
        title: "עמדה נמחקה",
        description: `העמדה "${stationName}" נמחקה לצמיתות`,
      });
    } catch (error) {
      console.error('Error deleting station:', error);
      toast({
        title: "שגיאה במחיקת העמדה",
        description: "יתכן שהעמדה משויכת לשירותים קיימים",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center" dir="rtl">
        <div className="flex items-center space-x-2 space-x-reverse">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg">טוען עמדות...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">שגיאה בטעינת העמדות</p>
          <Button onClick={() => window.location.reload()}>נסה שוב</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">רשימת עמדות</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם העמדה</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">מרווח התורים (דקות)</TableHead>
                <TableHead className="text-right">הפסקה בין תורים</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stations?.map((station) => (
                <TableRow key={station.id}>
                  <TableCell className="font-semibold text-gray-900">
                    <InlineEditText
                      value={station.name}
                      onSave={(newName) => handleUpdateStationName(station.id, newName)}
                      placeholder="שם העמדה"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center space-x-3 space-x-reverse">
                      <Switch
                        checked={station.is_active}
                        onCheckedChange={(checked) => handleStatusToggle(station.id, checked)}
                        disabled={updateStationMutation.isPending}
                      />
                      <span className={`text-sm font-medium ${
                        station.is_active ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {station.is_active ? 'פעילה' : 'מושבתת'}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <InlineEditNumber
                      value={station.slot_interval_minutes}
                      onSave={(newInterval) => handleUpdateSlotInterval(station.id, newInterval)}
                      suffix="דקות"
                      min={5}
                      max={360}
                    />
                  </TableCell>

                  <TableCell>
                    <InlineEditNumber
                      value={station.break_between_appointments}
                      onSave={(newBreakTime) => handleUpdateBreakTime(station.id, newBreakTime)}
                      suffix="דקות"
                      min={0}
                      max={60}
                    />
                  </TableCell>
                  
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          disabled={deleteStationMutation.isPending}
                        >
                          {deleteStationMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            האם למחוק את עמדה "{station.name}" לצמיתות?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            זוהי פעולה בלתי הפיכה. העמדה תימחק מהמערכת וכל השיוכים שלה לשירותים יוסרו.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>בטל</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteStation(station.id, station.name)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            כן, למחוק
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Add New Station Button */}
          <div className="mt-6 pt-6 border-t">
            <Dialog open={isAddingStation} onOpenChange={setIsAddingStation}>
              <DialogTrigger asChild>
                <Button className="w-full bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 ml-2" />
                  צור עמדה חדשה
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader>
                  <DialogTitle>יצירת עמדה חדשה</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="station-name">שם העמדה/הספר</Label>
                    <Input
                      id="station-name"
                      value={newStationName}
                      onChange={(e) => setNewStationName(e.target.value)}
                      placeholder="למשל: עמדה 3 - דנה"
                      className="mt-1"
                    />
                  </div>
                    <div>
                      <Label htmlFor="station-interval">מרווח התורים (בדקות)</Label>
                      <Input
                        id="station-interval"
                        type="number"
                        min={5}
                        max={360}
                        value={newStationInterval}
                        onChange={(e) => setNewStationInterval(e.target.value)}
                        placeholder="למשל: 60"
                        className="mt-1 text-right"
                      />
                    </div>
                  <div className="flex justify-end space-x-2 space-x-reverse">
                    <Button variant="outline" onClick={() => setIsAddingStation(false)}>
                      בטל
                    </Button>
                    <Button 
                      onClick={handleAddStation}
                        disabled={
                          !newStationName.trim() || 
                          createStationMutation.isPending ||
                          !Number.isFinite(parseInt(newStationInterval, 10)) ||
                          parseInt(newStationInterval, 10) <= 0
                        }
                    >
                      {createStationMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                          יוצר...
                        </>
                      ) : (
                        'שמור'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StationsManagement;
