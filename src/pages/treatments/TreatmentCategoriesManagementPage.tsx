import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, PawPrint, Pencil, Trash2, Eye } from "lucide-react"
import { TreatmentCategoryDialog } from "@/components/treatments/TreatmentCategoryDialog"
import { TreatmentCategoryDeleteDialog } from "@/components/treatments/TreatmentCategoryDeleteDialog"

type Variant = "category1" | "category2"

interface TreatmentCategoryItem {
    id: string
    name: string
    created_at?: string
    updated_at?: string
    treatmentCount: number
    treatmentTypeCount: number
}

const CONFIG: Record<Variant, {
    tableName: "treatment_types" | "treatment_categories"
    relationTable: "treatmentType_treatment_types" | "treatmentType_treatment_categories"
    relationColumn: "treatment_type_id" | "treatment_category_id"
    title: string
    description: string
    addButtonLabel: string
    entityLabel: string
    emptyTitle: string
    emptySubtitle: string
}> = {
    category1: {
        tableName: "treatment_types",
        relationTable: "treatmentType_treatment_types",
        relationColumn: "treatment_type_id",
        title: "קטגוריה 1 - סוגי כלב",
        description: "נהל סוגים כלליים של כלבים כדי לקבץ התנהגות וצרכים משותפים.",
        addButtonLabel: "הוסף קטגוריה 1",
        entityLabel: "קטגוריה 1",
        emptyTitle: "לא הוגדרו עדיין קטגוריות 1",
        emptySubtitle: "התחל על ידי הוספת קטגוריה חדשה ושייך אליה גזעים מתאימים.",
    },
    category2: {
        tableName: "treatment_categories",
        relationTable: "treatmentType_treatment_categories",
        relationColumn: "treatment_category_id",
        title: "קטגוריה 2 - קטגוריות התנהגות",
        description: "נהל קטגוריות מפורטות יותר להצמדת תוכניות טיפול מדויקות.",
        addButtonLabel: "הוסף קטגוריה 2",
        entityLabel: "קטגוריה 2",
        emptyTitle: "לא הוגדרו עדיין קטגוריות 2",
        emptySubtitle: "הוסף קטגוריה 2 חדשה ושייך אליה גזעים כדי להקל על סינון.",
    },
}

interface TreatmentCategoriesManagementPageProps {
    variant: Variant
}

export default function TreatmentCategoriesManagementPage({ variant }: TreatmentCategoriesManagementPageProps) {
    const config = CONFIG[variant]
    const { toast } = useToast()
    const navigate = useNavigate()
    const [items, setItems] = useState<TreatmentCategoryItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
    const [selectedItem, setSelectedItem] = useState<TreatmentCategoryItem | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const fetchCategories = useCallback(async () => {
        console.log("🔍 [TreatmentCategoriesManagementPage] Fetching categories", { variant })
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from(config.tableName)
                .select("id, name, created_at, updated_at")
                .order("name")

            if (error) throw error

            const categoryData = (data || []) as Pick<TreatmentCategoryItem, "id" | "name" | "created_at" | "updated_at">[]
            const categoryIds = categoryData.map((item) => item.id)

            const treatmentCountMap = new Map<string, number>()
            const treatmentTypeIdsByCategory: Record<string, Set<string>> = {}

            if (categoryIds.length > 0) {
                const { data: relationData, error: relationError } = await supabase
                    .from(config.relationTable)
                    .select(`
                        ${config.relationColumn},
                        treatmentType:treatment_types!inner (
                            id,
                            treatments:treatments (count)
                        )
                    `)
                    .in(config.relationColumn, categoryIds)

                if (relationError) throw relationError

                ;(relationData || []).forEach((row: any) => {
                    const categoryId = row[config.relationColumn]
                    const treatmentType = row.treatmentType
                    if (!categoryId || !treatmentType) return

                    if (!treatmentTypeIdsByCategory[categoryId]) {
                        treatmentTypeIdsByCategory[categoryId] = new Set<string>()
                    }
                    treatmentTypeIdsByCategory[categoryId].add(treatmentType.id)

                    const treatmentsArray = Array.isArray(treatmentType.treatments) ? treatmentType.treatments : []
                    const treatmentsCount = treatmentsArray.length > 0 ? Number(treatmentsArray[0]?.count ?? 0) : 0
                    treatmentCountMap.set(categoryId, (treatmentCountMap.get(categoryId) ?? 0) + treatmentsCount)
                })
            }

            const mapped = categoryData.map((item) => {
                const treatmentTypeSet = treatmentTypeIdsByCategory[item.id] ?? new Set<string>()
                return {
                    ...item,
                    treatmentCount: treatmentCountMap.get(item.id) ?? 0,
                    treatmentTypeCount: treatmentTypeSet.size,
                }
            })

            console.log("✅ [TreatmentCategoriesManagementPage] Loaded categories", { variant, mapped })

            setItems(mapped)
        } catch (error) {
            console.error("❌ [TreatmentCategoriesManagementPage] Failed to fetch categories", { variant, error })
            toast({
                title: "שגיאה בטעינה",
                description: "לא ניתן לטעון את הקטגוריות. נסה שוב מאוחר יותר.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }, [config, toast, variant])

    useEffect(() => {
        fetchCategories()
    }, [fetchCategories])

    const openCreateDialog = () => {
        setDialogMode("create")
        setSelectedItem(null)
        setIsDialogOpen(true)
    }

    const openEditDialog = (item: TreatmentCategoryItem) => {
        setDialogMode("edit")
        setSelectedItem(item)
        setIsDialogOpen(true)
    }

    const handleDialogSubmit = async (name: string) => {
        try {
            setIsSaving(true)
            if (dialogMode === "create") {
                console.log("📝 [TreatmentCategoriesManagementPage] Creating category", { variant, name })
                const { error } = await supabase.from(config.tableName).insert({ name })
                if (error) throw error
                toast({
                    title: `${config.entityLabel} נוצרה`,
                    description: `הקטגוריה "${name}" נוספה בהצלחה.`,
                })
            } else if (dialogMode === "edit" && selectedItem) {
                console.log("📝 [TreatmentCategoriesManagementPage] Updating category", { variant, id: selectedItem.id, name })
                const { error } = await supabase.from(config.tableName).update({ name }).eq("id", selectedItem.id)
                if (error) throw error
                toast({
                    title: `${config.entityLabel} עודכנה`,
                    description: `הקטגוריה "${name}" עודכנה בהצלחה.`,
                })
            }
            setIsDialogOpen(false)
            setSelectedItem(null)
            await fetchCategories()
        } catch (error) {
            console.error("❌ [TreatmentCategoriesManagementPage] Failed saving category", { variant, error })
            toast({
                title: "שגיאה בשמירה",
                description: error instanceof Error ? error.message : "לא ניתן לשמור את הקטגוריה.",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const openDeleteDialog = (item: TreatmentCategoryItem) => {
        setSelectedItem(item)
        setIsDeleteDialogOpen(true)
    }

    const handleDelete = async () => {
        if (!selectedItem) return
        try {
            setIsSaving(true)
            console.log("🗑️ [TreatmentCategoriesManagementPage] Deleting category", { variant, id: selectedItem.id })
            const { error } = await supabase.from(config.tableName).delete().eq("id", selectedItem.id)
            if (error) throw error
            toast({
                title: "הקטגוריה נמחקה",
                description: `הקטגוריה "${selectedItem.name}" הוסרה בהצלחה.`,
            })
            setIsDeleteDialogOpen(false)
            setSelectedItem(null)
            await fetchCategories()
        } catch (error) {
            console.error("❌ [TreatmentCategoriesManagementPage] Failed deleting category", { variant, error })
            toast({
                title: "שגיאה במחיקה",
                description: error instanceof Error ? error.message : "לא ניתן למחוק את הקטגוריה.",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleInspectTreatments = (item: TreatmentCategoryItem) => {
        const params = new URLSearchParams({
            section: "treatments",
            mode: "list",
            [variant === "category1" ? "category1Id" : "category2Id"]: item.id,
        })
        console.log("🔗 [TreatmentCategoriesManagementPage] Navigating to treatments list with filter", {
            variant,
            categoryId: item.id,
        })
        navigate(`/manager-screens?${params.toString()}`)
    }

    const handleNavigateToTreatmentTypes = (item: TreatmentCategoryItem) => {
        if (item.treatmentTypeCount === 0) return
        const params = new URLSearchParams({
            section: "settings",
            mode: "treatmentTypes",
            [variant === "category1" ? "category1Id" : "category2Id"]: item.id,
        })
        console.log("🔗 [TreatmentCategoriesManagementPage] Navigating to treatmentTypes settings with filter", {
            variant,
            categoryId: item.id,
        })
        navigate(`/manager-screens?${params.toString()}`)
    }

    const orderedItems = useMemo(
        () => [...items].sort((a, b) => a.name.localeCompare(b.name, "he")),
        [items]
    )

    return (
        <div className="space-y-6" dir="rtl">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>{config.title}</CardTitle>
                            <CardDescription>{config.description}</CardDescription>
                        </div>
                        <Button onClick={openCreateDialog} className="flex items-center gap-2" disabled={isSaving}>
                            <PawPrint className="h-4 w-4" />
                            {config.addButtonLabel}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            טוען קטגוריות...
                        </div>
                    ) : orderedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
                            <PawPrint className="h-10 w-10 text-gray-400" />
                            <p className="text-lg font-medium">{config.emptyTitle}</p>
                            <p className="text-sm">{config.emptySubtitle}</p>
                        </div>
                    ) : (
                        <div className="rounded-md border border-gray-200 bg-white shadow-sm">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-[hsl(205_80%_96%)]">
                                        <TableHead className="text-right text-sm font-semibold text-primary">שם</TableHead>
                                    <TableHead className="text-right text-sm font-semibold text-primary">מספר גזעים</TableHead>
                                        <TableHead className="text-right text-sm font-semibold text-primary">מספר כלבים</TableHead>
                                        <TableHead className="text-right text-sm font-semibold text-primary">נוצר</TableHead>
                                        <TableHead className="text-right text-sm font-semibold text-primary">עודכן</TableHead>
                                        <TableHead className="text-right text-sm font-semibold text-primary w-48">פעולות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orderedItems.map((item) => (
                                        <TableRow key={item.id} className="border-b last:border-b-0">
                                            <TableCell className="text-right font-medium text-gray-900">{item.name}</TableCell>
                                            <TableCell className="text-right text-gray-700">
                                                {item.treatmentTypeCount > 0 ? (
                                                    <button
                                                        type="button"
                                                        className="text-indigo-600 hover:underline"
                                                        onClick={() => handleNavigateToTreatmentTypes(item)}
                                                    >
                                                        {item.treatmentTypeCount}
                                                    </button>
                                                ) : (
                                                    0
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right text-gray-700">
                                                {item.treatmentCount}
                                            </TableCell>
                                            <TableCell className="text-right text-gray-600">
                                                {item.created_at
                                                    ? new Date(item.created_at).toLocaleDateString("he-IL")
                                                    : "-"}
                                            </TableCell>
                                            <TableCell className="text-right text-gray-600">
                                                {item.updated_at
                                                    ? new Date(item.updated_at).toLocaleDateString("he-IL")
                                                    : "-"}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-start gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleInspectTreatments(item)}
                                                        className="px-2 hover:bg-blue-50 text-blue-700"
                                                    >
                                                        <Eye className="h-4 w-4 ml-2" />
                                                        צפייה בכלבים
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openEditDialog(item)}
                                                        className="px-2 hover:bg-blue-50 text-blue-700"
                                                    >
                                                        <Pencil className="h-4 w-4 ml-2" />
                                                        ערוך
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => openDeleteDialog(item)}
                                                        className="px-2"
                                                        disabled={isSaving}
                                                    >
                                                        <Trash2 className="h-4 w-4 ml-1" />
                                                        מחק
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <TreatmentCategoryDialog
                open={isDialogOpen}
                mode={dialogMode}
                entityLabel={config.entityLabel}
                isSubmitting={isSaving}
                initialName={dialogMode === "edit" && selectedItem ? selectedItem.name : ""}
                onSubmit={handleDialogSubmit}
                onClose={() => {
                    if (isSaving) return
                    setIsDialogOpen(false)
                    setSelectedItem(null)
                }}
            />

            <TreatmentCategoryDeleteDialog
                open={isDeleteDialogOpen}
                entityLabel={config.entityLabel}
                name={selectedItem?.name}
                isSubmitting={isSaving}
                onConfirm={handleDelete}
                onClose={() => {
                    if (isSaving) return
                    setIsDeleteDialogOpen(false)
                    setSelectedItem(null)
                }}
            />

        </div>
    )
}
