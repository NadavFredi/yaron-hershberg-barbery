import { useState, useCallback, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useUpdateDogMutation } from "@/store/services/supabaseApi"
import { useBreeds } from "@/hooks/useBreeds"
import { getDogById } from "@/integrations/supabase/supabaseService"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { DatePickerInput } from "@/components/DatePickerInput"
import { format, parseISO, isValid as isValidDate } from "date-fns"

interface EditDogDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    dogId: string | null
    onSuccess?: () => void
    lockBreedSelection?: boolean
}

const parseBirthDateString = (value?: string | null): Date | null => {
    if (!value) {
        return null
    }

    try {
        const parsedIso = parseISO(value)
        if (isValidDate(parsedIso)) {
            return parsedIso
        }
    } catch (error) {
        console.warn("⚠️ [EditDogDialog] Failed to parse ISO birth date, falling back to Date constructor", {
            value,
            error,
        })
    }

    const fallback = new Date(value)
    if (isValidDate(fallback)) {
        return fallback
    }

    console.warn("⚠️ [EditDogDialog] Unable to parse birth date string", { value })
    return null
}

export function EditDogDialog({ open, onOpenChange, dogId, onSuccess, lockBreedSelection = false }: EditDogDialogProps) {
    const { toast } = useToast()
    const [updateDog, { isLoading: isUpdatingDog }] = useUpdateDogMutation()
    const { data: breeds = [], isLoading: isLoadingBreeds } = useBreeds()
    const [isLoadingDogData, setIsLoadingDogData] = useState(false)
    const [breedSearchValue, setBreedSearchValue] = useState("")

    const [dogData, setDogData] = useState({
        name: "",
        breed_id: "",
        gender: "male" as "male" | "female",
        birth_date: null as Date | null,
        health_notes: "",
        vet_name: "",
        vet_phone: "",
        aggression_risk: false,
        people_anxious: false,
    })

    // Load dog data when dialog opens
    useEffect(() => {
        if (open && dogId) {
            setIsLoadingDogData(true)
            getDogById(dogId)
                .then((result) => {
                    if (result.success && result.dog) {
                        const dog = result.dog
                        // If dog has no breed, use first breed as default
                        const defaultBreedId = dog.breed_id || (breeds.length > 0 ? breeds[0].id : "")
                        const defaultBreedName =
                            breeds.find((breed) => breed.id === defaultBreedId)?.name || ""
                        const parsedBirthDate = parseBirthDateString(dog.birth_date)
                        console.log("🐾 [EditDogDialog] Loaded dog data", {
                            dogId,
                            rawBirthDate: dog.birth_date,
                            parsedBirthDate,
                        })
                        setDogData({
                            name: dog.name,
                            breed_id: defaultBreedId,
                            gender: dog.gender,
                            birth_date: parsedBirthDate,
                            health_notes: dog.health_notes || "",
                            vet_name: dog.vet_name || "",
                            vet_phone: dog.vet_phone || "",
                            aggression_risk: dog.aggression_risk ?? false,
                            people_anxious: dog.people_anxious ?? false,
                        })
                        setBreedSearchValue(defaultBreedName)
                    } else {
                        toast({
                            title: "שגיאה",
                            description: result.error || "לא ניתן לטעון את פרטי הכלב",
                            variant: "destructive",
                        })
                        onOpenChange(false)
                    }
                })
                .catch((error) => {
                    console.error("Failed to load dog data:", error)
                    toast({
                        title: "שגיאה",
                        description: "לא ניתן לטעון את פרטי הכלב",
                        variant: "destructive",
                    })
                    onOpenChange(false)
                })
                .finally(() => {
                    setIsLoadingDogData(false)
                })
        }
    }, [open, dogId, breeds, toast, onOpenChange])

    const breedNameById = useMemo(() => {
        const lookup = new Map<string, string>()
        breeds.forEach((breed) => {
            lookup.set(breed.id, breed.name)
        })
        return lookup
    }, [breeds])

    useEffect(() => {
        if (!dogData.breed_id) {
            return
        }

        const resolvedName = breedNameById.get(dogData.breed_id) || ""
        if (resolvedName && resolvedName !== breedSearchValue) {
            setBreedSearchValue(resolvedName)
        }
    }, [dogData.breed_id, breedNameById, breedSearchValue])

    const searchBreeds = useCallback(
        async (searchTerm: string) => {
            const normalizedTerm = searchTerm.trim().toLowerCase()
            const filtered = breeds
                .filter((breed) => {
                    if (!normalizedTerm) {
                        return true
                    }
                    return breed.name.toLowerCase().includes(normalizedTerm)
                })
                .map((breed) => breed.name)

            const uniqueResults = Array.from(new Set(filtered)).slice(0, 20)

            console.log("🔎 [EditDogDialog] Filtering breeds for autocomplete", {
                searchTerm,
                results: uniqueResults.length,
            })

            return uniqueResults
        },
        [breeds]
    )

    const handleClose = useCallback(() => {
        if (isUpdatingDog || isLoadingDogData) {
            return
        }
        onOpenChange(false)
        // Reset form after a delay to allow animation to complete
        setTimeout(() => {
            setDogData({
                name: "",
                breed_id: "",
                gender: "male",
                birth_date: null,
                health_notes: "",
                vet_name: "",
                vet_phone: "",
                aggression_risk: false,
                people_anxious: false,
            })
            setBreedSearchValue("")
        }, 300)
    }, [isUpdatingDog, isLoadingDogData, onOpenChange])

    const handleUpdateDog = useCallback(async () => {
        if (!dogId) {
            toast({
                title: "שגיאה",
                description: "לא ניתן לעדכן כלב ללא זיהוי",
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

        if (!lockBreedSelection) {
            if (!dogData.breed_id || dogData.breed_id === "__none__") {
                toast({
                    title: "שדה חובה",
                    description: "יש לבחור גזע לכלב",
                    variant: "destructive",
                })
                return
            }
        }

        try {
            console.log("🔍 [EditDogDialog] Updating dog with data:", dogData)
            const result = await updateDog({
                dogId,
                name: dogData.name.trim(),
                ...(lockBreedSelection ? {} : { breed_id: dogData.breed_id }),
                gender: dogData.gender,
                birth_date: dogData.birth_date ? format(dogData.birth_date, "yyyy-MM-dd") : null,
                health_notes: dogData.health_notes.trim() || null,
                vet_name: dogData.vet_name.trim() || null,
                vet_phone: dogData.vet_phone.trim() || null,
                aggression_risk: dogData.aggression_risk || null,
                people_anxious: dogData.people_anxious || null,
            }).unwrap()

            if (result.success) {
                toast({
                    title: "הכלב עודכן בהצלחה",
                    description: `פרטי ${dogData.name} עודכנו בהצלחה.`,
                })
                handleClose()
                onSuccess?.()
            } else {
                throw new Error(result.error || "שגיאה בעדכון הכלב")
            }
        } catch (error) {
            console.error("Failed to update dog:", error)
            toast({
                title: "שגיאה בעדכון הכלב",
                description: error instanceof Error ? error.message : "לא ניתן לעדכן את הכלב כעת",
                variant: "destructive",
            })
        }
    }, [dogId, dogData, updateDog, toast, handleClose, onSuccess, lockBreedSelection])

    return (
        <Dialog open={open} onOpenChange={(open) => (open ? null : handleClose())}>
            <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto text-right">
                <DialogHeader className="items-start text-right">
                    <DialogTitle>ערוך פרטי כלב</DialogTitle>
                    <DialogDescription>
                        {lockBreedSelection ? "ניתן לעדכן פרטים, אך לא ניתן לשנות את הגזע לאחר שנקבעו תורים." : "עדכן את הפרטים של הכלב"}
                    </DialogDescription>
                </DialogHeader>
                {isLoadingDogData ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        <span className="mr-2 text-sm text-gray-500">טוען פרטי כלב...</span>
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-dog-name" className="text-right">
                                שם הכלב <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="edit-dog-name"
                                placeholder="הכנס שם הכלב"
                                value={dogData.name}
                                onChange={(e) => setDogData({ ...dogData, name: e.target.value })}
                                className="text-right"
                                dir="rtl"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-dog-breed" className="text-right">
                                גזע <span className="text-red-500">*</span>
                            </Label>
                            {lockBreedSelection ? (
                                <>
                                    <Input
                                        id="edit-dog-breed"
                                        value={breedSearchValue}
                                        disabled
                                        className="text-right"
                                        dir="rtl"
                                    />
                                    <p className="text-xs text-gray-500 text-right">
                                        לא ניתן לשנות גזע לכלב שכבר הוזמנו לו תורים.
                                    </p>
                                </>
                            ) : (
                                <AutocompleteFilter
                                    value={breedSearchValue}
                                    onChange={(value) => {
                                        setBreedSearchValue(value)
                                        setDogData((prev) => {
                                            const currentBreedName = prev.breed_id ? breedNameById.get(prev.breed_id) || "" : ""
                                            const normalizedTyped = value.trim().toLowerCase()
                                            const normalizedCurrent = currentBreedName.trim().toLowerCase()
                                            const shouldClear =
                                                !value.trim() ||
                                                !normalizedCurrent ||
                                                normalizedTyped !== normalizedCurrent

                                            if (shouldClear) {
                                                console.log("⚠️ [EditDogDialog] Clearing breed selection due to manual input", {
                                                    typedValue: value,
                                                    previousBreedId: prev.breed_id,
                                                    previousBreedName: currentBreedName,
                                                })
                                            }

                                            return {
                                                ...prev,
                                                breed_id: shouldClear ? "" : prev.breed_id,
                                            }
                                        })
                                    }}
                                    onSelect={(selectedName) => {
                                        const matchedBreed = breeds.find((breed) => breed.name === selectedName)
                                        console.log("✅ [EditDogDialog] Breed selected from autocomplete", {
                                            selectedName,
                                            matchedBreedId: matchedBreed?.id || null,
                                        })
                                        setBreedSearchValue(selectedName)
                                        setDogData((prev) => ({
                                            ...prev,
                                            breed_id: matchedBreed?.id || "",
                                        }))
                                    }}
                                    placeholder={isLoadingBreeds ? "טוען גזעים..." : "הקלד כדי לחפש גזע"}
                                    className="text-right"
                                    searchFn={searchBreeds}
                                    minSearchLength={1}
                                    debounceMs={200}
                                    autoSearchOnFocus
                                    initialLoadOnMount
                                    initialResultsLimit={10}
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-dog-gender" className="text-right">מין</Label>
                                <Select
                                    value={dogData.gender}
                                    onValueChange={(value: "male" | "female") =>
                                        setDogData({ ...dogData, gender: value })
                                    }
                                >
                                    <SelectTrigger id="edit-dog-gender" className="text-right" dir="rtl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">זכר</SelectItem>
                                        <SelectItem value="female">נקבה</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-dog-birth-date" className="text-right">תאריך לידה</Label>
                                <DatePickerInput
                                    id="edit-dog-birth-date"
                                    value={dogData.birth_date}
                                    onChange={(date) => {
                                        console.log("📅 [EditDogDialog] Birth date updated", { date })
                                        setDogData({ ...dogData, birth_date: date })
                                    }}
                                    className="text-right w-full"
                                    dir="rtl"
                                />
                            </div>
                        </div>



                        <div className="space-y-2">
                            <Label htmlFor="edit-dog-health-notes" className="text-right">הערות בריאות</Label>
                            <Textarea
                                id="edit-dog-health-notes"
                                placeholder="הערות על בעיות בריאות, אלרגיות וכו'"
                                value={dogData.health_notes}
                                onChange={(e) => setDogData({ ...dogData, health_notes: e.target.value })}
                                className="text-right min-h-[80px]"
                                dir="rtl"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <input
                                    type="checkbox"
                                    id="edit-dog-aggression-risk"
                                    checked={dogData.aggression_risk}
                                    onChange={(e) => setDogData({ ...dogData, aggression_risk: e.target.checked })}
                                    className="h-4 w-4"
                                />
                                <Label htmlFor="edit-dog-aggression-risk" className="text-right cursor-pointer">
                                    סיכון תוקפנות כלפי כלבים אחרים
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <input
                                    type="checkbox"
                                    id="edit-dog-people-anxious"
                                    checked={dogData.people_anxious}
                                    onChange={(e) => setDogData({ ...dogData, people_anxious: e.target.checked })}
                                    className="h-4 w-4"
                                />
                                <Label htmlFor="edit-dog-people-anxious" className="text-right cursor-pointer">
                                    נוטה להיבהל ממגע במסגרת חדשה
                                </Label>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-dog-vet-name" className="text-right">שם הוטרינר</Label>
                                <Input
                                    id="edit-dog-vet-name"
                                    placeholder="שם הוטרינר"
                                    value={dogData.vet_name}
                                    onChange={(e) => setDogData({ ...dogData, vet_name: e.target.value })}
                                    className="text-right"
                                    dir="rtl"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-dog-vet-phone" className="text-right">טלפון הוטרינר</Label>
                                <Input
                                    id="edit-dog-vet-phone"
                                    placeholder="טלפון הוטרינר"
                                    value={dogData.vet_phone}
                                    onChange={(e) => setDogData({ ...dogData, vet_phone: e.target.value })}
                                    className="text-right"
                                    dir="rtl"
                                />
                            </div>
                        </div>
                    </div>
                )}
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        onClick={handleUpdateDog}
                        disabled={isUpdatingDog || isLoadingDogData || !dogData.name.trim()}
                        className="inline-flex items-center gap-2"
                    >
                        {isUpdatingDog && <Loader2 className="h-4 w-4 animate-spin" />}
                        עדכן כלב
                    </Button>
                    <Button variant="outline" onClick={handleClose} disabled={isUpdatingDog || isLoadingDogData}>
                        בטל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

