import { useState, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Loader2, Search, X, ArrowUp, ArrowDown, GripVertical, ChevronDown, ChevronRight, Check, Save, Copy } from "lucide-react"
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
import { SERVICE_CATEGORY_VARIANTS } from "@/lib/serviceCategoryVariants"
import { useServiceCategories, useDefaultServiceCategory, type ServiceCategory } from "@/hooks/useServiceCategories"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"
import { RichTextEditor } from "@/components/admin/RichTextEditor"

// Utility function to format minutes into hours and minutes
const formatDuration = (minutes: number): string => {
    if (minutes <= 0) return "0 דקות"

    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60

    if (hours === 0) {
        return `${remainingMinutes} דקות`
    } else if (remainingMinutes === 0) {
        return `${hours} ${hours === 1 ? 'שעה' : 'שעות'}`
    } else {
        return `${hours} ${hours === 1 ? 'שעה' : 'שעות'} ${remainingMinutes} דקות`
    }
}

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

interface DraftSubActionRowProps {
    draft: {
        name: string
        description: string
        duration: number
        is_active: boolean
        tempId: string
    }
    onUpdate: (draft: { name: string; description: string; duration: number; is_active: boolean; tempId: string }) => void
    onSave: () => void
    onCancel: () => void
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
            className={cn("bg-primary/10/50", isDragging && "opacity-50")}
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
                {/* Category - empty for sub-actions */}
            </TableCell>
            <TableCell>
                <span className="text-xs text-gray-500">פעולת משנה</span>
            </TableCell>
            <TableCell>
                <span className="text-sm">{formatDuration(subAction.duration)}</span>
            </TableCell>
            <TableCell className="text-right">
                <span className="text-gray-600">
                    {subAction.is_active ? (
                        <span>{formatDuration(subAction.duration)}</span>
                    ) : (
                        <span className="text-gray-400">לא הוגדר</span>
                    )}
                </span>
            </TableCell>
            <TableCell className="text-gray-600 text-sm">
                {subAction.description || "-"}
            </TableCell>
            <TableCell>
                {/* Base Price - empty for sub-actions */}
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-2">
                    <Checkbox checked={subAction.is_active} disabled />
                    <Label className="text-xs">זמן עבודה פעיל</Label>
                </div>
            </TableCell>
            <TableCell className="w-[100px]">
                <div className="flex items-center justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRemove}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    )
}

function DraftSubActionRow({ draft, onUpdate, onSave, onCancel }: DraftSubActionRowProps) {
    return (
        <TableRow className="bg-primary/10/50">
            <TableCell className="pl-12">
                <Input
                    value={draft.name}
                    onChange={(e) => onUpdate({ ...draft, name: e.target.value })}
                    placeholder="שם הפעולה *"
                    className="h-7 text-sm w-full min-w-[200px] hover:ring-2 hover:ring-primary/20 transition-all"
                    dir="rtl"
                />
            </TableCell>
            <TableCell>
                {/* Category - empty for sub-actions */}
            </TableCell>
            <TableCell>
                <span className="text-xs text-gray-500">פעולת משנה</span>
            </TableCell>
            <TableCell>
                <div className="hover:ring-2 hover:ring-primary/20 rounded-md transition-all w-full min-w-[180px]">
                    <DurationInput
                        value={draft.duration}
                        onChange={(minutes) => onUpdate({ ...draft, duration: minutes })}
                        className="h-7 w-full"
                    />
                </div>
            </TableCell>
            <TableCell className="text-right">
                <span className="text-gray-600">
                    {draft.is_active ? (
                        <span>{formatDuration(draft.duration)}</span>
                    ) : (
                        <span className="text-gray-400">לא הוגדר</span>
                    )}
                </span>
            </TableCell>
            <TableCell>
                <Input
                    value={draft.description}
                    onChange={(e) => onUpdate({ ...draft, description: e.target.value })}
                    placeholder="תיאור (אופציונלי)"
                    className="h-7 text-sm w-full min-w-[200px] hover:ring-2 hover:ring-primary/20 transition-all"
                    dir="rtl"
                />
            </TableCell>
            <TableCell>
                {/* Base Price - empty for sub-actions */}
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-2">
                    <Checkbox
                        checked={draft.is_active}
                        onCheckedChange={(checked) => onUpdate({ ...draft, is_active: checked as boolean })}
                    />
                    <Label className="text-xs cursor-pointer">
                        זמן עבודה פעיל
                    </Label>
                </div>
            </TableCell>
            <TableCell className="w-[140px]">
                <div className="flex items-center gap-1 justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onCancel}
                        className="h-7 px-2"
                    >
                        ביטול
                    </Button>
                    <Button
                        size="sm"
                        onClick={onSave}
                        disabled={!draft.name.trim() || draft.duration <= 0}
                        className="h-7 px-2"
                    >
                        <Save className="h-4 w-4 ml-1" />
                        שמור
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    )
}

interface ExistingSubActionRowProps {
    subAction: ServiceSubAction
    onUpdateActive: (checked: boolean) => void
    onDelete: () => void
    editingField: { serviceId: string; field: string; subActionId?: string } | null
    onStartEdit: (subActionId: string, field: string, value: string | number) => void
    onSaveEdit: (subActionId: string, field: string, value: string | number) => void
    onCancelEdit: () => void
    inlineEditValue: string
    setInlineEditValue: (value: string) => void
}

function ExistingSubActionRow({
    subAction,
    onUpdateActive,
    onDelete,
    editingField,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    inlineEditValue,
    setInlineEditValue
}: ExistingSubActionRowProps) {
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
        transition: isDragging ? "none" : transition,
        opacity: isDragging ? 0.8 : 1,
    }

    const isEditingName = editingField?.subActionId === subAction.id && editingField.field === "name"
    const isEditingDescription = editingField?.subActionId === subAction.id && editingField.field === "description"
    const isEditingDuration = editingField?.subActionId === subAction.id && editingField.field === "duration"

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={cn("bg-gray-50/50", isDragging && "opacity-50 z-50")}
        >
            <TableCell className="pl-12">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="cursor-grab active:cursor-grabbing flex-shrink-0"
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="h-4 w-4 text-gray-400" />
                    </button>
                    {isEditingName ? (
                        <div className="flex items-center gap-1">
                            <Input
                                value={inlineEditValue}
                                onChange={(e) => setInlineEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        onSaveEdit(subAction.id, "name", inlineEditValue)
                                    } else if (e.key === "Escape") {
                                        onCancelEdit()
                                    }
                                }}
                                className="h-7 text-sm w-auto min-w-[100px] hover:ring-2 hover:ring-primary/20 transition-all"
                                autoFocus
                                dir="rtl"
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onSaveEdit(subAction.id, "name", inlineEditValue)}
                                className="h-5 w-5 p-0"
                            >
                                <Check className="h-3 w-3 text-green-600" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onCancelEdit}
                                className="h-5 w-5 p-0"
                            >
                                <X className="h-3 w-3 text-red-600" />
                            </Button>
                        </div>
                    ) : (
                        <span
                            className="text-sm cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors whitespace-nowrap"
                            onClick={() => onStartEdit(subAction.id, "name", subAction.name)}
                        >
                            {subAction.name}
                        </span>
                    )}
                </div>
            </TableCell>
            <TableCell>
                {/* Category - empty for sub-actions */}
            </TableCell>
            <TableCell>
                <span className="text-xs text-gray-500">פעולת משנה</span>
            </TableCell>
            <TableCell>
                {isEditingDuration ? (
                    <div className="flex items-center gap-1">
                        <div className="hover:ring-2 hover:ring-primary/20 rounded-md transition-all">
                            <DurationInput
                                value={parseInt(inlineEditValue) || 0}
                                onChange={(minutes) => {
                                    setInlineEditValue(String(minutes))
                                    onSaveEdit(subAction.id, "duration", minutes)
                                }}
                                className="h-7 w-24"
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onCancelEdit}
                            className="h-5 w-5 p-0"
                        >
                            <X className="h-3 w-3 text-red-600" />
                        </Button>
                    </div>
                ) : (
                    <span
                        className="text-sm cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                        onClick={() => onStartEdit(subAction.id, "duration", subAction.duration)}
                    >
                        {formatDuration(subAction.duration)}
                    </span>
                )}
            </TableCell>
            <TableCell className="text-right">
                <span className="text-gray-600">
                    {subAction.is_active ? (
                        <span>{formatDuration(subAction.duration)}</span>
                    ) : (
                        <span className="text-gray-400">לא הוגדר</span>
                    )}
                </span>
            </TableCell>
            <TableCell>
                {isEditingDescription ? (
                    <div className="flex items-center gap-1">
                        <Input
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    onSaveEdit(subAction.id, "description", inlineEditValue)
                                } else if (e.key === "Escape") {
                                    onCancelEdit()
                                }
                            }}
                            className="h-7 text-sm w-auto min-w-[150px] hover:ring-2 hover:ring-primary/20 transition-all"
                            autoFocus
                            dir="rtl"
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSaveEdit(subAction.id, "description", inlineEditValue)}
                            className="h-5 w-5 p-0"
                        >
                            <Check className="h-3 w-3 text-green-600" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onCancelEdit}
                            className="h-5 w-5 p-0"
                        >
                            <X className="h-3 w-3 text-red-600" />
                        </Button>
                    </div>
                ) : (
                    <span
                        className="text-gray-600 text-sm cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                        onClick={() => onStartEdit(subAction.id, "description", subAction.description || "")}
                    >
                        {subAction.description || "-"}
                    </span>
                )}
            </TableCell>
            <TableCell>
                {/* Base Price - empty for sub-actions */}
            </TableCell>
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
            <TableCell className="w-[100px]">
                <div className="flex items-center justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    )
}

export default function ServicesListPage() {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const { data: services = [], isLoading, refetch } = useServices()
    const { data: categories = [] } = useServiceCategories()
    const { data: defaultCategory } = useDefaultServiceCategory()
    const createService = useCreateService()
    const updateService = useUpdateService()
    const createSubAction = useCreateServiceSubAction()
    const updateSubAction = useUpdateServiceSubAction()
    const deleteSubAction = useDeleteServiceSubAction()

    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    // Edit dialog removed - using inline editing instead
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false)
    // editingService removed - using inline editing instead
    const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)
    const [serviceToDuplicate, setServiceToDuplicate] = useState<Service | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        base_price: 0,
        duration: 0,
        is_active: true,
        mode: "simple" as "simple" | "complicated",
        service_category_id: null as string | null,
    })

    // Sub actions state (for complicated mode)
    const [subActions, setSubActions] = useState<Omit<ServiceSubAction, "id" | "service_id" | "created_at" | "updated_at">[]>([])

    // Expanded services (for showing sub-actions)
    const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())

    // Inline editing state
    const [editingField, setEditingField] = useState<{ serviceId: string; field: string; subActionId?: string } | null>(null)
    const [inlineEditValue, setInlineEditValue] = useState<string>("")
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
    const [categorySearchTerm, setCategorySearchTerm] = useState<string>("")

    // Description edit modal state
    const [editingDescriptionServiceId, setEditingDescriptionServiceId] = useState<string | null>(null)
    const [descriptionEditValue, setDescriptionEditValue] = useState<string>("")

    // Inline sub-action creation state - accumulate multiple before saving
    const [addingSubActionTo, setAddingSubActionTo] = useState<string | null>(null)
    const [pendingSubActions, setPendingSubActions] = useState<Map<string, Array<{
        name: string
        description: string
        duration: number
        is_active: boolean
        tempId: string
    }>>>(new Map())
    const [draftSubActions, setDraftSubActions] = useState<Map<string, Array<{
        name: string
        description: string
        duration: number
        is_active: boolean
        tempId: string
    }>>>(new Map())

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    )

    // Track if we've validated services in this session to avoid infinite loops
    const validationInProgressRef = useRef(false)
    const lastValidatedServicesRef = useRef<Set<string>>(new Set())

    // Validate services on load: ensure no "complicated" services without sub-actions
    useEffect(() => {
        if (isLoading || validationInProgressRef.current || services.length === 0) {
            return
        }

        // Find services that need fixing: mode is "complicated" but have no sub-actions
        const servicesToFix = services.filter((service) => {
            const hasSubActions = service.service_sub_actions && service.service_sub_actions.length > 0
            const isInvalid = service.mode === "complicated" && !hasSubActions
            // Only fix if we haven't already validated this service in this session
            return isInvalid && !lastValidatedServicesRef.current.has(service.id)
        })

        if (servicesToFix.length === 0) {
            return
        }

        // Mark validation as in progress
        validationInProgressRef.current = true

        // Fix all invalid services
        const fixServices = async () => {
            try {
                for (const service of servicesToFix) {
                    await updateService.mutateAsync({
                        serviceId: service.id,
                        mode: "simple",
                    })
                    // Mark as validated
                    lastValidatedServicesRef.current.add(service.id)
                }
            } catch (error) {
                console.error("Error fixing invalid services:", error)
            } finally {
                validationInProgressRef.current = false
            }
        }

        fixServices()
    }, [services, isLoading, updateService])

    const filteredServices = services.filter((service) => {
        const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = !selectedCategoryId || service.service_category_id === selectedCategoryId
        return matchesSearch && matchesCategory
    })

    const handleAdd = () => {
        setFormData({
            name: "",
            description: "",
            base_price: 0,
            duration: 0,
            is_active: true,
            mode: "simple",
            service_category_id: defaultCategory?.id || null,
        })
        setSubActions([])
        setIsAddDialogOpen(true)
    }

    const handleDuplicate = (service: Service) => {
        setServiceToDuplicate(service)
        setIsDuplicateDialogOpen(true)
    }

    const handleConfirmDuplicate = async () => {
        if (!serviceToDuplicate) return

        try {
            // Create the duplicated service
            const duplicated = await createService.mutateAsync({
                name: `${serviceToDuplicate.name} (עותק)`,
                description: serviceToDuplicate.description,
                base_price: serviceToDuplicate.base_price,
                duration: serviceToDuplicate.duration,
                is_active: serviceToDuplicate.is_active,
                mode: serviceToDuplicate.mode,
                service_category_id: serviceToDuplicate.service_category_id || undefined,
            })

            // If service has sub-actions, duplicate them too
            if (serviceToDuplicate.mode === "complicated" && serviceToDuplicate.service_sub_actions) {
                const sortedSubActions = [...serviceToDuplicate.service_sub_actions].sort((a, b) => a.order_index - b.order_index)
                for (let i = 0; i < sortedSubActions.length; i++) {
                    const subAction = sortedSubActions[i]
                    await createSubAction.mutateAsync({
                        service_id: duplicated.id,
                        name: subAction.name,
                        description: subAction.description,
                        duration: subAction.duration,
                        order_index: i,
                        is_active: subAction.is_active,
                    })
                }
            }

            toast({
                title: "הצלחה",
                description: "השירות שוכפל בהצלחה",
            })
            setIsDuplicateDialogOpen(false)
            setServiceToDuplicate(null)
        } catch (error: unknown) {
            console.error("Error duplicating service:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשכפל את השירות"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    // Edit functionality removed - using inline editing instead

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
            const created = await createService.mutateAsync({
                name: formData.name.trim(),
                description: formData.description.trim() || undefined,
                base_price: formData.base_price,
                duration: formData.mode === "simple" ? formData.duration : undefined,
                is_active: formData.is_active,
                mode: formData.mode,
                service_category_id: formData.service_category_id || undefined,
            })
            const serviceId = created.id

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
            setFormData({ name: "", description: "", base_price: 0, duration: 0, is_active: true, mode: "simple", service_category_id: defaultCategory?.id || null })
            setSubActions([])
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

    const startInlineEdit = (serviceId: string, field: string, currentValue: string | number, subActionId?: string) => {
        setEditingField({ serviceId, field, subActionId })
        setInlineEditValue(String(currentValue))
    }

    const cancelInlineEdit = () => {
        setEditingField(null)
        setInlineEditValue("")
    }

    const openDescriptionEditModal = (service: Service) => {
        setEditingDescriptionServiceId(service.id)
        setDescriptionEditValue(service.description || "")
    }

    const closeDescriptionEditModal = () => {
        setEditingDescriptionServiceId(null)
        setDescriptionEditValue("")
    }

    const saveDescriptionEdit = async () => {
        if (!editingDescriptionServiceId) return

        const service = services.find(s => s.id === editingDescriptionServiceId)
        if (!service) return

        // Optimistic update
        const previousServices = queryClient.getQueryData<Service[]>(["services"])
        if (previousServices) {
            const optimisticServices = previousServices.map((s) => {
                if (s.id === service.id) {
                    return { ...s, description: descriptionEditValue.trim() || null }
                }
                return s
            })
            queryClient.setQueryData<Service[]>(["services"], optimisticServices)
        }

        try {
            await updateService.mutateAsync({
                serviceId: service.id,
                description: descriptionEditValue.trim() || null,
            })

            toast({
                title: "הצלחה",
                description: "התיאור עודכן בהצלחה",
            })

            closeDescriptionEditModal()
            // Silently refetch to ensure sync
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ["services"] })
            }, 100)
        } catch (error: unknown) {
            console.error("Error updating service description:", error)

            // Revert optimistic update on error
            if (previousServices) {
                queryClient.setQueryData<Service[]>(["services"], previousServices)
            }

            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את התיאור"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    // Check if there are any dirty/unsaved changes
    const hasDirtyChanges = () => {
        const hasActiveEdit = editingField !== null
        const hasDrafts = Array.from(draftSubActions.values()).some(arr => arr.length > 0)
        const hasPending = Array.from(pendingSubActions.values()).some(arr => arr.length > 0)
        return hasActiveEdit || hasDrafts || hasPending
    }

    // Save all dirty changes at once
    const handleSaveAll = async () => {
        try {
            // Save current inline edit if any
            if (editingField) {
                if (editingField.subActionId) {
                    // Find the sub-action
                    const service = services.find(s => s.service_sub_actions?.some(sa => sa.id === editingField.subActionId))
                    if (service) {
                        const subAction = service.service_sub_actions?.find(sa => sa.id === editingField.subActionId)
                        if (subAction) {
                            await saveSubActionEdit(subAction.id, editingField.field, inlineEditValue)
                        }
                    }
                } else {
                    // Find the service
                    const service = services.find(s => s.id === editingField.serviceId)
                    if (service) {
                        await saveInlineEdit(service)
                    }
                }
            }

            // Save all pending sub-actions for all services
            for (const [serviceId, pending] of pendingSubActions.entries()) {
                if (pending.length > 0) {
                    await handleSaveAllPendingSubActions(serviceId)
                }
            }

            toast({
                title: "הצלחה",
                description: "כל השינויים נשמרו בהצלחה",
            })
        } catch (error: unknown) {
            console.error("Error saving all changes:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את כל השינויים"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }


    const saveSubActionEdit = async (subActionId: string, field: string, value: string | number) => {
        // Only proceed if we're actually editing THIS specific sub-action field
        if (!editingField ||
            !editingField.subActionId ||
            editingField.subActionId !== subActionId ||
            editingField.field !== field) {
            return
        }

        // Optimistic update - ONLY update the sub-action, NOT the service
        const previousServices = queryClient.getQueryData<Service[]>(["services"])
        let optimisticServices = previousServices

        if (previousServices) {
            optimisticServices = previousServices.map((s) => {
                // Only update services that contain this sub-action
                if (s.service_sub_actions && s.service_sub_actions.some(sa => sa.id === subActionId)) {
                    const updatedSubActions = s.service_sub_actions.map((sa) => {
                        // Only update the specific sub-action that matches
                        if (sa.id === subActionId) {
                            if (field === "name") {
                                return { ...sa, name: String(value).trim() }
                            } else if (field === "description") {
                                return { ...sa, description: String(value).trim() || null }
                            } else if (field === "duration") {
                                return { ...sa, duration: Number(value) }
                            }
                        }
                        return sa
                    })
                    // Return service with updated sub-actions, but DON'T modify service fields
                    return { ...s, service_sub_actions: updatedSubActions }
                }
                // Return service unchanged if it doesn't contain this sub-action
                return s
            })

            queryClient.setQueryData<Service[]>(["services"], optimisticServices)
        }

        try {
            const updateData: {
                name?: string
                description?: string | null
                duration?: number
            } = {}

            if (field === "name") {
                updateData.name = String(value).trim()
            } else if (field === "description") {
                updateData.description = String(value).trim() || null
            } else if (field === "duration") {
                updateData.duration = Number(value)
            }

            await updateSubAction.mutateAsync({
                subActionId,
                ...updateData,
            })

            cancelInlineEdit()
            // Silently refetch to ensure sync
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ["services"] })
            }, 100)
        } catch (error: unknown) {
            console.error("Error updating sub-action:", error)

            // Revert optimistic update on error
            if (previousServices) {
                queryClient.setQueryData<Service[]>(["services"], previousServices)
            }

            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את פעולת המשנה"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
            cancelInlineEdit()
        }
    }

    const handleSubActionActiveChange = async (subActionId: string, checked: boolean) => {
        // Optimistic update
        const previousServices = queryClient.getQueryData<Service[]>(["services"])

        if (previousServices) {
            const optimisticServices = previousServices.map((s) => {
                if (s.service_sub_actions) {
                    const updatedSubActions = s.service_sub_actions.map((sa) => {
                        if (sa.id === subActionId) {
                            return { ...sa, is_active: checked }
                        }
                        return sa
                    })
                    return { ...s, service_sub_actions: updatedSubActions }
                }
                return s
            })

            queryClient.setQueryData<Service[]>(["services"], optimisticServices)
        }

        try {
            await updateSubAction.mutateAsync({
                subActionId,
                is_active: checked,
            })

            // Silently refetch to ensure sync
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ["services"] })
            }, 100)
        } catch (error: unknown) {
            console.error("Error updating sub-action active status:", error)

            // Revert optimistic update on error
            if (previousServices) {
                queryClient.setQueryData<Service[]>(["services"], previousServices)
            }

            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את הסטטוס"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleCategoryChange = async (serviceId: string, categoryId: string | null) => {
        // Optimistic update
        const previousServices = queryClient.getQueryData<Service[]>(["services"])
        const selectedCategory = categories.find(c => c.id === categoryId)

        if (previousServices) {
            const optimisticServices = previousServices.map((s) => {
                if (s.id === serviceId) {
                    return {
                        ...s,
                        service_category_id: categoryId,
                        service_category: selectedCategory ? {
                            id: selectedCategory.id,
                            name: selectedCategory.name,
                            variant: selectedCategory.variant,
                        } : null,
                    }
                }
                return s
            })

            queryClient.setQueryData<Service[]>(["services"], optimisticServices)
        }

        try {
            await updateService.mutateAsync({
                serviceId,
                service_category_id: categoryId,
            })

            // Silently refetch to ensure sync
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ["services"] })
            }, 100)
        } catch (error: unknown) {
            console.error("Error updating service category:", error)

            // Revert optimistic update on error
            if (previousServices) {
                queryClient.setQueryData<Service[]>(["services"], previousServices)
            }

            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את הקטגוריה"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleServiceActiveChange = async (serviceId: string, checked: boolean) => {
        // Optimistic update
        const previousServices = queryClient.getQueryData<Service[]>(["services"])

        if (previousServices) {
            const optimisticServices = previousServices.map((s) => {
                if (s.id === serviceId) {
                    return { ...s, is_active: checked }
                }
                return s
            })

            queryClient.setQueryData<Service[]>(["services"], optimisticServices)
        }

        try {
            await updateService.mutateAsync({
                serviceId,
                is_active: checked,
            })

            // Silently refetch to ensure sync
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ["services"] })
            }, 100)
        } catch (error: unknown) {
            console.error("Error updating service active status:", error)

            // Revert optimistic update on error
            if (previousServices) {
                queryClient.setQueryData<Service[]>(["services"], previousServices)
            }

            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את הסטטוס"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const saveInlineEdit = async (service: Service) => {
        // Only proceed if we're editing a service field (not a sub-action)
        if (!editingField || editingField.subActionId || editingField.serviceId !== service.id) {
            return
        }

        // Optimistic update
        const previousServices = queryClient.getQueryData<Service[]>(["services"])
        let optimisticServices = previousServices

        if (previousServices) {
            optimisticServices = previousServices.map((s) => {
                if (s.id === service.id) {
                    if (editingField.field === "name") {
                        return { ...s, name: inlineEditValue.trim() }
                    } else if (editingField.field === "description") {
                        return { ...s, description: inlineEditValue.trim() || null }
                    } else if (editingField.field === "base_price") {
                        return { ...s, base_price: parseFloat(inlineEditValue) || 0 }
                    } else if (editingField.field === "duration" && service.mode === "simple") {
                        return { ...s, duration: parseInt(inlineEditValue) || 0 }
                    }
                }
                return s
            })

            queryClient.setQueryData<Service[]>(["services"], optimisticServices)
        }

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

            cancelInlineEdit()
            // Silently refetch to ensure sync
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ["services"] })
            }, 100)
        } catch (error: unknown) {
            console.error("Error updating service:", error)

            // Revert optimistic update on error
            if (previousServices) {
                queryClient.setQueryData<Service[]>(["services"], previousServices)
            }

            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את השירות"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
            cancelInlineEdit()
        }
    }

    const handleStartAddingSubAction = (serviceId: string) => {
        setAddingSubActionTo(serviceId)
        const tempId = `draft-${Date.now()}-${Math.random()}`
        const currentDrafts = draftSubActions.get(serviceId) || []
        setDraftSubActions(new Map(draftSubActions.set(serviceId, [
            ...currentDrafts,
            {
                name: "",
                description: "",
                duration: 0,
                is_active: true,
                tempId,
            }
        ])))
        if (!expandedServices.has(serviceId)) {
            setExpandedServices(new Set([...expandedServices, serviceId]))
        }
    }

    const handleCancelAddingSubAction = () => {
        setAddingSubActionTo(null)
        setDraftSubActions(new Map())
        setPendingSubActions(new Map())
    }

    const handleSaveDraftSubAction = (serviceId: string, draftTempId: string) => {
        const drafts = draftSubActions.get(serviceId) || []
        const draft = drafts.find(d => d.tempId === draftTempId)

        if (!draft) return

        if (!draft.name.trim()) {
            toast({
                title: "שגיאה",
                description: "אנא הזן שם לפעולת המשנה",
                variant: "destructive",
            })
            return
        }

        if (draft.duration <= 0) {
            toast({
                title: "שגיאה",
                description: "אנא הזן משך זמן חיובי",
                variant: "destructive",
            })
            return
        }

        // Move from drafts to pending
        const currentPending = pendingSubActions.get(serviceId) || []
        setPendingSubActions(new Map(pendingSubActions.set(serviceId, [
            ...currentPending,
            {
                name: draft.name.trim(),
                description: draft.description.trim(),
                duration: draft.duration,
                is_active: draft.is_active,
                tempId: draft.tempId,
            }
        ])))

        // Remove from drafts
        setDraftSubActions(new Map(draftSubActions.set(serviceId, drafts.filter(d => d.tempId !== draftTempId))))
    }

    const handleCancelDraftSubAction = (serviceId: string, draftTempId: string) => {
        const drafts = draftSubActions.get(serviceId) || []
        const updatedDrafts = drafts.filter(d => d.tempId !== draftTempId)

        if (updatedDrafts.length === 0) {
            // If no more drafts and no pending, cancel adding mode
            const hasPending = (pendingSubActions.get(serviceId) || []).length > 0
            if (!hasPending) {
                setAddingSubActionTo(null)
            }
            setDraftSubActions(new Map(draftSubActions.set(serviceId, [])))
        } else {
            setDraftSubActions(new Map(draftSubActions.set(serviceId, updatedDrafts)))
        }
    }

    const handleUpdateDraftSubAction = (serviceId: string, draftTempId: string, updatedDraft: {
        name: string
        description: string
        duration: number
        is_active: boolean
        tempId: string
    }) => {
        const drafts = draftSubActions.get(serviceId) || []
        const updatedDrafts = drafts.map(d => d.tempId === draftTempId ? updatedDraft : d)
        setDraftSubActions(new Map(draftSubActions.set(serviceId, updatedDrafts)))
    }

    const handleRemovePendingSubAction = (serviceId: string, tempId: string) => {
        const currentPending = pendingSubActions.get(serviceId) || []
        setPendingSubActions(new Map(pendingSubActions.set(serviceId, currentPending.filter(sa => sa.tempId !== tempId))))
    }

    const handleDeleteSubAction = async (subActionId: string) => {
        try {
            // Find the service that contains this sub-action
            const service = services.find(s =>
                s.service_sub_actions?.some(sa => sa.id === subActionId)
            )

            if (!service) {
                toast({
                    title: "שגיאה",
                    description: "לא נמצא השירות",
                    variant: "destructive",
                })
                return
            }

            // Check if this is the last sub-action
            const remainingSubActionsCount = (service.service_sub_actions || []).length
            const isLastSubAction = remainingSubActionsCount === 1

            // Delete the sub-action
            await deleteSubAction.mutateAsync(subActionId)

            // If this was the last sub-action, update mode to simple
            if (isLastSubAction && service.mode === "complicated") {
                await updateService.mutateAsync({
                    serviceId: service.id,
                    mode: "simple",
                })
            }
        } catch (error: unknown) {
            console.error("Error deleting sub-action:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן למחוק את פעולת המשנה"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
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

        // Get fresh data from cache to ensure we have the latest
        const currentServices = queryClient.getQueryData<Service[]>(["services"]) || services
        const service = currentServices.find(s => s.id === serviceId)
        if (!service || !service.service_sub_actions) return

        const subActions = [...service.service_sub_actions].sort((a, b) => a.order_index - b.order_index)
        const oldIndex = subActions.findIndex(sa => sa.id === active.id)
        const newIndex = subActions.findIndex(sa => sa.id === over.id)

        if (oldIndex === -1 || newIndex === -1) return

        // Save previous state for rollback
        const previousServices = queryClient.getQueryData<Service[]>(["services"])

        // Reorder locally
        const updated = [...subActions]
        const [moved] = updated.splice(oldIndex, 1)
        updated.splice(newIndex, 0, moved)

        // Update order_index for reordered items
        const reorderedSubActions = updated.map((sa, index) => ({
            ...sa,
            order_index: index,
        }))

        // Optimistically update the cache immediately - this must happen synchronously
        if (previousServices) {
            const optimisticServices = previousServices.map((s) => {
                if (s.id === serviceId) {
                    return {
                        ...s,
                        service_sub_actions: reorderedSubActions,
                    }
                }
                return s
            })

            // Set the data immediately - this triggers a re-render with the new order
            queryClient.setQueryData<Service[]>(["services"], optimisticServices)
        }

        // Update order_index for all affected sub-actions in the background
        try {
            // Update all sub-actions that need their order_index changed
            const updates = reorderedSubActions
                .map((sa, index) => ({
                    subActionId: sa.id,
                    order_index: index,
                    originalIndex: subActions.findIndex(orig => orig.id === sa.id),
                }))
                .filter((update) => {
                    // Only update if order_index actually changed
                    return update.originalIndex !== update.order_index
                })

            // Batch update all sub-actions
            if (updates.length > 0) {
                await Promise.all(
                    updates.map((update) =>
                        updateSubAction.mutateAsync({
                            subActionId: update.subActionId,
                            order_index: update.order_index,
                        })
                    )
                )
            }

            // Silently refetch in background to ensure sync (without showing loading)
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ["services"] })
            }, 100)
        } catch (error: unknown) {
            console.error("Error reordering sub-actions:", error)

            // Revert optimistic update on error
            if (previousServices) {
                queryClient.setQueryData<Service[]>(["services"], previousServices)
            }

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
                    {/* Search, Filter and Save All */}
                    <div className="mb-4 flex items-center gap-4 flex-wrap">
                        {hasDirtyChanges() && (
                            <Button
                                onClick={handleSaveAll}
                                disabled={updateService.isPending || createSubAction.isPending || updateSubAction.isPending}
                                className="shrink-0"
                            >
                                {updateService.isPending || createSubAction.isPending || updateSubAction.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                ) : (
                                    <Save className="h-4 w-4 ml-2" />
                                )}
                                שמור הכל
                            </Button>
                        )}
                        <div className="relative flex-1 max-w-md min-w-[200px]">
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
                        <Select value={selectedCategoryId || "all"} onValueChange={(value) => setSelectedCategoryId(value === "all" ? null : value)}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="כל הקטגוריות" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">כל הקטגוריות</SelectItem>
                                {categories.map((category) => {
                                    const variant = SERVICE_CATEGORY_VARIANTS[category.variant as keyof typeof SERVICE_CATEGORY_VARIANTS]
                                    return (
                                        <SelectItem key={category.id} value={category.id}>
                                            <div className="flex items-center gap-2">
                                                <div className={cn("h-3 w-3 rounded-full", variant.bg)} />
                                                <span>{category.name}</span>
                                            </div>
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table */}
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right">שם השירות</TableHead>
                                    <TableHead className="text-right">קטגוריה</TableHead>
                                    <TableHead className="text-right">סוג</TableHead>
                                    <TableHead className="text-right">משך זמן</TableHead>
                                    <TableHead className="text-right">משך זמן פעיל</TableHead>
                                    <TableHead className="text-right">תיאור</TableHead>
                                    <TableHead className="text-right">מחיר בסיס</TableHead>
                                    <TableHead className="text-right">סטטוס</TableHead>
                                    <TableHead className="text-right">פעולות</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredServices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center text-gray-500 py-8">
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
                                                .reduce((sum, sa) => sum + sa.duration, 0)
                                            : (service.duration ?? 0)

                                        const activeDuration = serviceMode === "complicated"
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

                                        // Only show as editing if editing THIS service field (not a sub-action)
                                        const isEditingName = editingField?.serviceId === service.id && editingField.field === "name" && !editingField.subActionId
                                        const isEditingDescription = editingField?.serviceId === service.id && editingField.field === "description" && !editingField.subActionId
                                        const isEditingPrice = editingField?.serviceId === service.id && editingField.field === "base_price" && !editingField.subActionId
                                        const isEditingDuration = editingField?.serviceId === service.id && editingField.field === "duration" && serviceMode === "simple" && !editingField.subActionId
                                        const isEditingCategory = editingCategoryId === service.id

                                        const serviceRows = [
                                            <TableRow
                                                key={`${service.id}-main`}
                                                className={cn(serviceMode === "complicated" && "cursor-pointer")}
                                                onClick={(e) => {
                                                    // Only toggle if clicking on the row itself, not on interactive elements
                                                    const target = e.target as HTMLElement
                                                    if (serviceMode === "complicated" &&
                                                        !target.closest('button') &&
                                                        !target.closest('input') &&
                                                        !target.closest('textarea') &&
                                                        !target.closest('[role="checkbox"]')) {
                                                        toggleExpanded(service.id)
                                                    }
                                                }}
                                            >
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => toggleExpanded(service.id)}
                                                            className="h-6 w-6 p-0"
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronRight className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4" />
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
                                                                    className="h-8 w-auto min-w-[100px] hover:ring-2 hover:ring-primary/20 transition-all"
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
                                                    {isEditingCategory ? (
                                                        <CategoryAutocomplete
                                                            serviceId={service.id}
                                                            currentCategoryId={service.service_category_id || null}
                                                            categories={categories}
                                                            searchTerm={categorySearchTerm}
                                                            onSearchChange={setCategorySearchTerm}
                                                            onSelect={(categoryId) => {
                                                                handleCategoryChange(service.id, categoryId)
                                                                setEditingCategoryId(null)
                                                                setCategorySearchTerm("")
                                                            }}
                                                            onCancel={() => {
                                                                setEditingCategoryId(null)
                                                                setCategorySearchTerm("")
                                                            }}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                                                            onClick={() => {
                                                                setEditingCategoryId(service.id)
                                                                setCategorySearchTerm(service.service_category?.name || "")
                                                            }}
                                                        >
                                                            {service.service_category ? (
                                                                <div className="flex items-center gap-2">
                                                                    <div
                                                                        className={cn(
                                                                            "h-3 w-3 rounded-full",
                                                                            SERVICE_CATEGORY_VARIANTS[service.service_category.variant as keyof typeof SERVICE_CATEGORY_VARIANTS]?.bg || "bg-gray-400"
                                                                        )}
                                                                    />
                                                                    <span className="text-sm">
                                                                        {service.service_category.name}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm text-gray-400">ללא קטגוריה</span>
                                                            )}
                                                        </div>
                                                    )}
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
                                                            className={cn(
                                                                serviceMode === "simple" && "cursor-pointer hover:underline",
                                                                serviceMode === "complicated" && "cursor-default"
                                                            )}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                if (serviceMode === "simple") {
                                                                    startInlineEdit(service.id, "duration", service.duration || 0)
                                                                }
                                                            }}
                                                        >
                                                            {totalDuration > 0 ? (
                                                                <div>
                                                                    <span>{formatDuration(totalDuration)}</span>
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
                                                <TableCell className="text-right">
                                                    <span className="text-gray-600">
                                                        {activeDuration > 0 ? (
                                                            <span>{formatDuration(activeDuration)}</span>
                                                        ) : (
                                                            <span className="text-gray-400">לא הוגדר</span>
                                                        )}
                                                    </span>
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
                                                                className="h-8 w-auto min-w-[150px] hover:ring-2 hover:ring-primary/20 transition-all"
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
                                                        service.description ? (
                                                            <div
                                                                className="text-gray-600 cursor-pointer hover:underline"
                                                                onClick={() => openDescriptionEditModal(service)}
                                                                dangerouslySetInnerHTML={{ __html: service.description }}
                                                            />
                                                        ) : (
                                                            <span
                                                                className="text-gray-600 cursor-pointer hover:underline"
                                                                onClick={() => openDescriptionEditModal(service)}
                                                            >
                                                                -
                                                            </span>
                                                        )
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
                                                                className="h-8 w-auto min-w-[80px] hover:ring-2 hover:ring-primary/20 transition-all"
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
                                                                handleServiceActiveChange(service.id, checked as boolean)
                                                            }}
                                                        />
                                                        <Label className="text-xs cursor-pointer">
                                                            גלוי ללקוחות
                                                        </Label>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="w-[100px]">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleDuplicate(service)
                                                            }}
                                                            className="h-8 w-8 p-0 text-primary hover:text-primary"
                                                            title="שכפל שירות"
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleDelete(service)
                                                            }}
                                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ]

                                        if (isExpanded) {
                                            if (serviceMode === "complicated" && service.service_sub_actions && service.service_sub_actions.length > 0) {
                                                serviceRows.push(
                                                    <DndContext
                                                        key={`${service.id}-existing-subactions`}
                                                        sensors={sensors}
                                                        collisionDetection={closestCenter}
                                                        onDragEnd={handleDragEndExisting(service.id)}
                                                    >
                                                        <SortableContext
                                                            items={(service.service_sub_actions || []).sort((a, b) => a.order_index - b.order_index).map(sa => sa.id)}
                                                            strategy={verticalListSortingStrategy}
                                                        >
                                                            {(service.service_sub_actions || []).sort((a, b) => a.order_index - b.order_index).map((subAction) => (
                                                                <ExistingSubActionRow
                                                                    key={subAction.id}
                                                                    subAction={subAction}
                                                                    onUpdateActive={(checked) => {
                                                                        handleSubActionActiveChange(subAction.id, checked)
                                                                    }}
                                                                    onDelete={() => {
                                                                        handleDeleteSubAction(subAction.id)
                                                                    }}
                                                                    editingField={editingField}
                                                                    onStartEdit={(subActionId, field, value) => {
                                                                        startInlineEdit(service.id, field, value, subActionId)
                                                                    }}
                                                                    onSaveEdit={saveSubActionEdit}
                                                                    onCancelEdit={cancelInlineEdit}
                                                                    inlineEditValue={inlineEditValue}
                                                                    setInlineEditValue={setInlineEditValue}
                                                                />
                                                            ))}
                                                        </SortableContext>
                                                    </DndContext>
                                                )
                                            }

                                            if (isAddingSubAction) {
                                                serviceRows.push(
                                                    ...((draftSubActions.get(service.id) || []).map((draft) => (
                                                        <DraftSubActionRow
                                                            key={draft.tempId}
                                                            draft={draft}
                                                            onUpdate={(updatedDraft) => handleUpdateDraftSubAction(service.id, draft.tempId, updatedDraft)}
                                                            onSave={() => handleSaveDraftSubAction(service.id, draft.tempId)}
                                                            onCancel={() => handleCancelDraftSubAction(service.id, draft.tempId)}
                                                        />
                                                    )))
                                                )

                                                if ((pendingSubActions.get(service.id) || []).length > 0) {
                                                    serviceRows.push(
                                                        <DndContext
                                                            key={`${service.id}-pending-subactions`}
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
                                                    )
                                                    serviceRows.push(
                                                        <TableRow key={`${service.id}-add-row-pending`} className="bg-gray-50/50">
                                                            <TableCell colSpan={9} className="p-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleStartAddingSubAction(service.id)}
                                                                    className="w-full justify-start mb-2"
                                                                >
                                                                    <Plus className="h-4 w-4 ml-2" />
                                                                    הוסף שורה נוספת
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                    serviceRows.push(
                                                        <TableRow key={`${service.id}-pending-actions`}>
                                                            <TableCell colSpan={9} className="p-2">
                                                                <div className="flex items-center gap-2 justify-end">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={handleCancelAddingSubAction}
                                                                    >
                                                                        ביטול הכל
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
                                                    )
                                                }

                                                if ((draftSubActions.get(service.id) || []).length > 0) {
                                                    serviceRows.push(
                                                        <TableRow key={`${service.id}-add-row-draft`} className="bg-gray-50/50">
                                                            <TableCell colSpan={9} className="p-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleStartAddingSubAction(service.id)}
                                                                    className="w-full justify-start mb-2"
                                                                >
                                                                    <Plus className="h-4 w-4 ml-2" />
                                                                    הוסף שורה נוספת
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                    serviceRows.push(
                                                        <TableRow key={`${service.id}-draft-actions`}>
                                                            <TableCell colSpan={9} className="p-2">
                                                                <div className="flex items-center gap-2 justify-end">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={handleCancelAddingSubAction}
                                                                        className="shrink-0"
                                                                    >
                                                                        ביטול הכל
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={async () => {
                                                                            try {
                                                                                // First, move all drafts to pending
                                                                                const drafts = draftSubActions.get(service.id) || []
                                                                                for (const draft of drafts) {
                                                                                    if (!draft.name.trim() || draft.duration <= 0) {
                                                                                        continue
                                                                                    }
                                                                                    handleSaveDraftSubAction(service.id, draft.tempId)
                                                                                }
                                                                                // Wait a bit for state to update, then save all pending
                                                                                setTimeout(async () => {
                                                                                    await handleSaveAllPendingSubActions(service.id)
                                                                                }, 200)
                                                                            } catch (error) {
                                                                                console.error("Error saving all drafts:", error)
                                                                            }
                                                                        }}
                                                                        disabled={createSubAction.isPending}
                                                                        className="shrink-0"
                                                                    >
                                                                        {createSubAction.isPending ? (
                                                                            <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                                                        ) : (
                                                                            <Save className="h-4 w-4 ml-2" />
                                                                        )}
                                                                        שמור הכל
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                }

                                                if ((draftSubActions.get(service.id) || []).length === 0 && (pendingSubActions.get(service.id) || []).length === 0) {
                                                    serviceRows.push(
                                                        <TableRow key={`${service.id}-add-row`} className="bg-gray-50/50">
                                                            <TableCell colSpan={9} className="p-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleStartAddingSubAction(service.id)}
                                                                    className="w-full justify-start"
                                                                >
                                                                    <Plus className="h-4 w-4 ml-2" />
                                                                    הוסף שורה נוספת
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                }
                                            }
                                        }

                                        if (!isAddingSubAction && isExpanded) {
                                            serviceRows.push(
                                                <TableRow key={`${service.id}-add-subaction`} className="bg-gray-50/50">
                                                    <TableCell colSpan={9} className="p-2">
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
                                            )
                                        }

                                        return serviceRows
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Add Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsAddDialogOpen(false)
                    setFormData({ name: "", description: "", base_price: 0, duration: 0, is_active: true, mode: "simple", service_category_id: defaultCategory?.id || null })
                    setSubActions([])
                }
            }}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>הוסף שירות חדש</DialogTitle>
                        <DialogDescription>
                            הזן את פרטי השירות החדש
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
                            <Label htmlFor="service_category">קטגוריה</Label>
                            <Select
                                value={formData.service_category_id || "none"}
                                onValueChange={(value) => setFormData({ ...formData, service_category_id: value === "none" ? null : value })}
                            >
                                <SelectTrigger dir="rtl">
                                    <SelectValue placeholder="בחר קטגוריה (אופציונלי)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">ללא קטגוריה</SelectItem>
                                    {categories.map((category) => {
                                        const variant = SERVICE_CATEGORY_VARIANTS[category.variant as keyof typeof SERVICE_CATEGORY_VARIANTS]
                                        return (
                                            <SelectItem key={category.id} value={category.id}>
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("h-3 w-3 rounded-full", variant.bg)} />
                                                    <span>{category.name}</span>
                                                </div>
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
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
                            setFormData({ name: "", description: "", base_price: 0, duration: 0, is_active: true, mode: "simple", service_category_id: defaultCategory?.id || null })
                            setSubActions([])
                        }}>
                            ביטול
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={createService.isPending || createSubAction.isPending}
                        >
                            {(createService.isPending || createSubAction.isPending) && (
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                            )}
                            הוסף
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[425px]" dir="rtl">
                    <DialogHeader className="text-right">
                        <DialogTitle className="text-right">מחיקת שירות</DialogTitle>
                        <DialogDescription className="text-right">
                            האם אתה בטוח שברצונך למחוק את השירות "{serviceToDelete?.name}"? פעולה זו לא ניתנת לביטול.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-row-reverse gap-2">
                        <Button variant="destructive" onClick={handleConfirmDelete}>
                            מחק
                        </Button>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                            ביטול
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Duplicate Confirmation Dialog */}
            <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
                <DialogContent className="sm:max-w-[425px]" dir="rtl">
                    <DialogHeader className="text-right">
                        <DialogTitle className="text-right">שכפול שירות</DialogTitle>
                        <DialogDescription className="text-right">
                            האם אתה בטוח שברצונך לשכפל את השירות "{serviceToDuplicate?.name}"?
                            {serviceToDuplicate?.mode === "complicated" && serviceToDuplicate.service_sub_actions && serviceToDuplicate.service_sub_actions.length > 0 && (
                                <span className="block mt-2 text-sm">
                                    כל {serviceToDuplicate.service_sub_actions.length} פעולות המשנה יישכפלו גם כן.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-row-reverse gap-2">
                        <Button onClick={handleConfirmDuplicate} disabled={createService.isPending || createSubAction.isPending}>
                            {createService.isPending || createSubAction.isPending ? (
                                <>
                                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                    משכפל...
                                </>
                            ) : (
                                "שכפל"
                            )}
                        </Button>
                        <Button variant="outline" onClick={() => setIsDuplicateDialogOpen(false)}>
                            ביטול
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Description Edit Modal */}
            <Dialog open={!!editingDescriptionServiceId} onOpenChange={(open) => !open && closeDescriptionEditModal()}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right">ערוך תיאור</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="edit-description">תיאור</Label>
                            <div className="mt-1">
                                <RichTextEditor
                                    value={descriptionEditValue}
                                    onChange={setDescriptionEditValue}
                                    placeholder="הכנס תיאור כאן..."
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="sm:justify-start gap-2">
                        <Button variant="outline" onClick={closeDescriptionEditModal}>
                            ביטול
                        </Button>
                        <Button
                            onClick={saveDescriptionEdit}
                            disabled={updateService.isPending}
                        >
                            {updateService.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                    שומר...
                                </>
                            ) : (
                                'שמור שינויים'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

interface CategoryAutocompleteProps {
    serviceId: string
    currentCategoryId: string | null
    categories: ServiceCategory[]
    searchTerm: string
    onSearchChange: (term: string) => void
    onSelect: (categoryId: string | null) => void
    onCancel: () => void
}

function CategoryAutocomplete({
    serviceId: _serviceId,
    currentCategoryId,
    categories,
    searchTerm,
    onSearchChange,
    onSelect,
    onCancel,
}: CategoryAutocompleteProps) {
    const [isOpen, setIsOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus()
        }
    }, [])

    const filteredCategories = categories.filter((cat) =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleSelect = (categoryId: string | null) => {
        onSelect(categoryId)
        setIsOpen(false)
    }

    return (
        <div className="relative w-full">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverAnchor asChild>
                    <div className="flex items-center gap-1">
                        <Input
                            ref={inputRef}
                            value={searchTerm}
                            onChange={(e) => {
                                onSearchChange(e.target.value)
                                setIsOpen(true)
                            }}
                            onFocus={() => setIsOpen(true)}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                    onCancel()
                                } else if (e.key === "Enter" && filteredCategories.length === 1) {
                                    handleSelect(filteredCategories[0].id)
                                }
                            }}
                            className="h-8 w-auto min-w-[150px] hover:ring-2 hover:ring-primary/20 transition-all"
                            placeholder="חפש קטגוריה..."
                            dir="rtl"
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onCancel}
                            className="h-6 w-6 p-0"
                        >
                            <X className="h-3 w-3 text-gray-600" />
                        </Button>
                    </div>
                </PopoverAnchor>
                <PopoverContent className="w-[200px] p-0" align="start" side="bottom">
                    <div className="max-h-[200px] overflow-y-auto">
                        {filteredCategories.length > 0 ? (
                            <div className="py-1">
                                <div
                                    className="px-3 py-2 text-sm text-gray-500 cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSelect(null)}
                                >
                                    ללא קטגוריה
                                </div>
                                {filteredCategories.map((category) => {
                                    const variant = SERVICE_CATEGORY_VARIANTS[category.variant as keyof typeof SERVICE_CATEGORY_VARIANTS]
                                    return (
                                        <div
                                            key={category.id}
                                            className={cn(
                                                "px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 flex items-center gap-2",
                                                currentCategoryId === category.id && "bg-primary/10"
                                            )}
                                            onClick={() => handleSelect(category.id)}
                                        >
                                            <div className={cn("h-3 w-3 rounded-full", variant?.bg || "bg-gray-400")} />
                                            <span className="flex-1">{category.name}</span>
                                            {currentCategoryId === category.id && (
                                                <Check className="h-4 w-4 text-primary" />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="px-3 py-2 text-sm text-gray-500">לא נמצאו תוצאות</div>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
