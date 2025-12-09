import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Loader2, Edit2, Save, X } from "lucide-react"
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הקטגוריה "${name}"?`)) {
      return
    }

    try {
      await deleteCategory.mutateAsync(id)
      toast({
        title: "הצלחה",
        description: "קטגוריה נמחקה בהצלחה",
      })
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>קטגוריות שירותים</CardTitle>
              <CardDescription>נהל קטגוריות שירותים וצבעים</CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="ml-2 h-4 w-4" />
              קטגוריה חדשה
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם</TableHead>
                  <TableHead className="text-right">ווריאנט צבע</TableHead>
                  <TableHead className="text-right">מספר שירותים</TableHead>
                  <TableHead className="text-left">פעולות</TableHead>
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
                              className="w-full"
                              dir="rtl"
                            />
                          ) : (
                            <div className="flex items-center gap-2 justify-end">
                              <div
                                className={cn(
                                  "h-4 w-4 rounded-full",
                                  variant.bg
                                )}
                              />
                              <span className="font-medium">{category.name}</span>
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
                            <div className="flex items-center gap-2 justify-end">
                              <span className={cn("text-sm", variant.text)}>
                                {variant.name}
                              </span>
                              <div
                                className={cn(
                                  "h-6 w-6 rounded border-2",
                                  variant.bg,
                                  variant.border
                                )}
                              />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm text-gray-600">
                            {category.services_count || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-left">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
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
                            <div className="flex items-center gap-2">
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
                                onClick={() => handleDelete(category.id, category.name)}
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>יצירת קטגוריה חדשה</DialogTitle>
            <DialogDescription>
              הזן שם לקטגוריה ובחר ווריאנט צבע
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם הקטגוריה</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="לדוגמה: תספורות, טיפוח"
              />
            </div>
            <div className="space-y-2">
              <Label>ווריאנט צבע</Label>
              <VariantSelector
                selectedVariant={newVariant}
                onVariantChange={setNewVariant}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              ביטול
            </Button>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface VariantSelectorProps {
  selectedVariant: ServiceCategoryVariant
  onVariantChange: (variant: ServiceCategoryVariant) => void
}

function VariantSelector({ selectedVariant, onVariantChange }: VariantSelectorProps) {
  const selectedVariantConfig = SERVICE_CATEGORY_VARIANTS[selectedVariant]

  return (
    <div className="space-y-3">
      <Select value={selectedVariant} onValueChange={onVariantChange}>
        <SelectTrigger className="w-full">
          <SelectValue>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-4 w-4 rounded-full",
                  selectedVariantConfig.bg
                )}
              />
              <span>{selectedVariantConfig.name}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SERVICE_CATEGORY_VARIANTS_ARRAY.map((variant) => (
            <SelectItem key={variant.id} value={variant.id}>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-4 w-4 rounded-full",
                    variant.bg
                  )}
                />
                <span>{variant.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Preview */}
      <div className="rounded-lg border-2 p-4 space-y-3" style={{ borderColor: `var(--${selectedVariantConfig.ring.replace('ring-', '')})` }}>
        <div className="text-sm font-medium text-gray-700">תצוגה מקדימה:</div>
        <div className="space-y-2">
          <div
            className={cn(
              "rounded-lg px-4 py-3 text-white font-medium",
              selectedVariantConfig.bg
            )}
          >
            כותרת עם רקע צבעוני
          </div>
          <div
            className={cn(
              "rounded-lg px-4 py-3 border-2",
              selectedVariantConfig.bgLight,
              selectedVariantConfig.border,
              selectedVariantConfig.text
            )}
          >
            כותרת עם רקע בהיר
          </div>
          <div
            className={cn(
              "rounded-lg px-4 py-2 border",
              selectedVariantConfig.border,
              selectedVariantConfig.text
            )}
          >
            כותרת עם מסגרת
          </div>
        </div>
      </div>
    </div>
  )
}
