
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Loader2 } from 'lucide-react';
import { useBreeds } from '@/hooks/useBreeds';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SmartBreedSelectorMultipleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBreedsSelect: (breedIds: string[]) => Promise<void>;
  excludeBreedIds?: string[];
}

const SmartBreedSelectorMultiple = ({
  open,
  onOpenChange,
  onBreedsSelect,
  excludeBreedIds = []
}: SmartBreedSelectorMultipleProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBreedIds, setSelectedBreedIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  
  const { data: breeds, refetch: refetchBreeds } = useBreeds();
  const { toast } = useToast();

  // Filter breeds based on search term and exclude list
  const filteredBreeds = breeds?.filter(breed => {
    const matchesSearch = breed.name.toLowerCase().includes(searchTerm.toLowerCase());
    const notExcluded = !excludeBreedIds.includes(breed.id);
    return matchesSearch && notExcluded;
  }) || [];

  // Check if search term matches any existing breed exactly
  const exactMatch = breeds?.find(breed => 
    breed.name.toLowerCase() === searchTerm.toLowerCase()
  );

  // Show create option if there's a search term and no exact match
  const showCreateOption = searchTerm.trim() && !exactMatch;

  const handleBreedToggle = (breedId: string, checked: boolean) => {
    if (checked) {
      setSelectedBreedIds(prev => [...prev, breedId]);
    } else {
      setSelectedBreedIds(prev => prev.filter(id => id !== breedId));
    }
  };

  const handleCreateBreed = async () => {
    if (!searchTerm.trim()) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('breeds')
        .insert({ name: searchTerm.trim() })
        .select()
        .single();

      if (error) throw error;

      await refetchBreeds();
      
      // Automatically select the newly created breed
      setSelectedBreedIds(prev => [...prev, data.id]);
      
      // Clear search term
      setSearchTerm('');
      
      toast({
        title: "גזע נוצר בהצלחה",
        description: `הגזע "${searchTerm}" נוצר ונבחר להוספה`,
      });
    } catch (error) {
      console.error('Error creating breed:', error);
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
    if (selectedBreedIds.length === 0) return;

    setIsApplying(true);
    try {
      await onBreedsSelect(selectedBreedIds);
      
      // Reset state and close dialog
      setSelectedBreedIds([]);
      setSearchTerm('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error applying breed selection:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      // Reset state when closing
      setSelectedBreedIds([]);
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

          {/* Create New Breed Option */}
          {showCreateOption && (
            <div className="border-b pb-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleCreateBreed}
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

          {/* Breeds List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredBreeds.length > 0 ? (
              filteredBreeds.map(breed => (
                <div key={breed.id} className="flex items-center space-x-3 space-x-reverse p-2 hover:bg-gray-50 rounded">
                  <Checkbox
                    id={breed.id}
                    checked={selectedBreedIds.includes(breed.id)}
                    onCheckedChange={(checked) => handleBreedToggle(breed.id, checked as boolean)}
                  />
                  <label
                    htmlFor={breed.id}
                    className="flex-1 cursor-pointer text-sm font-medium"
                  >
                    {breed.name}
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
              disabled={selectedBreedIds.length === 0 || isApplying}
              className="min-w-[120px]"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  מוסיף...
                </>
              ) : (
                `הוסף ${selectedBreedIds.length} ${selectedBreedIds.length === 1 ? 'גזע' : 'גזעים'}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SmartBreedSelectorMultiple;
