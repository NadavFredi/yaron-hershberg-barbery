import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, Loader2, Package } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAppDispatch } from "@/store/hooks"
import { supabaseApi } from "@/store/services/supabaseApi"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ProductEditDialog } from "@/components/dialogs/settings/products/ProductEditDialog"
import { DeleteProductDialog } from "@/components/dialogs/settings/products/DeleteProductDialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X } from "lucide-react"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"

interface Product {
    id: string
    name: string
    brand_id: string | null
    brand?: { id: string; name: string } | null
    category: string | null
    stock_quantity: number | null
    cost_price: number | null
    bundle_price: number | null
    retail_price: number | null
    created_at: string
    updated_at: string
}

interface Brand {
    id: string
    name: string
}

interface SettingsProductsSectionProps {
    initialBrandId?: string | null
    hideHeader?: boolean
    hideBrandFilter?: boolean
    onProductsChange?: () => void
}

export function SettingsProductsSection({
    initialBrandId = null,
    hideHeader = false,
    hideBrandFilter = false,
    onProductsChange,
}: SettingsProductsSectionProps = {}) {
    const { toast } = useToast()
    const dispatch = useAppDispatch()
    const [products, setProducts] = useState<Product[]>([])
    const [brands, setBrands] = useState<Brand[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [productToDelete, setProductToDelete] = useState<Product | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 50

    // Filter state
    const [filters, setFilters] = useState({
        brandId: initialBrandId as string | null,
        category: null as string | null,
        searchQuery: "" as string,
    })

    useEffect(() => {
        fetchProducts()
        fetchBrands()
    }, [])

    // Update brand filter when initialBrandId changes
    useEffect(() => {
        if (initialBrandId !== undefined) {
            setFilters(prev => ({ ...prev, brandId: initialBrandId }))
        }
    }, [initialBrandId])

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
        }
    }

    const fetchProducts = async () => {
        try {
            setIsLoading(true)
            const { data, error } = await supabase
                .from("products")
                .select(`
                    *,
                    brand:brands!products_brand_id_fkey(id, name)
                `)
                .order("name", { ascending: true })

            if (error) throw error

            const productsWithBrands = (data || []).map((product: any) => ({
                ...product,
                brand: product.brand || null,
            }))

            setProducts(productsWithBrands)
        } catch (error) {
            console.error("Error fetching products:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את המוצרים",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleAdd = () => {
        setEditingProduct(null)
        setIsEditDialogOpen(true)
    }

    const handleEdit = (product: Product) => {
        setEditingProduct(product)
        setIsEditDialogOpen(true)
    }

    const handleDelete = (product: Product) => {
        setProductToDelete(product)
        setIsDeleteDialogOpen(true)
    }

    const handleSaved = async () => {
        setIsEditDialogOpen(false)
        setEditingProduct(null)
        await fetchProducts()
        await fetchBrands() // Also refresh brands in case a new one was created
        dispatch(supabaseApi.util.invalidateTags(["Products"]))
        onProductsChange?.()
    }

    const handleDeleted = async () => {
        setIsDeleteDialogOpen(false)
        setProductToDelete(null)
        await fetchProducts()
        dispatch(supabaseApi.util.invalidateTags(["Products"]))
        onProductsChange?.()
    }

    const filteredProducts = useMemo(() => {
        let filtered = [...products]

        // Filter by brand
        if (filters.brandId) {
            filtered = filtered.filter(p => p.brand_id === filters.brandId)
        }

        // Filter by category
        if (filters.category) {
            filtered = filtered.filter(p => p.category === filters.category)
        }

        // Filter by search query
        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase()
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.brand?.name.toLowerCase().includes(query) ||
                p.category?.toLowerCase().includes(query)
            )
        }

        return filtered
    }, [products, filters])

    // Get unique categories from products
    const categories = useMemo(() => {
        const cats = new Set<string>()
        products.forEach(p => {
            if (p.category) {
                cats.add(p.category)
            }
        })
        return Array.from(cats).sort()
    }, [products])

    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        const end = start + ITEMS_PER_PAGE
        return filteredProducts.slice(start, end)
    }, [filteredProducts, currentPage])

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)

    const hasActiveFilters = filters.brandId !== null ||
        filters.category !== null ||
        filters.searchQuery !== ""

    const clearFilters = () => {
        setFilters({
            brandId: null,
            category: null,
            searchQuery: "",
        })
        setCurrentPage(1)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mr-2">טוען מוצרים...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {!hideHeader && (
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">ניהול מוצרים</h2>
                        <p className="text-gray-600 mt-1">נהל את המלאי, המותגים והמוצרים במערכת</p>
                    </div>
                    <Button onClick={handleAdd} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        הוסף מוצר חדש
                    </Button>
                </div>
            )}

            {/* Filters Section */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">סינון מוצרים</CardTitle>
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="text-xs"
                            >
                                <X className="h-3 w-3 ml-1" />
                                נקה סינון
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4 items-end">
                        {/* Search Filter */}
                        <div className="space-y-2 min-w-[200px] flex-1">
                            <Label className="text-sm">חיפוש</Label>
                            <Input
                                placeholder="חפש לפי שם, מותג או קטגוריה..."
                                value={filters.searchQuery}
                                onChange={(e) => {
                                    setFilters(prev => ({ ...prev, searchQuery: e.target.value }))
                                    setCurrentPage(1)
                                }}
                                className="text-right"
                                dir="rtl"
                            />
                        </div>

                        {/* Brand Filter */}
                        {!hideBrandFilter && (
                            <div className="space-y-2 min-w-[200px]">
                                <Label className="text-sm">מותג</Label>
                                <AutocompleteFilter
                                    value={brands.find(b => b.id === filters.brandId)?.name || ""}
                                    onChange={(value) => {
                                        // Only clear filter if value becomes empty
                                        // Don't update filter while user is typing
                                        if (!value) {
                                            setFilters(prev => ({
                                                ...prev,
                                                brandId: null
                                            }))
                                            setCurrentPage(1)
                                        }
                                    }}
                                    onSelect={(value) => {
                                        const brand = brands.find(b => b.name === value)
                                        if (brand) {
                                            setFilters(prev => ({
                                                ...prev,
                                                brandId: brand.id
                                            }))
                                            setCurrentPage(1)
                                        }
                                    }}
                                    placeholder="חפש או בחר מותג..."
                                    searchFn={async (searchTerm: string) => {
                                        if (searchTerm.length < 2) {
                                            // Return all brands for initial load
                                            return brands.map(b => b.name)
                                        }
                                        // Filter brands by name
                                        const filtered = brands
                                            .filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .map(b => b.name)
                                        return filtered
                                    }}
                                    minSearchLength={0}
                                    debounceMs={300}
                                    initialLoadOnMount={true}
                                    initialResultsLimit={20}
                                    className="w-full"
                                />
                                {filters.brandId && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setFilters(prev => ({ ...prev, brandId: null }))
                                            setCurrentPage(1)
                                        }}
                                        className="h-6 text-xs text-gray-500 hover:text-gray-700"
                                    >
                                        <X className="h-3 w-3 ml-1" />
                                        נקה מותג
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Category Filter */}
                        {categories.length > 0 && (
                            <div className="space-y-2 min-w-[150px]">
                                <Label className="text-sm">קטגוריה</Label>
                                <Select
                                    value={filters.category || "all"}
                                    onValueChange={(value) => {
                                        setFilters(prev => ({
                                            ...prev,
                                            category: value === "all" ? null : value
                                        }))
                                        setCurrentPage(1)
                                    }}
                                >
                                    <SelectTrigger className="text-right" dir="rtl">
                                        <SelectValue placeholder="הכל" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="all">הכל</SelectItem>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat} value={cat}>
                                                {cat}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Products Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        רשימת מוצרים ({filteredProducts.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {paginatedProducts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            {hasActiveFilters ? "לא נמצאו מוצרים לפי הסינון" : "אין מוצרים במערכת"}
                        </div>
                    ) : (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-right">שם המוצר</TableHead>
                                            <TableHead className="text-right">מותג</TableHead>
                                            <TableHead className="text-right">קטגוריה</TableHead>
                                            <TableHead className="text-right">מלאי</TableHead>
                                            <TableHead className="text-right">מחיר עלות</TableHead>
                                            <TableHead className="text-right">מחיר צרכן</TableHead>
                                            <TableHead className="text-right">מחיר חבילה</TableHead>
                                            <TableHead className="text-right">פעולות</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedProducts.map((product) => (
                                            <TableRow key={product.id}>
                                                <TableCell className="font-medium text-right">
                                                    {product.name}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {product.brand ? (
                                                        <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                                                            {product.brand.name}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">ללא מותג</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {product.category || (
                                                        <span className="text-xs text-muted-foreground">ללא קטגוריה</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {product.stock_quantity !== null ? (
                                                        <span className={product.stock_quantity === 0 ? "text-red-600 font-semibold" : ""}>
                                                            {product.stock_quantity}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">לא צוין</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {product.cost_price !== null ? (
                                                        `₪${product.cost_price.toFixed(2)}`
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">לא צוין</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {product.retail_price !== null ? (
                                                        <span className="font-semibold">₪{product.retail_price.toFixed(2)}</span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">לא צוין</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {product.bundle_price !== null ? (
                                                        `₪${product.bundle_price.toFixed(2)}`
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">לא צוין</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(product)} title="ערוך">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(product)} title="מחק">
                                                            <Trash2 className="h-4 w-4 text-red-600" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4">
                                    <div className="text-sm text-gray-600">
                                        מציג {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} מתוך {filteredProducts.length} מוצרים
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            הקודם
                                        </Button>
                                        <span className="text-sm text-gray-600">
                                            עמוד {currentPage} מתוך {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            הבא
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <ProductEditDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                product={editingProduct}
                brands={brands}
                onSaved={handleSaved}
                onBrandCreated={fetchBrands}
            />

            {/* Delete Dialog */}
            <DeleteProductDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                product={productToDelete}
                onDeleted={handleDeleted}
            />
        </div>
    )
}

