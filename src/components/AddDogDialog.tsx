import { useState, useCallback, useMemo, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, FileText, Upload, X, Image as ImageIcon } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useCreateDogMutation } from "@/store/services/supabaseApi"
import { useBreeds } from "@/hooks/useBreeds"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { DatePickerInput } from "@/components/DatePickerInput"
import { supabase } from "@/integrations/supabase/client"
import { format, parse } from "date-fns"
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"
import { uploadDogImage } from "@/utils/dogImageUpload"

interface AddDogDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string | null
    onSuccess?: (dogId: string) => void
}

export function AddDogDialog({ open, onOpenChange, customerId, onSuccess }: AddDogDialogProps) {
    const { toast } = useToast()
    const { user } = useSupabaseAuth()
    const [createDog, { isLoading: isCreatingDog }] = useCreateDogMutation()
    const { data: breeds = [], isLoading: isLoadingBreeds } = useBreeds()
    const fileInputRef = useRef<HTMLInputElement>(null)

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
        notes: "",
        staff_notes: "",
        grooming_notes: "",
    })

    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [isUploadingImage, setIsUploadingImage] = useState(false)

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
                notes: "",
                staff_notes: "",
                grooming_notes: "",
            })
            setImageFile(null)
            setImagePreview(null)
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
        }, 300)
    }, [isCreatingDog, onOpenChange])

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
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }, [])

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
                let imageUrl: string | null = null

                // Upload image if provided
                if (imageFile && user?.id) {
                    setIsUploadingImage(true)
                    console.log("📸 [AddDogDialog] Uploading dog image", {
                        dogId: result.dogId,
                        fileName: imageFile.name,
                    })

                    const uploadResult = await uploadDogImage(imageFile, user.id, result.dogId)
                    
                    if (uploadResult.success && uploadResult.imageUrl) {
                        imageUrl = uploadResult.imageUrl
                        console.log("✅ [AddDogDialog] Image uploaded successfully", { imageUrl })
                    } else {
                        console.error("❌ [AddDogDialog] Image upload failed", uploadResult.error)
                        toast({
                            title: "אזהרה",
                            description: uploadResult.error || "הכלב נוצר בהצלחה, אך לא ניתן להעלות את התמונה",
                            variant: "destructive",
                        })
                    }
                    setIsUploadingImage(false)
                }

                // Update notes, staff_notes, grooming_notes, and image_url directly via Supabase
                const { error: notesError } = await supabase
                    .from("dogs")
                    .update({
                        notes: dogData.notes.trim() || null,
                        staff_notes: dogData.staff_notes.trim() || null,
                        grooming_notes: dogData.grooming_notes.trim() || null,
                        image_url: imageUrl,
                    })
                    .eq("id", result.dogId)

                if (notesError) {
                    console.error("Error updating notes:", notesError)
                    toast({
                        title: "אזהרה",
                        description: "הכלב נוצר בהצלחה, אך לא ניתן לעדכן את ההערות",
                        variant: "destructive",
                    })
                }

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
            <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] flex flex-col text-right">
                <DialogHeader className="items-start text-right flex-shrink-0">
                    <DialogTitle>הוסף כלב חדש</DialogTitle>
                    <DialogDescription>מלא את הפרטים כדי להוסיף כלב חדש לרשימה שלך</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 px-2 overflow-y-auto flex-1 min-h-0">
                    {/* Image Upload Section */}
                    <div className="space-y-3">
                        <Label htmlFor="add-dog-image" className="text-right">
                            תמונת הכלב
                        </Label>
                        <div className="flex flex-col items-center gap-4" dir="rtl">
                            {imagePreview ? (
                                <div className="relative group">
                                    <img
                                        src={imagePreview}
                                        alt="תצוגה מקדימה"
                                        className="w-40 h-40 object-cover rounded-xl border-2 border-gray-200 shadow-sm"
                                    />
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-md hover:scale-110 transition-transform"
                                        onClick={handleRemoveImage}
                                        disabled={isCreatingDog || isUploadingImage}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="w-40 h-40 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <ImageIcon className="h-10 w-10 text-gray-400" />
                                </div>
                            )}
                            <div className="w-full max-w-sm">
                                <Input
                                    id="add-dog-image"
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                                    onChange={handleImageSelect}
                                    disabled={isCreatingDog || isUploadingImage}
                                    className="hidden"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isCreatingDog || isUploadingImage}
                                    className="w-full"
                                >
                                    <Upload className="h-4 w-4 ml-2" />
                                    {imagePreview ? "החלף תמונה" : "העלה תמונה"}
                                </Button>
                                <p className="text-xs text-gray-500 text-center mt-2">
                                    ניתן להעלות תמונות JPEG, PNG, WebP או GIF (עד 5MB)
                                </p>
                            </div>
                        </div>
                    </div>

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

                    <div className="space-y-2">
                        <Label htmlFor="add-dog-notes" className="text-right flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            הערות לקוח על הכלב
                        </Label>
                        <Textarea
                            id="add-dog-notes"
                            placeholder="הערות לקוח על הכלב"
                            value={dogData.notes}
                            onChange={(e) => setDogData({ ...dogData, notes: e.target.value })}
                            className="text-right min-h-[120px] resize-none"
                            dir="rtl"
                            disabled={isCreatingDog}
                        />
                        <p className="text-xs text-gray-500 text-right">
                            הערות אלו נראות גם ללקוח וגם לצוות
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="add-dog-staff-notes" className="text-right flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-400" />
                            הערות צוות על הכלב
                        </Label>
                        <Textarea
                            id="add-dog-staff-notes"
                            placeholder="הערות צוות על הכלב"
                            value={dogData.staff_notes}
                            onChange={(e) => setDogData({ ...dogData, staff_notes: e.target.value })}
                            className="text-right min-h-[120px] resize-none"
                            dir="rtl"
                            disabled={isCreatingDog}
                        />
                        <p className="text-xs text-blue-600 text-right">
                            הערות אלו נראות רק לצוות ולא ללקוח
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="add-dog-grooming-notes" className="text-right flex items-center gap-2">
                            <FileText className="h-4 w-4 text-purple-400" />
                            הערות לתספורת
                        </Label>
                        <Textarea
                            id="add-dog-grooming-notes"
                            placeholder="הערות כלליות על אופן התספורת של הכלב (דרך כלל לעשות תספורת לכלב זה)"
                            value={dogData.grooming_notes}
                            onChange={(e) => setDogData({ ...dogData, grooming_notes: e.target.value })}
                            className="text-right min-h-[120px] resize-none"
                            dir="rtl"
                            disabled={isCreatingDog}
                        />
                        <p className="text-xs text-purple-600 text-right">
                            הערות כלליות על אופן התספורת - יופיעו בכל תור תספורת של הכלב
                        </p>
                    </div>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse flex-shrink-0 pt-4 border-t">
                    <Button
                        onClick={handleCreateDog}
                        disabled={
                            isCreatingDog ||
                            isUploadingImage ||
                            !dogData.name.trim() ||
                            dogData.gender !== "male" && dogData.gender !== "female"
                        }
                        className="inline-flex items-center gap-2"
                    >
                        {(isCreatingDog || isUploadingImage) && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isUploadingImage ? "מעלה תמונה..." : "הוסף כלב"}
                    </Button>
                    <Button variant="outline" onClick={handleClose} disabled={isCreatingDog || isUploadingImage}>
                        בטל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

