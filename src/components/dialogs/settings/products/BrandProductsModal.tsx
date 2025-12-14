import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SettingsProductsSection } from "@/components/settings/SettingsProductsSection/SettingsProductsSection"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Brand {
    id: string
    name: string
}

interface BrandProductsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    brand: Brand | null
}

export function BrandProductsModal({
    open,
    onOpenChange,
    brand,
}: BrandProductsModalProps) {
    if (!brand) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange} dir="rtl">
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col p-0" dir="rtl">
                <DialogHeader className="px-6 pt-6 pb-4">
                    <DialogTitle className="text-right text-xl">
                        מוצרים של {brand.name}
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        כל המוצרים של המותג "{brand.name}" במערכת
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    <SettingsProductsSection
                        initialBrandId={brand.id}
                        hideHeader={true}
                        hideBrandFilter={true}
                        onProductsChange={() => {
                            // Optionally refresh products list when products change
                        }}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}

