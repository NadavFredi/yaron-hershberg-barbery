import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, FileText, Pencil, Heart, Stethoscope, Upload, X, Image as ImageIcon } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useUpdateDogMutation } from "@/store/services/supabaseApi"
import { useBreeds } from "@/hooks/useBreeds"
import { getDogById } from "@/integrations/supabase/supabaseService"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { DatePickerInput } from "@/components/DatePickerInput"
import { format, parseISO, isValid as isValidDate } from "date-fns"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"
import { uploadDogImage, deleteDogImage } from "@/utils/dogImageUpload"
import { supabase } from "@/integrations/supabase/client"

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
    const { user } = useSupabaseAuth()
    const [updateDog, { isLoading: isUpdatingDog }] = useUpdateDogMutation()
    const { data: breeds = [], isLoading: isLoadingBreeds } = useBreeds()
    const [isLoadingDogData, setIsLoadingDogData] = useState(false)
    const [breedSearchValue, setBreedSearchValue] = useState("")
    const [isEditingNotes, setIsEditingNotes] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

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
        notes: "",
        staff_notes: "",
        grooming_notes: "",
    })

    const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [isUploadingImage, setIsUploadingImage] = useState(false)

    // Load dog data when dialog opens
    useEffect(() => {
        if (open && dogId) {
            // Reset image state when dialog opens
            setImageFile(null)
            setImagePreview(null)
            setExistingImageUrl(null)
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
                            notes: (dog as any).notes || "",
                            staff_notes: (dog as any).staff_notes || "",
                            grooming_notes: (dog as any).grooming_notes || "",
                        })
                        setBreedSearchValue(defaultBreedName)
                        
                        // Load existing image URL if available
                        const dogImageUrl = dog.image_url && dog.image_url.trim() ? dog.image_url.trim() : null
                        console.log("🖼️ [EditDogDialog] Loaded dog image URL", { dogId, imageUrl: dogImageUrl, rawImageUrl: dog.image_url })
                        setExistingImageUrl(dogImageUrl)
                        setImagePreview(dogImageUrl)
                        setImageFile(null) // Reset new file selection
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
                notes: "",
                staff_notes: "",
                grooming_notes: "",
            })
            setBreedSearchValue("")
            setIsEditingNotes(false)
            setExistingImageUrl(null)
            setImageFile(null)
            setImagePreview(null)
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
        }, 300)
    }, [isUpdatingDog, isLoadingDogData, onOpenChange])

    const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) {
            return
        }

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
        if (!allowedTypes.includes(file.type)) {
            toast({
                title: "סוג קובץ לא נתמך",
                description: "יש להשתמש בתמונות: JPEG, PNG, WebP, או GIF",
                variant: "destructive",
            })
            return
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast({
                title: "קובץ גדול מדי",
                description: "גודל הקובץ המקסימלי הוא 5MB",
                variant: "destructive",
            })
            return
        }

        setImageFile(file)

        // Create preview
        const reader = new FileReader()
        reader.onloadend = () => {
            setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(file)
    }, [toast])

    const handleRemoveImage = useCallback(() => {
        setImageFile(null)
        setImagePreview(null)
        setExistingImageUrl(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }, [])

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
            console.log("📸 [EditDogDialog] Image state:", {
                hasImageFile: !!imageFile,
                existingImageUrl,
                hasImagePreview: !!imagePreview,
                userId: user?.id,
            })

            // Handle image upload/delete
            let finalImageUrl: string | null = existingImageUrl

            // If user selected a new image, upload it
            if (imageFile && user?.id) {
                setIsUploadingImage(true)
                console.log("📸 [EditDogDialog] Uploading new dog image", {
                    dogId,
                    fileName: imageFile.name,
                })

                // Delete old image if it exists
                if (existingImageUrl && user.id) {
                    const deleteResult = await deleteDogImage(existingImageUrl, user.id)
                    if (deleteResult.success) {
                        console.log("✅ [EditDogDialog] Old image deleted successfully")
                    } else {
                        console.warn("⚠️ [EditDogDialog] Failed to delete old image", deleteResult.error)
                    }
                }

                // Upload new image
                const uploadResult = await uploadDogImage(imageFile, user.id, dogId)
                
                if (uploadResult.success && uploadResult.imageUrl) {
                    finalImageUrl = uploadResult.imageUrl
                    console.log("✅ [EditDogDialog] New image uploaded successfully", { imageUrl: finalImageUrl })
                } else {
                    console.error("❌ [EditDogDialog] Image upload failed", uploadResult.error)
                    toast({
                        title: "אזהרה",
                        description: uploadResult.error || "לא ניתן להעלות את התמונה החדשה",
                        variant: "destructive",
                    })
                }
                setIsUploadingImage(false)
            } else if (!imagePreview && existingImageUrl) {
                // User removed the image, delete it from storage
                if (user?.id) {
                    setIsUploadingImage(true)
                    console.log("🗑️ [EditDogDialog] Deleting dog image", { imageUrl: existingImageUrl })
                    
                    const deleteResult = await deleteDogImage(existingImageUrl, user.id)
                    if (deleteResult.success) {
                        finalImageUrl = null
                        console.log("✅ [EditDogDialog] Image deleted successfully")
                    } else {
                        console.warn("⚠️ [EditDogDialog] Failed to delete image", deleteResult.error)
                        // Continue anyway - we'll set image_url to null in DB
                        finalImageUrl = null
                    }
                    setIsUploadingImage(false)
                } else {
                    finalImageUrl = null
                }
            }

            // Update notes, staff_notes, grooming_notes, and image_url directly via Supabase since updateDog might not support them
            const { error: notesError } = await supabase
                .from("dogs")
                .update({
                    notes: dogData.notes.trim() || null,
                    staff_notes: dogData.staff_notes.trim() || null,
                    grooming_notes: dogData.grooming_notes.trim() || null,
                    image_url: finalImageUrl,
                })
                .eq("id", dogId)

            if (notesError) {
                console.error("Error updating notes and image:", notesError)
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לעדכן את ההערות או התמונה",
                    variant: "destructive",
                })
                setIsUploadingImage(false)
                return
            }

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
    }, [dogId, dogData, updateDog, toast, handleClose, onSuccess, lockBreedSelection, user, existingImageUrl, imageFile, imagePreview])

    return (
        <Dialog open={open} onOpenChange={(open) => (open ? null : handleClose())}>
            <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] flex flex-col text-right">
                <DialogHeader className="items-start text-right flex-shrink-0">
                    <DialogTitle>ערוך פרטי כלב</DialogTitle>
                    <DialogDescription>
                        {lockBreedSelection ? "ניתן לעדכן פרטים, אך לא ניתן לשנות את הגזע לאחר שנקבעו תורים." : "עדכן את הפרטים של הכלב"}
                    </DialogDescription>
                </DialogHeader>
                {isLoadingDogData ? (
                    <div className="flex items-center justify-center p-8 flex-1">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        <span className="mr-2 text-sm text-gray-500">טוען פרטי כלב...</span>
                    </div>
                ) : (
                    <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0 px-2">
                        {/* Image Upload Section */}
                        <div className="space-y-3">
                            <Label htmlFor="edit-dog-image" className="text-right">
                                תמונת הכלב
                            </Label>
                            <div className="flex flex-col items-center gap-2" dir="rtl">
                                <Input
                                    id="edit-dog-image"
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                                    onChange={handleImageSelect}
                                    disabled={isUpdatingDog || isLoadingDogData || isUploadingImage}
                                    className="hidden"
                                />
                                {imagePreview ? (
                                    <div 
                                        className="relative group cursor-pointer"
                                        onClick={() => !isUpdatingDog && !isLoadingDogData && !isUploadingImage && fileInputRef.current?.click()}
                                    >
                                        <img
                                            src={imagePreview}
                                            alt="תצוגה מקדימה"
                                            className="w-40 h-40 object-cover rounded-xl border-2 border-gray-200 shadow-sm hover:border-gray-300 transition-colors"
                                            onError={(e) => {
                                                console.error("❌ [EditDogDialog] Failed to load image", { imagePreview })
                                                // If image fails to load, show placeholder
                                                e.currentTarget.style.display = 'none'
                                                setImagePreview(null)
                                                setExistingImageUrl(null)
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-xl transition-all flex items-center justify-center pointer-events-none">
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Upload className="h-6 w-6 text-white drop-shadow-lg" />
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-md hover:scale-110 transition-transform z-10"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleRemoveImage()
                                            }}
                                            disabled={isUpdatingDog || isLoadingDogData || isUploadingImage}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div 
                                        className="w-40 h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-colors cursor-pointer"
                                        onClick={() => !isUpdatingDog && !isLoadingDogData && !isUploadingImage && fileInputRef.current?.click()}
                                    >
                                        <ImageIcon className="h-10 w-10 text-gray-400" />
                                        <span className="text-xs text-gray-500">לחץ להעלות תמונה</span>
                                    </div>
                                )}
                                <p className="text-xs text-gray-500 text-center">
                                    ניתן להעלות תמונות JPEG, PNG, WebP או GIF (עד 5MB)
                                </p>
                            </div>
                        </div>

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

                        {/* Customer Notes - Read-only with edit button */}
                        <div className="space-y-2 border-b pb-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-right flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-gray-400" />
                                    משהו שחשוב שנדע
                                </Label>
                                {!isEditingNotes && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsEditingNotes(true)}
                                        className="h-8 px-2"
                                        disabled={isUpdatingDog}
                                    >
                                        <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                    </Button>
                                )}
                            </div>
                            {isEditingNotes ? (
                                <>
                                    <Textarea
                                        id="edit-dog-notes"
                                        placeholder="הערות כלליות על הכלב (נראות ללקוח ולצוות)"
                                        value={dogData.notes}
                                        onChange={(e) => setDogData({ ...dogData, notes: e.target.value })}
                                        className="text-right min-h-[100px] resize-none"
                                        dir="rtl"
                                        disabled={isUpdatingDog}
                                    />
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-gray-500 text-right">
                                            הערות אלו נראות גם ללקוח וגם לצוות
                                        </p>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsEditingNotes(false)}
                                            className="h-7 px-2 text-xs"
                                            disabled={isUpdatingDog}
                                        >
                                            סיים עריכה
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="bg-gray-50 rounded-md p-3 min-h-[60px]">
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap text-right">
                                        {dogData.notes || <span className="text-gray-400">אין הערות</span>}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Additional Information - Collapsible sections */}
                        <Accordion type="multiple" className="w-full" dir="rtl">
                            <AccordionItem value="vet-details" className="border-b">
                                <AccordionTrigger className="text-right hover:no-underline py-3">
                                    <div className="flex items-center gap-2 flex-1">
                                        <Stethoscope className="h-4 w-4 text-green-400" />
                                        <span className="font-medium">פרטי הוטרינר</span>
                                        {dogData.vet_name || dogData.vet_phone ? (
                                            <span className="text-xs text-gray-500">
                                                • {dogData.vet_name && dogData.vet_phone
                                                    ? `${dogData.vet_name} • ${dogData.vet_phone}`
                                                    : dogData.vet_name || dogData.vet_phone}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400">• אין נתונים</span>
                                        )}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-2 gap-4 pt-2">
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
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="health-notes" className="border-b">
                                <AccordionTrigger className="text-right hover:no-underline py-3">
                                    <div className="flex items-center gap-2 flex-1">
                                        <Heart className="h-4 w-4 text-red-400" />
                                        <span className="font-medium">הערות בריאות ובטיחות</span>
                                        {dogData.health_notes || dogData.aggression_risk || dogData.people_anxious ? (
                                            <span className="text-xs text-gray-500 line-clamp-1">
                                                • {[
                                                    dogData.health_notes && dogData.health_notes.substring(0, 50),
                                                    dogData.aggression_risk && "סיכון תוקפנות",
                                                    dogData.people_anxious && "נוטה להיבהל",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" • ")}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400">• אין נתונים</span>
                                        )}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-4 pt-2">
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
                                                <Checkbox
                                                    id="edit-dog-aggression-risk"
                                                    checked={dogData.aggression_risk}
                                                    onCheckedChange={(checked) => setDogData({ ...dogData, aggression_risk: checked === true })}
                                                />
                                                <Label htmlFor="edit-dog-aggression-risk" className="text-right cursor-pointer">
                                                    סיכון תוקפנות כלפי כלבים אחרים
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2 space-x-reverse">
                                                <Checkbox
                                                    id="edit-dog-people-anxious"
                                                    checked={dogData.people_anxious}
                                                    onCheckedChange={(checked) => setDogData({ ...dogData, people_anxious: checked === true })}
                                                />
                                                <Label htmlFor="edit-dog-people-anxious" className="text-right cursor-pointer">
                                                    נוטה להיבהל ממגע במסגרת חדשה
                                                </Label>
                                            </div>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="staff-notes" className="border-b">
                                <AccordionTrigger className="text-right hover:no-underline py-3">
                                    <div className="flex items-center gap-2 flex-1">
                                        <FileText className="h-4 w-4 text-blue-400" />
                                        <span className="font-medium">הערות צוות פנימי</span>
                                        {dogData.staff_notes ? (
                                            <span className="text-xs text-gray-500 line-clamp-1">
                                                • {dogData.staff_notes.length > 60
                                                    ? `${dogData.staff_notes.substring(0, 60)}...`
                                                    : dogData.staff_notes}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400">• אין נתונים</span>
                                        )}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-2 pt-2">
                                        <Textarea
                                            id="edit-dog-staff-notes"
                                            placeholder="הערות פנימיות על הכלב (לא נראות ללקוח)"
                                            value={dogData.staff_notes}
                                            onChange={(e) => setDogData({ ...dogData, staff_notes: e.target.value })}
                                            className="text-right min-h-[100px] resize-none"
                                            dir="rtl"
                                            disabled={isUpdatingDog}
                                        />
                                        <p className="text-xs text-blue-600 text-right">
                                            הערות אלו נראות רק לצוות ולא ללקוח
                                        </p>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="grooming-notes" className="border-b">
                                <AccordionTrigger className="text-right hover:no-underline py-3">
                                    <div className="flex items-center gap-2 flex-1">
                                        <FileText className="h-4 w-4 text-purple-400" />
                                        <span className="font-medium">הערות לתספורת</span>
                                        {dogData.grooming_notes ? (
                                            <span className="text-xs text-gray-500 line-clamp-1">
                                                • {dogData.grooming_notes.length > 60
                                                    ? `${dogData.grooming_notes.substring(0, 60)}...`
                                                    : dogData.grooming_notes}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400">• אין נתונים</span>
                                        )}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-2 pt-2">
                                        <Textarea
                                            id="edit-dog-grooming-notes"
                                            placeholder="הערות כלליות על אופן התספורת של הכלב (דרך כלל לעשות תספורת לכלב זה)"
                                            value={dogData.grooming_notes}
                                            onChange={(e) => setDogData({ ...dogData, grooming_notes: e.target.value })}
                                            className="text-right min-h-[100px] resize-none"
                                            dir="rtl"
                                            disabled={isUpdatingDog}
                                        />
                                        <p className="text-xs text-purple-600 text-right">
                                            הערות כלליות על אופן התספורת - יופיעו בכל תור תספורת של הכלב
                                        </p>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                )}
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse flex-shrink-0 pt-4 border-t">
                    <Button
                        onClick={handleUpdateDog}
                        disabled={isUpdatingDog || isLoadingDogData || isUploadingImage || !dogData.name.trim()}
                        className="inline-flex items-center gap-2"
                    >
                        {(isUpdatingDog || isUploadingImage) && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isUploadingImage ? "מעלה תמונה..." : "עדכן כלב"}
                    </Button>
                    <Button variant="outline" onClick={handleClose} disabled={isUpdatingDog || isLoadingDogData || isUploadingImage}>
                        בטל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

