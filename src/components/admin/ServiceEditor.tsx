
import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight, Plus, X, Search, Clock } from 'lucide-react';
import { useServiceConfiguration } from '@/hooks/useServiceConfiguration';
import ServiceBasePriceEditor from './ServiceBasePriceEditor';
import PriceStepper from './PriceStepper';
import SmartBreedSelectorMultiple from './SmartBreedSelectorMultiple';
import { useToast } from '@/hooks/use-toast';

interface ServiceEditorProps {
  serviceId: string;
  onBack: () => void;
}

// Memoized station card to prevent unnecessary re-renders
const StationCard = React.memo(({ 
  station, 
  serviceBasePrice, 
  onTimeChange, 
  onPriceChange 
}: {
  station: any;
  serviceBasePrice: number;
  onTimeChange: (stationId: string, newTime: number) => void;
  onPriceChange: (stationId: string, newPrice: number) => void;
}) => {
  const [optimisticTime, setOptimisticTime] = useState<number | null>(null);
  const [optimisticPrice, setOptimisticPrice] = useState<number | null>(null);

  const displayTime = optimisticTime !== null ? optimisticTime : station.base_time_minutes;
  const displayPriceAdjustment = optimisticPrice !== null ? optimisticPrice : (station.price_adjustment || 0);
  const finalPrice = serviceBasePrice + displayPriceAdjustment;

  const handleTimeChange = useCallback(async (newTime: number) => {
    setOptimisticTime(newTime);
    try {
      await onTimeChange(station.id, newTime);
      setOptimisticTime(null);
    } catch (error) {
      console.error('Error updating time:', error);
      setOptimisticTime(null);
    }
  }, [station.id, onTimeChange]);

  const handlePriceChange = useCallback(async (newPrice: number) => {
    setOptimisticPrice(newPrice);
    try {
      await onPriceChange(station.id, newPrice);
      setOptimisticPrice(null);
    } catch (error) {
      console.error('Error updating price:', error);
      setOptimisticPrice(null);
    }
  }, [station.id, onPriceChange]);

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{station.name}</h3>
        <div className="text-sm text-gray-500">
          {station.is_active ? 'פעילה' : 'לא פעילה'}
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            זמן (דקות): {displayTime}
          </label>
          <Slider
            value={[displayTime]}
            onValueChange={([newValue]) => handleTimeChange(newValue)}
            max={180}
            min={15}
            step={15}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>15 דקות</span>
            <span>3 שעות</span>
          </div>
        </div>
        
        <div className="border-t pt-3">
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            התאמת מחיר לעמדה זו
          </label>
          <div className="flex items-center justify-between">
            <PriceStepper
              value={displayPriceAdjustment}
              onChange={handlePriceChange}
              step={5}
              min={-100}
              max={500}
            />
            <div className="text-left">
              <div className="text-sm text-gray-600">מחיר סופי:</div>
              <div className="text-xl font-bold text-green-600">
                {finalPrice}₪
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const ServiceEditor = ({ serviceId, onBack }: ServiceEditorProps) => {
  // All hooks must be called at the top level, unconditionally
  const [isBreedSelectorOpen, setIsBreedSelectorOpen] = useState(false);
  const [breedSearchTerm, setBreedSearchTerm] = useState('');
  const [isApplyAllDialogOpen, setIsApplyAllDialogOpen] = useState(false);
  const [applyAllTime, setApplyAllTime] = useState(60);
  const { toast } = useToast();
  
  const {
    service,
    stations,
    breedAdjustments,
    isLoading,
    updateStationConfig,
    addBreedAdjustments,
    removeBreedAdjustment,
    updateBreedTimeAdjustment,
    applyTimeToAllStations
  } = useServiceConfiguration(serviceId);

  // Filter breed adjustments based on search term and sort alphabetically
  const filteredBreedAdjustments = useMemo(() => {
    if (!breedAdjustments) return [];
    
    let filtered = breedAdjustments;
    
    if (breedSearchTerm.trim()) {
      filtered = breedAdjustments.filter(adj => 
        adj.breed_name.toLowerCase().includes(breedSearchTerm.toLowerCase())
      );
    }
    
    return filtered.sort((a, b) => a.breed_name.localeCompare(b.breed_name, 'he'));
  }, [breedAdjustments, breedSearchTerm]);

  const handleStationTimeChange = useCallback(async (stationId: string, newTimeMinutes: number) => {
    return updateStationConfig({
      serviceId,
      stationId,
      baseTimeMinutes: newTimeMinutes
    });
  }, [serviceId, updateStationConfig]);

  const handleStationPriceChange = useCallback(async (stationId: string, newPriceAdjustment: number) => {
    const station = stations?.find(s => s.id === stationId);
    return updateStationConfig({
      serviceId,
      stationId,
      baseTimeMinutes: station?.base_time_minutes || 60,
      priceAdjustment: newPriceAdjustment
    });
  }, [serviceId, stations, updateStationConfig]);

  const handleBreedsSelect = useCallback(async (breedIds: string[]) => {
    try {
      await addBreedAdjustments(breedIds);
      toast({
        title: "גזעים נוספו בהצלחה",
        description: `${breedIds.length} גזעים נוספו לשירות`,
      });
    } catch (error) {
      console.error('Error adding breeds:', error);
      toast({
        title: "שגיאה בהוספת הגזעים",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    }
  }, [addBreedAdjustments, toast]);

  const handleRemoveBreed = useCallback(async (breedId: string) => {
    try {
      await removeBreedAdjustment(breedId);
    } catch (error) {
      console.error('Error removing breed:', error);
    }
  }, [removeBreedAdjustment]);

  const handleBreedTimeChange = useCallback(async (breedId: string, newTimeAdjustment: number) => {
    try {
      await updateBreedTimeAdjustment(breedId, newTimeAdjustment);
    } catch (error) {
      console.error('Error updating breed time:', error);
    }
  }, [updateBreedTimeAdjustment]);

  const handleApplyTimeToAll = useCallback(async () => {
    try {
      await applyTimeToAllStations(applyAllTime);
      setIsApplyAllDialogOpen(false);
      toast({
        title: "זמן עודכן בכל העמדות",
        description: `כל העמדות עודכנו ל-${applyAllTime} דקות`,
      });
    } catch (error) {
      console.error('Error applying time to all stations:', error);
      toast({
        title: "שגיאה בעדכון הזמן",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    }
  }, [applyTimeToAllStations, applyAllTime, toast]);

  // Early return after all hooks have been called
  if (isLoading || !service) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען נתוני השירות...</p>
        </div>
      </div>
    );
  }

  // Get excluded breed IDs for the selector
  const excludeBreedIds = breedAdjustments?.map(adj => adj.breed_id) || [];

  // Sort stations by creation order (id) for consistent display
  const sortedStations = stations?.slice().sort((a, b) => a.id.localeCompare(b.id)) || [];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="mb-4 text-blue-600 hover:text-blue-700"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            חזרה לרשימת השירותים
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">עריכת שירות: {service.name}</h1>
          {service.description && (
            <p className="text-gray-600 mt-1">{service.description}</p>
          )}
        </div>
      </div>

      {/* Base Price Editor */}
      <ServiceBasePriceEditor
        serviceId={serviceId}
        serviceName={service.name}
        currentBasePrice={service.base_price}
      />

      {/* Station Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">כמה זמן ומחיר זה לוקח בכל עמדה?</CardTitle>
            <Button
              variant="outline"
              onClick={() => setIsApplyAllDialogOpen(true)}
              className="text-blue-600 hover:text-blue-700"
            >
              <Clock className="w-4 h-4 ml-2" />
              החל זמן אחיד על כל העמדות
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sortedStations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                serviceBasePrice={service.base_price}
                onTimeChange={handleStationTimeChange}
                onPriceChange={handleStationPriceChange}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Breed Adjustments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">התאמות מיוחדות לגזעים</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                הוסף זמן נוסף לגזעים מסוימים (למשל: פודל טויי +15 דקות)
              </p>
            </div>
            <Button
              onClick={() => setIsBreedSelectorOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 ml-2" />
              הוסף גזעים
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Box - Always Visible */}
          {breedAdjustments && breedAdjustments.length > 0 && (
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="חפש/י גזע ברשימה..."
                  value={breedSearchTerm}
                  onChange={(e) => setBreedSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
          )}

          {/* Breed Adjustments List */}
          {filteredBreedAdjustments.length > 0 ? (
            <div className="space-y-3">
              {filteredBreedAdjustments.map((adjustment) => (
                <div
                  key={adjustment.breed_id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-gray-50"
                >
                  <div className="flex items-center space-x-4 space-x-reverse flex-1">
                    <div className="font-medium text-lg">{adjustment.breed_name}</div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <span className="text-sm text-gray-600">זמן נוסף:</span>
                      <PriceStepper
                        value={adjustment.time_modifier_minutes}
                        onChange={(newTime) => handleBreedTimeChange(adjustment.breed_id, newTime)}
                        step={5}
                        min={-30}
                        max={120}
                      />
                      <span className="text-sm text-gray-600">דקות</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRemoveBreed(adjustment.breed_id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : breedAdjustments && breedAdjustments.length > 0 && breedSearchTerm ? (
            // Show "no results" but keep search visible
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">לא נמצאו גזעים התואמים לחיפוש "{breedSearchTerm}"</p>
              <Button
                variant="outline"
                onClick={() => setBreedSearchTerm('')}
              >
                נקה חיפוש
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>אין עדיין התאמות מיוחדות לגזעים.</p>
              <p className="text-sm mt-2">לחץ על "הוסף גזעים" כדי להתחיל.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apply Time to All Dialog */}
      <Dialog open={isApplyAllDialogOpen} onOpenChange={setIsApplyAllDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>החל זמן אחיד על כל העמדות</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                זמן (דקות): {applyAllTime}
              </label>
              <Slider
                value={[applyAllTime]}
                onValueChange={([newValue]) => setApplyAllTime(newValue)}
                max={180}
                min={15}
                step={15}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>15 דקות</span>
                <span>3 שעות</span>
              </div>
            </div>
            <div className="flex justify-end space-x-2 space-x-reverse">
              <Button variant="outline" onClick={() => setIsApplyAllDialogOpen(false)}>
                בטל
              </Button>
              <Button onClick={handleApplyTimeToAll}>
                החל על כל העמדות
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Breed Selector */}
      <SmartBreedSelectorMultiple
        open={isBreedSelectorOpen}
        onOpenChange={setIsBreedSelectorOpen}
        onBreedsSelect={handleBreedsSelect}
        excludeBreedIds={excludeBreedIds}
      />
    </div>
  );
};

export default ServiceEditor;
