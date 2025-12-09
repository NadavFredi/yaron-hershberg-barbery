import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, Loader2, Search, X, ArrowUp, ArrowDown, GripVertical, ChevronDown, ChevronRight, Check, Save } from "lucide-react"
import {
    DndContext,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { DurationInput } from "@/components/DurationInput"
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
import { cn } from "@/lib/utils"

interface PendingSubActionRowProps {
    subAction: {
        name: string
        description: string
        duration: number
        is_active: boolean
        tempId: string
    }
    onRemove: () => void
}

function PendingSubActionRow({ subAction, onRemove }: PendingSubActionRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: subAction.tempId })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={cn("bg-blue-50/50", isDragging && "opacity-50")}
        >
            <TableCell className="pl-12">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="cursor-grab active:cursor-grabbing"
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="h-4 w-4 text-gray-400" />
                    </button>
                    <span className="text-sm">{subAction.name}</span>
                </div>
            </TableCell>
            <TableCell>
                <span className="text-xs text-gray-500">פעולת משנה (ממתין)</span>
            </TableCell>
            <TableCell>
                <span className="text-sm">{subAction.duration} דקות</span>
            </TableCell>
            <TableCell className="text-gray-600 text-sm">
                {subAction.description || "-"}
            </TableCell>
            <TableCell></TableCell>
            <TableCell>
                <div className="flex items-center gap-2">
                    <Checkbox checked={subAction.is_active} disabled />
                    <Label className="text-xs">זמן עבודה פעיל</Label>
                </div>
            </TableCell>
            <TableCell>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRemove}
                    className="h-6 w-6 p-0 text-red-600"
                >
                    <X className="h-3 w-3" />
                </Button>
            </TableCell>
        </TableRow>
    )
}

interface ExistingSubActionRowProps {
    subAction: ServiceSubAction
    onUpdateActive: (checked: boolean) => void
    onDelete: () => void
}

function ExistingSubActionRow({ subAction, onUpdateActive, onDelete }: ExistingSubActionRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: subAction.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={cn("bg-gray-50/50", isDragging && "opacity-50")}
        >
            <TableCell className="pl-12">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="cursor-grab active:cursor-grabbing"
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="h-4 w-4 text-gray-400" />
                    </button>
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
                <div className="flex items-center gap-2">
                    <Checkbox
                        checked={subAction.is_active}
                        onCheckedChange={onUpdateActive}
                    />
                    <Label className="text-xs cursor-pointer">
                        זמן עבודה פעיל
                    </Label>
                </div>
            </TableCell>
            <TableCell>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDelete}
                    className="h-6 w-6 p-0 text-red-600"
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            </TableCell>
        </TableRow>
    )
}

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

    // Expanded services (for showing sub-actions)
    const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())

    // Inline editing state
    const [editingField, setEditingField] = useState<{ serviceId: string; field: string } | null>(null)
    const [inlineEditValue, setInlineEditValue] = useState<string>("")

    // Inline sub-action creation state - accumulate multiple before saving
    const [addingSubActionTo, setAddingSubActionTo] = useState<string | null>(null)
    const [pendingSubActions, setPendingSubActions] = useState<Map<string, Array<{
        name: string
        description: string
        duration: number
        is_active: boolean
        tempId: string
    }>>>(new Map())
    const [newSubAction, setNewSubAction] = useState<{
        name: string
        description: string
        duration: number
        is_active: boolean
    }>({
        name: "",
        description: "",
        duration: 0,
        is_active: true,
    })

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    )

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

    const toggleExpanded = (serviceId: string) => {
        const newExpanded = new Set(expandedServices)
        if (newExpanded.has(serviceId)) {
            newExpanded.delete(serviceId)
            setAddingSubActionTo(null)
        } else {
            newExpanded.add(serviceId)
        }
        setExpandedServices(newExpanded)
    }

    const startInlineEdit = (serviceId: string, field: string, currentValue: string | number) => {
        setEditingField({ serviceId, field })
        setInlineEditValue(String(currentValue))
    }

    const cancelInlineEdit = () => {
        setEditingField(null)
        setInlineEditValue("")
    }

    const saveInlineEdit = async (service: Service) => {
        if (!editingField) return

        try {
            const updateData: {
                name?: string
                description?: string | null
                base_price?: number
                duration?: number
            } = {}
            if (editingField.field === "name") {
                updateData.name = inlineEditValue.trim()
            } else if (editingField.field === "description") {
                updateData.description = inlineEditValue.trim() || null
            } else if (editingField.field === "base_price") {
                updateData.base_price = parseFloat(inlineEditValue) || 0
            } else if (editingField.field === "duration" && service.mode === "simple") {
                updateData.duration = parseInt(inlineEditValue) || 0
            }

            await updateService.mutateAsync({
                serviceId: service.id,
                ...updateData,
            })

            toast({
                title: "הצלחה",
                description: "השירות עודכן בהצלחה",
            })

            cancelInlineEdit()
        } catch (error: unknown) {
            console.error("Error updating service:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את השירות"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleStartAddingSubAction = (serviceId: string) => {
        setAddingSubActionTo(serviceId)
        setNewSubAction({
            name: "",
            description: "",
            duration: 0,
            is_active: true,
        })
        if (!expandedServices.has(serviceId)) {
            setExpandedServices(new Set([...expandedServices, serviceId]))
        }
    }

    const handleCancelAddingSubAction = () => {
        setAddingSubActionTo(null)
        setNewSubAction({
            name: "",
            description: "",
            duration: 0,
            is_active: true,
        })
        setPendingSubActions(new Map())
    }

    const handleAddPendingSubAction = (serviceId: string) => {
        if (!newSubAction.name.trim()) {
            toast({
                title: "שגיאה",
                description: "אנא הזן שם לפעולת המשנה",
                variant: "destructive",
            })
            return
        }

        if (newSubAction.duration <= 0) {
            toast({
                title: "שגיאה",
                description: "אנא הזן משך זמן חיובי",
                variant: "destructive",
            })
            return
        }

        const currentPending = pendingSubActions.get(serviceId) || []
        const tempId = `temp-${Date.now()}-${Math.random()}`
        setPendingSubActions(new Map(pendingSubActions.set(serviceId, [
            ...currentPending,
            {
                ...newSubAction,
                name: newSubAction.name.trim(),
                description: newSubAction.description.trim(),
                tempId,
            }
        ])))

        // Reset form
        setNewSubAction({
            name: "",
            description: "",
            duration: 0,
            is_active: true,
        })
    }

    const handleRemovePendingSubAction = (serviceId: string, tempId: string) => {
        const currentPending = pendingSubActions.get(serviceId) || []
        setPendingSubActions(new Map(pendingSubActions.set(serviceId, currentPending.filter(sa => sa.tempId !== tempId))))
    }

    const handleSaveAllPendingSubActions = async (serviceId: string) => {
        const pending = pendingSubActions.get(serviceId) || []

        if (pending.length === 0) {
            toast({
                title: "שגיאה",
                description: "אין פעולות משנה לשמירה",
                variant: "destructive",
            })
            return
        }

        try {
            const service = services.find(s => s.id === serviceId)
            const existingSubActions = service?.service_sub_actions || []
            const maxOrder = existingSubActions.length > 0
                ? Math.max(...existingSubActions.map(sa => sa.order_index))
                : -1

            // Create all sub-actions
            for (let i = 0; i < pending.length; i++) {
                await createSubAction.mutateAsync({
                    service_id: serviceId,
                    name: pending[i].name,
                    description: pending[i].description || undefined,
                    duration: pending[i].duration,
                    order_index: maxOrder + 1 + i,
                    is_active: pending[i].is_active,
                })
            }

            // If service was simple, update it to complicated
            if (service && service.mode === "simple") {
                await updateService.mutateAsync({
                    serviceId: service.id,
                    mode: "complicated",
                })
            }

            toast({
                title: "הצלחה",
                description: `${pending.length} פעולות משנה נוספו בהצלחה`,
            })

            handleCancelAddingSubAction()
        } catch (error: unknown) {
            console.error("Error creating sub-actions:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן להוסיף את פעולות המשנה"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleDragEnd = (serviceId: string) => (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const pending = pendingSubActions.get(serviceId) || []
        const oldIndex = pending.findIndex(sa => sa.tempId === active.id)
        const newIndex = pending.findIndex(sa => sa.tempId === over.id)

        if (oldIndex === -1 || newIndex === -1) return

        const updated = [...pending]
        const [moved] = updated.splice(oldIndex, 1)
        updated.splice(newIndex, 0, moved)

        setPendingSubActions(new Map(pendingSubActions.set(serviceId, updated)))
    }

    const handleDragEndExisting = (serviceId: string) => async (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const service = services.find(s => s.id === serviceId)
        if (!service || !service.service_sub_actions) return

        const subActions = [...service.service_sub_actions]
        const oldIndex = subActions.findIndex(sa => sa.id === active.id)
        const newIndex = subActions.findIndex(sa => sa.id === over.id)

        if (oldIndex === -1 || newIndex === -1) return

        // Reorder locally
        const updated = [...subActions]
        const [moved] = updated.splice(oldIndex, 1)
        updated.splice(newIndex, 0, moved)

        // Update order_index for all affected sub-actions
        try {
            for (let i = 0; i < updated.length; i++) {
                if (updated[i].order_index !== i) {
                    await updateSubAction.mutateAsync({
                        subActionId: updated[i].id,
                        order_index: i,
                    })
                }
            }
            toast({
                title: "הצלחה",
                description: "סדר הפעולות עודכן בהצלחה",
            })
        } catch (error: unknown) {
            console.error("Error reordering sub-actions:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את הסדר"
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
                                        const isExpanded = expandedServices.has(service.id)
                                        const isAddingSubAction = addingSubActionTo === service.id

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

                                        const isEditingName = editingField?.serviceId === service.id && editingField.field === "name"
                                        const isEditingDescription = editingField?.serviceId === service.id && editingField.field === "description"
                                        const isEditingPrice = editingField?.serviceId === service.id && editingField.field === "base_price"
                                        const isEditingDuration = editingField?.serviceId === service.id && editingField.field === "duration" && serviceMode === "simple"

                                        return (
                                            <>
                                                <TableRow key={service.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => toggleExpanded(service.id)}
                                                                className="h-6 w-6 p-0"
                                                            >
                                                                {isExpanded ? (
                                                                    <ChevronDown className="h-4 w-4" />
                                                                ) : (
                                                                    <ChevronRight className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                            {isEditingName ? (
                                                                <div className="flex items-center gap-1">
                                                                    <Input
                                                                        value={inlineEditValue}
                                                                        onChange={(e) => setInlineEditValue(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === "Enter") {
                                                                                saveInlineEdit(service)
                                                                            } else if (e.key === "Escape") {
                                                                                cancelInlineEdit()
                                                                            }
                                                                        }}
                                                                        className="h-8 w-32"
                                                                        autoFocus
                                                                        dir="rtl"
                                                                    />
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => saveInlineEdit(service)}
                                                                        className="h-6 w-6 p-0"
                                                                    >
                                                                        <Check className="h-3 w-3 text-green-600" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={cancelInlineEdit}
                                                                        className="h-6 w-6 p-0"
                                                                    >
                                                                        <X className="h-3 w-3 text-red-600" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <span
                                                                    className="font-medium cursor-pointer hover:underline"
                                                                    onClick={() => startInlineEdit(service.id, "name", service.name)}
                                                                >
                                                                    {service.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={serviceMode === "simple" ? "default" : "secondary"}>
                                                            {serviceMode === "simple" ? "פשוט" : "מורכב"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {isEditingDuration ? (
                                                            <div className="flex items-center gap-1">
                                                                <Input
                                                                    type="number"
                                                                    value={inlineEditValue}
                                                                    onChange={(e) => setInlineEditValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") {
                                                                            saveInlineEdit(service)
                                                                        } else if (e.key === "Escape") {
                                                                            cancelInlineEdit()
                                                                        }
                                                                    }}
                                                                    className="h-8 w-20"
                                                                    autoFocus
                                                                    dir="rtl"
                                                                />
                                                                <span className="text-sm">דקות</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => saveInlineEdit(service)}
                                                                    className="h-6 w-6 p-0"
                                                                >
                                                                    <Check className="h-3 w-3 text-green-600" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={cancelInlineEdit}
                                                                    className="h-6 w-6 p-0"
                                                                >
                                                                    <X className="h-3 w-3 text-red-600" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <span
                                                                className="cursor-pointer hover:underline"
                                                                onClick={() => {
                                                                    if (serviceMode === "simple") {
                                                                        startInlineEdit(service.id, "duration", service.duration || 0)
                                                                    }
                                                                }}
                                                            >
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
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isEditingDescription ? (
                                                            <div className="flex items-center gap-1">
                                                                <Input
                                                                    value={inlineEditValue}
                                                                    onChange={(e) => setInlineEditValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") {
                                                                            saveInlineEdit(service)
                                                                        } else if (e.key === "Escape") {
                                                                            cancelInlineEdit()
                                                                        }
                                                                    }}
                                                                    className="h-8 w-40"
                                                                    autoFocus
                                                                    dir="rtl"
                                                                />
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => saveInlineEdit(service)}
                                                                    className="h-6 w-6 p-0"
                                                                >
                                                                    <Check className="h-3 w-3 text-green-600" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={cancelInlineEdit}
                                                                    className="h-6 w-6 p-0"
                                                                >
                                                                    <X className="h-3 w-3 text-red-600" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <span
                                                                className="text-gray-600 cursor-pointer hover:underline"
                                                                onClick={() => startInlineEdit(service.id, "description", service.description || "")}
                                                            >
                                                                {service.description || "-"}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isEditingPrice ? (
                                                            <div className="flex items-center gap-1">
                                                                <Input
                                                                    type="number"
                                                                    value={inlineEditValue}
                                                                    onChange={(e) => setInlineEditValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") {
                                                                            saveInlineEdit(service)
                                                                        } else if (e.key === "Escape") {
                                                                            cancelInlineEdit()
                                                                        }
                                                                    }}
                                                                    className="h-8 w-24"
                                                                    autoFocus
                                                                    dir="rtl"
                                                                />
                                                                <span className="text-sm">₪</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => saveInlineEdit(service)}
                                                                    className="h-6 w-6 p-0"
                                                                >
                                                                    <Check className="h-3 w-3 text-green-600" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={cancelInlineEdit}
                                                                    className="h-6 w-6 p-0"
                                                                >
                                                                    <X className="h-3 w-3 text-red-600" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <span
                                                                className="cursor-pointer hover:underline"
                                                                onClick={() => startInlineEdit(service.id, "base_price", service.base_price)}
                                                            >
                                                                {service.base_price} ₪
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox
                                                                checked={service.is_active ?? true}
                                                                onCheckedChange={(checked) => {
                                                                    updateService.mutateAsync({
                                                                        serviceId: service.id,
                                                                        is_active: checked as boolean,
                                                                    })
                                                                }}
                                                            />
                                                            <Label className="text-xs cursor-pointer">
                                                                גלוי ללקוחות
                                                            </Label>
                                                        </div>
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
                                                {isExpanded && (
                                                    <>
                                                        {serviceMode === "complicated" && service.service_sub_actions && service.service_sub_actions.length > 0 && (
                                                            <DndContext
                                                                sensors={sensors}
                                                                collisionDetection={closestCenter}
                                                                onDragEnd={handleDragEndExisting(service.id)}
                                                            >
                                                                <SortableContext
                                                                    items={service.service_sub_actions.map(sa => sa.id)}
                                                                    strategy={verticalListSortingStrategy}
                                                                >
                                                                    {service.service_sub_actions.map((subAction) => (
                                                                        <ExistingSubActionRow
                                                                            key={subAction.id}
                                                                            subAction={subAction}
                                                                            onUpdateActive={(checked) => {
                                                                                updateSubAction.mutateAsync({
                                                                                    subActionId: subAction.id,
                                                                                    is_active: checked,
                                                                                })
                                                                            }}
                                                                            onDelete={() => {
                                                                                deleteSubAction.mutateAsync(subAction.id)
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </SortableContext>
                                                            </DndContext>
                                                        )}
                                                        {isAddingSubAction && (
                                                            <>
                                                                {/* Single line input form */}
                                                                <TableRow className="bg-blue-50/50">
                                                                    <TableCell colSpan={7} className="p-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <Input
                                                                                value={newSubAction.name}
                                                                                onChange={(e) => setNewSubAction({ ...newSubAction, name: e.target.value })}
                                                                                placeholder="שם הפעולה *"
                                                                                className="flex-1"
                                                                                dir="rtl"
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === "Enter") {
                                                                                        handleAddPendingSubAction(service.id)
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <div className="w-32">
                                                                                <DurationInput
                                                                                    value={newSubAction.duration}
                                                                                    onChange={(minutes) => setNewSubAction({ ...newSubAction, duration: minutes })}
                                                                                />
                                                                            </div>
                                                                            <Input
                                                                                value={newSubAction.description}
                                                                                onChange={(e) => setNewSubAction({ ...newSubAction, description: e.target.value })}
                                                                                placeholder="תיאור (אופציונלי)"
                                                                                className="flex-1"
                                                                                dir="rtl"
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === "Enter") {
                                                                                        handleAddPendingSubAction(service.id)
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <div className="flex items-center gap-1">
                                                                                <Checkbox
                                                                                    checked={newSubAction.is_active}
                                                                                    onCheckedChange={(checked) => setNewSubAction({ ...newSubAction, is_active: checked as boolean })}
                                                                                />
                                                                                <Label className="text-xs cursor-pointer whitespace-nowrap">זמן עבודה פעיל</Label>
                                                                            </div>
                                                                            <Button
                                                                                size="sm"
                                                                                onClick={() => handleAddPendingSubAction(service.id)}
                                                                                disabled={!newSubAction.name.trim() || newSubAction.duration <= 0}
                                                                            >
                                                                                <Plus className="h-4 w-4 ml-1" />
                                                                                הוסף
                                                                            </Button>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>

                                                                {/* Pending sub-actions list with drag and drop */}
                                                                {(pendingSubActions.get(service.id) || []).length > 0 && (
                                                                    <DndContext
                                                                        sensors={sensors}
                                                                        collisionDetection={closestCenter}
                                                                        onDragEnd={handleDragEnd(service.id)}
                                                                    >
                                                                        <SortableContext
                                                                            items={(pendingSubActions.get(service.id) || []).map(sa => sa.tempId)}
                                                                            strategy={verticalListSortingStrategy}
                                                                        >
                                                                            {(pendingSubActions.get(service.id) || []).map((pendingSubAction) => (
                                                                                <PendingSubActionRow
                                                                                    key={pendingSubAction.tempId}
                                                                                    subAction={pendingSubAction}
                                                                                    onRemove={() => handleRemovePendingSubAction(service.id, pendingSubAction.tempId)}
                                                                                />
                                                                            ))}
                                                                        </SortableContext>
                                                                    </DndContext>
                                                                )}

                                                                {/* Save/Cancel buttons */}
                                                                {(pendingSubActions.get(service.id) || []).length > 0 && (
                                                                    <TableRow>
                                                                        <TableCell colSpan={7} className="p-2">
                                                                            <div className="flex items-center gap-2 justify-end">
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    onClick={handleCancelAddingSubAction}
                                                                                >
                                                                                    ביטול
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    onClick={() => handleSaveAllPendingSubActions(service.id)}
                                                                                    disabled={createSubAction.isPending}
                                                                                >
                                                                                    {createSubAction.isPending ? (
                                                                                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                                                                    ) : (
                                                                                        <Save className="h-4 w-4 ml-2" />
                                                                                    )}
                                                                                    שמור הכל ({pendingSubActions.get(service.id)?.length || 0})
                                                                                </Button>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </>
                                                        )}
                                                        {!isAddingSubAction && (
                                                            <TableRow className="bg-gray-50/50">
                                                                <TableCell colSpan={7} className="p-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleStartAddingSubAction(service.id)}
                                                                        className="w-full justify-start"
                                                                    >
                                                                        <Plus className="h-4 w-4 ml-2" />
                                                                        הוסף פעולת משנה
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </>
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
                            <Label htmlFor="is_active" className="cursor-pointer">גלוי ללקוחות</Label>
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
                                                            <Label className="cursor-pointer">זמן עבודה פעיל</Label>
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

