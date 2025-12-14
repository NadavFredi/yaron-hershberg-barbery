import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, Loader2, Tag, Package, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAppDispatch } from "@/store/hooks"
import { supabaseApi } from "@/store/services/supabaseApi"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BrandProductsModal } from "@/components/dialogs/settings/products/BrandProductsModal"

interface Brand {
    id: string
    name: string
    created_at: string
    updated_at: string
}

interface Product {
    id: string
    name: string
    brand_id: string | null
}

export default function BrandsSection() {
    const { toast } = useToast()
    const dispatch = useAppDispatch()
    const [brands, setBrands] = useState<Brand[]>([])
    const [products, setProducts] = useState<Record<string, Product[]>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
    const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [brandName, setBrandName] = useState("")
    const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set())
    const [isBrandProductsModalOpen, setIsBrandProductsModalOpen] = useState(false)
    const [selectedBrandForProducts, setSelectedBrandForProducts] = useState<Brand | null>(null)

    useEffect(() => {
        fetchBrands()
        fetchProducts()
    }, [])

    const fetchBrands = async () => {
        try {
            const { data, error } = await supabase
                .from("brands")
                .select("*")
                .order("name", { ascending: true })

            if (error) throw error
            setBrands(data || [])
        } catch (error) {
            console.error("Error fetching brands:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את המותגים",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from("products")
                .select("id, name, brand_id")
                .not("brand_id", "is", null)

            if (error) throw error

            // Group products by brand_id
            const productsByBrand: Record<string, Product[]> = {}
            ;(data || []).forEach((product) => {
                if (product.brand_id) {
                    if (!productsByBrand[product.brand_id]) {
                        productsByBrand[product.brand_id] = []
                    }
                    productsByBrand[product.brand_id].push(product)
                }
            })

            setProducts(productsByBrand)
        } catch (error) {
            console.error("Error fetching products:", error)
        }
    }

    const handleAdd = () => {
        setEditingBrand(null)
        setBrandName("")
        setIsEditDialogOpen(true)
    }

    const handleEdit = (brand: Brand) => {
        setEditingBrand(brand)
        setBrandName(brand.name)
        setIsEditDialogOpen(true)
    }

    const handleDelete = (brand: Brand) => {
        setBrandToDelete(brand)
        setIsDeleteDialogOpen(true)
    }

    const handleSave = async () => {
        if (!brandName.trim()) {
            toast({
                title: "שגיאה",
                description: "שם המותג נדרש",
                variant: "destructive",
            })
            return
        }

        setIsSaving(true)
        try {
            if (editingBrand) {
                // Update existing brand
                const { error } = await supabase
                    .from("brands")
                    .update({ name: brandName.trim() })
                    .eq("id", editingBrand.id)

                if (error) throw error

                toast({
                    title: "הצלחה",
                    description: "המותג עודכן בהצלחה",
                })
            } else {
                // Create new brand
                const { error } = await supabase
                    .from("brands")
                    .insert({ name: brandName.trim() })

                if (error) throw error

                toast({
                    title: "הצלחה",
                    description: "המותג נוצר בהצלחה",
                })
            }

            setIsEditDialogOpen(false)
            setEditingBrand(null)
            setBrandName("")
            await fetchBrands()
            await fetchProducts()
            dispatch(supabaseApi.util.invalidateTags(["Brands", "Products"]))
        } catch (error: any) {
            console.error("Error saving brand:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן לשמור את המותג",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteConfirm = async () => {
        if (!brandToDelete) return

        // Check if brand has products
        const brandProducts = products[brandToDelete.id] || []
        if (brandProducts.length > 0) {
            toast({
                title: "לא ניתן למחוק",
                description: `לא ניתן למחוק מותג עם ${brandProducts.length} מוצרים קשורים. אנא הסר את המותג מכל המוצרים תחילה.`,
                variant: "destructive",
            })
            return
        }

        setIsDeleting(true)
        try {
            const { error } = await supabase
                .from("brands")
                .delete()
                .eq("id", brandToDelete.id)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "המותג נמחק בהצלחה",
            })

            setIsDeleteDialogOpen(false)
            setBrandToDelete(null)
            await fetchBrands()
            await fetchProducts()
            dispatch(supabaseApi.util.invalidateTags(["Brands"]))
        } catch (error: any) {
            console.error("Error deleting brand:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן למחוק את המותג",
                variant: "destructive",
            })
        } finally {
            setIsDeleting(false)
        }
    }

    const toggleBrandExpansion = (brandId: string) => {
        setExpandedBrands((prev) => {
            const next = new Set(prev)
            if (next.has(brandId)) {
                next.delete(brandId)
            } else {
                next.add(brandId)
            }
            return next
        })
    }

    const handleViewBrandProducts = (brand: Brand) => {
        setSelectedBrandForProducts(brand)
        setIsBrandProductsModalOpen(true)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mr-2">טוען מותגים...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">ניהול מותגים</h2>
                    <p className="text-gray-600 mt-1">נהל את המותגים במערכת וצפה במוצרים שלהם</p>
                </div>
                <Button onClick={handleAdd} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    הוסף מותג חדש
                </Button>
            </div>

            {/* Brands Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Tag className="h-5 w-5" />
                        רשימת מותגים ({brands.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {brands.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            אין מותגים במערכת
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right">שם המותג</TableHead>
                                        <TableHead className="text-right">מספר מוצרים</TableHead>
                                        <TableHead className="text-right">מוצרים</TableHead>
                                        <TableHead className="text-right">פעולות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {brands.map((brand) => {
                                        const brandProducts = products[brand.id] || []
                                        const isExpanded = expandedBrands.has(brand.id)

                                        return (
                                            <React.Fragment key={brand.id}>
                                                <TableRow>
                                                    <TableCell className="font-medium text-right">
                                                        {brand.name}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                                                            {brandProducts.length}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {brandProducts.length > 0 ? (
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleViewBrandProducts(brand)}
                                                                    className="text-xs"
                                                                >
                                                                    <Eye className="h-3 w-3 ml-1" />
                                                                    הצג מוצרים
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => toggleBrandExpansion(brand.id)}
                                                                    className="text-xs"
                                                                >
                                                                    {isExpanded ? "הסתר" : "הצג"} תצוגה מהירה
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">אין מוצרים</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1 justify-end">
                                                            <Button variant="ghost" size="sm" onClick={() => handleEdit(brand)} title="ערוך">
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(brand)} title="מחק">
                                                                <Trash2 className="h-4 w-4 text-red-600" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && brandProducts.length > 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="bg-gray-50">
                                                            <div className="space-y-2 py-2">
                                                                <div className="text-sm font-medium text-gray-700 mb-2">
                                                                    <Package className="h-4 w-4 inline ml-1" />
                                                                    מוצרים במותג זה:
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {brandProducts.map((product) => (
                                                                        <Badge key={product.id} variant="secondary" className="text-xs">
                                                                            {product.name}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} dir="rtl">
                <DialogContent className="max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right">
                            {editingBrand ? "ערוך מותג" : "הוסף מותג חדש"}
                        </DialogTitle>
                        <DialogDescription className="text-right">
                            {editingBrand ? "עדכן את שם המותג" : "הוסף מותג חדש למערכת"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="brand-name" className="text-right">
                                שם המותג <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="brand-name"
                                value={brandName}
                                onChange={(e) => setBrandName(e.target.value)}
                                placeholder="הכנס שם מותג"
                                className="text-right"
                                dir="rtl"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault()
                                        handleSave()
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsEditDialogOpen(false)
                                setEditingBrand(null)
                                setBrandName("")
                            }}
                            disabled={isSaving}
                        >
                            ביטול
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                            {editingBrand ? "שמור שינויים" : "צור מותג"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} dir="rtl">
                <DialogContent className="max-w-sm" dir="rtl">
                    <DialogHeader className="text-right">
                        <DialogTitle className="text-right">מחק מותג?</DialogTitle>
                        <DialogDescription className="text-right">
                            האם אתה בטוח שברצונך למחוק את המותג "{brandToDelete?.name}"?
                            <br />
                            <br />
                            פעולה זו תמחק את המותג לצמיתות ולא ניתנת לביטול.
                            {brandToDelete && products[brandToDelete.id]?.length > 0 && (
                                <>
                                    <br />
                                    <br />
                                    <span className="text-amber-600 font-semibold">
                                        אזהרה: למותג זה יש {products[brandToDelete.id].length} מוצרים קשורים.
                                    </span>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(false)}
                            disabled={isDeleting}
                        >
                            ביטול
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                        >
                            {isDeleting && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                            <Trash2 className="h-4 w-4 ml-2" />
                            מחק
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Brand Products Modal */}
            <BrandProductsModal
                open={isBrandProductsModalOpen}
                onOpenChange={setIsBrandProductsModalOpen}
                brand={selectedBrandForProducts}
            />
        </div>
    )
}

