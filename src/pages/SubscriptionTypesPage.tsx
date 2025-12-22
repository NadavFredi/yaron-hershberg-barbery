import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Pencil, Plus, Trash2, Ticket, Copy, UserPlus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { SubscriptionTypeDialog, type SubscriptionTypeFormValues } from "@/components/subscription-types/SubscriptionTypeDialog"
import { SubscriptionTypeDeleteDialog } from "@/components/subscription-types/SubscriptionTypeDeleteDialog"
import { BulkAssignSubscriptionDialog } from "@/components/subscription-types/BulkAssignSubscriptionDialog"

interface SubscriptionTypeTicket {
  id: string
  customer_id: string
}

interface SubscriptionType {
  id: string
  name: string
  price: number | null
  description: string | null
  type: "entrances" | "days"
  total_entries: number | null
  days_duration: number | null
  expiration_days: number
  expiry_calculation_method: "from_purchase_date" | "from_first_usage"
  is_active: boolean
  visible_to_users: boolean
  created_at: string
  updated_at: string
  tickets: SubscriptionTypeTicket[]
}

interface SubscriptionTypeRowProps {
  type: SubscriptionType
  onEdit: (type: SubscriptionType) => void
  onDelete: (type: SubscriptionType) => void
  onDuplicate: (type: SubscriptionType) => void
  onViewSubscriptions: (type: SubscriptionType) => void
  onBulkAssign: (type: SubscriptionType) => void
  onToggleActive: (type: SubscriptionType, isActive: boolean) => void
  onToggleVisibleToUsers: (type: SubscriptionType, visibleToUsers: boolean) => void
  isSaving: boolean
}

function SubscriptionTypeRow({ type, onEdit, onDelete, onDuplicate, onViewSubscriptions, onBulkAssign, onToggleActive, onToggleVisibleToUsers, isSaving }: SubscriptionTypeRowProps) {
  return (
    <TableRow className="border-b transition-colors hover:bg-gray-50">
      <TableCell className="text-sm font-medium text-gray-900 text-right">{type.name}</TableCell>
      <TableCell className="text-right">
        {type.price !== null ? (
          <Badge variant="outline" className="bg-[hsl(228_36%_95%)] text-primary border-primary/30">
            ₪{type.price.toFixed(2)}
          </Badge>
        ) : (
          <span className="text-gray-400">ללא מחיר</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {type.type === "entrances" ? (
          type.total_entries !== null ? (
            <Badge variant="outline" className="border-primary/20 text-gray-700">
              {type.total_entries} כניסות
            </Badge>
          ) : (
            <span className="text-gray-400">—</span>
          )
        ) : (
          type.days_duration !== null ? (
            <Badge variant="outline" className="border-primary/20 text-gray-700">
              {type.days_duration} ימים
            </Badge>
          ) : (
            <span className="text-gray-400">—</span>
          )
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            {type.expiration_days} ימים
          </Badge>
          <Badge variant="outline" className="text-xs border-gray-300">
            {type.expiry_calculation_method === "from_purchase_date" ? "מתאריך רכישה" : "משימוש ראשון"}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-sm text-gray-600 text-right">
        {type.description?.trim() ? type.description : "אין תיאור"}
      </TableCell>
      <TableCell className="text-right">
        <Badge variant="outline" className="border-primary/20 text-gray-700">
          {type.tickets.length}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Checkbox
          checked={type.is_active}
          onCheckedChange={(checked) => onToggleActive(type, checked === true)}
          disabled={isSaving}
        />
      </TableCell>
      <TableCell className="text-right">
        <Checkbox
          checked={type.visible_to_users}
          onCheckedChange={(checked) => onToggleVisibleToUsers(type, checked === true)}
          disabled={isSaving}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-start gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onBulkAssign(type)}
            disabled={isSaving}
            className="px-2 hover:bg-primary/10"
            title="הקצה מנוי ללקוחות"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewSubscriptions(type)}
            disabled={isSaving}
            className="px-2 hover:bg-primary/10"
            title="צפה במנויים"
          >
            <Ticket className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDuplicate(type)}
            disabled={isSaving}
            className="px-2 hover:bg-primary/10"
            title="שכפל"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(type)}
            disabled={isSaving}
            className="px-2 hover:bg-primary/10"
            title="ערוך"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(type)} disabled={isSaving} className="px-2" title="מחק">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function SubscriptionTypesPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBulkAssignDialogOpen, setIsBulkAssignDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [selectedType, setSelectedType] = useState<SubscriptionType | null>(null)

  const fetchSubscriptionTypes = useCallback(async () => {
    console.log("🔍 [SubscriptionTypesPage] Fetching subscription types...")
    setIsLoading(true)
    const { data, error } = await supabase
      .from("ticket_types")
      .select(
        `
        id,
        name,
        price,
        description,
        type,
        total_entries,
        days_duration,
        expiration_days,
        expiry_calculation_method,
        is_active,
        visible_to_users,
        created_at,
        updated_at,
        tickets:tickets(
          id,
          customer_id
        )
      `
      )
      .order("name", { ascending: true })

    if (error) {
      console.error("❌ [SubscriptionTypesPage] Failed fetching subscription types:", error)
      toast({
        title: "שגיאה בטעינה",
        description: "לא ניתן לטעון את סוגי המנויים. נסה שוב מאוחר יותר.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    const transformed = (data || []).map((type) => ({
      ...type,
      tickets: Array.isArray(type.tickets) ? (type.tickets as SubscriptionTypeTicket[]) : [],
    })) as SubscriptionType[]

    console.log("✅ [SubscriptionTypesPage] Loaded subscription types:", transformed)
    setSubscriptionTypes(transformed)
    setIsLoading(false)
  }, [toast])

  useEffect(() => {
    fetchSubscriptionTypes()
  }, [fetchSubscriptionTypes])

  const openCreateDialog = () => {
    setDialogMode("create")
    setSelectedType(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (type: SubscriptionType) => {
    setDialogMode("edit")
    setSelectedType(type)
    setIsDialogOpen(true)
  }

  const openDuplicateDialog = (type: SubscriptionType) => {
    setDialogMode("create")
    setSelectedType(type)
    setIsDialogOpen(true)
  }

  const handleDialogSubmit = async (values: SubscriptionTypeFormValues) => {
    try {
      setIsSaving(true)
      const trimmedName = values.name.trim()
      const trimmedDescription = values.description.trim()

      if (dialogMode === "create") {
        const payload = {
          name: trimmedName,
          price: values.price !== null && values.price !== "" ? parseFloat(values.price.toString()) : null,
          description: trimmedDescription || null,
          type: values.type,
          total_entries: values.type === "entrances" && values.totalEntries ? parseInt(values.totalEntries.toString()) : null,
          days_duration: values.type === "days" && values.daysDuration ? parseInt(values.daysDuration.toString()) : null,
          expiration_days: values.expirationDays ? parseInt(values.expirationDays.toString()) : 365,
          expiry_calculation_method: values.expiryCalculationMethod || "from_purchase_date",
          is_active: values.isActive,
          visible_to_users: values.visibleToUsers,
        }

        console.log("📝 [SubscriptionTypesPage] Creating new subscription type:", payload)
        const { error } = await supabase.from("ticket_types").insert(payload)
        if (error) throw error
        toast({
          title: "סוג המנוי נוצר",
          description: `הסוג "${payload.name}" נוסף בהצלחה.`,
        })
      } else if (dialogMode === "edit" && selectedType) {
        const payload = {
          name: trimmedName,
          price: values.price !== null && values.price !== "" ? parseFloat(values.price.toString()) : null,
          description: trimmedDescription || null,
          type: values.type,
          total_entries: values.type === "entrances" && values.totalEntries ? parseInt(values.totalEntries.toString()) : null,
          days_duration: values.type === "days" && values.daysDuration ? parseInt(values.daysDuration.toString()) : null,
          expiration_days: values.expirationDays ? parseInt(values.expirationDays.toString()) : 365,
          expiry_calculation_method: values.expiryCalculationMethod || "from_purchase_date",
          is_active: values.isActive,
          visible_to_users: values.visibleToUsers,
        }

        console.log("📝 [SubscriptionTypesPage] Updating subscription type:", { id: selectedType.id, ...payload })
        const { error } = await supabase.from("ticket_types").update(payload).eq("id", selectedType.id)
        if (error) throw error
        toast({
          title: "סוג המנוי עודכן",
          description: `הסוג "${payload.name}" עודכן בהצלחה.`,
        })
      }

      setIsDialogOpen(false)
      setSelectedType(null)
      await fetchSubscriptionTypes()
    } catch (error) {
      console.error("❌ [SubscriptionTypesPage] Failed saving subscription type:", error)
      const message = error instanceof Error ? error.message : "לא ניתן לשמור את סוג המנוי כעת."
      toast({
        title: "שגיאה בשמירה",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleViewSubscriptionsForType = (type: SubscriptionType) => {
    // Navigate to subscriptions list filtered by this type
    navigate(`/manager-screens?section=subscriptions&mode=list&type=${type.id}`)
  }

  const openDeleteDialog = (type: SubscriptionType) => {
    setSelectedType(type)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteType = async () => {
    if (!selectedType) return

    try {
      setIsSaving(true)
      console.log("🗑️ [SubscriptionTypesPage] Deleting subscription type:", selectedType.id)
      const { error } = await supabase.from("ticket_types").delete().eq("id", selectedType.id)
      if (error) throw error

      toast({
        title: "סוג נמחק",
        description: `הסוג "${selectedType.name}" הוסר. מנויים שהיו משויכים אליו יישארו ללא סוג.`,
      })

      setIsDeleteDialogOpen(false)
      setSelectedType(null)
      await fetchSubscriptionTypes()
    } catch (error) {
      console.error("❌ [SubscriptionTypesPage] Failed deleting subscription type:", error)
      const message = error instanceof Error ? error.message : "לא ניתן למחוק את סוג המנוי כעת."
      toast({
        title: "שגיאה במחיקה",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (type: SubscriptionType, isActive: boolean) => {
    try {
      setIsSaving(true)
      console.log("🔄 [SubscriptionTypesPage] Toggling active status:", { id: type.id, isActive })
      const { error } = await supabase
        .from("ticket_types")
        .update({ is_active: isActive })
        .eq("id", type.id)

      if (error) throw error

      toast({
        title: isActive ? "סוג הופעל" : "סוג הושבת",
        description: `הסוג "${type.name}" ${isActive ? "הופעל" : "הושבת"} בהצלחה.`,
      })

      await fetchSubscriptionTypes()
    } catch (error) {
      console.error("❌ [SubscriptionTypesPage] Failed toggling active status:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לעדכן את סטטוס הפעילות",
        variant: "destructive",
      })
      // Revert the change by refetching
      await fetchSubscriptionTypes()
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleVisibleToUsers = async (type: SubscriptionType, visibleToUsers: boolean) => {
    try {
      setIsSaving(true)
      console.log("🔄 [SubscriptionTypesPage] Toggling visible to users:", { id: type.id, visibleToUsers })
      const { error } = await supabase
        .from("ticket_types")
        .update({ visible_to_users: visibleToUsers })
        .eq("id", type.id)

      if (error) throw error

      toast({
        title: visibleToUsers ? "סוג גלוי למשתמשים" : "סוג מוסתר ממשתמשים",
        description: `הסוג "${type.name}" ${visibleToUsers ? "גלוי" : "מוסתר"} למשתמשים בהצלחה.`,
      })

      await fetchSubscriptionTypes()
    } catch (error) {
      console.error("❌ [SubscriptionTypesPage] Failed toggling visible to users:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לעדכן את נראות הסוג למשתמשים",
        variant: "destructive",
      })
      // Revert the change by refetching
      await fetchSubscriptionTypes()
    } finally {
      setIsSaving(false)
    }
  }

  const handleBulkAssign = (type: SubscriptionType) => {
    setSelectedType(type)
    setIsBulkAssignDialogOpen(true)
  }

  const handleBulkAssignSuccess = async () => {
    await fetchSubscriptionTypes()
  }

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>סוגי מנויים</CardTitle>
              <CardDescription>נהל סוגי מנויים וכרטיסיות עם מחירים והגדרות.</CardDescription>
            </div>
            <Button onClick={openCreateDialog} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              הוסף סוג מנוי
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin ml-2" />
              טוען סוגים...
            </div>
          ) : subscriptionTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Ticket className="h-10 w-10 mb-4 text-gray-400" />
              <p className="text-lg font-medium">לא הוגדרו עדיין סוגי מנויים</p>
              <p className="text-sm">התחל על ידי הוספת סוג חדש כדי לנהל מנויים</p>
            </div>
          ) : (
            <div className="rounded-md border border-gray-200 bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[hsl(228_36%_95%)]">
                    <TableHead className="text-right text-sm font-semibold text-primary">שם סוג</TableHead>
                    <TableHead className="w-32 text-right text-sm font-semibold text-primary">מחיר</TableHead>
                    <TableHead className="w-40 text-right text-sm font-semibold text-primary">סוג / משך</TableHead>
                    <TableHead className="w-40 text-right text-sm font-semibold text-primary">ימי תפוגה / חישוב</TableHead>
                    <TableHead className="text-right text-sm font-semibold text-primary">תיאור</TableHead>
                    <TableHead className="w-40 text-right text-sm font-semibold text-primary">מנויים משויכים</TableHead>
                    <TableHead className="w-32 text-right text-sm font-semibold text-primary">פעיל</TableHead>
                    <TableHead className="w-32 text-right text-sm font-semibold text-primary">גלוי למשתמשים</TableHead>
                    <TableHead className="w-44 text-right text-sm font-semibold text-primary">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {subscriptionTypes.map((type) => (
                    <SubscriptionTypeRow
                      key={type.id}
                      type={type}
                      onEdit={openEditDialog}
                      onDelete={openDeleteDialog}
                      onDuplicate={openDuplicateDialog}
                      onViewSubscriptions={handleViewSubscriptionsForType}
                      onBulkAssign={handleBulkAssign}
                      onToggleActive={handleToggleActive}
                      onToggleVisibleToUsers={handleToggleVisibleToUsers}
                      isSaving={isSaving}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <SubscriptionTypeDialog
        open={isDialogOpen}
        mode={dialogMode}
        initialValues={
          selectedType
            ? {
              name: dialogMode === "create" ? `${selectedType.name} (עותק)` : selectedType.name,
              description: selectedType.description || "",
              price: selectedType.price?.toString() || "",
              type: selectedType.type,
              totalEntries: selectedType.total_entries?.toString() || "",
              daysDuration: selectedType.days_duration?.toString() || "",
              expirationDays: selectedType.expiration_days?.toString() || "365",
              expiryCalculationMethod: selectedType.expiry_calculation_method || "from_purchase_date",
              isActive: selectedType.is_active,
              visibleToUsers: selectedType.visible_to_users ?? true,
            }
            : undefined
        }
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
      <SubscriptionTypeDeleteDialog
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

      {/* Bulk Assign Dialog */}
      <BulkAssignSubscriptionDialog
        open={isBulkAssignDialogOpen}
        onOpenChange={setIsBulkAssignDialogOpen}
        subscriptionTypeId={selectedType?.id || null}
        subscriptionTypeName={selectedType?.name || ""}
        onSuccess={handleBulkAssignSuccess}
      />
    </div>
  )
}

