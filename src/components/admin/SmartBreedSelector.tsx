
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Plus, Loader2, Pencil, Check, X } from 'lucide-react';
import { useBreeds } from '@/hooks/useBreeds';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SmartBreedSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBreedSelect: (breedId: string) => void;
  excludeBreedIds?: string[];
}

const SmartBreedSelector = ({ 
  open, 
  onOpenChange, 
  onBreedSelect, 
  excludeBreedIds = [] 
}: SmartBreedSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingBreedId, setEditingBreedId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [hoveredBreedId, setHoveredBreedId] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { data: breeds, refetch: refetchBreeds } = useBreeds();

  // Filter available breeds (exclude already selected ones)
  const availableBreeds = breeds?.filter(breed => 
    !excludeBreedIds.includes(breed.id)
  ) || [];

  // Filter breeds based on search term
  const filteredBreeds = availableBreeds.filter(breed =>
    breed.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if search term matches any existing breed exactly
  const exactMatch = availableBreeds.find(breed => 
    breed.name.toLowerCase() === searchTerm.toLowerCase()
  );

  // Show create option when there's a search term and no exact match
  const showCreateOption = searchTerm.trim() && !exactMatch && filteredBreeds.length === 0;

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Auto-focus edit input when editing starts
  useEffect(() => {
    if (editingBreedId && editInputRef.current) {
      setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 100);
    }
  }, [editingBreedId]);

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setIsCreating(false);
      setEditingBreedId(null);
      setEditingName('');
    }
  }, [open]);

  const handleBreedSelect = (breedId: string) => {
    onBreedSelect(breedId);
    onOpenChange(false);
  };

  const handleCreateBreed = async () => {
    if (!searchTerm.trim()) return;

    setIsCreating(true);
    try {
      const { data: newBreed, error } = await supabase
        .from('breeds')
        .insert({ name: searchTerm.trim() })
        .select()
        .single();

      if (error) throw error;

      // Refresh breeds list
      await refetchBreeds();

      toast({
        title: "גזע נוצר בהצלחה",
        description: `הגזע "${searchTerm}" נוצר ונוסף למערכת`,
      });

      // Select the newly created breed
      handleBreedSelect(newBreed.id);
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

  const handleStartEdit = (breedId: string, currentName: string) => {
    setEditingBreedId(breedId);
    setEditingName(currentName);
  };

  const handleSaveEdit = async () => {
    if (!editingName.trim() || !editingBreedId) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('breeds')
        .update({ name: editingName.trim() })
        .eq('id', editingBreedId);

      if (error) throw error;

      await refetchBreeds();
      
      toast({
        title: "שם הגזע עודכן",
        description: `השם עודכן בהצלחה`,
      });

      setEditingBreedId(null);
      setEditingName('');
    } catch (error) {
      console.error('Error updating breed name:', error);
      toast({
        title: "שגיאה בעדכון השם",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingBreedId(null);
    setEditingName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">חיפוש או יצירת גזע</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Smart Search Input */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              ref={inputRef}
              placeholder="הקלד/י שם גזע לחיפוש או ליצירה..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>

          {/* Dynamic Results */}
          <div className="max-h-64 overflow-y-auto">
            {!searchTerm ? (
              // Initial state - show popular breeds
              <div className="space-y-1">
                <p className="text-sm text-gray-600 mb-3">בחירה מהירה:</p>
                {availableBreeds.slice(0, 8).map(breed => (
                  <div
                    key={breed.id}
                    className="flex items-center justify-between group hover:bg-gray-50 rounded-lg p-2"
                    onMouseEnter={() => setHoveredBreedId(breed.id)}
                    onMouseLeave={() => setHoveredBreedId(null)}
                  >
                    {editingBreedId === breed.id ? (
                      // Edit mode
                      <div className="flex items-center flex-1 space-x-2 space-x-reverse">
                        <Input
                          ref={editInputRef}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveEdit();
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-600 hover:text-green-700"
                          onClick={handleSaveEdit}
                          disabled={isUpdating}
                        >
                          {isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-500 hover:text-gray-700"
                          onClick={handleCancelEdit}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      // Display mode
                      <>
                        <Button
                          variant="ghost"
                          className="flex-1 justify-start"
                          onClick={() => handleBreedSelect(breed.id)}
                        >
                          {breed.name}
                        </Button>
                        {hoveredBreedId === breed.id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-gray-500 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleStartEdit(breed.id, breed.name)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // Search results or create option
              <div className="space-y-1">
                {filteredBreeds.length > 0 && (
                  <>
                    <p className="text-sm text-gray-600 mb-2">תוצאות חיפוש:</p>
                    {filteredBreeds.map(breed => (
                      <div
                        key={breed.id}
                        className="flex items-center justify-between group hover:bg-gray-50 rounded-lg p-2"
                        onMouseEnter={() => setHoveredBreedId(breed.id)}
                        onMouseLeave={() => setHoveredBreedId(null)}
                      >
                        {editingBreedId === breed.id ? (
                          // Edit mode
                          <div className="flex items-center flex-1 space-x-2 space-x-reverse">
                            <Input
                              ref={editInputRef}
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveEdit();
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              className="flex-1"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600 hover:text-green-700"
                              onClick={handleSaveEdit}
                              disabled={isUpdating}
                            >
                              {isUpdating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-gray-500 hover:text-gray-700"
                              onClick={handleCancelEdit}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          // Display mode
                          <>
                            <Button
                              variant="ghost"
                              className="flex-1 justify-start"
                              onClick={() => handleBreedSelect(breed.id)}
                            >
                              {breed.name}
                            </Button>
                            {hoveredBreedId === breed.id && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-gray-500 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleStartEdit(breed.id, breed.name)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {showCreateOption && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
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
                          צור גזע חדש בשם "{searchTerm}"
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {filteredBreeds.length === 0 && !showCreateOption && searchTerm && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    לא נמצאו גזעים התואמים לחיפוש
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SmartBreedSelector;
