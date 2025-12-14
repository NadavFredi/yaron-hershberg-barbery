import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { LeadSourceDialog, type LeadSourceFormValues } from "@/components/lead-sources/LeadSourceDialog"
import { LeadSourceDeleteDialog } from "@/components/lead-sources/LeadSourceDeleteDialog"

interface LeadSourceCustomer {
  id: string
  full_name: string
  phone: string | null
  email: string | null
}

interface LeadSource {
  id: string
  name: string
  created_at: string
  updated_at: string
  customers: LeadSourceCustomer[]
}

interface LeadSourceRowProps {
  source: LeadSource
  onEdit: (source: LeadSource) => void
  onDelete: (source: LeadSource) => void
  onViewCustomers: (source: LeadSource) => void
  isSaving: boolean
}

function LeadSourceRow({ source, onEdit, onDelete, onViewCustomers, isSaving }: LeadSourceRowProps) {
  return (
    <TableRow className="border-b transition-colors hover:bg-gray-50">
      <TableCell className="text-sm font-medium text-gray-900 text-right">{source.name}</TableCell>
      <TableCell className="text-right">
        <Badge variant="outline" className="border-primary/20 text-gray-700">
          {source.customers.length}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-start gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewCustomers(source)}
            disabled={isSaving}
            className="px-2 hover:bg-primary/10"
          >
            <Users className="h-4 w-4 ml-2" />
            צפה בלקוחות
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(source)}
            disabled={isSaving}
            className="px-2 hover:bg-primary/10"
          >
            <Pencil className="h-4 w-4 ml-2" />
            ערוך
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(source)} disabled={isSaving} className="px-2">
            <Trash2 className="h-4 w-4 ml-1" />
            מחק
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function LeadSourcesPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [leadSources, setLeadSources] = useState<LeadSource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [selectedSource, setSelectedSource] = useState<LeadSource | null>(null)

  const fetchLeadSources = useCallback(async () => {
    console.log("🔍 [LeadSourcesPage] Fetching lead sources...")
    setIsLoading(true)
    const { data, error } = await supabase
      .from("lead_sources")
      .select(
        `
        id,
        name,
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
      .order("name", { ascending: true })

    if (error) {
      console.error("❌ [LeadSourcesPage] Failed fetching lead sources:", error)
      toast({
        title: "שגיאה בטעינה",
        description: "לא ניתן לטעון את מקורות ההגעה. נסה שוב מאוחר יותר.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    const transformed = (data || []).map((source) => ({
      ...source,
      customers: Array.isArray(source.customers) ? (source.customers as LeadSourceCustomer[]) : [],
    })) as LeadSource[]

    console.log("✅ [LeadSourcesPage] Loaded lead sources:", transformed)
    setLeadSources(transformed)
    setIsLoading(false)
  }, [toast])

  useEffect(() => {
    fetchLeadSources()
  }, [fetchLeadSources])

  const openCreateDialog = () => {
    setDialogMode("create")
    setSelectedSource(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (source: LeadSource) => {
    setDialogMode("edit")
    setSelectedSource(source)
    setIsDialogOpen(true)
  }

  const handleDialogSubmit = async ({ name }: LeadSourceFormValues) => {
    try {
      setIsSaving(true)
      const trimmedName = name.trim()

      if (dialogMode === "create") {
        const payload = {
          name: trimmedName,
        }

        console.log("📝 [LeadSourcesPage] Creating new lead source:", payload)
        const { error } = await supabase.from("lead_sources").insert(payload)
        if (error) throw error
        toast({
          title: "מקור הגעה נוצר",
          description: `המקור "${payload.name}" נוסף בהצלחה.`,
        })
      } else if (dialogMode === "edit" && selectedSource) {
        const payload = {
          name: trimmedName,
        }

        console.log("📝 [LeadSourcesPage] Updating lead source:", { id: selectedSource.id, ...payload })
        const { error } = await supabase.from("lead_sources").update(payload).eq("id", selectedSource.id)
        if (error) throw error
        toast({
          title: "מקור הגעה עודכן",
          description: `המקור "${payload.name}" עודכן בהצלחה.`,
        })
      }

      setIsDialogOpen(false)
      setSelectedSource(null)
      await fetchLeadSources()
    } catch (error) {
      console.error("❌ [LeadSourcesPage] Failed saving lead source:", error)
      const message = error instanceof Error ? error.message : "לא ניתן לשמור את מקור ההגעה כעת."
      toast({
        title: "שגיאה בשמירה",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleViewCustomersForSource = (source: LeadSource) => {
    navigate(`/manager-screens?section=customers&mode=list&leadSource=${source.id}`)
  }

  const openDeleteDialog = (source: LeadSource) => {
    setSelectedSource(source)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteSource = async () => {
    if (!selectedSource) return

    try {
      setIsSaving(true)
      console.log("🗑️ [LeadSourcesPage] Deleting lead source:", selectedSource.id)
      const { error } = await supabase.from("lead_sources").delete().eq("id", selectedSource.id)
      if (error) throw error

      toast({
        title: "מקור הגעה נמחק",
        description: `המקור "${selectedSource.name}" הוסר. לקוחות שהיו משויכים אליו הועברו ללא מקור הגעה.`,
      })

      setIsDeleteDialogOpen(false)
      setSelectedSource(null)
      await fetchLeadSources()
    } catch (error) {
      console.error("❌ [LeadSourcesPage] Failed deleting lead source:", error)
      const message = error instanceof Error ? error.message : "לא ניתן למחוק את מקור ההגעה כעת."
      toast({
        title: "שגיאה במחיקה",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>מקורות הגעה</CardTitle>
              <CardDescription>נהל מקורות הגעה ללקוחות כדי לעקוב אחר מקורות הלקוחות.</CardDescription>
            </div>
            <Button onClick={openCreateDialog} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              הוסף מקור הגעה
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin ml-2" />
              טוען מקורות הגעה...
            </div>
          ) : leadSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Users className="h-10 w-10 mb-4 text-gray-400" />
              <p className="text-lg font-medium">לא הוגדרו עדיין מקורות הגעה</p>
              <p className="text-sm">התחל על ידי הוספת מקור חדש</p>
            </div>
          ) : (
            <div className="rounded-md border border-gray-200 bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[hsl(228_36%_95%)]">
                    <TableHead className="text-right text-sm font-semibold text-primary">שם מקור</TableHead>
                    <TableHead className="w-40 text-right text-sm font-semibold text-primary">לקוחות משויכים</TableHead>
                    <TableHead className="w-44 text-right text-sm font-semibold text-primary">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadSources.map((source) => (
                    <LeadSourceRow
                      key={source.id}
                      source={source}
                      onEdit={openEditDialog}
                      onDelete={openDeleteDialog}
                      onViewCustomers={handleViewCustomersForSource}
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
      <LeadSourceDialog
        open={isDialogOpen}
        mode={dialogMode}
        initialValues={selectedSource ? { name: selectedSource.name } : undefined}
        isSubmitting={isSaving}
        onClose={() => {
          if (isSaving) {
            return
          }
          setIsDialogOpen(false)
          setSelectedSource(null)
        }}
        onSubmit={handleDialogSubmit}
      />

      {/* Delete Confirmation */}
      <LeadSourceDeleteDialog
        open={isDeleteDialogOpen}
        name={selectedSource?.name}
        isSubmitting={isSaving}
        onConfirm={handleDeleteSource}
        onClose={() => {
          if (isSaving) {
            return
          }
          setIsDeleteDialogOpen(false)
          setSelectedSource(null)
        }}
      />
    </div>
  )
}
