import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Loader2, Edit2, Save, X, Eye } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  useServiceCategoriesWithCounts,
  useCreateServiceCategory,
  useUpdateServiceCategory,
  useDeleteServiceCategory,
  type ServiceCategoryWithServices,
} from "@/hooks/useServiceCategories"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  SERVICE_CATEGORY_VARIANTS,
  SERVICE_CATEGORY_VARIANTS_ARRAY,
  type ServiceCategoryVariant,
} from "@/lib/serviceCategoryVariants"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  const [newName, setNewName] = useState("")
  const [newVariant, setNewVariant] = useState<ServiceCategoryVariant>("blue")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string; servicesCount: number } | null>(null)
  const [makeServicesInvisible, setMakeServicesInvisible] = useState(false)
  const [demoVariant, setDemoVariant] = useState<ServiceCategoryVariant | null>(null)

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
      await createCategory.mutateAsync({
        name: newName.trim(),
        variant: newVariant,
      })
      setIsCreateDialogOpen(false)
      setNewName("")
      setNewVariant("blue")
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
      <Card className="max-w-4xl mx-auto">
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

                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <VariantSelector
                              selectedVariant={editVariant}
                              onVariantChange={setEditVariant}
                            />
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
                                className="h-6 px-2 text-xs shrink-0"
                              >
                                <Eye className="h-3 w-3 ml-1" />
                                צפה בדמו
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm text-gray-600 text-right">
                            {category.services_count || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex items-center gap-2 justify-end">
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
                            <div className="flex items-center gap-2 justify-end">
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
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleCreate} disabled={createCategory.isPending}>
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
          <DialogFooter className="flex-row-reverse gap-2">
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
        <Select value={selectedVariant} onValueChange={onVariantChange} className="flex-1">
          <SelectTrigger className="w-full" dir="rtl">
            <SelectValue>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-right">{selectedVariantConfig.name}</span>
                <div
                  className={cn(
                    "h-4 w-4 rounded-full shrink-0",
                    selectedVariantConfig.bg
                  )}
                />
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent dir="rtl">
            {SERVICE_CATEGORY_VARIANTS_ARRAY.map((variant) => (
              <SelectItem key={variant.id} value={variant.id}>
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-right">{variant.name}</span>
                  <div
                    className={cn(
                      "h-4 w-4 rounded-full shrink-0",
                      variant.bg
                    )}
                  />
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleOpenDemo}
          className="shrink-0"
        >
          <Eye className="h-4 w-4 ml-1" />
          צפה בדמו
        </Button>
      </div>

      <Dialog open={isDemoModalOpen} onOpenChange={setIsDemoModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-right">בחר ווריאנט צבע</DialogTitle>
            <DialogDescription className="text-right">
              בחר ווריאנט צבע וצפה בתצוגה מקדימה
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Variants Grid - 6 per row */}
            <div>
              <Label className="text-base font-medium mb-3 block text-right">ווריאנטים זמינים:</Label>
              <div className="grid grid-cols-6 gap-1.5">
                {SERVICE_CATEGORY_VARIANTS_ARRAY.map((variant) => {
                  const isSelected = tempSelectedVariant === variant.id
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setTempSelectedVariant(variant.id)}
                      className={cn(
                        "p-1 rounded border transition-all hover:scale-105",
                        isSelected
                          ? cn("border-2", variant.border, "ring-1", variant.ring)
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <div
                          className={cn(
                            "h-5 w-5 rounded-full",
                            variant.bg
                          )}
                        />
                        <span className={cn("text-[10px] font-medium text-center leading-tight", variant.text)}>
                          {variant.name}
                        </span>
                        {isSelected && (
                          <div className={cn("text-[9px] leading-tight text-center", variant.text)}>✓</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Preview Section */}
            <div className="space-y-3">
              <Label className="text-base font-medium text-right">תצוגה מקדימה:</Label>
              <div
                className={cn(
                  "rounded-lg border-2 p-4 space-y-3",
                  tempVariantConfig.border
                )}
              >
                <div className="space-y-2">
                  <div
                    className={cn(
                      "rounded-lg px-4 py-3 text-white font-medium text-right",
                      tempVariantConfig.bg
                    )}
                  >
                    כותרת עם רקע צבעוני
                  </div>
                  <div
                    className={cn(
                      "rounded-lg px-4 py-3 border-2 text-right",
                      tempVariantConfig.bgLight,
                      tempVariantConfig.border,
                      tempVariantConfig.text
                    )}
                  >
                    כותרת עם רקע בהיר
                  </div>
                  <div
                    className={cn(
                      "rounded-lg px-4 py-2 border text-right",
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
          <DialogFooter className="flex-row-reverse gap-2 sm:justify-start">
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
    <Dialog open={true} onOpenChange={onClose}>
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
