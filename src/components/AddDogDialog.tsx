import { useState, useCallback, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useCreateDogMutation } from "@/store/services/supabaseApi"
import { useBreeds } from "@/hooks/useBreeds"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { DatePickerInput } from "@/components/DatePickerInput"
import { supabase } from "@/integrations/supabase/client"
import { format, parse } from "date-fns"

interface AddDogDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string | null
    onSuccess?: (dogId: string) => void
}

export function AddDogDialog({ open, onOpenChange, customerId, onSuccess }: AddDogDialogProps) {
    const { toast } = useToast()
    const [createDog, { isLoading: isCreatingDog }] = useCreateDogMutation()
    const { data: breeds = [], isLoading: isLoadingBreeds } = useBreeds()

    const [dogData, setDogData] = useState({
        name: "",
        breed_id: "",
        breed_name: "", // For AutocompleteFilter display
        gender: "" as "" | "male" | "female",
        birth_date: null as Date | null,
        health_notes: "",
        vet_name: "",
        vet_phone: "",
        aggression_risk: false,
        people_anxious: false,
    })

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

    const handleClose = useCallback(() => {
        if (isCreatingDog) {
            return
        }
        onOpenChange(false)
        // Reset form after a delay to allow animation to complete
        setTimeout(() => {
            setDogData({
                name: "",
                breed_id: "",
                breed_name: "",
                gender: "",
                birth_date: null,
                health_notes: "",
                vet_name: "",
                vet_phone: "",
                aggression_risk: false,
                people_anxious: false,
            })
        }, 300)
    }, [isCreatingDog, onOpenChange])

    const handleCreateDog = useCallback(async () => {
        if (!customerId) {
            toast({
                title: "שגיאה",
                description: "לא ניתן להוסיף כלב ללא זיהוי לקוח",
                variant: "destructive",
            })
            return
        }

        if (!dogData.name.trim()) {
            toast({
                title: "שדה חובה",
                description: "שם הכלב נדרש",
                variant: "destructive",
            })
            return
        }

        if (dogData.gender !== "male" && dogData.gender !== "female") {
            toast({
                title: "שדה חובה",
                description: "יש לבחור מין לכלב",
                variant: "destructive",
            })
            return
        }

        // Validate breed selection
        const selectedBreed = breeds.find(b => b.name === dogData.breed_name)
        if (!selectedBreed) {
            toast({
                title: "שדה חובה",
                description: "יש לבחור גזע לכלב",
                variant: "destructive",
            })
            return
        }

        try {
            console.log("🔍 [AddDogDialog] Creating dog with data:", dogData)
            const result = await createDog({
                customerId,
                name: dogData.name.trim(),
                breed_id: selectedBreed.id,
                gender: dogData.gender,
                birth_date: dogData.birth_date ? format(dogData.birth_date, "yyyy-MM-dd") : null,
                health_notes: dogData.health_notes.trim() || null,
                vet_name: dogData.vet_name.trim() || null,
                vet_phone: dogData.vet_phone.trim() || null,
                aggression_risk: dogData.aggression_risk || null,
                people_anxious: dogData.people_anxious || null,
            }).unwrap()

            if (result.success && result.dogId) {
                toast({
                    title: "הכלב נוסף בהצלחה",
                    description: `${dogData.name} נוסף לרשימת הכלבים שלך.`,
                })
                handleClose()
                onSuccess?.(result.dogId)
            } else {
                throw new Error(result.error || "שגיאה ביצירת הכלב")
            }
        } catch (error) {
            console.error("Failed to create dog:", error)
            toast({
                title: "שגיאה ביצירת הכלב",
                description: error instanceof Error ? error.message : "לא ניתן ליצור את הכלב כעת",
                variant: "destructive",
            })
        }
    }, [customerId, dogData, createDog, toast, handleClose, onSuccess])

    return (
        <Dialog open={open} onOpenChange={(open) => (open ? null : handleClose())}>
            <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto text-right">
                <DialogHeader className="items-start text-right">
                    <DialogTitle>הוסף כלב חדש</DialogTitle>
                    <DialogDescription>מלא את הפרטים כדי להוסיף כלב חדש לרשימה שלך</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="add-dog-name" className="text-right">
                            שם הכלב <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="add-dog-name"
                            placeholder="הכנס שם הכלב"
                            value={dogData.name}
                            onChange={(e) => setDogData({ ...dogData, name: e.target.value })}
                            className="text-right"
                            dir="rtl"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="add-dog-breed" className="text-right">
                            גזע <span className="text-red-500">*</span>
                        </Label>
                        <AutocompleteFilter
                            value={dogData.breed_name}
                            onChange={(breedName) => {
                                const breed = breeds.find(b => b.name === breedName)
                                setDogData({
                                    ...dogData,
                                    breed_name: breedName,
                                    breed_id: breed?.id || ""
                                })
                            }}
                            onSelect={(breedName) => {
                                const breed = breeds.find(b => b.name === breedName)
                                setDogData({
                                    ...dogData,
                                    breed_name: breedName,
                                    breed_id: breed?.id || ""
                                })
                            }}
                            placeholder={isLoadingBreeds ? "טוען גזעים..." : "חפש גזע..."}
                            searchFn={searchBreeds}
                            minSearchLength={0}
                            autoSearchOnFocus={true}
                            className="w-full"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="add-dog-gender" className="text-right">
                                מין <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={dogData.gender}
                                onValueChange={(value: "male" | "female") =>
                                    setDogData({ ...dogData, gender: value })
                                }
                            >
                                <SelectTrigger id="add-dog-gender" className="text-right" dir="rtl">
                                    <SelectValue placeholder="בחר מין" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">זכר</SelectItem>
                                    <SelectItem value="female">נקבה</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add-dog-birth-date" className="text-right">תאריך לידה</Label>
                            <DatePickerInput
                                id="add-dog-birth-date"
                                value={dogData.birth_date}
                                onChange={(date) => setDogData({ ...dogData, birth_date: date })}
                                placeholder="dd/mm/yyyy"
                                className="text-right w-full"
                                dir="rtl"
                            />
                        </div>
                    </div>



                    <div className="space-y-2">
                        <Label htmlFor="add-dog-health-notes" className="text-right">הערות בריאות</Label>
                        <Textarea
                            id="add-dog-health-notes"
                            placeholder="הערות על בעיות בריאות, אלרגיות וכו'"
                            value={dogData.health_notes}
                            onChange={(e) => setDogData({ ...dogData, health_notes: e.target.value })}
                            className="text-right min-h-[80px]"
                            dir="rtl"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                                id="add-dog-aggression-risk"
                                checked={dogData.aggression_risk}
                                onCheckedChange={(checked) => setDogData({ ...dogData, aggression_risk: checked === true })}
                            />
                            <Label htmlFor="add-dog-aggression-risk" className="text-right cursor-pointer">
                                סיכון תוקפנות כלפי כלבים אחרים
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                                id="add-dog-people-anxious"
                                checked={dogData.people_anxious}
                                onCheckedChange={(checked) => setDogData({ ...dogData, people_anxious: checked === true })}
                            />
                            <Label htmlFor="add-dog-people-anxious" className="text-right cursor-pointer">
                                נוטה להיבהל ממגע במסגרת חדשה
                            </Label>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="add-dog-vet-name" className="text-right">שם הוטרינר</Label>
                            <Input
                                id="add-dog-vet-name"
                                placeholder="שם הוטרינר"
                                value={dogData.vet_name}
                                onChange={(e) => setDogData({ ...dogData, vet_name: e.target.value })}
                                className="text-right"
                                dir="rtl"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add-dog-vet-phone" className="text-right">טלפון הוטרינר</Label>
                            <Input
                                id="add-dog-vet-phone"
                                placeholder="טלפון הוטרינר"
                                value={dogData.vet_phone}
                                onChange={(e) => setDogData({ ...dogData, vet_phone: e.target.value })}
                                className="text-right"
                                dir="rtl"
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        onClick={handleCreateDog}
                        disabled={
                            isCreatingDog ||
                            !dogData.name.trim() ||
                            dogData.gender !== "male" && dogData.gender !== "female"
                        }
                        className="inline-flex items-center gap-2"
                    >
                        {isCreatingDog && <Loader2 className="h-4 w-4 animate-spin" />}
                        הוסף כלב
                    </Button>
                    <Button variant="outline" onClick={handleClose} disabled={isCreatingDog}>
                        בטל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

