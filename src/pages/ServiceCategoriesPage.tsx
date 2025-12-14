import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Loader2, Edit2, Save, X, Eye, Star, Pencil } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  useServiceCategoriesWithCounts,
  useCreateServiceCategory,
  useUpdateServiceCategory,
  useDeleteServiceCategory,
  useServicesByCategory,
  type ServiceCategoryWithServices,
} from "@/hooks/useServiceCategories"
import { useServices, useUpdateService, type Service } from "@/hooks/useServices"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  SERVICE_CATEGORY_VARIANTS,
  SERVICE_CATEGORY_VARIANTS_ARRAY,
  type ServiceCategoryVariant,
} from "@/lib/serviceCategoryVariants"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ServiceCategoriesPage() {
  const queryClient = useQueryClient()
  const { data: categories, isLoading } = useServiceCategoriesWithCounts()
  const createCategory = useCreateServiceCategory()
  const updateCategory = useUpdateServiceCategory()
  const deleteCategory = useDeleteServiceCategory()
  const { toast } = useToast()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editVariant, setEditVariant] = useState<ServiceCategoryVariant>("blue")
  const [editIsDefault, setEditIsDefault] = useState(false)
  const [newName, setNewName] = useState("")
  const [newVariant, setNewVariant] = useState<ServiceCategoryVariant>("blue")
  const [newIsDefault, setNewIsDefault] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string; servicesCount: number } | null>(null)
  const [makeServicesInvisible, setMakeServicesInvisible] = useState(false)
  const [demoVariant, setDemoVariant] = useState<ServiceCategoryVariant | null>(null)
  const [servicesModalOpen, setServicesModalOpen] = useState(false)
  const [servicesModalCategory, setServicesModalCategory] = useState<ServiceCategoryWithServices | null>(null)
  const [isEditingServices, setIsEditingServices] = useState(false)
  const [editingVariantCategoryId, setEditingVariantCategoryId] = useState<string | null>(null)
  const [tempVariant, setTempVariant] = useState<ServiceCategoryVariant | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({
        title: "שגיאה",
        description: "נא להזין שם לקטגוריה",
        variant: "destructive",
      })
      return
    }

    try {
      // If setting as default, unset all other defaults first
      if (newIsDefault) {
        await supabase
          .from("service_categories")
          .update({ is_default: false })
      }

      await createCategory.mutateAsync({
        name: newName.trim(),
        variant: newVariant,
        is_default: newIsDefault,
      })
      setIsCreateDialogOpen(false)
      setNewName("")
      setNewVariant("blue")
      setNewIsDefault(false)
      toast({
        title: "הצלחה",
        description: "קטגוריה נוצרה בהצלחה",
      })
    } catch (error) {
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ניתן ליצור קטגוריה",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (category: ServiceCategoryWithServices) => {
    setEditingId(category.id)
    setEditName(category.name)
    setEditVariant(category.variant)
    setEditIsDefault(category.is_default || false)
  }

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) {
      toast({
        title: "שגיאה",
        description: "נא להזין שם לקטגוריה",
        variant: "destructive",
      })
      return
    }

    try {
      await updateCategory.mutateAsync({
        categoryId: id,
        name: editName.trim(),
        variant: editVariant,
        is_default: editIsDefault,
      })
      setEditingId(null)
      toast({
        title: "הצלחה",
        description: "קטגוריה עודכנה בהצלחה",
      })
    } catch (error) {
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ניתן לעדכן קטגוריה",
        variant: "destructive",
      })
    }
  }

  const handleDeleteClick = (category: ServiceCategoryWithServices) => {
    setCategoryToDelete({
      id: category.id,
      name: category.name,
      servicesCount: category.services_count || 0,
    })
    setMakeServicesInvisible(false)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return

    try {
      // If user wants to make services invisible, update them first
      if (makeServicesInvisible && categoryToDelete.servicesCount > 0) {
        const { data: services } = await supabase
          .from("services")
          .select("id")
          .eq("service_category_id", categoryToDelete.id)

        if (services && services.length > 0) {
          await supabase
            .from("services")
            .update({ is_active: false })
            .in("id", services.map((s) => s.id))
        }
      }

      await deleteCategory.mutateAsync(categoryToDelete.id)

      // Invalidate services query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["services"] })

      toast({
        title: "הצלחה",
        description: "קטגוריה נמחקה בהצלחה",
      })
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
      setMakeServicesInvisible(false)
    } catch (error) {
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ניתן למחוק קטגוריה",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="max-w-7xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">

            <div className="text-right">
              <CardTitle>קטגוריות שירותים</CardTitle>
              <CardDescription>נהל קטגוריות שירותים וצבעים</CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="ml-2 h-4 w-4" />
              קטגוריה חדשה
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם</TableHead>
                  <TableHead className="text-right">ווריאנט צבע</TableHead>
                  <TableHead className="text-right">מספר שירותים</TableHead>
                  <TableHead className="text-right">האם ברירת מחדל</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories && categories.length > 0 ? (
                  categories.map((category) => {
                    const variant = SERVICE_CATEGORY_VARIANTS[category.variant]
                    const isEditing = editingId === category.id

                    return (
                      <TableRow key={category.id}>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full text-right"
                              dir="rtl"
                            />
                          ) : (
                            <div className="flex items-center gap-2 justify-start">
                              <div
                                className={cn(
                                  "h-4 w-4 rounded-full shrink-0",
                                  variant.bg
                                )}
                              />
                              <span className="font-medium text-right">{category.name}</span>
                              {category.is_default && (
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 mr-1" />
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="space-y-3">
                              <VariantSelector
                                selectedVariant={editVariant}
                                onVariantChange={setEditVariant}
                              />
                              <div className="flex items-center space-x-2 space-x-reverse">
                                <Checkbox
                                  id={`is-default-${category.id}`}
                                  checked={editIsDefault}
                                  onCheckedChange={(checked) => setEditIsDefault(checked as boolean)}
                                />
                                <Label
                                  htmlFor={`is-default-${category.id}`}
                                  className="text-sm font-normal cursor-pointer text-right"
                                >
                                  קטגוריה ברירת מחדל
                                </Label>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 justify-start">
                              <div
                                className={cn(
                                  "h-6 w-6 rounded border-2 shrink-0",
                                  variant.bg,
                                  variant.border
                                )}
                              />
                              <span className={cn("text-sm text-right", variant.text)}>
                                {variant.name}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setDemoVariant(category.variant)}
                                className="h-6 w-6 p-0 shrink-0"
                                title="צפה בדמו"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingVariantCategoryId(category.id)
                                  setTempVariant(category.variant)
                                }}
                                className="h-6 w-6 p-0 shrink-0"
                                title="ערוך ווריאנט"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2 ">
                            <span className="text-sm text-gray-600 text-right">
                              {category.services_count || 0}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setServicesModalCategory(category)
                                setIsEditingServices(false)
                                setServicesModalOpen(true)
                              }}
                              className="h-6 w-6 p-0"
                              title="צפה בשירותים"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setServicesModalCategory(category)
                                setIsEditingServices(true)
                                setServicesModalOpen(true)
                              }}
                              className="h-6 w-6 p-0"
                              title="נהל שירותים"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={async () => {
                                const newIsDefault = !category.is_default

                                // Optimistic update
                                queryClient.setQueryData<ServiceCategoryWithServices[]>(
                                  ["service-categories-with-counts"],
                                  (old) => {
                                    if (!old) return old
                                    return old.map((cat) => ({
                                      ...cat,
                                      is_default: cat.id === category.id ? newIsDefault : false,
                                    }))
                                  }
                                )

                                // Perform the actual update
                                try {
                                  await updateCategory.mutateAsync({
                                    categoryId: category.id,
                                    is_default: newIsDefault,
                                  })
                                } catch {
                                  // Revert on error
                                  queryClient.invalidateQueries({ queryKey: ["service-categories-with-counts"] })
                                  toast({
                                    title: "שגיאה",
                                    description: "לא ניתן לעדכן את ברירת המחדל",
                                    variant: "destructive",
                                  })
                                }
                              }}
                              className="p-0.5 hover:opacity-70 transition-opacity"
                              title={category.is_default ? "הסר מברירת מחדל" : "הפוך לברירת מחדל"}
                            >
                              <Star
                                className={cn(
                                  "h-4 w-4",
                                  category.is_default
                                    ? "text-yellow-500 fill-yellow-500"
                                    : "text-gray-300"
                                )}
                              />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex items-center gap-2  ">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSaveEdit(category.id)}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 ">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(category)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteClick(category)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                      אין קטגוריות. צור קטגוריה חדשה כדי להתחיל.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-right">יצירת קטגוריה חדשה</DialogTitle>
            <DialogDescription className="text-right">
              הזן שם לקטגוריה ובחר ווריאנט צבע
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-right">שם הקטגוריה</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="לדוגמה: תספורות, טיפוח"
                className="text-right"
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-right">ווריאנט צבע</Label>
              <VariantSelector
                selectedVariant={newVariant}
                onVariantChange={setNewVariant}
              />
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2 sm:justify-start">
            <Button
              onClick={handleCreate}
              disabled={createCategory.isPending || !newName.trim() || !newVariant}
            >
              {createCategory.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  יוצר...
                </>
              ) : (
                "צור"
              )}
            </Button>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-right">מחיקת קטגוריה</DialogTitle>
            <DialogDescription className="text-right">
              האם אתה בטוח שברצונך למחוק את הקטגוריה "{categoryToDelete?.name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {categoryToDelete && categoryToDelete.servicesCount > 0 && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600 text-right">
                  לקטגוריה זו יש {categoryToDelete.servicesCount} שירות{categoryToDelete.servicesCount > 1 ? "ים" : ""} משויכים.
                </div>
                <div className="flex items-center space-x-2 space-x-reverse pt-2">
                  <Checkbox
                    id="make-invisible"
                    checked={makeServicesInvisible}
                    onCheckedChange={(checked) => setMakeServicesInvisible(checked as boolean)}
                  />
                  <Label
                    htmlFor="make-invisible"
                    className="text-sm font-normal cursor-pointer text-right"
                  >
                    הסתר את כל השירותים בקטגוריה זו מלקוחות
                  </Label>
                </div>
                {!makeServicesInvisible && (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2 text-right">
                    שירותים יישארו גלויים ללקוחות אך ללא קטגוריה
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-row-reverse gap-2 sm:justify-start">
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteCategory.isPending}>
              {deleteCategory.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מוחק...
                </>
              ) : (
                "מחק"
              )}
            </Button>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Demo Modal for Viewing Variant */}
      {demoVariant && (
        <VariantDemoModal
          variant={demoVariant}
          onClose={() => setDemoVariant(null)}
        />
      )}

      {/* Edit Variant Modal */}
      {editingVariantCategoryId && tempVariant !== null && (
        <EditVariantModal
          currentVariant={tempVariant}
          onSave={async (newVariant) => {
            try {
              await updateCategory.mutateAsync({
                categoryId: editingVariantCategoryId,
                variant: newVariant,
              })
              setEditingVariantCategoryId(null)
              setTempVariant(null)
              toast({
                title: "הצלחה",
                description: "ווריאנט הצבע עודכן בהצלחה",
              })
            } catch (error) {
              toast({
                title: "שגיאה",
                description: error instanceof Error ? error.message : "לא ניתן לעדכן את ווריאנט הצבע",
                variant: "destructive",
              })
            }
          }}
          onClose={() => {
            setEditingVariantCategoryId(null)
            setTempVariant(null)
          }}
        />
      )}

      {/* Services Modal */}
      {servicesModalCategory && (
        <CategoryServicesModal
          category={servicesModalCategory}
          isOpen={servicesModalOpen}
          isEditing={isEditingServices}
          onClose={() => {
            setServicesModalOpen(false)
            setServicesModalCategory(null)
            setIsEditingServices(false)
          }}
        />
      )}
    </div>
  )
}

interface VariantSelectorProps {
  selectedVariant: ServiceCategoryVariant
  onVariantChange: (variant: ServiceCategoryVariant) => void
}

function VariantSelector({ selectedVariant, onVariantChange }: VariantSelectorProps) {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)
  const [tempSelectedVariant, setTempSelectedVariant] = useState<ServiceCategoryVariant>(selectedVariant)
  const selectedVariantConfig = SERVICE_CATEGORY_VARIANTS[selectedVariant]

  const handleOpenDemo = () => {
    setTempSelectedVariant(selectedVariant)
    setIsDemoModalOpen(true)
  }

  const handleChooseVariant = () => {
    onVariantChange(tempSelectedVariant)
    setIsDemoModalOpen(false)
  }

  const handleCancelDemo = () => {
    setTempSelectedVariant(selectedVariant)
    setIsDemoModalOpen(false)
  }

  const tempVariantConfig = SERVICE_CATEGORY_VARIANTS[tempSelectedVariant]

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 justify-start ">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenDemo}
            className="shrink-0"
          >
            <Eye className="h-4 w-4 ml-1" />
            בחר צבע
          </Button>
          {/* Small color circle to show current color - right next to text */}
          <div
            className={cn(
              "h-5 w-5 rounded-full border border-gray-300 shrink-0",
              selectedVariantConfig.bg
            )}
            title={selectedVariantConfig.name}
          />
          <span>{selectedVariantConfig.name}</span>
          {/* Choose color button - close to text */}

        </div>
      </div>

      <Dialog open={isDemoModalOpen} onOpenChange={setIsDemoModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-right text-lg">בחר ווריאנט צבע</DialogTitle>
            <DialogDescription className="text-right text-sm">
              בחר ווריאנט צבע וצפה בתצוגה מקדימה
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            {/* Selected Variant Indicator */}
            {tempVariantConfig && (
              <div className="flex items-center justify-end gap-2 pb-2 border-b">
                <span className="text-xs text-gray-600">נבחר:</span>
                <div className={cn("h-4 w-4 rounded-full", tempVariantConfig.bg)} />
                <span className={cn("text-sm font-medium", tempVariantConfig.text)}>
                  {tempVariantConfig.name}
                </span>
              </div>
            )}
            {/* Variants Grid - Numbered grid, 10 per row */}
            <div className="grid grid-cols-10 gap-1 max-h-[30vh] overflow-y-auto pr-2">
              <TooltipProvider>
                {SERVICE_CATEGORY_VARIANTS_ARRAY.map((variant, index) => {
                  const row = Math.floor(index / 10) + 1
                  const col = (index % 10) + 1
                  const position = `${row},${col}`
                  const isSelected = tempSelectedVariant === variant.id
                  return (
                    <Tooltip key={variant.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setTempSelectedVariant(variant.id)}
                          className={cn(
                            "relative p-1 rounded border transition-all hover:scale-110 aspect-square",
                            isSelected
                              ? cn("border-2", variant.border, "ring-1", variant.ring)
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <div className="flex flex-col items-center justify-center h-full">
                            <div
                              className={cn(
                                "h-5 w-5 rounded-full mb-0.5",
                                variant.bg
                              )}
                            />
                            <span className="text-[9px] font-mono text-gray-500 leading-none">
                              {position}
                            </span>
                            {isSelected && (
                              <div className={cn("absolute top-0.5 right-0.5 text-[10px] leading-none", variant.text)}>✓</div>
                            )}
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="font-medium">{variant.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </TooltipProvider>
            </div>

            {/* Preview Section - Compact */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs font-medium text-right text-gray-600">תצוגה מקדימה:</Label>
              <div
                className={cn(
                  "rounded-lg border-2 p-2 space-y-2",
                  tempVariantConfig.border
                )}
              >
                <div className="space-y-1.5">
                  <div
                    className={cn(
                      "rounded px-2 py-1.5 text-white text-xs font-medium text-right",
                      tempVariantConfig.bg
                    )}
                  >
                    כותרת עם רקע צבעוני
                  </div>
                  <div
                    className={cn(
                      "rounded px-2 py-1.5 border-2 text-xs text-right",
                      tempVariantConfig.bgLight,
                      tempVariantConfig.border,
                      tempVariantConfig.text
                    )}
                  >
                    כותרת עם רקע בהיר
                  </div>
                  <div
                    className={cn(
                      "rounded px-2 py-1 border text-xs text-right",
                      tempVariantConfig.border,
                      tempVariantConfig.text
                    )}
                  >
                    כותרת עם מסגרת
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2 sm:justify-end">
            <Button onClick={handleChooseVariant}>
              בחר
            </Button>
            <Button variant="outline" onClick={handleCancelDemo}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface VariantDemoModalProps {
  variant: ServiceCategoryVariant
  onClose: () => void
}

function VariantDemoModal({ variant, onClose }: VariantDemoModalProps) {
  const variantConfig = SERVICE_CATEGORY_VARIANTS[variant]

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="text-right">תצוגה מקדימה: {variantConfig.name}</DialogTitle>
          <DialogDescription className="text-right">
            כך ייראה הווריאנט "{variantConfig.name}" בשימוש
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label className="text-base font-medium text-right">תצוגה מקדימה:</Label>
            <div
              className={cn(
                "rounded-lg border-2 p-4 space-y-3",
                variantConfig.border
              )}
            >
              <div className="space-y-2">
                <div
                  className={cn(
                    "rounded-lg px-4 py-3 text-white font-medium text-right",
                    variantConfig.bg
                  )}
                >
                  כותרת עם רקע צבעוני
                </div>
                <div
                  className={cn(
                    "rounded-lg px-4 py-3 border-2 text-right",
                    variantConfig.bgLight,
                    variantConfig.border,
                    variantConfig.text
                  )}
                >
                  כותרת עם רקע בהיר
                </div>
                <div
                  className={cn(
                    "rounded-lg px-4 py-2 border text-right",
                    variantConfig.border,
                    variantConfig.text
                  )}
                >
                  כותרת עם מסגרת
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-row-reverse gap-2">
          <Button onClick={onClose}>
            סגור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CategoryServicesModalProps {
  category: ServiceCategoryWithServices
  isOpen: boolean
  isEditing: boolean
  onClose: () => void
}

interface EditVariantModalProps {
  currentVariant: ServiceCategoryVariant
  onSave: (variant: ServiceCategoryVariant) => Promise<void>
  onClose: () => void
}

function EditVariantModal({ currentVariant, onSave, onClose }: EditVariantModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<ServiceCategoryVariant>(currentVariant)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (selectedVariant === currentVariant) {
      onClose()
      return
    }

    setIsSaving(true)
    try {
      await onSave(selectedVariant)
    } finally {
      setIsSaving(false)
    }
  }

  const selectedVariantConfig = SERVICE_CATEGORY_VARIANTS[selectedVariant]

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="text-right text-lg">ערוך ווריאנט צבע</DialogTitle>
          <DialogDescription className="text-right text-sm">
            בחר ווריאנט צבע חדש וצפה בתצוגה מקדימה
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-3">
          {/* Selected Variant Indicator */}
          {selectedVariantConfig && (
            <div className="flex items-center  gap-2 pb-2 border-b">
              <span className="text-xs text-gray-600">נבחר:</span>
              <div className={cn("h-4 w-4 rounded-full", selectedVariantConfig.bg)} />
              <span className={cn("text-sm font-medium", selectedVariantConfig.text)}>
                {selectedVariantConfig.name}
              </span>
            </div>
          )}
          {/* Variants Grid - Numbered grid, 10 per row */}
          <div className="grid grid-cols-10 gap-1 max-h-[25vh] overflow-y-auto pr-2">
            <TooltipProvider>
              {SERVICE_CATEGORY_VARIANTS_ARRAY.map((variant, index) => {
                const row = Math.floor(index / 10) + 1
                const col = (index % 10) + 1
                const position = `${row},${col}`
                const isSelected = selectedVariant === variant.id
                return (
                  <Tooltip key={variant.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setSelectedVariant(variant.id)}
                        className={cn(
                          "relative p-1 rounded border transition-all hover:scale-110 aspect-square",
                          isSelected
                            ? cn("border-2", variant.border, "ring-1", variant.ring)
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <div className="flex flex-col items-center justify-center h-full">
                          <div
                            className={cn(
                              "h-5 w-5 rounded-full mb-0.5",
                              variant.bg
                            )}
                          />
                          <span className="text-[9px] font-mono text-gray-500 leading-none">
                            {position}
                          </span>
                          {isSelected && (
                            <div className={cn("absolute top-0.5 right-0.5 text-[10px] leading-none", variant.text)}>✓</div>
                          )}
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="font-medium">{variant.name}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </TooltipProvider>
          </div>

          {/* Preview Section - Compact */}
          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs font-medium text-right text-gray-600">תצוגה מקדימה:</Label>
            <div
              className={cn(
                "rounded-lg border-2 p-2 space-y-2",
                selectedVariantConfig.border
              )}
            >
              <div className="space-y-1.5">
                <div
                  className={cn(
                    "rounded px-2 py-1.5 text-white text-xs font-medium text-right",
                    selectedVariantConfig.bg
                  )}
                >
                  כותרת עם רקע צבעוני
                </div>
                <div
                  className={cn(
                    "rounded px-2 py-1.5 border-2 text-xs text-right",
                    selectedVariantConfig.bgLight,
                    selectedVariantConfig.border,
                    selectedVariantConfig.text
                  )}
                >
                  כותרת עם רקע בהיר
                </div>
                <div
                  className={cn(
                    "rounded px-2 py-1 border text-xs text-right",
                    selectedVariantConfig.border,
                    selectedVariantConfig.text
                  )}
                >
                  כותרת עם מסגרת
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-row-reverse gap-2 sm:justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                שומר...
              </>
            ) : (
              "שמור"
            )}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoryServicesModal({ category, isOpen, isEditing, onClose }: CategoryServicesModalProps) {
  const { data: servicesInCategory = [], isLoading } = useServicesByCategory(category.id)
  const { data: allServices = [] } = useServices()
  const updateService = useUpdateService()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set())

  // Initialize selected services when modal opens
  useEffect(() => {
    if (isOpen && isEditing) {
      const linkedServiceIds = new Set<string>(servicesInCategory.map((s: { id: string }) => s.id))
      setSelectedServiceIds(linkedServiceIds)
    }
  }, [isOpen, isEditing, servicesInCategory])

  const handleToggleService = (serviceId: string) => {
    if (!isEditing) return

    const newSelected = new Set(selectedServiceIds)
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId)
    } else {
      newSelected.add(serviceId)
    }
    setSelectedServiceIds(newSelected)
  }

  const handleSaveLinks = async () => {
    try {
      // Get current linked services
      const currentLinkedIds = new Set<string>(servicesInCategory.map((s: { id: string }) => s.id))

      // Find services to link (in selected but not currently linked)
      const toLink = Array.from(selectedServiceIds).filter(id => !currentLinkedIds.has(id))

      // Find services to unlink (currently linked but not in selected)
      const toUnlink = Array.from(currentLinkedIds).filter(id => !selectedServiceIds.has(id))

      // Link services
      for (const serviceId of toLink) {
        await updateService.mutateAsync({
          serviceId,
          service_category_id: category.id,
        })
      }

      // Unlink services
      for (const serviceId of toUnlink) {
        await updateService.mutateAsync({
          serviceId,
          service_category_id: null,
        })
      }

      // Invalidate all relevant queries to refresh counts
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["services"] }),
        queryClient.invalidateQueries({ queryKey: ["service-categories-with-counts"] }),
        queryClient.invalidateQueries({ queryKey: ["services-by-category", category.id] }),
      ])

      toast({
        title: "הצלחה",
        description: "קישורי השירותים עודכנו בהצלחה",
      })
      onClose()
    } catch (error) {
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ניתן לעדכן את קישורי השירותים",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose()
    }}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="text-right">
            {isEditing ? "נהל שירותים בקטגוריה" : "שירותים בקטגוריה"}: {category.name}
          </DialogTitle>
          <DialogDescription className="text-right">
            {isEditing
              ? "בחר את השירותים שתרצה לקשר לקטגוריה זו"
              : `לקטגוריה זו יש ${servicesInCategory.length} שירות${servicesInCategory.length !== 1 ? "ים" : ""} משויכים`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : isEditing ? (
            <div className="space-y-2">
              <Label className="text-right">בחר שירותים:</Label>
              <div className="max-h-[400px] overflow-y-auto border rounded-lg p-2">
                {allServices.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">אין שירותים במערכת</div>
                ) : (
                  <div className="space-y-2">
                    {allServices.map((service: Service) => {
                      const isSelected = selectedServiceIds.has(service.id)
                      const isCurrentlyLinked = servicesInCategory.some((s: { id: string }) => s.id === service.id)

                      return (
                        <div
                          key={service.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-gray-50 transition-colors",
                            isSelected && "bg-blue-50 border-blue-200"
                          )}
                          onClick={() => handleToggleService(service.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleService(service.id)}
                          />
                          <span className="flex-1 text-right">{service.name}</span>
                          {isCurrentlyLinked && !isSelected && (
                            <span className="text-xs text-amber-600">(יוסר)</span>
                          )}
                          {!isCurrentlyLinked && isSelected && (
                            <span className="text-xs text-green-600">(יוסף)</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {servicesInCategory.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  אין שירותים משויכים לקטגוריה זו
                </div>
              ) : (
                <div className="space-y-2">
                  {servicesInCategory.map((service: { id: string; name: string; is_active?: boolean }) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <span className="text-right font-medium">{service.name}</span>
                      <Badge variant={service.is_active ? "default" : "secondary"}>
                        {service.is_active ? "פעיל" : "לא פעיל"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="flex-row-reverse gap-2 sm:justify-start">
          {isEditing ? (
            <>
              <Button onClick={handleSaveLinks} disabled={updateService.isPending}>
                {updateService.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    שומר...
                  </>
                ) : (
                  "שמור שינויים"
                )}
              </Button>
              <Button variant="outline" onClick={onClose}>
                ביטול
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>
              סגור
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
