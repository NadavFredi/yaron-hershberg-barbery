import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, Loader2, Search, X, ArrowUp, ArrowDown, GripVertical } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
    useServices,
    useCreateService,
    useUpdateService,
    useCreateServiceSubAction,
    useUpdateServiceSubAction,
    useDeleteServiceSubAction,
    type Service,
    type ServiceSubAction
} from "@/hooks/useServices"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export default function ServicesListPage() {
    const { toast } = useToast()
    const { data: services = [], isLoading, refetch } = useServices()
    const createService = useCreateService()
    const updateService = useUpdateService()
    const createSubAction = useCreateServiceSubAction()
    const updateSubAction = useUpdateServiceSubAction()
    const deleteSubAction = useDeleteServiceSubAction()

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
        duration: 0,
        is_active: true,
        mode: "simple" as "simple" | "complicated",
    })

    // Sub actions state (for complicated mode)
    const [subActions, setSubActions] = useState<Omit<ServiceSubAction, "id" | "service_id" | "created_at" | "updated_at">[]>([])

    const filteredServices = services.filter((service) =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleAdd = () => {
        setFormData({
            name: "",
            description: "",
            base_price: 0,
            duration: 0,
            is_active: true,
            mode: "simple"
        })
        setSubActions([])
        setEditingService(null)
        setIsAddDialogOpen(true)
    }

    const handleEdit = (service: Service) => {
        setEditingService(service)
        const serviceMode = service.mode || "simple"
        setFormData({
            name: service.name,
            description: service.description || "",
            base_price: service.base_price,
            duration: service.duration ?? 0,
            is_active: service.is_active ?? true,
            mode: serviceMode,
        })
        // Only load sub actions if service is in complicated mode
        if (serviceMode === "complicated") {
            setSubActions(
                (service.service_sub_actions || []).map(({ id: _id, service_id: _service_id, created_at: _created_at, updated_at: _updated_at, ...rest }) => rest)
            )
        } else {
            setSubActions([])
        }
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

        if (formData.mode === "simple" && !formData.duration) {
            toast({
                title: "שגיאה",
                description: "אנא הזן משך זמן לשירות",
                variant: "destructive",
            })
            return
        }

        if (formData.mode === "complicated" && subActions.length === 0) {
            toast({
                title: "שגיאה",
                description: "אנא הוסף לפחות פעולת משנה אחת",
                variant: "destructive",
            })
            return
        }

        try {
            let serviceId: string

            if (editingService) {
                const updated = await updateService.mutateAsync({
                    serviceId: editingService.id,
                    name: formData.name.trim(),
                    description: formData.description.trim() || null,
                    base_price: formData.base_price,
                    duration: formData.mode === "simple" ? formData.duration : undefined,
                    is_active: formData.is_active,
                    mode: formData.mode,
                })
                serviceId = updated.id

                // Handle sub actions for complicated mode
                const existingSubActions = editingService.service_sub_actions || []

                if (formData.mode === "complicated") {
                    // Delete removed sub actions
                    const currentIds = new Set(subActions.map((_, idx) => {
                        // Try to find matching existing sub action by order
                        const existing = existingSubActions.find(e => e.order_index === idx)
                        return existing?.id
                    }).filter(Boolean))

                    for (const existing of existingSubActions) {
                        if (!currentIds.has(existing.id)) {
                            await deleteSubAction.mutateAsync(existing.id)
                        }
                    }

                    // Update or create sub actions
                    for (let i = 0; i < subActions.length; i++) {
                        const subAction = subActions[i]
                        const existing = existingSubActions.find(e => e.order_index === i)

                        if (existing) {
                            await updateSubAction.mutateAsync({
                                subActionId: existing.id,
                                name: subAction.name,
                                description: subAction.description,
                                duration: subAction.duration,
                                order_index: i,
                                is_active: subAction.is_active,
                            })
                        } else {
                            await createSubAction.mutateAsync({
                                service_id: serviceId,
                                name: subAction.name,
                                description: subAction.description,
                                duration: subAction.duration,
                                order_index: i,
                                is_active: subAction.is_active,
                            })
                        }
                    }
                } else {
                    // Delete all sub actions if switching to simple mode
                    for (const existing of existingSubActions) {
                        await deleteSubAction.mutateAsync(existing.id)
                    }
                }

                toast({
                    title: "הצלחה",
                    description: "השירות עודכן בהצלחה",
                })
                setIsEditDialogOpen(false)
            } else {
                const created = await createService.mutateAsync({
                    name: formData.name.trim(),
                    description: formData.description.trim() || undefined,
                    base_price: formData.base_price,
                    duration: formData.mode === "simple" ? formData.duration : undefined,
                    is_active: formData.is_active,
                    mode: formData.mode,
                })
                serviceId = created.id

                // Create sub actions for complicated mode
                if (formData.mode === "complicated") {
                    for (let i = 0; i < subActions.length; i++) {
                        await createSubAction.mutateAsync({
                            service_id: serviceId,
                            name: subActions[i].name,
                            description: subActions[i].description,
                            duration: subActions[i].duration,
                            order_index: i,
                            is_active: subActions[i].is_active,
                        })
                    }
                }

                toast({
                    title: "הצלחה",
                    description: "השירות נוסף בהצלחה",
                })
                setIsAddDialogOpen(false)
            }
            setFormData({ name: "", description: "", base_price: 0, duration: 0, is_active: true, mode: "simple" })
            setSubActions([])
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

    const addSubAction = () => {
        setSubActions([
            ...subActions,
            {
                name: "",
                description: "",
                duration: 0,
                order_index: subActions.length,
                is_active: true,
            }
        ])
    }

    const removeSubAction = (index: number) => {
        setSubActions(subActions.filter((_, i) => i !== index).map((sa, i) => ({ ...sa, order_index: i })))
    }

    const updateSubActionField = (index: number, field: keyof Omit<ServiceSubAction, "id" | "service_id" | "created_at" | "updated_at">, value: string | number | boolean) => {
        const updated = [...subActions]
        updated[index] = { ...updated[index], [field]: value }
        setSubActions(updated)
    }

    const moveSubAction = (index: number, direction: "up" | "down") => {
        if (direction === "up" && index === 0) return
        if (direction === "down" && index === subActions.length - 1) return

        const updated = [...subActions]
        const newIndex = direction === "up" ? index - 1 : index + 1
            ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
        updated[index].order_index = index
        updated[newIndex].order_index = newIndex
        setSubActions(updated)
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
                                    <TableHead className="text-right">סוג</TableHead>
                                    <TableHead className="text-right">משך זמן</TableHead>
                                    <TableHead className="text-right">תיאור</TableHead>
                                    <TableHead className="text-right">מחיר בסיס</TableHead>
                                    <TableHead className="text-right">סטטוס</TableHead>
                                    <TableHead className="text-right">פעולות</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredServices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                                            {services.length === 0
                                                ? "אין שירותים במערכת. הוסף שירות חדש כדי להתחיל."
                                                : "לא נמצאו שירותים התואמים את החיפוש."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredServices.map((service) => {
                                        // Handle null/undefined mode (for existing services before migration)
                                        const serviceMode = service.mode || "simple"

                                        const totalDuration = serviceMode === "complicated"
                                            ? (service.service_sub_actions || [])
                                                .filter(sa => sa.is_active)
                                                .reduce((sum, sa) => sum + sa.duration, 0)
                                            : (service.duration ?? 0)

                                        const activeSubActionsCount = serviceMode === "complicated"
                                            ? (service.service_sub_actions || []).filter(sa => sa.is_active).length
                                            : 0
                                        const totalSubActionsCount = serviceMode === "complicated"
                                            ? (service.service_sub_actions || []).length
                                            : 0

                                        return (
                                            <>
                                                <TableRow key={service.id}>
                                                    <TableCell className="font-medium">{service.name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={serviceMode === "simple" ? "default" : "secondary"}>
                                                            {serviceMode === "simple" ? "פשוט" : "מורכב"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {totalDuration > 0 ? (
                                                            <div>
                                                                <span>{totalDuration} דקות</span>
                                                                {serviceMode === "complicated" && totalSubActionsCount > 0 && (
                                                                    <span className="text-xs text-gray-500 block mt-1">
                                                                        ({activeSubActionsCount}/{totalSubActionsCount} פעולות פעילות)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400">לא הוגדר</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-gray-600">
                                                        {service.description || "-"}
                                                    </TableCell>
                                                    <TableCell>{service.base_price} ₪</TableCell>
                                                    <TableCell>
                                                        <Badge variant={(service.is_active ?? true) ? "default" : "secondary"}>
                                                            {(service.is_active ?? true) ? "פעיל" : "לא פעיל"}
                                                        </Badge>
                                                    </TableCell>
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
                                                {serviceMode === "complicated" && service.service_sub_actions && service.service_sub_actions.length > 0 && (
                                                    service.service_sub_actions.map((subAction) => (
                                                        <TableRow key={`${service.id}-${subAction.id}`} className="bg-gray-50/50">
                                                            <TableCell className="pl-8">
                                                                <div className="flex items-center gap-2">
                                                                    <GripVertical className="h-4 w-4 text-gray-400" />
                                                                    <span className="text-sm">{subAction.name}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="text-xs text-gray-500">פעולת משנה</span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="text-sm">{subAction.duration} דקות</span>
                                                            </TableCell>
                                                            <TableCell className="text-gray-600 text-sm">
                                                                {subAction.description || "-"}
                                                            </TableCell>
                                                            <TableCell></TableCell>
                                                            <TableCell>
                                                                <Badge variant={subAction.is_active ? "default" : "secondary"} className="text-xs">
                                                                    {subAction.is_active ? "פעיל" : "לא פעיל"}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell></TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </>
                                        )
                                    })
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
                    setFormData({ name: "", description: "", base_price: 0, duration: 0, is_active: true, mode: "simple" })
                    setSubActions([])
                    setEditingService(null)
                }
            }}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" dir="rtl">
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
                        <div className="space-y-2">
                            <Label htmlFor="mode">סוג שירות *</Label>
                            <Select
                                value={formData.mode}
                                onValueChange={(value: "simple" | "complicated") => {
                                    setFormData({ ...formData, mode: value })
                                    if (value === "simple") {
                                        setSubActions([])
                                    }
                                }}
                            >
                                <SelectTrigger dir="rtl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="simple">פשוט</SelectItem>
                                    <SelectItem value="complicated">מורכב</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {formData.mode === "simple" && (
                            <div className="space-y-2">
                                <Label htmlFor="duration">משך זמן (דקות) *</Label>
                                <Input
                                    id="duration"
                                    type="number"
                                    value={formData.duration}
                                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                                    placeholder="0"
                                    dir="rtl"
                                />
                            </div>
                        )}
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                                id="is_active"
                                checked={formData.is_active}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked as boolean })}
                            />
                            <Label htmlFor="is_active" className="cursor-pointer">פעיל</Label>
                        </div>

                        {formData.mode === "complicated" && (
                            <div className="space-y-4 border-t pt-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>פעולות משנה</Label>
                                        {subActions.length > 0 && (
                                            <p className="text-sm text-gray-500 mt-1">
                                                משך זמן כולל: {subActions.filter(sa => sa.is_active).reduce((sum, sa) => sum + sa.duration, 0)} דקות
                                            </p>
                                        )}
                                    </div>
                                    <Button type="button" onClick={addSubAction} size="sm" variant="outline">
                                        <Plus className="h-4 w-4 ml-2" />
                                        הוסף פעולה
                                    </Button>
                                </div>
                                {subActions.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-4">
                                        אין פעולות משנה. הוסף פעולה כדי להתחיל.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {subActions.map((subAction, index) => (
                                            <Card key={index} className="p-4">
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <GripVertical className="h-4 w-4 text-gray-400" />
                                                            <span className="text-sm font-medium">פעולה {index + 1}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => moveSubAction(index, "up")}
                                                                disabled={index === 0}
                                                                className="h-6 w-6 p-0"
                                                            >
                                                                <ArrowUp className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => moveSubAction(index, "down")}
                                                                disabled={index === subActions.length - 1}
                                                                className="h-6 w-6 p-0"
                                                            >
                                                                <ArrowDown className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => removeSubAction(index)}
                                                                className="h-6 w-6 p-0 text-red-600"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>שם הפעולה *</Label>
                                                        <Input
                                                            value={subAction.name}
                                                            onChange={(e) => updateSubActionField(index, "name", e.target.value)}
                                                            placeholder="לדוגמה: צביעה"
                                                            dir="rtl"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>תיאור</Label>
                                                        <Textarea
                                                            value={subAction.description || ""}
                                                            onChange={(e) => updateSubActionField(index, "description", e.target.value)}
                                                            placeholder="תיאור הפעולה (אופציונלי)"
                                                            dir="rtl"
                                                            rows={2}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>משך זמן (דקות) *</Label>
                                                            <Input
                                                                type="number"
                                                                value={subAction.duration}
                                                                onChange={(e) => updateSubActionField(index, "duration", parseInt(e.target.value) || 0)}
                                                                placeholder="0"
                                                                dir="rtl"
                                                            />
                                                        </div>
                                                        <div className="flex items-center space-x-2 space-x-reverse pt-6">
                                                            <Checkbox
                                                                checked={subAction.is_active}
                                                                onCheckedChange={(checked) => updateSubActionField(index, "is_active", checked as boolean)}
                                                            />
                                                            <Label className="cursor-pointer">פעיל</Label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter dir="ltr">
                        <Button variant="outline" onClick={() => {
                            setIsAddDialogOpen(false)
                            setIsEditDialogOpen(false)
                            setFormData({ name: "", description: "", base_price: 0, duration: 0, is_active: true, mode: "simple" })
                            setSubActions([])
                            setEditingService(null)
                        }}>
                            ביטול
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={createService.isPending || updateService.isPending || createSubAction.isPending || updateSubAction.isPending || deleteSubAction.isPending}
                        >
                            {(createService.isPending || updateService.isPending || createSubAction.isPending || updateSubAction.isPending || deleteSubAction.isPending) && (
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

