import React, { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"

interface AddGroomingProductDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onAdd: (data: { dogId: string; dogName: string; breed: string; price: number }) => void
    selectedDate?: Date
}

export const AddGroomingProductDialog: React.FC<AddGroomingProductDialogProps> = ({
    open,
    onOpenChange,
    onAdd,
    selectedDate,
}) => {
    const [dogName, setDogName] = useState<string>('')
    const [calculatedPrice, setCalculatedPrice] = useState<number>(0)
    const [customPrice, setCustomPrice] = useState<string>('')
    const [isLoadingPrice, setIsLoadingPrice] = useState(false)


    const handleAdd = () => {
        const price = parseFloat(customPrice) || 0
        if (price <= 0) {
            return
        }

        onAdd({
            dogId: `temp_${Date.now()}`,
            dogName: dogName || 'שירות',
            breed: '',
            price,
        })

        // Reset form
        setDogName('')
        setCalculatedPrice(0)
        setCustomPrice('')
        onOpenChange(false)
    }

    const handleClose = () => {
        setDogName('')
        setCalculatedPrice(0)
        setCustomPrice('')
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">הוסף מוצר מספרה</DialogTitle>
                    <DialogDescription className="text-right">
                        הזן שם ומחיר למוצר
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Service Name */}
                    <div>
                        <Label className="text-right block mb-2">שם השירות</Label>
                        <Input
                            type="text"
                            value={dogName}
                            onChange={(e) => setDogName(e.target.value)}
                            placeholder="הזן שם שירות"
                            dir="rtl"
                        />
                    </div>

                    {/* Price Input */}
                    <div>
                        <Label className="text-right block mb-2">מחיר</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={customPrice}
                                onChange={(e) => setCustomPrice(e.target.value)}
                                className="flex-1"
                                dir="rtl"
                                placeholder="0"
                                min="0"
                            />
                            <span className="text-sm">₪</span>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 pt-4">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={handleClose}
                        >
                            ביטול
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleAdd}
                            disabled={!customPrice || parseFloat(customPrice) <= 0}
                        >
                            הוסף
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

