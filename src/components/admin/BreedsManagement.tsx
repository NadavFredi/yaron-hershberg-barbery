
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useBreeds } from '@/hooks/useBreeds';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import InlineEditText from './InlineEditText';

const BreedsManagement = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newBreedName, setNewBreedName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteDialogState, setDeleteDialogState] = useState<{
    isOpen: boolean;
    breedId: string;
    breedName: string;
    servicesCount: number;
  }>({
    isOpen: false,
    breedId: '',
    breedName: '',
    servicesCount: 0
  });
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { toast } = useToast();
  const { data: breeds, refetch: refetchBreeds } = useBreeds();

  const handleCreateBreed = async () => {
    if (!newBreedName.trim()) return;

    setIsCreating(true);
    try {
      const { error } = await supabase
        .from('breeds')
        .insert({ name: newBreedName.trim() });

      if (error) throw error;

      await refetchBreeds();
      
      toast({
        title: "גזע נוצר בהצלחה",
        description: `הגזע "${newBreedName}" נוצר ונוסף למערכת`,
      });

      setNewBreedName('');
      setIsAddDialogOpen(false);
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

  const handleUpdateBreedName = async (breedId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('breeds')
        .update({ name: newName })
        .eq('id', breedId);

      if (error) throw error;

      await refetchBreeds();
      
      toast({
        title: "שם הגזע עודכן",
        description: `השם עודכן בהצלחה ל"${newName}"`,
      });
    } catch (error) {
      console.error('Error updating breed name:', error);
      toast({
        title: "שגיאה בעדכון השם",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteClick = async (breedId: string, breedName: string) => {
    try {
      // Check how many services this breed is associated with
      const { data: modifiers, error } = await supabase
        .from('breed_modifiers')
        .select('service_id')
        .eq('breed_id', breedId);

      if (error) throw error;

      const servicesCount = modifiers?.length || 0;
      
      setDeleteDialogState({
        isOpen: true,
        breedId,
        breedName,
        servicesCount
      });
    } catch (error) {
      console.error('Error checking breed associations:', error);
      toast({
        title: "שגיאה בבדיקת השיוכים",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      // First delete all breed modifiers
      const { error: modifiersError } = await supabase
        .from('breed_modifiers')
        .delete()
        .eq('breed_id', deleteDialogState.breedId);

      if (modifiersError) throw modifiersError;

      // Then delete the breed
      const { error: breedError } = await supabase
        .from('breeds')
        .delete()
        .eq('id', deleteDialogState.breedId);

      if (breedError) throw breedError;

      await refetchBreeds();
      
      toast({
        title: "גזע נמחק בהצלחה",
        description: `הגזע "${deleteDialogState.breedName}" נמחק מהמערכת`,
      });

      setDeleteDialogState({
        isOpen: false,
        breedId: '',
        breedName: '',
        servicesCount: 0
      });
    } catch (error) {
      console.error('Error deleting breed:', error);
      toast({
        title: "שגיאה במחיקת הגזע",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Sort breeds alphabetically
  const sortedBreeds = breeds?.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')) || [];

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl">רשימת הגזעים במערכת</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                לחץ על שם גזע כדי לערוך אותו
              </p>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 ml-2" />
              הוסף גזע חדש
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sortedBreeds && sortedBreeds.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם הגזע</TableHead>
                  <TableHead className="text-right">שירותים משויכים</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBreeds.map((breed) => (
                  <TableRow key={breed.id}>
                    <TableCell className="font-medium">
                      <InlineEditText
                        value={breed.name}
                        onSave={(newName) => handleUpdateBreedName(breed.id, newName)}
                        placeholder="שם הגזע"
                      />
                    </TableCell>
                    <TableCell className="text-gray-600">
                      משויך לשירותים
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteClick(breed.id, breed.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              אין גזעים במערכת. הוסף גזע ראשון כדי להתחיל.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Breed Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת גזע חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="הקלד/י שם הגזע..."
                value={newBreedName}
                onChange={(e) => setNewBreedName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newBreedName.trim()) {
                    handleCreateBreed();
                  }
                }}
              />
            </div>
            <div className="flex justify-end space-x-2 space-x-reverse">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                בטל
              </Button>
              <Button 
                onClick={handleCreateBreed}
                disabled={!newBreedName.trim() || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    שומר...
                  </>
                ) : (
                  'שמור'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogState.isOpen} onOpenChange={(open) => 
        setDeleteDialogState(prev => ({ ...prev, isOpen: open }))
      }>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              האם למחוק את הגזע "{deleteDialogState.breedName}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialogState.servicesCount === 0 ? (
                <span>הגזע יימחק מהמערכת לצמיתות.</span>
              ) : (
                <span className="text-red-600">
                  <strong>אזהרה:</strong> הגזע "{deleteDialogState.breedName}" משויך ל-{deleteDialogState.servicesCount} שירותים. 
                  מחיקתו תסיר אותו ואת כל התאמות הזמן והמחיר שלו משירותים אלה. 
                  הפעולה אינה הפיכה.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>בטל</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  מוחק...
                </>
              ) : (
                'כן, אני מבין/ה, למחוק'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BreedsManagement;
