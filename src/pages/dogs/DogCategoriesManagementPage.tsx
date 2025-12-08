import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, PawPrint, Pencil, Trash2, Eye } from "lucide-react"
import { DogCategoryDialog } from "@/components/dogs/DogCategoryDialog"
import { DogCategoryDeleteDialog } from "@/components/dogs/DogCategoryDeleteDialog"

interface DogCategoryItem {
    id: string
    name: string
    created_at?: string
    updated_at?: string
    dogCount: number
    breedCount: number
}

const CONFIG = {
    tableName: "dog_categories" as const,
    relationTable: "breed_dog_categories" as const,
    relationColumn: "dog_category_id" as const,
    title: "קטגוריות כלבים",
    description: "נהל קטגוריות כלבים להצמדת תוכניות טיפול מדויקות.",
    addButtonLabel: "הוסף קטגוריית כלבים",
    entityLabel: "קטגוריית כלבים",
    emptyTitle: "לא הוגדרו עדיין קטגוריות כלבים",
    emptySubtitle: "הוסף קטגוריית כלבים חדשה ושייך אליה גזעים כדי להקל על סינון.",
}

export default function DogCategoriesManagementPage() {
    const config = CONFIG
    const { toast } = useToast()
    const navigate = useNavigate()
    const [items, setItems] = useState<DogCategoryItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
    const [selectedItem, setSelectedItem] = useState<DogCategoryItem | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const fetchCategories = useCallback(async () => {
        console.log("🔍 [DogCategoriesManagementPage] Fetching categories")
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from(config.tableName)
                .select("id, name, created_at, updated_at")
                .order("name")

            if (error) throw error

            const categoryData = (data || []) as Pick<DogCategoryItem, "id" | "name" | "created_at" | "updated_at">[]
            const categoryIds = categoryData.map((item) => item.id)

            const dogCountMap = new Map<string, number>()
            const breedIdsByCategory: Record<string, Set<string>> = {}

            if (categoryIds.length > 0) {
                const { data: relationData, error: relationError } = await supabase
                    .from(config.relationTable)
                    .select(`
                        ${config.relationColumn},
                        breed:breeds!inner (
                            id,
                            dogs:dogs (count)
                        )
                    `)
                    .in(config.relationColumn, categoryIds)

                if (relationError) throw relationError

                ;(relationData || []).forEach((row: any) => {
                    const categoryId = row[config.relationColumn]
                    const breed = row.breed
                    if (!categoryId || !breed) return

                    if (!breedIdsByCategory[categoryId]) {
                        breedIdsByCategory[categoryId] = new Set<string>()
                    }
                    breedIdsByCategory[categoryId].add(breed.id)

                    const dogsArray = Array.isArray(breed.dogs) ? breed.dogs : []
                    const dogsCount = dogsArray.length > 0 ? Number(dogsArray[0]?.count ?? 0) : 0
                    dogCountMap.set(categoryId, (dogCountMap.get(categoryId) ?? 0) + dogsCount)
                })
            }

            const mapped = categoryData.map((item) => {
                const breedSet = breedIdsByCategory[item.id] ?? new Set<string>()
                return {
                    ...item,
                    dogCount: dogCountMap.get(item.id) ?? 0,
                    breedCount: breedSet.size,
                }
            })

            console.log("✅ [DogCategoriesManagementPage] Loaded categories", { mapped })

            setItems(mapped)
        } catch (error) {
            console.error("❌ [DogCategoriesManagementPage] Failed to fetch categories", { error })
            toast({
                title: "שגיאה בטעינה",
                description: "לא ניתן לטעון את הקטגוריות. נסה שוב מאוחר יותר.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }, [config, toast])

    useEffect(() => {
        fetchCategories()
    }, [fetchCategories])

    const openCreateDialog = () => {
        setDialogMode("create")
        setSelectedItem(null)
        setIsDialogOpen(true)
    }

    const openEditDialog = (item: DogCategoryItem) => {
        setDialogMode("edit")
        setSelectedItem(item)
        setIsDialogOpen(true)
    }

    const handleDialogSubmit = async (name: string) => {
        try {
            setIsSaving(true)
            if (dialogMode === "create") {
                console.log("📝 [DogCategoriesManagementPage] Creating category", { name })
                const { error } = await supabase.from(config.tableName).insert({ name })
                if (error) throw error
                toast({
                    title: `${config.entityLabel} נוצרה`,
                    description: `הקטגוריה "${name}" נוספה בהצלחה.`,
                })
            } else if (dialogMode === "edit" && selectedItem) {
                console.log("📝 [DogCategoriesManagementPage] Updating category", { id: selectedItem.id, name })
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
            console.error("❌ [DogCategoriesManagementPage] Failed saving category", { error })
            toast({
                title: "שגיאה בשמירה",
                description: error instanceof Error ? error.message : "לא ניתן לשמור את הקטגוריה.",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const openDeleteDialog = (item: DogCategoryItem) => {
        setSelectedItem(item)
        setIsDeleteDialogOpen(true)
    }

    const handleDelete = async () => {
        if (!selectedItem) return
        try {
            setIsSaving(true)
            console.log("🗑️ [DogCategoriesManagementPage] Deleting category", { id: selectedItem.id })
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
            console.error("❌ [DogCategoriesManagementPage] Failed deleting category", { error })
            toast({
                title: "שגיאה במחיקה",
                description: error instanceof Error ? error.message : "לא ניתן למחוק את הקטגוריה.",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleInspectDogs = (item: DogCategoryItem) => {
        const params = new URLSearchParams({
            section: "dogs",
            mode: "list",
            category2Id: item.id,
        })
        console.log("🔗 [DogCategoriesManagementPage] Navigating to dogs list with filter", {
            categoryId: item.id,
        })
        navigate(`/manager-screens?${params.toString()}`)
    }

    const handleNavigateToBreeds = (item: DogCategoryItem) => {
        if (item.breedCount === 0) return
        const params = new URLSearchParams({
            section: "settings",
            mode: "breeds",
            category2Id: item.id,
        })
        console.log("🔗 [DogCategoriesManagementPage] Navigating to breeds settings with filter", {
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
                                                {item.breedCount > 0 ? (
                                                    <button
                                                        type="button"
                                                        className="text-indigo-600 hover:underline"
                                                        onClick={() => handleNavigateToBreeds(item)}
                                                    >
                                                        {item.breedCount}
                                                    </button>
                                                ) : (
                                                    0
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right text-gray-700">
                                                {item.dogCount}
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
                                                        onClick={() => handleInspectDogs(item)}
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

            <DogCategoryDialog
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

            <DogCategoryDeleteDialog
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
