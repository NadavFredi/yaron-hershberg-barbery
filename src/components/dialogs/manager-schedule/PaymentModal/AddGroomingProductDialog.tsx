import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useServices } from "@/hooks/useServices"
import { useServiceCategories } from "@/hooks/useServiceCategories"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"

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
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
    const [serviceInputValue, setServiceInputValue] = useState<string>("")
    const [customPrice, setCustomPrice] = useState<string>('')
    const { data: services = [], isLoading: isLoadingServices } = useServices()
    const { data: categories = [], isLoading: isLoadingCategories } = useServiceCategories()

    // Filter services by selected category
    const filteredServices = useMemo(() => {
        if (!selectedCategoryId) {
            return services
        }
        return services.filter((service) => service.service_category_id === selectedCategoryId)
    }, [services, selectedCategoryId])

    // Get selected service for price
    const selectedService = useMemo(() => {
        return services.find((s) => s.id === selectedServiceId) || null
    }, [services, selectedServiceId])

    // Auto-fetch price when service is selected
    useEffect(() => {
        if (selectedService && selectedService.base_price > 0) {
            setCustomPrice(selectedService.base_price.toString())
        }
    }, [selectedService])


    // Search function for AutocompleteFilter
    const searchServices = useCallback((term: string): Promise<string[]> => {
        if (!filteredServices.length) {
            return Promise.resolve([])
        }

        const needle = term.trim().toLowerCase()
        if (!needle) {
            return Promise.resolve(filteredServices.slice(0, 5).map((service) => service.name))
        }

        return Promise.resolve(
            filteredServices
                .filter((service) => service.name.toLowerCase().includes(needle))
                .slice(0, 10)
                .map((service) => service.name)
        )
    }, [filteredServices])

    const handleServiceSelect = (serviceName: string) => {
        setServiceInputValue(serviceName)
        const service = filteredServices.find((s) => s.name === serviceName)
        if (service) {
            setSelectedServiceId(service.id)
        } else {
            setSelectedServiceId(null)
        }
    }

    const handleCategoryChange = (categoryId: string | null) => {
        setSelectedCategoryId(categoryId)
        // Clear service selection when category changes
        setSelectedServiceId(null)
        setServiceInputValue("")
        setCustomPrice("")
    }

    const handleAdd = () => {
        const price = parseFloat(customPrice) || 0
        if (price <= 0) {
            return
        }

        const serviceName = selectedService?.name || serviceInputValue || 'שירות'

        onAdd({
            dogId: `temp_${Date.now()}`,
            dogName: serviceName,
            breed: '',
            price,
        })

        // Reset form
        setSelectedServiceId(null)
        setSelectedCategoryId(null)
        setServiceInputValue("")
        setCustomPrice('')
        onOpenChange(false)
    }

    const handleClose = () => {
        setSelectedServiceId(null)
        setSelectedCategoryId(null)
        setServiceInputValue("")
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
                    {/* Service Category Filter */}
                    <div className="space-y-2">
                        <Label htmlFor="service-category-select">קטגוריית שירות (אופציונלי)</Label>
                        <Select
                            value={selectedCategoryId || "none"}
                            onValueChange={(value) => handleCategoryChange(value === "none" ? null : value)}
                            disabled={isLoadingCategories}
                        >
                            <SelectTrigger id="service-category-select" dir="rtl">
                                <SelectValue placeholder={isLoadingCategories ? "טוען קטגוריות..." : "כל הקטגוריות"} />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="none">כל הקטגוריות</SelectItem>
                                {categories.map((category) => (
                                    <SelectItem key={category.id} value={category.id}>
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Service Name - Autocomplete */}
                    <div className="space-y-2">
                        <Label htmlFor="service-select">שירות</Label>
                        <AutocompleteFilter
                            value={serviceInputValue}
                            onChange={(value) => {
                                setServiceInputValue(value)
                                if (!value.trim()) {
                                    setSelectedServiceId(null)
                                    setCustomPrice("")
                                    return
                                }
                            }}
                            onSelect={handleServiceSelect}
                            placeholder={isLoadingServices ? "טוען שירותים..." : "הקלידו את שם השירות..."}
                            className="w-full"
                            searchFn={searchServices}
                            minSearchLength={1}
                            debounceMs={150}
                            initialLoadOnMount
                            initialResultsLimit={5}
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
                        {selectedService && selectedService.base_price > 0 && (
                            <p className="text-xs text-gray-500 mt-1 text-right">
                                מחיר בסיס: ₪{selectedService.base_price.toFixed(2)}
                            </p>
                        )}
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

