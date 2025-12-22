
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUpdateService } from '@/hooks/useServices';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';

interface ServiceBasePriceEditorProps {
  serviceId: string;
  serviceName: string;
  currentBasePrice: number;
}

const ServiceBasePriceEditor = ({ 
  serviceId, 
  serviceName, 
  currentBasePrice 
}: ServiceBasePriceEditorProps) => {
  const [optimisticPrice, setOptimisticPrice] = useState<number | null>(null);
  const { toast } = useToast();
  const updateServiceMutation = useUpdateService();

  const debouncedUpdate = useDebounce(async (newPrice: number) => {
    try {
      await updateServiceMutation.mutateAsync({
        serviceId,
        base_price: newPrice
      });
      
      console.log('Base price updated successfully:', { serviceId, newPrice });
      
      // Clear optimistic state after successful update
      setOptimisticPrice(null);
    } catch (error) {
      console.error('Error updating base price:', error);
      // Revert optimistic update on error
      setOptimisticPrice(null);
      
      toast({
        title: "שגיאה בעדכון המחיר",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    }
  }, 800);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrice = parseFloat(e.target.value) || 0;
    
    // Optimistic update
    setOptimisticPrice(newPrice);
    
    // Debounced server update
    debouncedUpdate.debouncedCallback(newPrice);
  };

  const displayPrice = optimisticPrice !== null ? optimisticPrice : currentBasePrice;
  const isOptimistic = optimisticPrice !== null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-xl">תמחור בסיסי לשירות</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start space-x-6 space-x-reverse">
          <div className="space-y-2 flex-shrink-0">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Label htmlFor="basePrice" className="text-sm font-medium">
                מחיר התחלתי
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="z-50 bg-gray-900 text-white p-2 rounded shadow-lg max-w-sm">
                    <p>זהו מחיר הבסיס של השירות, לפני התאמות מיוחדות של עמדה</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="relative w-48">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-medium">₪</span>
              <Input
                id="basePrice"
                type="number"
                value={displayPrice}
                onChange={handlePriceChange}
                className={`pl-8 text-lg font-semibold text-right ${
                  isOptimistic ? 'border-primary/30 bg-primary/10' : ''
                }`}
                min="0"
                step="5"
                placeholder="0"
                dir="rtl"
              />
            </div>
          </div>
          
          <div className="flex-1">
            <p className="text-xs text-gray-500 mt-8">
              מחיר זה ישמש כבסיס לכל העמדות. ניתן להוסיף התאמות מחיר לעמדות ספציפיות מטה.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServiceBasePriceEditor;
