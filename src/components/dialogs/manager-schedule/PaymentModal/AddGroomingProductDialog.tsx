import React, { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useBreeds } from "@/hooks/useBreeds"
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
    const { data: breeds = [], isLoading: isLoadingBreeds } = useBreeds()
    const [selectedBreed, setSelectedBreed] = useState<string>('')
    const [dogName, setDogName] = useState<string>('')
    const [calculatedPrice, setCalculatedPrice] = useState<number>(0)
    const [customPrice, setCustomPrice] = useState<string>('')
    const [isLoadingPrice, setIsLoadingPrice] = useState(false)

    // Search function for breeds
    const searchBreeds = useCallback(async (searchTerm: string): Promise<string[]> => {
        try {
            let query = supabase
                .from("breeds")
                .select("name")
                .order("name")
                .limit(20)

            // If there's a search term, filter by it; otherwise return first 20
            if (searchTerm && searchTerm.trim().length > 0) {
                query = query.ilike("name", `%${searchTerm.trim()}%`)
            }

            const { data, error } = await query

            if (error) throw error
            return (data || []).map(b => b.name)
        } catch (error) {
            console.error("Error searching breeds:", error)
            return []
        }
    }, [])

    // Calculate price when breed changes
    useEffect(() => {
        if (selectedBreed) {
            calculatePrice(selectedBreed)
        }
    }, [selectedBreed])


    const calculatePrice = async (breedName: string) => {
        if (!breedName) {
            setCalculatedPrice(0)
            return
        }

        setIsLoadingPrice(true)
        try {
            const { data, error } = await supabase
                .from('breeds')
                .select('min_groom_price, max_groom_price, hourly_price')
                .eq('name', breedName)
                .maybeSingle()

            if (error) throw error

            if (data) {
                const minPrice = data.min_groom_price != null ? Number(data.min_groom_price) : null
                const price = minPrice || 0
                setCalculatedPrice(price)
                if (!customPrice) {
                    setCustomPrice(price.toString())
                }
            } else {
                setCalculatedPrice(0)
                if (!customPrice) {
                    setCustomPrice('0')
                }
            }
        } catch (err) {
            console.error('Error calculating price:', err)
            setCalculatedPrice(0)
        } finally {
            setIsLoadingPrice(false)
        }
    }

    const handleAdd = () => {
        if (!selectedBreed) {
            return
        }

        const price = parseFloat(customPrice) || calculatedPrice || 0
        onAdd({
            dogId: `temp_${Date.now()}`,
            dogName: dogName || 'כלב',
            breed: selectedBreed,
            price,
        })

        // Reset form
        setSelectedBreed('')
        setDogName('')
        setCalculatedPrice(0)
        setCustomPrice('')
        onOpenChange(false)
    }

    const handleClose = () => {
        setSelectedBreed('')
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
                        בחר כלב וגזע לחישוב מחיר
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Breed Selection */}
                    <div>
                        <Label className="text-right block mb-2">גזע</Label>
                        <AutocompleteFilter
                            value={selectedBreed}
                            onChange={(breedName) => {
                                setSelectedBreed(breedName)
                                if (breedName) {
                                    calculatePrice(breedName)
                                }
                            }}
                            onSelect={(breedName) => {
                                setSelectedBreed(breedName)
                                if (breedName) {
                                    calculatePrice(breedName)
                                }
                            }}
                            placeholder={isLoadingBreeds ? "טוען גזעים..." : "חפש גזע..."}
                            searchFn={searchBreeds}
                            minSearchLength={0}
                            autoSearchOnFocus={true}
                            className="w-full"
                        />
                    </div>

                    {/* Dog Name (Optional) */}
                    <div>
                        <Label className="text-right block mb-2">שם הכלב (אופציונלי)</Label>
                        <Input
                            type="text"
                            value={dogName}
                            onChange={(e) => setDogName(e.target.value)}
                            placeholder="הזן שם כלב"
                            dir="rtl"
                        />
                    </div>

                    {/* Price Display and Input */}
                    {selectedBreed && (
                        <div>
                            <Label className="text-right block mb-2">מחיר</Label>
                            <div className="flex items-center gap-2">
                                {isLoadingPrice ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Input
                                            type="number"
                                            value={customPrice}
                                            onChange={(e) => setCustomPrice(e.target.value)}
                                            className="flex-1"
                                            dir="rtl"
                                            placeholder={calculatedPrice > 0 ? calculatedPrice.toString() : '0'}
                                        />
                                        <span className="text-sm">₪</span>
                                        {calculatedPrice > 0 && (
                                            <span className="text-xs text-gray-500">
                                                (מוצע: ₪{calculatedPrice})
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

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
                            disabled={!selectedBreed}
                        >
                            הוסף
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

