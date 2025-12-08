import { useState, useEffect, useMemo, useRef } from 'react'
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Loader2, Dog, X, Plus, Pencil } from "lucide-react"
import { useListOwnerDogsQuery } from "@/store/services/supabaseApi"
import { cn } from "@/lib/utils"
import { AddDogDialog } from "@/components/AddDogDialog"
import { EditDogDialog } from "@/components/EditDogDialog"

export interface Dog {
    id: string
    name: string
    breed: string
    size: string
    isSmall: boolean
    ownerId: string
}

interface DogSelectInputProps {
    selectedCustomer: { id: string; recordId?: string } | null
    selectedDog: Dog | null
    onDogSelect: (dog: Dog) => void
    onDogClear: () => void
    disabled?: boolean
    label?: string
    placeholder?: string
    onDogCreated?: (dogId: string) => void
    className?: string
}

export function DogSelectInput({
    selectedCustomer,
    selectedDog,
    onDogSelect,
    onDogClear,
    disabled = false,
    label = "בחירת כלב",
    placeholder = "בחר כלב",
    onDogCreated,
    className,
}: DogSelectInputProps) {
    const [cachedDogs, setCachedDogs] = useState<Dog[]>([])
    const [isAddDogDialogOpen, setIsAddDogDialogOpen] = useState(false)
    const [isEditDogDialogOpen, setIsEditDogDialogOpen] = useState(false)
    const previousOwnerIdRef = useRef<string>("")
    const hasAutoSelectedRef = useRef<boolean>(false)

    const ownerId = selectedCustomer?.recordId || selectedCustomer?.id || ""

    // Fetch dogs for selected customer
    const { data: dogsData, isLoading: isLoadingDogs, refetch: refetchDogs } = useListOwnerDogsQuery(
        ownerId,
        { skip: !ownerId }
    )

    useEffect(() => {
        if (dogsData?.dogs) {
            setCachedDogs(dogsData.dogs)
        }
    }, [dogsData])

    useEffect(() => {
        if (!ownerId) {
            setCachedDogs([])
            hasAutoSelectedRef.current = false
        }
    }, [ownerId])

    // Extract dogs from API responses
    const dogs = useMemo(() => dogsData?.dogs ?? cachedDogs, [dogsData, cachedDogs])

    // Auto-select first dog when customer is selected and dogs are loaded
    useEffect(() => {
        // Reset auto-select flag when owner changes
        if (previousOwnerIdRef.current !== ownerId) {
            hasAutoSelectedRef.current = false
            previousOwnerIdRef.current = ownerId
        }

        // Only auto-select if:
        // 1. Customer is selected
        // 2. Dogs are loaded (not loading)
        // 3. No dog is currently selected
        // 4. There's at least one dog available
        // 5. We haven't already auto-selected for this customer
        const shouldAutoSelect = 
            selectedCustomer && 
            !isLoadingDogs && 
            !selectedDog && 
            dogs.length > 0 &&
            !hasAutoSelectedRef.current &&
            ownerId !== ""

        if (shouldAutoSelect) {
            console.log("✅ [DogSelectInput] Auto-selecting first dog:", dogs[0])
            onDogSelect(dogs[0])
            hasAutoSelectedRef.current = true
        }
    }, [selectedCustomer, isLoadingDogs, selectedDog, dogs, ownerId, onDogSelect])

    const handleDogSelect = (dogId: string) => {
        if (dogId === "__add_new__") {
            setIsAddDogDialogOpen(true)
            return
        }
        const dog = dogs.find(d => d.id === dogId)
        if (dog) {
            onDogSelect(dog)
        }
    }

    if (!selectedCustomer) {
        return (
            <div className={className}>
                <Label className="text-sm font-medium text-gray-700 mb-2 text-right block">{label}</Label>
                <div className="text-sm text-gray-500 text-right">
                    יש לבחור לקוח תחילה
                </div>
            </div>
        )
    }

    if (isLoadingDogs) {
        return (
            <div className={className}>
                <Label className="text-sm font-medium text-gray-700 mb-2 text-right block">{label}</Label>
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    <span className="mr-2 text-sm text-gray-500">טוען כלבים...</span>
                </div>
            </div>
        )
    }

    return (
        <div className={className}>
            <Label className="text-sm font-medium text-gray-700 mb-2 text-right block">{label}</Label>

            {dogs.length === 0 ? (
                <div className="space-y-2">
                    <div className="text-sm text-gray-500 text-right">
                        ללקוח זה אין כלבים רשומים
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddDogDialogOpen(true)}
                        className="w-full text-right"
                        disabled={disabled}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        הוסף כלב חדש
                    </Button>
                </div>
            ) : (
                <div className="relative">
                    <Select
                        dir="rtl"
                        value={selectedDog?.id || ""}
                        onValueChange={handleDogSelect}
                        disabled={disabled}
                    >
                        <SelectTrigger
                            dir="rtl"
                            className={cn(
                                "relative w-full text-right transition-colors justify-start  gap-2 pr-4 pl-10 [&>svg:last-of-type]:hidden",
                                selectedDog ? "border-green-300 bg-green-50" : "",
                                !selectedDog && "pr-10"
                            )}
                        >
                            <SelectValue
                                dir="rtl"
                                className="flex-1 text-right"
                                placeholder={placeholder}
                            />
                            {!selectedDog && (
                                <span className="pointer-events-none absolute left-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="h-4 w-4 text-gray-400"
                                    >
                                        <path fill="none" d="M0 0h24v24H0z" />
                                        <path d="M7 10l5 5 5-5z" />
                                    </svg>
                                </span>
                            )}
                        </SelectTrigger>
                        <SelectContent
                            dir="rtl"
                            align="end"
                            sideOffset={4}
                            className="text-right"
                        >
                            {dogs.map((dog) => (
                                <SelectItem key={dog.id} value={dog.id} className="text-right" dir="rtl">
                                    <div className="flex flex-row-reverse items-center gap-2 justify-between w-full">
                                        <div className="text-right flex-1">
                                            <div className="font-medium">{dog.name}</div>
                                            <div className="text-xs text-gray-500">{dog.breed} • {dog.size}</div>
                                        </div>
                                        <Dog className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    </div>
                                </SelectItem>
                            ))}
                            <div className="border-t border-gray-200 my-1" />
                            <SelectItem value="__add_new__" className="text-right">
                                <div className="flex items-center gap-2 justify-end w-full text-blue-600">
                                    <Plus className="h-4 w-4" />
                                    <span className="font-medium">הוסף כלב חדש</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    {selectedDog && (
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 z-10">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    setIsEditDogDialogOpen(true)
                                }}
                                className="p-1 hover:bg-green-100 rounded transition-colors"
                                disabled={disabled}
                                title="ערוך כלב"
                            >
                                <Pencil className="h-4 w-4 text-green-600" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    onDogClear()
                                }}
                                className="p-1 hover:bg-green-100 rounded transition-colors"
                                disabled={disabled}
                                title="נקה בחירה"
                            >
                                <X className="h-4 w-4 text-green-600" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Add Dog Dialog */}
            <AddDogDialog
                open={isAddDogDialogOpen}
                onOpenChange={setIsAddDogDialogOpen}
                customerId={ownerId}
                onSuccess={async (dogId) => {
                    console.log("✅ [DogSelectInput] Dog created:", dogId)
                    // Refetch dogs list and select the newly created dog
                    try {
                        const result = await refetchDogs()
                        if (result.data?.dogs) {
                            const newDog = result.data.dogs.find(d => d.id === dogId)
                            if (newDog) {
                                onDogSelect(newDog)
                            }
                        }
                    } catch (error) {
                        console.error("Error refetching dogs:", error)
                    }
                    // Notify parent if callback provided
                    onDogCreated?.(dogId)
                }}
            />

            {/* Edit Dog Dialog */}
            <EditDogDialog
                open={isEditDogDialogOpen}
                onOpenChange={setIsEditDogDialogOpen}
                dogId={selectedDog?.id || null}
                onSuccess={async () => {
                    console.log("✅ [DogSelectInput] Dog updated")
                    // Refetch dogs list to get updated data
                    try {
                        const result = await refetchDogs()
                        if (result.data?.dogs && selectedDog) {
                            const updatedDog = result.data.dogs.find(d => d.id === selectedDog.id)
                            if (updatedDog) {
                                onDogSelect(updatedDog)
                            }
                        }
                    } catch (error) {
                        console.error("Error refetching dogs:", error)
                    }
                }}
            />
        </div>
    )
}
