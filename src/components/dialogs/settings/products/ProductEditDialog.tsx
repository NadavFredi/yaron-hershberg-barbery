import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Plus, HelpCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Product {
    id: string
    name: string
    brand_id: string | null
    category: string | null
    stock_quantity: number | null
    cost_price: number | null
    bundle_price: number | null
    retail_price: number | null
}

interface Brand {
    id: string
    name: string
}

interface ProductEditDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product | null
    brands: Brand[]
    onSaved: () => Promise<void>
    onBrandCreated?: () => Promise<void> // Optional callback when a brand is created
}

export function ProductEditDialog({
    open,
    onOpenChange,
    product,
    brands,
    onSaved,
    onBrandCreated,
}: ProductEditDialogProps) {
    const { toast } = useToast()
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        brand_id: "" as string | null,
        category: "",
        stock_quantity: "",
        cost_price: "",
        bundle_price: "",
        retail_price: "",
    })

    const [newBrandName, setNewBrandName] = useState("")
    const [showNewBrandInput, setShowNewBrandInput] = useState(false)
    const [isCreatingBrand, setIsCreatingBrand] = useState(false)

    useEffect(() => {
        if (open) {
            // Check if product exists and has a valid UUID (not 'new' or empty string)
            const isValidUUID = product?.id && product.id !== 'new' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product.id)
            
            if (product && isValidUUID) {
                // Editing existing product
                setFormData({
                    name: product.name || "",
                    brand_id: product.brand_id || null,
                    category: product.category || "",
                    stock_quantity: product.stock_quantity?.toString() || "",
                    cost_price: product.cost_price?.toString() || "",
                    bundle_price: product.bundle_price?.toString() || "",
                    retail_price: product.retail_price?.toString() || "",
                })
            } else if (product && !isValidUUID) {
                // New product with pre-filled name (id is 'new' or invalid)
                setFormData({
                    name: product.name || "",
                    brand_id: null,
                    category: "",
                    stock_quantity: "",
                    cost_price: "",
                    bundle_price: "",
                    retail_price: "",
                })
            } else {
                // Completely new product
                setFormData({
                    name: "",
                    brand_id: null,
                    category: "",
                    stock_quantity: "",
                    cost_price: "",
                    bundle_price: "",
                    retail_price: "",
                })
            }
            setNewBrandName("")
            setShowNewBrandInput(false)
        }
    }, [product, open])

    const handleCreateBrand = async () => {
        if (!newBrandName.trim()) {
            toast({
                title: "שגיאה",
                description: "שם המותג נדרש",
                variant: "destructive",
            })
            return
        }

        setIsCreatingBrand(true)
        try {
            const { data, error } = await supabase
                .from("brands")
                .insert({ name: newBrandName.trim() })
                .select()
                .single()

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "המותג נוצר בהצלחה",
            })

            setFormData(prev => ({ ...prev, brand_id: data.id }))
            setNewBrandName("")
            setShowNewBrandInput(false)
            
            // Refresh brands list if callback provided
            if (onBrandCreated) {
                await onBrandCreated()
            }
        } catch (error: any) {
            console.error("Error creating brand:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן ליצור את המותג",
                variant: "destructive",
            })
        } finally {
            setIsCreatingBrand(false)
        }
    }

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast({
                title: "שגיאה",
                description: "שם המוצר נדרש",
                variant: "destructive",
            })
            return
        }

        // Validate numeric fields
        const stockQuantity = formData.stock_quantity ? parseInt(formData.stock_quantity, 10) : null
        const costPrice = formData.cost_price ? parseFloat(formData.cost_price) : null
        const bundlePrice = formData.bundle_price ? parseFloat(formData.bundle_price) : null
        const retailPrice = formData.retail_price ? parseFloat(formData.retail_price) : null

        if (formData.stock_quantity && (isNaN(stockQuantity!) || stockQuantity! < 0)) {
            toast({
                title: "שגיאה",
                description: "כמות המלאי חייבת להיות מספר חיובי",
                variant: "destructive",
            })
            return
        }

        if (formData.cost_price && (isNaN(costPrice!) || costPrice! < 0)) {
            toast({
                title: "שגיאה",
                description: "מחיר העלות חייב להיות מספר חיובי",
                variant: "destructive",
            })
            return
        }

        if (formData.bundle_price && (isNaN(bundlePrice!) || bundlePrice! < 0)) {
            toast({
                title: "שגיאה",
                description: "מחיר החבילה חייב להיות מספר חיובי",
                variant: "destructive",
            })
            return
        }

        if (formData.retail_price && (isNaN(retailPrice!) || retailPrice! < 0)) {
            toast({
                title: "שגיאה",
                description: "מחיר הצרכן חייב להיות מספר חיובי",
                variant: "destructive",
            })
            return
        }

        setIsSaving(true)
        try {
            const productData = {
                name: formData.name.trim(),
                brand_id: formData.brand_id || null,
                category: formData.category.trim() || null,
                stock_quantity: stockQuantity,
                cost_price: costPrice,
                bundle_price: bundlePrice,
                retail_price: retailPrice,
            }

            // Check if product exists and has a valid UUID (not 'new' or empty string)
            const isValidUUID = product?.id && product.id !== 'new' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product.id)
            
            if (product && isValidUUID) {
                // Update existing product
                const { error } = await supabase
                    .from("products")
                    .update(productData)
                    .eq("id", product.id)

                if (error) throw error

                toast({
                    title: "הצלחה",
                    description: "המוצר עודכן בהצלחה",
                })
            } else {
                // Create new product
                const { error } = await supabase
                    .from("products")
                    .insert(productData)

                if (error) throw error

                toast({
                    title: "הצלחה",
                    description: "המוצר נוצר בהצלחה",
                })
            }

            onOpenChange(false)
            await onSaved()
        } catch (error: any) {
            console.error("Error saving product:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן לשמור את המוצר",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange} dir="rtl">
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">
                        {product && product.id !== 'new' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product.id) ? "ערוך מוצר" : "הוסף מוצר חדש"}
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        {product && product.id !== 'new' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product.id) ? "עדכן את פרטי המוצר" : "הוסף מוצר חדש למערכת"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Product Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-right">
                            שם המוצר <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="הכנס שם מוצר"
                            className="text-right"
                            dir="rtl"
                        />
                    </div>

                    {/* Brand */}
                    <div className="space-y-2">
                        <Label htmlFor="brand" className="text-right">
                            מותג
                        </Label>
                        <div className="flex gap-2">
                            <Select
                                value={formData.brand_id || "none"}
                                onValueChange={(value) => {
                                    if (value === "new") {
                                        setShowNewBrandInput(true)
                                    } else {
                                        setFormData(prev => ({ ...prev, brand_id: value === "none" ? null : value }))
                                        setShowNewBrandInput(false)
                                    }
                                }}
                            >
                                <SelectTrigger className="text-right flex-1" dir="rtl">
                                    <SelectValue placeholder="בחר מותג" />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="none">ללא מותג</SelectItem>
                                    {brands.map((brand) => (
                                        <SelectItem key={brand.id} value={brand.id}>
                                            {brand.name}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="new">
                                        <div className="flex items-center gap-1">
                                            <Plus className="h-3 w-3" />
                                            מותג חדש
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {showNewBrandInput && (
                            <div className="flex gap-2">
                                <Input
                                    value={newBrandName}
                                    onChange={(e) => setNewBrandName(e.target.value)}
                                    placeholder="שם מותג חדש"
                                    className="text-right flex-1"
                                    dir="rtl"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            handleCreateBrand()
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCreateBrand}
                                    disabled={isCreatingBrand || !newBrandName.trim()}
                                    size="sm"
                                >
                                    {isCreatingBrand ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        "צור"
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                        setShowNewBrandInput(false)
                                        setNewBrandName("")
                                        setFormData(prev => ({ ...prev, brand_id: null }))
                                    }}
                                    size="sm"
                                >
                                    ביטול
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                        <Label htmlFor="category" className="text-right">
                            קטגוריה
                        </Label>
                        <Input
                            id="category"
                            value={formData.category}
                            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                            placeholder="הכנס קטגוריה"
                            className="text-right"
                            dir="rtl"
                        />
                    </div>

                    {/* Stock Quantity */}
                    <div className="space-y-2">
                        <Label htmlFor="stock_quantity" className="text-right">
                            כמות במלאי
                        </Label>
                        <Input
                            id="stock_quantity"
                            type="number"
                            min="0"
                            value={formData.stock_quantity}
                            onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: e.target.value }))}
                            placeholder="0"
                            className="text-right"
                            dir="rtl"
                        />
                    </div>

                    {/* Prices Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Cost Price */}
                        <div className="space-y-2">
                            <Label htmlFor="cost_price" className="text-right">
                                מחיר עלות (₪)
                            </Label>
                            <Input
                                id="cost_price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.cost_price}
                                onChange={(e) => setFormData(prev => ({ ...prev, cost_price: e.target.value }))}
                                placeholder="0.00"
                                className="text-right"
                                dir="rtl"
                            />
                        </div>

                        {/* Retail Price */}
                        <div className="space-y-2">
                            <Label htmlFor="retail_price" className="text-right">
                                מחיר צרכן (₪)
                            </Label>
                            <Input
                                id="retail_price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.retail_price}
                                onChange={(e) => setFormData(prev => ({ ...prev, retail_price: e.target.value }))}
                                placeholder="0.00"
                                className="text-right"
                                dir="rtl"
                            />
                        </div>

                        {/* Bundle Price */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 justify-end">
                                <Label htmlFor="bundle_price" className="text-right">
                                    מחיר חבילה (₪)
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="z-50 bg-gray-900 text-white p-2 rounded shadow-lg max-w-sm" dir="rtl">
                                            <p className="text-right">מחיר מיוחד לרכישה של מספר יחידות יחד (חבילה). למשל, מחיר עבור 3 יחידות או יותר.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Input
                                id="bundle_price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.bundle_price}
                                onChange={(e) => setFormData(prev => ({ ...prev, bundle_price: e.target.value }))}
                                placeholder="0.00"
                                className="text-right"
                                dir="rtl"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        ביטול
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                        {product ? "שמור שינויים" : "צור מוצר"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

