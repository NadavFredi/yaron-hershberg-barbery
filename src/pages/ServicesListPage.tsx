import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, Loader2, Search, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useServices, useCreateService, useUpdateService, type Service } from "@/hooks/useServices"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

export default function ServicesListPage() {
    const { toast } = useToast()
    const { data: services = [], isLoading, refetch } = useServices()
    const createService = useCreateService()
    const updateService = useUpdateService()
    
    const [searchTerm, setSearchTerm] = useState("")
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [editingService, setEditingService] = useState<Service | null>(null)
    const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)
    
    // Form state
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        base_price: 0,
    })

    const filteredServices = services.filter((service) =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleAdd = () => {
        setFormData({ name: "", description: "", base_price: 0 })
        setEditingService(null)
        setIsAddDialogOpen(true)
    }

    const handleEdit = (service: Service) => {
        setEditingService(service)
        setFormData({
            name: service.name,
            description: service.description || "",
            base_price: service.base_price,
        })
        setIsEditDialogOpen(true)
    }

    const handleDelete = (service: Service) => {
        setServiceToDelete(service)
        setIsDeleteDialogOpen(true)
    }

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast({
                title: "שגיאה",
                description: "אנא הזן שם שירות",
                variant: "destructive",
            })
            return
        }

        try {
            if (editingService) {
                await updateService.mutateAsync({
                    serviceId: editingService.id,
                    name: formData.name.trim(),
                    description: formData.description.trim() || null,
                    base_price: formData.base_price,
                })
                toast({
                    title: "הצלחה",
                    description: "השירות עודכן בהצלחה",
                })
                setIsEditDialogOpen(false)
            } else {
                await createService.mutateAsync({
                    name: formData.name.trim(),
                    description: formData.description.trim() || undefined,
                    base_price: formData.base_price,
                })
                toast({
                    title: "הצלחה",
                    description: "השירות נוסף בהצלחה",
                })
                setIsAddDialogOpen(false)
            }
            setFormData({ name: "", description: "", base_price: 0 })
            setEditingService(null)
        } catch (error: unknown) {
            console.error("Error saving service:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את השירות"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleConfirmDelete = async () => {
        if (!serviceToDelete) return

        try {
            const { error } = await supabase
                .from("services")
                .delete()
                .eq("id", serviceToDelete.id)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "השירות נמחק בהצלחה",
            })

            setIsDeleteDialogOpen(false)
            setServiceToDelete(null)
            refetch()
        } catch (error: unknown) {
            console.error("Error deleting service:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן למחוק את השירות"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mr-2">טוען שירותים...</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>שירותים</CardTitle>
                            <CardDescription>נהל את רשימת השירותים במערכת</CardDescription>
                        </div>
                        <Button onClick={handleAdd} className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            הוסף שירות
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Search */}
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                                placeholder="חפש שירות..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pr-10"
                                dir="rtl"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm("")}
                                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right">שם השירות</TableHead>
                                    <TableHead className="text-right">תיאור</TableHead>
                                    <TableHead className="text-right">מחיר בסיס</TableHead>
                                    <TableHead className="text-right">פעולות</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredServices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                                            {services.length === 0
                                                ? "אין שירותים במערכת. הוסף שירות חדש כדי להתחיל."
                                                : "לא נמצאו שירותים התואמים את החיפוש."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredServices.map((service) => (
                                        <TableRow key={service.id}>
                                            <TableCell className="font-medium">{service.name}</TableCell>
                                            <TableCell className="text-gray-600">
                                                {service.description || "-"}
                                            </TableCell>
                                            <TableCell>{service.base_price} ₪</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 justify-end">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEdit(service)}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(service)}
                                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsAddDialogOpen(false)
                    setIsEditDialogOpen(false)
                    setFormData({ name: "", description: "", base_price: 0 })
                    setEditingService(null)
                }
            }}>
                <DialogContent className="sm:max-w-[500px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{editingService ? "ערוך שירות" : "הוסף שירות חדש"}</DialogTitle>
                        <DialogDescription>
                            {editingService ? "ערוך את פרטי השירות" : "הזן את פרטי השירות החדש"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">שם השירות *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="לדוגמה: תספורת גברים"
                                dir="rtl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">תיאור</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="תיאור השירות (אופציונלי)"
                                dir="rtl"
                                rows={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="base_price">מחיר בסיס (₪) *</Label>
                            <Input
                                id="base_price"
                                type="number"
                                value={formData.base_price}
                                onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                                placeholder="0"
                                dir="rtl"
                            />
                        </div>
                    </div>
                    <DialogFooter dir="ltr">
                        <Button variant="outline" onClick={() => {
                            setIsAddDialogOpen(false)
                            setIsEditDialogOpen(false)
                            setFormData({ name: "", description: "", base_price: 0 })
                            setEditingService(null)
                        }}>
                            ביטול
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={createService.isPending || updateService.isPending}
                        >
                            {(createService.isPending || updateService.isPending) && (
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                            )}
                            {editingService ? "עדכן" : "הוסף"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[425px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>מחיקת שירות</DialogTitle>
                        <DialogDescription>
                            האם אתה בטוח שברצונך למחוק את השירות "{serviceToDelete?.name}"? פעולה זו לא ניתנת לביטול.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter dir="ltr">
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                            ביטול
                        </Button>
                        <Button variant="destructive" onClick={handleConfirmDelete}>
                            מחק
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

