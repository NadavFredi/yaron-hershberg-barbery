
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Plus, Loader2, Pencil, Check, X } from 'lucide-react';
import { useTreatmentTypes } from '@/hooks/useTreatmentTypes';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SmartTreatmentTypeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTreatmentTypeSelect: (treatmentTypeId: string) => void;
  excludeTreatmentTypeIds?: string[];
}

const SmartTreatmentTypeSelector = ({ 
  open, 
  onOpenChange, 
  onTreatmentTypeSelect, 
  excludeTreatmentTypeIds = [] 
}: SmartTreatmentTypeSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingTreatmentTypeId, setEditingTreatmentTypeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [hoveredTreatmentTypeId, setHoveredTreatmentTypeId] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { data: treatmentTypes, refetch: refetchTreatmentTypes } = useTreatmentTypes();

  // Filter available treatmentTypes (exclude already selected ones)
  const availableTreatmentTypes = treatmentTypes?.filter(treatmentType => 
    !excludeTreatmentTypeIds.includes(treatmentType.id)
  ) || [];

  // Filter treatmentTypes based on search term
  const filteredTreatmentTypes = availableTreatmentTypes.filter(treatmentType =>
    treatmentType.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if search term matches any existing treatmentType exactly
  const exactMatch = availableTreatmentTypes.find(treatmentType => 
    treatmentType.name.toLowerCase() === searchTerm.toLowerCase()
  );

  // Show create option when there's a search term and no exact match
  const showCreateOption = searchTerm.trim() && !exactMatch && filteredTreatmentTypes.length === 0;

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
    if (editingTreatmentTypeId && editInputRef.current) {
      setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 100);
    }
  }, [editingTreatmentTypeId]);

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setIsCreating(false);
      setEditingTreatmentTypeId(null);
      setEditingName('');
    }
  }, [open]);

  const handleTreatmentTypeSelect = (treatmentTypeId: string) => {
    onTreatmentTypeSelect(treatmentTypeId);
    onOpenChange(false);
  };

  const handleCreateTreatmentType = async () => {
    if (!searchTerm.trim()) return;

    setIsCreating(true);
    try {
      const { data: newTreatmentType, error } = await supabase
        .from('treatmentTypes')
        .insert({ name: searchTerm.trim() })
        .select()
        .single();

      if (error) throw error;

      // Refresh treatmentTypes list
      await refetchTreatmentTypes();

      toast({
        title: "גזע נוצר בהצלחה",
        description: `הגזע "${searchTerm}" נוצר ונוסף למערכת`,
      });

      // Select the newly created treatmentType
      handleTreatmentTypeSelect(newTreatmentType.id);
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

  const handleStartEdit = (treatmentTypeId: string, currentName: string) => {
    setEditingTreatmentTypeId(treatmentTypeId);
    setEditingName(currentName);
  };

  const handleSaveEdit = async () => {
    if (!editingName.trim() || !editingTreatmentTypeId) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('treatmentTypes')
        .update({ name: editingName.trim() })
        .eq('id', editingTreatmentTypeId);

      if (error) throw error;

      await refetchTreatmentTypes();
      
      toast({
        title: "שם הגזע עודכן",
        description: `השם עודכן בהצלחה`,
      });

      setEditingTreatmentTypeId(null);
      setEditingName('');
    } catch (error) {
      console.error('Error updating treatmentType name:', error);
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
    setEditingTreatmentTypeId(null);
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
              // Initial state - show popular treatmentTypes
              <div className="space-y-1">
                <p className="text-sm text-gray-600 mb-3">בחירה מהירה:</p>
                {availableTreatmentTypes.slice(0, 8).map(treatmentType => (
                  <div
                    key={treatmentType.id}
                    className="flex items-center justify-between group hover:bg-gray-50 rounded-lg p-2"
                    onMouseEnter={() => setHoveredTreatmentTypeId(treatmentType.id)}
                    onMouseLeave={() => setHoveredTreatmentTypeId(null)}
                  >
                    {editingTreatmentTypeId === treatmentType.id ? (
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
                          onClick={() => handleTreatmentTypeSelect(treatmentType.id)}
                        >
                          {treatmentType.name}
                        </Button>
                        {hoveredTreatmentTypeId === treatmentType.id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-gray-500 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleStartEdit(treatmentType.id, treatmentType.name)}
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
                {filteredTreatmentTypes.length > 0 && (
                  <>
                    <p className="text-sm text-gray-600 mb-2">תוצאות חיפוש:</p>
                    {filteredTreatmentTypes.map(treatmentType => (
                      <div
                        key={treatmentType.id}
                        className="flex items-center justify-between group hover:bg-gray-50 rounded-lg p-2"
                        onMouseEnter={() => setHoveredTreatmentTypeId(treatmentType.id)}
                        onMouseLeave={() => setHoveredTreatmentTypeId(null)}
                      >
                        {editingTreatmentTypeId === treatmentType.id ? (
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
                              onClick={() => handleTreatmentTypeSelect(treatmentType.id)}
                            >
                              {treatmentType.name}
                            </Button>
                            {hoveredTreatmentTypeId === treatmentType.id && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-gray-500 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleStartEdit(treatmentType.id, treatmentType.name)}
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
                          צור גזע חדש בשם "{searchTerm}"
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {filteredTreatmentTypes.length === 0 && !showCreateOption && searchTerm && (
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

export default SmartTreatmentTypeSelector;
