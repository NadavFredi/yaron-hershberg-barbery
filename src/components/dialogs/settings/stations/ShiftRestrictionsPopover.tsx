import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Settings2 } from "lucide-react"
import { CustomerTypeMultiSelect, type CustomerTypeOption } from "@/components/customer-types/CustomerTypeMultiSelect"
import { DogCategoryMultiSelect, type DogCategoryOption } from "@/components/dog-categories/DogCategoryMultiSelect"

interface StationWorkingHour {
    id?: string
    station_id: string
    weekday: string
    open_time: string
    close_time: string
    shift_order: number
    allowedCustomerTypeIds?: string[]
    allowedDogCategoryIds?: string[]
    blockedCustomerTypeIds?: string[]
    blockedDogCategoryIds?: string[]
}

interface ShiftRestrictionsPopoverProps {
    shift: StationWorkingHour
    customerTypes: CustomerTypeOption[]
    dogCategories: DogCategoryOption[]
    isLoadingCustomerTypes: boolean
    isLoadingDogCategories: boolean
    onCreateCustomerType: (name: string) => Promise<string | null>
    onCreateDogCategory: (name: string) => Promise<string | null>
    onRefreshCustomerTypes: () => Promise<void>
    onRefreshDogCategories: () => Promise<void>
    onRestrictionChange: (
        type: "customerTypes" | "dogCategories" | "blockedCustomerTypes" | "blockedDogCategories",
        ids: string[]
    ) => void
}

export function ShiftRestrictionsPopover({
    shift,
    customerTypes,
    dogCategories,
    isLoadingCustomerTypes,
    isLoadingDogCategories,
    onCreateCustomerType,
    onCreateDogCategory,
    onRefreshCustomerTypes,
    onRefreshDogCategories,
    onRestrictionChange,
}: ShiftRestrictionsPopoverProps) {
    const [popoverOpen, setPopoverOpen] = useState(false)

    const allowedCount =
        (shift.allowedCustomerTypeIds?.length || 0) + (shift.allowedDogCategoryIds?.length || 0)
    const blockedCount =
        (shift.blockedCustomerTypeIds?.length || 0) + (shift.blockedDogCategoryIds?.length || 0)
    const totalRestrictions = allowedCount + blockedCount

    return (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 px-2 whitespace-nowrap">
                    <Settings2 className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-xs">הגבלות</span>
                    {totalRestrictions > 0 && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {allowedCount > 0 && (
                                <Badge
                                    variant="secondary"
                                    className="h-4 w-4 p-0 text-xs flex items-center justify-center bg-green-100 text-green-700 border-green-300 hover:bg-green-100"
                                >
                                    {allowedCount}
                                </Badge>
                            )}
                            {blockedCount > 0 && (
                                <Badge
                                    variant="secondary"
                                    className="h-4 w-4 p-0 text-xs flex items-center justify-center bg-red-100 text-red-700 border-red-300 hover:bg-red-100"
                                >
                                    {blockedCount}
                                </Badge>
                            )}
                        </div>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-96 p-4"
                align="end"
                dir="rtl"
                onOpenAutoFocus={(event) => {
                    // Prevent auto-focus to avoid opening dropdowns automatically
                    event.preventDefault()
                }}
            >
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-sm mb-3 text-right">הגבלות משמרת</h4>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-3 border border-green-200 bg-green-50/30 rounded p-3">
                            <div className="space-y-2">
                                <Label className="text-xs text-green-700 text-right block font-medium">
                                    סוגי לקוחות מורשים (אופציונלי)
                                </Label>
                                <CustomerTypeMultiSelect
                                    options={customerTypes}
                                    selectedIds={shift.allowedCustomerTypeIds || []}
                                    onSelectionChange={(ids) => onRestrictionChange("customerTypes", ids)}
                                    placeholder="כל הלקוחות..."
                                    isLoading={isLoadingCustomerTypes}
                                    onCreateCustomerType={onCreateCustomerType}
                                    onRefreshOptions={onRefreshCustomerTypes}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-green-700 text-right block font-medium">
                                    קטגוריות כלבים מורשות (אופציונלי)
                                </Label>
                                <DogCategoryMultiSelect
                                    options={dogCategories}
                                    selectedIds={shift.allowedDogCategoryIds || []}
                                    onSelectionChange={(ids) => onRestrictionChange("dogCategories", ids)}
                                    placeholder="כל הקטגוריות..."
                                    isLoading={isLoadingDogCategories}
                                    onCreateDogCategory={onCreateDogCategory}
                                    onRefreshOptions={onRefreshDogCategories}
                                />
                            </div>
                        </div>
                        <div className="border-t border-red-200 pt-3 space-y-3 bg-red-50/30 rounded p-3">
                            <div className="space-y-2">
                                <Label className="text-xs text-red-700 text-right block font-medium">
                                    סוגי לקוחות חסומים (אופציונלי)
                                </Label>
                                <CustomerTypeMultiSelect
                                    options={customerTypes}
                                    selectedIds={shift.blockedCustomerTypeIds || []}
                                    onSelectionChange={(ids) => onRestrictionChange("blockedCustomerTypes", ids)}
                                    placeholder="אין חסימות..."
                                    isLoading={isLoadingCustomerTypes}
                                    onCreateCustomerType={onCreateCustomerType}
                                    onRefreshOptions={onRefreshCustomerTypes}
                                />
                                <p className="text-xs text-red-600 text-right">חסימות גוברות על הרשאות</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-red-700 text-right block font-medium">
                                    קטגוריות כלבים חסומות (אופציונלי)
                                </Label>
                                <DogCategoryMultiSelect
                                    options={dogCategories}
                                    selectedIds={shift.blockedDogCategoryIds || []}
                                    onSelectionChange={(ids) => onRestrictionChange("blockedDogCategories", ids)}
                                    placeholder="אין חסימות..."
                                    isLoading={isLoadingDogCategories}
                                    onCreateDogCategory={onCreateDogCategory}
                                    onRefreshOptions={onRefreshDogCategories}
                                />
                                <p className="text-xs text-red-600 text-right">חסימות גוברות על הרשאות</p>
                            </div>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

