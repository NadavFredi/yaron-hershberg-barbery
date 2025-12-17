import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Trash2, Plus, Edit, Loader2, GripVertical } from 'lucide-react';
import { useFAQs, useCreateFAQ, useUpdateFAQ, useDeleteFAQ, useReorderFAQs, FAQ } from '@/hooks/useFAQs';
import { useToast } from '@/hooks/use-toast';
import { FAQDialog } from '@/components/dialogs/FAQDialog';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRowProps {
    faq: FAQ;
    onEdit: (faq: FAQ) => void;
    onDelete: (id: string) => void;
    onToggleVisibility: (id: string, isVisible: boolean) => void;
}

const SortableRow = ({ faq, onEdit, onDelete, onToggleVisibility }: SortableRowProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: faq.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleRowClick = (e: React.MouseEvent) => {
        // Don't open edit modal if clicking on drag handle, checkbox, or action buttons
        const target = e.target as HTMLElement;
        const isClickableElement =
            target.closest('[data-drag-handle]') ||
            target.closest('input[type="checkbox"]') ||
            target.closest('button') ||
            target.closest('[role="checkbox"]');

        if (!isClickableElement) {
            onEdit(faq);
        }
    };

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={`${isDragging ? 'bg-gray-100' : ''} cursor-pointer hover:bg-gray-50`}
            onClick={handleRowClick}
        >
            <TableCell className="w-10">
                <div
                    {...attributes}
                    {...listeners}
                    data-drag-handle
                    className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical className="h-4 w-4 text-gray-400" />
                </div>
            </TableCell>
            <TableCell className="font-medium text-right">{faq.question}</TableCell>
            <TableCell className="text-right">
                <div
                    className="text-sm text-gray-600 line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: faq.answer }}
                />
            </TableCell>
            <TableCell>
                <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={faq.is_visible}
                        onCheckedChange={(checked) => onToggleVisibility(faq.id, checked === true)}
                    />
                </div>
            </TableCell>
            <TableCell className="text-center">{faq.display_order}</TableCell>
            <TableCell>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(faq)}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                            <AlertDialogHeader>
                                <AlertDialogTitle>מחיקת שאלה</AlertDialogTitle>
                                <AlertDialogDescription>
                                    האם אתה בטוח שברצונך למחוק את השאלה "{faq.question}"? פעולה זו לא ניתנת לביטול.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => onDelete(faq.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    מחק
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </TableCell>
        </TableRow>
    );
};

const FAQsManagement = () => {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
    const { toast } = useToast();

    const { data: faqs = [], isLoading, error } = useFAQs(true); // Include hidden FAQs for managers
    const createFAQMutation = useCreateFAQ();
    const updateFAQMutation = useUpdateFAQ();
    const deleteFAQMutation = useDeleteFAQ();
    const reorderFAQsMutation = useReorderFAQs();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleAddFAQ = async (data: { question: string; answer: string; is_visible: boolean }) => {
        try {
            const maxOrder = faqs.length > 0 ? Math.max(...faqs.map(f => f.display_order)) : -1;
            await createFAQMutation.mutateAsync({
                question: data.question,
                answer: data.answer,
                is_visible: data.is_visible,
                display_order: maxOrder + 1,
            });

            toast({
                title: "שאלה נוספה בהצלחה",
                description: "השאלה נשמרה במערכת",
            });

            setIsAddDialogOpen(false);
        } catch (error) {
            console.error('Error creating FAQ:', error);
            toast({
                title: "שגיאה בהוספת שאלה",
                description: "אנא נסה שוב",
                variant: "destructive",
            });
            throw error;
        }
    };

    const handleEditFAQ = (faq: FAQ) => {
        setEditingFAQ(faq);
    };

    const handleUpdateFAQ = async (data: { question: string; answer: string; is_visible: boolean }) => {
        if (!editingFAQ) {
            return;
        }

        try {
            await updateFAQMutation.mutateAsync({
                id: editingFAQ.id,
                updates: {
                    question: data.question,
                    answer: data.answer,
                    is_visible: data.is_visible,
                },
            });

            toast({
                title: "שאלה עודכנה בהצלחה",
                description: "השינויים נשמרו",
            });

            setEditingFAQ(null);
        } catch (error) {
            console.error('Error updating FAQ:', error);
            toast({
                title: "שגיאה בעדכון שאלה",
                description: "אנא נסה שוב",
                variant: "destructive",
            });
            throw error;
        }
    };

    const handleDeleteFAQ = async (id: string) => {
        try {
            await deleteFAQMutation.mutateAsync(id);
            toast({
                title: "שאלה נמחקה",
                description: "השאלה הוסרה מהמערכת",
            });
        } catch (error) {
            console.error('Error deleting FAQ:', error);
            toast({
                title: "שגיאה במחיקת שאלה",
                description: "אנא נסה שוב",
                variant: "destructive",
            });
        }
    };

    const handleToggleVisibility = async (id: string, isVisible: boolean) => {
        try {
            await updateFAQMutation.mutateAsync({
                id,
                updates: { is_visible: isVisible },
            });

            toast({
                title: isVisible ? "שאלה הופעלה" : "שאלה הוסתרה",
                description: "השינוי נשמר",
            });
        } catch (error) {
            console.error('Error toggling FAQ visibility:', error);
            toast({
                title: "שגיאה בעדכון נראות",
                description: "אנא נסה שוב",
                variant: "destructive",
            });
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = faqs.findIndex((faq) => faq.id === active.id);
        const newIndex = faqs.findIndex((faq) => faq.id === over.id);

        const reorderedFAQs = arrayMove(faqs, oldIndex, newIndex) as FAQ[];

        try {
            const updates = reorderedFAQs.map((faq, index) => ({
                id: faq.id,
                display_order: index,
            }));

            await reorderFAQsMutation.mutateAsync(updates);

            toast({
                title: "סדר השאלות עודכן",
                description: "השינויים נשמרו",
            });
        } catch (error) {
            console.error('Error reordering FAQs:', error);
            toast({
                title: "שגיאה בעדכון הסדר",
                description: "אנא נסה שוב",
                variant: "destructive",
            });
        }
    };

    const handleCloseEditDialog = () => {
        setEditingFAQ(null);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <p className="text-red-600">שגיאה בטעינת השאלות</p>
            </div>
        );
    }

    return (
        <div className="space-y-6" dir="rtl">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl">ניהול שאלות ותשובות</CardTitle>
                        <FAQDialog
                            open={isAddDialogOpen}
                            onOpenChange={setIsAddDialogOpen}
                            mode="add"
                            onSave={handleAddFAQ}
                            isPending={createFAQMutation.isPending}
                            trigger={
                                <Button>
                                    <Plus className="h-4 w-4 ml-2" />
                                    הוסף שאלה חדשה
                                </Button>
                            }
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {faqs.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            אין שאלות במערכת. הוסף שאלה חדשה כדי להתחיל.
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10"></TableHead>
                                        <TableHead className="text-right">שאלה</TableHead>
                                        <TableHead className="text-right">תשובה</TableHead>
                                        <TableHead className="text-right">גלוי</TableHead>
                                        <TableHead className="text-center">סדר</TableHead>
                                        <TableHead className="text-right">פעולות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <SortableContext items={faqs.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                        {faqs.map((faq) => (
                                            <SortableRow
                                                key={faq.id}
                                                faq={faq}
                                                onEdit={handleEditFAQ}
                                                onDelete={handleDeleteFAQ}
                                                onToggleVisibility={handleToggleVisibility}
                                            />
                                        ))}
                                    </SortableContext>
                                </TableBody>
                            </Table>
                        </DndContext>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <FAQDialog
                open={!!editingFAQ}
                onOpenChange={(open) => !open && handleCloseEditDialog()}
                mode="edit"
                faq={editingFAQ}
                onSave={handleUpdateFAQ}
                isPending={updateFAQMutation.isPending}
            />
        </div>
    );
};

export default FAQsManagement;

