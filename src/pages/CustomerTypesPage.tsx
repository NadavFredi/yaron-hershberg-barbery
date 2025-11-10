import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Pencil, Plus, Trash2, Users, GripVertical } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
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
import { CustomerTypeDialog, type CustomerTypeFormValues } from "@/components/customer-types/CustomerTypeDialog"
import { CustomerTypeDeleteDialog } from "@/components/customer-types/CustomerTypeDeleteDialog"

interface CustomerTypeCustomer {
  id: string
  full_name: string
  phone: string | null
  email: string | null
}

interface CustomerType {
  id: string
  name: string
  priority: number
  description: string | null
  created_at: string
  updated_at: string
  customers: CustomerTypeCustomer[]
}

interface CustomerTypeRowProps {
  type: CustomerType
  index: number
  onEdit: (type: CustomerType) => void
  onDelete: (type: CustomerType) => void
  onViewCustomers: (type: CustomerType) => void
  isSaving: boolean
}

function CustomerTypeRow({ type, index, onEdit, onDelete, onViewCustomers, isSaving }: CustomerTypeRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: type.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn("border-b transition-colors hover:bg-gray-50", isDragging && "bg-[hsl(228_36%_95%)]")}
    >
      <TableCell className="w-12">
        <button
          type="button"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-gray-500 transition-colors",
            !isDragging && "hover:border-primary/40 hover:text-primary"
          )}
          {...attributes}
          {...listeners}
          aria-label="גרור לשינוי קדימות"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="text-sm font-medium text-gray-900 text-right">{type.name}</TableCell>
      <TableCell className="text-right">
        <Badge variant="outline" className="bg-[hsl(228_36%_95%)] text-primary border-primary/30">
          קדימות {index + 1}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-gray-600 text-right">
        {type.description?.trim() ? type.description : "אין תיאור"}
      </TableCell>
      <TableCell className="text-right">
        <Badge variant="outline" className="border-primary/20 text-gray-700">
          {type.customers.length}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-start gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewCustomers(type)}
            disabled={isSaving}
            className="px-2 hover:bg-primary/10"
          >
            <Users className="h-4 w-4 ml-2" />
            צפה בלקוחות
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(type)}
            disabled={isSaving}
            className="px-2 hover:bg-primary/10"
          >
            <Pencil className="h-4 w-4 ml-2" />
            ערוך
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(type)} disabled={isSaving} className="px-2">
            <Trash2 className="h-4 w-4 ml-1" />
            מחק
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function CustomerTypesPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [selectedType, setSelectedType] = useState<CustomerType | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const orderedTypes = useMemo(
    () => [...customerTypes].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)),
    [customerTypes]
  )

  const fetchCustomerTypes = useCallback(async () => {
    console.log("🔍 [CustomerTypesPage] Fetching customer types...")
    setIsLoading(true)
    const { data, error } = await supabase
      .from("customer_types")
      .select(
        `
        id,
        name,
        priority,
        description,
        created_at,
        updated_at,
        customers:customers(
          id,
          full_name,
          phone,
          email
        )
      `
      )
      .order("priority", { ascending: true })

    if (error) {
      console.error("❌ [CustomerTypesPage] Failed fetching customer types:", error)
      toast({
        title: "שגיאה בטעינה",
        description: "לא ניתן לטעון את סוגי הלקוחות. נסה שוב מאוחר יותר.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    const transformed = (data || []).map((type) => ({
      ...type,
      customers: Array.isArray(type.customers) ? (type.customers as CustomerTypeCustomer[]) : [],
    })) as CustomerType[]

    console.log("✅ [CustomerTypesPage] Loaded customer types:", transformed)
    setCustomerTypes(transformed)
    setIsLoading(false)
  }, [toast])

  useEffect(() => {
    fetchCustomerTypes()
  }, [fetchCustomerTypes])

  const openCreateDialog = () => {
    setDialogMode("create")
    setSelectedType(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (type: CustomerType) => {
    setDialogMode("edit")
    setSelectedType(type)
    setIsDialogOpen(true)
  }

  const handleDialogSubmit = async ({ name, description }: CustomerTypeFormValues) => {
    try {
      setIsSaving(true)
      const trimmedName = name.trim()
      const trimmedDescription = description.trim()

      if (dialogMode === "create") {
        const maxPriority = customerTypes.length > 0 ? Math.max(...customerTypes.map((type) => type.priority)) : 0
        const nextPriority = maxPriority + 1
        const payload = {
          name: trimmedName,
          priority: nextPriority,
          description: trimmedDescription || null,
        }

        console.log("📝 [CustomerTypesPage] Creating new customer type:", payload)
        const { error } = await supabase.from("customer_types").insert(payload)
        if (error) throw error
        toast({
          title: "סוג הלקוח נוצר",
          description: `הסוג "${payload.name}" נוסף בהצלחה.`,
        })
      } else if (dialogMode === "edit" && selectedType) {
        const payload = {
          name: trimmedName,
          priority: selectedType.priority,
          description: trimmedDescription || null,
        }

        console.log("📝 [CustomerTypesPage] Updating customer type:", { id: selectedType.id, ...payload })
        const { error } = await supabase.from("customer_types").update(payload).eq("id", selectedType.id)
        if (error) throw error
        toast({
          title: "סוג הלקוח עודכן",
          description: `הסוג "${payload.name}" עודכן בהצלחה.`,
        })
      }

      setIsDialogOpen(false)
      setSelectedType(null)
      await fetchCustomerTypes()
    } catch (error) {
      console.error("❌ [CustomerTypesPage] Failed saving customer type:", error)
      const message = error instanceof Error ? error.message : "לא ניתן לשמור את סוג הלקוח כעת."
      toast({
        title: "שגיאה בשמירה",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleViewCustomersForType = (type: CustomerType) => {
    navigate(`/manager-screens?section=customers&mode=list&type=${type.id}`)
  }

  const openDeleteDialog = (type: CustomerType) => {
    setSelectedType(type)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteType = async () => {
    if (!selectedType) return

    try {
      setIsSaving(true)
      console.log("🗑️ [CustomerTypesPage] Deleting customer type:", selectedType.id)
      const { error } = await supabase.from("customer_types").delete().eq("id", selectedType.id)
      if (error) throw error

      toast({
        title: "סוג נמחק",
        description: `הסוג "${selectedType.name}" הוסר. לקוחות שהיו משויכים אליו הועברו ללא סוג.`,
      })

      setIsDeleteDialogOpen(false)
      setSelectedType(null)
      await fetchCustomerTypes()
    } catch (error) {
      console.error("❌ [CustomerTypesPage] Failed deleting customer type:", error)
      const message = error instanceof Error ? error.message : "לא ניתן למחוק את סוג הלקוח כעת."
      toast({
        title: "שגיאה במחיקה",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const persistNewOrder = useCallback(
    async (ordered: CustomerType[]) => {
      setIsReordering(true)
      try {
        const payload = ordered.map((type, index) => ({
          id: type.id,
          name: type.name,
          priority: index + 1,
          description: type.description ?? null,
        }))
        console.log("🌀 [CustomerTypesPage] Persisting new priority order", payload)
        const { error } = await supabase.from("customer_types").upsert(payload, { onConflict: "id", ignoreDuplicates: false })
        if (error) {
          throw error
        }
        toast({
          title: "הקדימויות עודכנו",
          description: "סדר הקדימויות נשמר בהצלחה.",
        })
      } catch (error) {
        console.error("❌ [CustomerTypesPage] Failed to persist priorities:", error)
        toast({
          title: "שגיאה בשמירת הקדימויות",
          description: error instanceof Error ? error.message : "לא ניתן לשמור את הקדימויות כעת.",
          variant: "destructive",
        })
        await fetchCustomerTypes()
      } finally {
        setIsReordering(false)
      }
    },
    [fetchCustomerTypes, toast]
  )

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) {
        return
      }

      const oldIndex = orderedTypes.findIndex((type) => type.id === active.id)
      const newIndex = orderedTypes.findIndex((type) => type.id === over.id)
      if (oldIndex === -1 || newIndex === -1) {
        return
      }

      const updated = [...orderedTypes]
      const [moved] = updated.splice(oldIndex, 1)
      updated.splice(newIndex, 0, moved)
      const reIndexed = updated.map((type, index) => ({ ...type, priority: index + 1 }))
      console.log("🔄 [CustomerTypesPage] Local reorder result:", reIndexed.map((t) => ({ id: t.id, priority: t.priority })))
      setCustomerTypes(reIndexed)
      void persistNewOrder(reIndexed)
    },
    [orderedTypes, persistNewOrder]
  )

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>סוגי לקוחות</CardTitle>
              <CardDescription>נהל סוגים וקדימויות ללקוחות כדי לייעד טיפול מועדף.</CardDescription>
            </div>
            <Button onClick={openCreateDialog} className="flex items-center gap-2" disabled={isReordering}>
              <Plus className="h-4 w-4" />
              הוסף סוג לקוח
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin ml-2" />
              טוען סוגים...
            </div>
          ) : orderedTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Users className="h-10 w-10 mb-4 text-gray-400" />
              <p className="text-lg font-medium">לא הוגדרו עדיין סוגי לקוחות</p>
              <p className="text-sm">התחל על ידי הוספת סוג חדש כדי לנהל קדימויות</p>
            </div>
          ) : (
            <div className="rounded-md border border-gray-200 bg-white shadow-sm">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedTypes.map((type) => type.id)} strategy={verticalListSortingStrategy}>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[hsl(228_36%_95%)]">
                        <TableHead className="w-14" />
                        <TableHead className="text-right text-sm font-semibold text-primary">שם סוג</TableHead>
                        <TableHead className="w-32 text-right text-sm font-semibold text-primary">תיעדוף תורים</TableHead>
                        <TableHead className="text-right text-sm font-semibold text-primary">תיאור</TableHead>
                        <TableHead className="w-40 text-right text-sm font-semibold text-primary">לקוחות משויכים</TableHead>
                        <TableHead className="w-44 text-right text-sm font-semibold text-primary">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderedTypes.map((type, index) => (
                        <CustomerTypeRow
                          key={type.id}
                          type={type}
                          index={index}
                          onEdit={openEditDialog}
                          onDelete={openDeleteDialog}
                          onViewCustomers={handleViewCustomersForType}
                          isSaving={isSaving || isReordering}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </SortableContext>
              </DndContext>
              {isReordering && (
                <div className="flex items-center justify-center gap-2 border-t border-gray-200 bg-[hsl(228_36%_97%)] py-2 text-sm text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  שומר את סדר הקדימויות...
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <CustomerTypeDialog
        open={isDialogOpen}
        mode={dialogMode}
        initialValues={selectedType ? { name: selectedType.name, description: selectedType.description || "" } : undefined}
        nextPriority={dialogMode === "create" ? (customerTypes.length > 0 ? Math.max(...customerTypes.map((type) => type.priority)) + 1 : 1) : undefined}
        isSubmitting={isSaving}
        onClose={() => {
          if (isSaving) {
            return
          }
          setIsDialogOpen(false)
          setSelectedType(null)
        }}
        onSubmit={handleDialogSubmit}
      />

      {/* Delete Confirmation */}
      <CustomerTypeDeleteDialog
        open={isDeleteDialogOpen}
        name={selectedType?.name}
        isSubmitting={isSaving}
        onConfirm={handleDeleteType}
        onClose={() => {
          if (isSaving) {
            return
          }
          setIsDeleteDialogOpen(false)
          setSelectedType(null)
        }}
      />
    </div>
  )
}
