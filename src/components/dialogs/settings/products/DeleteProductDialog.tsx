import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface Product {
    id: string
    name: string
    brand?: { id: string; name: string } | null
}

interface DeleteProductDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product | null
    onDeleted: () => Promise<void>
}

export function DeleteProductDialog({
    open,
    onOpenChange,
    product,
    onDeleted,
}: DeleteProductDialogProps) {
    const { toast } = useToast()
    const [isDeleting, setIsDeleting] = useState(false)

    const handleClose = () => {
        if (!isDeleting) {
            onOpenChange(false)
        }
    }

    const handleConfirm = async () => {
        if (!product) return

        setIsDeleting(true)
        try {
            // Check if product is used in any orders
            const { data: orderItems, error: checkError } = await supabase
                .from("order_items")
                .select("id")
                .eq("product_id", product.id)
                .limit(1)

            if (checkError) throw checkError

            if (orderItems && orderItems.length > 0) {
                toast({
                    title: "לא ניתן למחוק",
                    description: "לא ניתן למחוק מוצר ששויך להזמנות קיימות",
                    variant: "destructive",
                })
                return
            }

            const { error } = await supabase
                .from("products")
                .delete()
                .eq("id", product.id)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "המוצר נמחק בהצלחה",
            })

            onOpenChange(false)
            await onDeleted()
        } catch (error: any) {
            console.error("Error deleting product:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן למחוק את המוצר",
                variant: "destructive",
            })
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose} dir="rtl">
            <DialogContent className="max-w-sm" dir="rtl">
                <DialogHeader className="text-right">
                    <DialogTitle className="text-right">מחק מוצר?</DialogTitle>
                    <DialogDescription className="text-right">
                        האם אתה בטוח שברצונך למחוק את המוצר "{product?.name}"?
                        <br />
                        <br />
                        פעולה זו תמחק את המוצר לצמיתות ולא ניתנת לביטול.
                        {product?.brand && (
                            <>
                                <br />
                                <br />
                                <span className="text-xs text-gray-500">
                                    מותג: {product.brand.name}
                                </span>
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isDeleting}
                    >
                        ביטול
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={isDeleting}
                    >
                        {isDeleting && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                        <Trash2 className="h-4 w-4 ml-2" />
                        מחק
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}





