
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Scissors, Loader2 } from 'lucide-react';
import { useServicesWithStats, useCreateService } from '@/hooks/useServices';
import { useToast } from '@/hooks/use-toast';

interface ServiceLibraryProps {
  onEditService: (serviceId: string) => void;
}

const ServiceLibrary = ({ onEditService }: ServiceLibraryProps) => {
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceBasePrice, setNewServiceBasePrice] = useState<number>(100);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: serviceStats, isLoading, error } = useServicesWithStats();
  const createServiceMutation = useCreateService();

  const handleCreateService = async () => {
    if (!newServiceName.trim()) return;

    try {
      await createServiceMutation.mutateAsync({
        name: newServiceName.trim(),
        base_price: newServiceBasePrice
      });
      
      toast({
        title: "שירות נוצר בהצלחה",
        description: `השירות "${newServiceName}" נוסף לספריית השירותים`,
      });
      
      setNewServiceName('');
      setNewServiceBasePrice(100);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error creating service:', error);
      toast({
        title: "שגיאה ביצירת השירות",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center" dir="rtl">
        <div className="flex items-center space-x-2 space-x-reverse">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg">טוען שירותים...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">שגיאה בטעינת השירותים</p>
          <Button onClick={() => window.location.reload()}>נסה שוב</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">סטודיו השירותים שלנו</h1>
          <p className="text-lg text-gray-600">כאן מנהלים את כל סוגי הטיפולים שהמספרה מציעה</p>
        </div>

        {/* Service Cards Gallery */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {serviceStats?.map((service) => (
            <Card 
              key={service.id} 
              className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer bg-white border-0 shadow-md"
              onClick={() => onEditService(service.id)}
            >
              <CardContent className="p-6">
                {/* Service Icon and Name */}
                <div className="text-center mb-4">
                  <div className="w-16 h-16 mx-auto mb-3 bg-primary/20 rounded-full flex items-center justify-center">
                    <Scissors className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                  )}
                </div>

                {/* Service Tags */}
                <div className="space-y-2 mb-4">
                  <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm text-center">
                    מחיר בסיס: ₪{service.base_price}
                  </div>
                  <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm text-center">
                    זמן ממוצע: {service.averageTime} דקות
                  </div>
                  <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm text-center">
                    מוגדר עבור {service.configuredStationsCount} מתוך {service.totalStationsCount} עמדות
                  </div>
                </div>

                {/* Hover Action Button */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white">
                    נהל שירות
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Floating Action Button */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="fixed bottom-6 left-6 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-xl transition-all"
              size="icon"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right">שירות חדש</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="serviceName" className="text-right block mb-2">
                  איך נקרא לשירות החדש?
                </Label>
                <Input
                  id="serviceName"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="למשל: תספורת מלאה"
                  className="text-right"
                />
              </div>
              <div>
                <Label htmlFor="serviceBasePrice" className="text-right block mb-2">
                  מחיר בסיס (₪)
                </Label>
                <Input
                  id="serviceBasePrice"
                  type="number"
                  value={newServiceBasePrice}
                  onChange={(e) => setNewServiceBasePrice(parseInt(e.target.value) || 0)}
                  placeholder="100"
                  className="text-right"
                  min="0"
                  step="5"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  ביטול
                </Button>
                <Button 
                  onClick={handleCreateService} 
                  disabled={!newServiceName.trim() || createServiceMutation.isPending}
                >
                  {createServiceMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      יוצר...
                    </>
                  ) : (
                    'צור שירות'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ServiceLibrary;
