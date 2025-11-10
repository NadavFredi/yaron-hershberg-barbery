
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Loader2 } from 'lucide-react';
import { useTreatmentTypes } from '@/hooks/useTreatmentTypes';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SmartTreatmentTypeSelectorMultipleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTreatmentTypesSelect: (treatmentTypeIds: string[]) => Promise<void>;
  excludeTreatmentTypeIds?: string[];
}

const SmartTreatmentTypeSelectorMultiple = ({
  open,
  onOpenChange,
  onTreatmentTypesSelect,
  excludeTreatmentTypeIds = []
}: SmartTreatmentTypeSelectorMultipleProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTreatmentTypeIds, setSelectedTreatmentTypeIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  
  const { data: treatmentTypes, refetch: refetchTreatmentTypes } = useTreatmentTypes();
  const { toast } = useToast();

  // Filter treatmentTypes based on search term and exclude list
  const filteredTreatmentTypes = treatmentTypes?.filter(treatmentType => {
    const matchesSearch = treatmentType.name.toLowerCase().includes(searchTerm.toLowerCase());
    const notExcluded = !excludeTreatmentTypeIds.includes(treatmentType.id);
    return matchesSearch && notExcluded;
  }) || [];

  // Check if search term matches any existing treatmentType exactly
  const exactMatch = treatmentTypes?.find(treatmentType => 
    treatmentType.name.toLowerCase() === searchTerm.toLowerCase()
  );

  // Show create option if there's a search term and no exact match
  const showCreateOption = searchTerm.trim() && !exactMatch;

  const handleTreatmentTypeToggle = (treatmentTypeId: string, checked: boolean) => {
    if (checked) {
      setSelectedTreatmentTypeIds(prev => [...prev, treatmentTypeId]);
    } else {
      setSelectedTreatmentTypeIds(prev => prev.filter(id => id !== treatmentTypeId));
    }
  };

  const handleCreateTreatmentType = async () => {
    if (!searchTerm.trim()) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('treatmentTypes')
        .insert({ name: searchTerm.trim() })
        .select()
        .single();

      if (error) throw error;

      await refetchTreatmentTypes();
      
      // Automatically select the newly created treatmentType
      setSelectedTreatmentTypeIds(prev => [...prev, data.id]);
      
      // Clear search term
      setSearchTerm('');
      
      toast({
        title: "גזע נוצר בהצלחה",
        description: `הגזע "${searchTerm}" נוצר ונבחר להוספה`,
      });
    } catch (error) {
      console.error('Error creating treatmentType:', error);
      toast({
        title: "שגיאה ביצירת הגזע",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleApplySelection = async () => {
    if (selectedTreatmentTypeIds.length === 0) return;

    setIsApplying(true);
    try {
      await onTreatmentTypesSelect(selectedTreatmentTypeIds);
      
      // Reset state and close dialog
      setSelectedTreatmentTypeIds([]);
      setSearchTerm('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error applying treatmentType selection:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      // Reset state when closing
      setSelectedTreatmentTypeIds([]);
      setSearchTerm('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>בחירת גזעים להתאמה</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="חפש או צור גזע חדש..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>

          {/* Create New TreatmentType Option */}
          {showCreateOption && (
            <div className="border-b pb-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleCreateTreatmentType}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    יוצר...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 ml-2" />
                    צור גזע חדש: "{searchTerm}"
                  </>
                )}
              </Button>
            </div>
          )}

          {/* TreatmentTypes List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredTreatmentTypes.length > 0 ? (
              filteredTreatmentTypes.map(treatmentType => (
                <div key={treatmentType.id} className="flex items-center space-x-3 space-x-reverse p-2 hover:bg-gray-50 rounded">
                  <Checkbox
                    id={treatmentType.id}
                    checked={selectedTreatmentTypeIds.includes(treatmentType.id)}
                    onCheckedChange={(checked) => handleTreatmentTypeToggle(treatmentType.id, checked as boolean)}
                  />
                  <label
                    htmlFor={treatmentType.id}
                    className="flex-1 cursor-pointer text-sm font-medium"
                  >
                    {treatmentType.name}
                  </label>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'לא נמצאו גזעים המתאימים לחיפוש' : 'לא נמצאו גזעים זמינים'}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 space-x-reverse pt-4 border-t">
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              בטל
            </Button>
            <Button 
              onClick={handleApplySelection}
              disabled={selectedTreatmentTypeIds.length === 0 || isApplying}
              className="min-w-[120px]"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  מוסיף...
                </>
              ) : (
                `הוסף ${selectedTreatmentTypeIds.length} ${selectedTreatmentTypeIds.length === 1 ? 'גזע' : 'גזעים'}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SmartTreatmentTypeSelectorMultiple;
