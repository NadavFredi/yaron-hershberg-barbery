import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, MoreHorizontal, Pencil, CreditCard, Save, Loader2, X, Image as ImageIcon } from "lucide-react"
import { EditDogDialog } from "@/components/EditDogDialog"
import { getDogById } from "@/integrations/supabase/supabaseService"
import { DogPaymentsModal } from "@/components/dialogs/payments/DogPaymentsModal"
import { MessagingActions } from "@/components/sheets/MessagingActions"
import { ImageGalleryModal } from "@/components/dialogs/ImageGalleryModal"
import { DogAppointmentImagesModal } from "@/components/dialogs/DogAppointmentImagesModal"
import { useAppSelector, useAppDispatch } from "@/store/hooks"
import { setSelectedClient, setIsClientDetailsOpen, setIsDogDetailsOpen, setSelectedDog, type ClientDetails } from "@/store/slices/managerScheduleSlice"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"
import type { Database } from "@/integrations/supabase/types"

interface ClientDetails {
    name: string
    classification?: string
    customerTypeName?: string
    phone?: string
    email?: string
    address?: string
    notes?: string
    preferences?: string
    recordId?: string
    recordNumber?: string
    clientId?: string
}

interface DogDetails {
    id: string
    name: string
    breed?: string
    clientClassification?: string
    owner?: ClientDetails
    age?: string
    weight?: string
    gender?: string
    notes?: string
    staffNotes?: string
    medicalNotes?: string
    importantNotes?: string
    internalNotes?: string
    vetName?: string
    vetPhone?: string
    healthIssues?: string
    birthDate?: string
    tendsToBite?: string
    aggressiveWithOtherDogs?: string
    hasBeenToGarden?: boolean
    suitableForGardenFromQuestionnaire?: boolean
    notSuitableForGardenFromQuestionnaire?: boolean
    recordId?: string
    recordNumber?: string
}

// Helper function to format birth date and calculate age
const formatBirthDateWithAge = (birthDateString?: string) => {
    if (!birthDateString) return null

    try {
        // Parse the date (assuming it comes in YYYY-MM-DD format)
        const birthDate = new Date(birthDateString)
        if (isNaN(birthDate.getTime())) return null

        // Format as DD/MM/YYYY
        const day = birthDate.getDate().toString().padStart(2, '0')
        const month = (birthDate.getMonth() + 1).toString().padStart(2, '0')
        const year = birthDate.getFullYear()
        const formattedDate = `${day}/${month}/${year}`

        // Calculate age in years and months
        const today = new Date()
        let years = today.getFullYear() - birthDate.getFullYear()
        let months = today.getMonth() - birthDate.getMonth()

        if (today.getDate() < birthDate.getDate()) {
            months--
        }

        if (months < 0) {
            years--
            months += 12
        }

        // Format age string
        let ageString = ''
        if (years > 0) {
            ageString += `${years} שנים`
        }
        if (months > 0) {
            if (ageString) ageString += ' '
            ageString += `${months} חודשים`
        }

        // If less than a month old
        if (years === 0 && months === 0) {
            ageString = 'פחות מחודש'
        }

        return `${formattedDate} (${ageString})`
    } catch (error) {
        console.error('Error formatting birth date:', error)
        return null
    }
}

interface DogDetailsSheetProps {
    onShowDogAppointments: (dogId: string, dogName: string) => void
}

export const DogDetailsSheet = ({
    onShowDogAppointments,
}: DogDetailsSheetProps) => {
    const dispatch = useAppDispatch()
    const navigate = useNavigate()
    const selectedDog = useAppSelector((state) => state.managerSchedule.selectedDog)
    const open = useAppSelector((state) => state.managerSchedule.isDogDetailsOpen)

    const handleOpenChange = (isOpen: boolean) => {
        dispatch(setIsDogDetailsOpen(isOpen))
        if (!isOpen) {
            dispatch(setSelectedDog(null))
        }
    }
    const [isEditDogDialogOpen, setIsEditDogDialogOpen] = useState(false)
    const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false)
    const [dogNotes, setDogNotes] = useState<string>("")
    const [dogStaffNotes, setDogStaffNotes] = useState<string>("")
    const [dogGroomingNotes, setDogGroomingNotes] = useState<string>("")
    const [dogHealthNotes, setDogHealthNotes] = useState<string>("")
    const [dogVetName, setDogVetName] = useState<string>("")
    const [dogVetPhone, setDogVetPhone] = useState<string>("")
    const [dogGender, setDogGender] = useState<string>("")
    const [dogBirthDate, setDogBirthDate] = useState<string | null>(null)
    const [dogAggressionRisk, setDogAggressionRisk] = useState<boolean | null>(null)
    const [dogPeopleAnxious, setDogPeopleAnxious] = useState<boolean | null>(null)
    const [dogIsSmall, setDogIsSmall] = useState<boolean | null>(null)
    const [isLoadingDogDetails, setIsLoadingDogDetails] = useState(false)
    const [dogCustomerId, setDogCustomerId] = useState<string | null>(null)
    const [dogOwnerPhone, setDogOwnerPhone] = useState<string | null>(null)
    const [dogOwnerName, setDogOwnerName] = useState<string | null>(null)
    const [isSavingNotes, setIsSavingNotes] = useState(false)
    const [isSavingStaffNotes, setIsSavingStaffNotes] = useState(false)
    const [isSavingGroomingNotes, setIsSavingGroomingNotes] = useState(false)
    const [isSavingHealthNotes, setIsSavingHealthNotes] = useState(false)
    const [isSavingAllChanges, setIsSavingAllChanges] = useState(false)
    const [originalNotes, setOriginalNotes] = useState<string>("")
    const [originalStaffNotes, setOriginalStaffNotes] = useState<string>("")
    const [originalGroomingNotes, setOriginalGroomingNotes] = useState<string>("")
    const [originalHealthNotes, setOriginalHealthNotes] = useState<string>("")
    const [dogContacts, setDogContacts] = useState<Database["public"]["Tables"]["customer_contacts"]["Row"][]>([])
    const [isDesiredGoalImagesModalOpen, setIsDesiredGoalImagesModalOpen] = useState(false)
    const [desiredGoalImagesCount, setDesiredGoalImagesCount] = useState<number | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [isDogAppointmentImagesModalOpen, setIsDogAppointmentImagesModalOpen] = useState(false)
    const { toast } = useToast()

    const handleOpenEditDog = () => {
        setIsEditDogDialogOpen(true)
    }

    const handleSaveNotes = async () => {
        if (!selectedDog?.id) return

        setIsSavingNotes(true)
        try {
            console.log("💾 [DogDetailsSheet] Saving customer notes:", dogNotes)
            const { error } = await supabase
                .from("dogs")
                .update({ notes: dogNotes.trim() || null })
                .eq("id", selectedDog.id)

            if (error) {
                console.error("❌ [DogDetailsSheet] Error saving notes:", error)
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לשמור את ההערות",
                    variant: "destructive",
                })
                return
            }

            toast({
                title: "הערות נשמרו",
                description: "הערות הלקוח עודכנו בהצלחה",
            })
            setOriginalNotes(dogNotes.trim() || "")
        } catch (error) {
            console.error("❌ [DogDetailsSheet] Error saving notes:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את ההערות",
                variant: "destructive",
            })
        } finally {
            setIsSavingNotes(false)
        }
    }

    const handleSaveStaffNotes = async () => {
        if (!selectedDog?.id) return

        setIsSavingStaffNotes(true)
        try {
            console.log("💾 [DogDetailsSheet] Saving staff notes:", dogStaffNotes)
            const { error } = await supabase
                .from("dogs")
                .update({ staff_notes: dogStaffNotes.trim() || null })
                .eq("id", selectedDog.id)

            if (error) {
                console.error("❌ [DogDetailsSheet] Error saving staff notes:", error)
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לשמור את הערות הצוות",
                    variant: "destructive",
                })
                return
            }

            toast({
                title: "הערות נשמרו",
                description: "הערות הצוות עודכנו בהצלחה",
            })
            setOriginalStaffNotes(dogStaffNotes.trim() || "")
        } catch (error) {
            console.error("❌ [DogDetailsSheet] Error saving staff notes:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את הערות הצוות",
                variant: "destructive",
            })
        } finally {
            setIsSavingStaffNotes(false)
        }
    }

    const handleSaveGroomingNotes = async () => {
        if (!selectedDog?.id) return

        setIsSavingGroomingNotes(true)
        try {
            console.log("💾 [DogDetailsSheet] Saving grooming notes:", dogGroomingNotes)
            const { error } = await supabase
                .from("dogs")
                .update({ grooming_notes: dogGroomingNotes.trim() || null })
                .eq("id", selectedDog.id)

            if (error) {
                console.error("❌ [DogDetailsSheet] Error saving grooming notes:", error)
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לשמור את הערות התספורת",
                    variant: "destructive",
                })
                return
            }

            toast({
                title: "הערות נשמרו",
                description: "הערות התספורת עודכנו בהצלחה",
            })
            setOriginalGroomingNotes(dogGroomingNotes.trim() || "")
        } catch (error) {
            console.error("❌ [DogDetailsSheet] Error saving grooming notes:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את הערות התספורת",
                variant: "destructive",
            })
        } finally {
            setIsSavingGroomingNotes(false)
        }
    }

    const handleRevertNotes = () => {
        setDogNotes(originalNotes)
        toast({
            title: "הערות שוחזרו",
            description: "הערות הלקוח שוחזרו לערך המקורי",
        })
    }

    const handleRevertStaffNotes = () => {
        setDogStaffNotes(originalStaffNotes)
        toast({
            title: "הערות שוחזרו",
            description: "הערות הצוות שוחזרו לערך המקורי",
        })
    }

    const handleRevertGroomingNotes = () => {
        setDogGroomingNotes(originalGroomingNotes)
        toast({
            title: "הערות שוחזרו",
            description: "הערות התספורת שוחזרו לערך המקורי",
        })
    }

    const handleSaveHealthNotes = async () => {
        if (!selectedDog?.id) return

        setIsSavingHealthNotes(true)
        try {
            console.log("💾 [DogDetailsSheet] Saving health notes:", dogHealthNotes)
            const { error } = await supabase
                .from("dogs")
                .update({ health_notes: dogHealthNotes.trim() || null })
                .eq("id", selectedDog.id)

            if (error) {
                console.error("❌ [DogDetailsSheet] Error saving health notes:", error)
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לשמור את הערות הבריאות",
                    variant: "destructive",
                })
                return
            }

            toast({
                title: "הערות נשמרו",
                description: "הערות הבריאות עודכנו בהצלחה",
            })
            setOriginalHealthNotes(dogHealthNotes.trim() || "")
        } catch (error) {
            console.error("❌ [DogDetailsSheet] Error saving health notes:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את הערות הבריאות",
                variant: "destructive",
            })
        } finally {
            setIsSavingHealthNotes(false)
        }
    }

    const handleRevertHealthNotes = () => {
        setDogHealthNotes(originalHealthNotes)
        toast({
            title: "הערות שוחזרו",
            description: "הערות הבריאות שוחזרו לערך המקורי",
        })
    }

    const handleSaveAllChanges = async () => {
        if (!selectedDog?.id) return

        setIsSavingAllChanges(true)
        const errors: string[] = []

        try {
            console.log("💾 [DogDetailsSheet] Saving all changes...")

            // Save all notes in parallel
            const savePromises: Promise<void>[] = []

            // Save health notes if changed
            if (dogHealthNotes !== originalHealthNotes) {
                savePromises.push(
                    (async () => {
                        try {
                            console.log("💾 [DogDetailsSheet] Saving health notes:", dogHealthNotes)
                            const { error } = await supabase
                                .from("dogs")
                                .update({ health_notes: dogHealthNotes.trim() || null })
                                .eq("id", selectedDog.id)

                            if (error) throw error
                            setOriginalHealthNotes(dogHealthNotes.trim() || "")
                        } catch (error) {
                            console.error("❌ [DogDetailsSheet] Error saving health notes:", error)
                            errors.push("הערות הבריאות")
                        }
                    })()
                )
            }

            // Save customer notes if changed
            if (dogNotes !== originalNotes) {
                savePromises.push(
                    (async () => {
                        try {
                            console.log("💾 [DogDetailsSheet] Saving customer notes:", dogNotes)
                            const { error } = await supabase
                                .from("dogs")
                                .update({ notes: dogNotes.trim() || null })
                                .eq("id", selectedDog.id)

                            if (error) throw error
                            setOriginalNotes(dogNotes.trim() || "")
                        } catch (error) {
                            console.error("❌ [DogDetailsSheet] Error saving customer notes:", error)
                            errors.push("הערות הלקוח")
                        }
                    })()
                )
            }

            // Save grooming notes if changed
            if (dogGroomingNotes !== originalGroomingNotes) {
                savePromises.push(
                    (async () => {
                        try {
                            console.log("💾 [DogDetailsSheet] Saving grooming notes:", dogGroomingNotes)
                            const { error } = await supabase
                                .from("dogs")
                                .update({ grooming_notes: dogGroomingNotes.trim() || null })
                                .eq("id", selectedDog.id)

                            if (error) throw error
                            setOriginalGroomingNotes(dogGroomingNotes.trim() || "")
                        } catch (error) {
                            console.error("❌ [DogDetailsSheet] Error saving grooming notes:", error)
                            errors.push("הערות התספורת")
                        }
                    })()
                )
            }

            // Save staff notes if changed
            if (dogStaffNotes !== originalStaffNotes) {
                savePromises.push(
                    (async () => {
                        try {
                            console.log("💾 [DogDetailsSheet] Saving staff notes:", dogStaffNotes)
                            const { error } = await supabase
                                .from("dogs")
                                .update({ staff_notes: dogStaffNotes.trim() || null })
                                .eq("id", selectedDog.id)

                            if (error) throw error
                            setOriginalStaffNotes(dogStaffNotes.trim() || "")
                        } catch (error) {
                            console.error("❌ [DogDetailsSheet] Error saving staff notes:", error)
                            errors.push("הערות הצוות")
                        }
                    })()
                )
            }

            // Wait for all saves to complete
            await Promise.all(savePromises)

            if (errors.length > 0) {
                toast({
                    title: "שגיאה חלקית",
                    description: `לא ניתן היה לשמור: ${errors.join(", ")}`,
                    variant: "destructive",
                })
            } else {
                toast({
                    title: "הכל נשמר",
                    description: "כל השינויים נשמרו בהצלחה",
                })
            }
        } catch (error) {
            console.error("❌ [DogDetailsSheet] Error saving all changes:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לשמור את כל השינויים",
                variant: "destructive",
            })
        } finally {
            setIsSavingAllChanges(false)
        }
    }

    // Get current user ID
    useEffect(() => {
        const getCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setCurrentUserId(user.id)
            }
        }
        getCurrentUser()
    }, [])

    // Fetch desired goal images count
    useEffect(() => {
        const fetchImagesCount = async () => {
            if (!selectedDog?.id || !open) {
                setDesiredGoalImagesCount(null)
                return
            }

            try {
                const { count, error } = await supabase
                    .from("dog_desired_goal_images")
                    .select("*", { count: "exact", head: true })
                    .eq("dog_id", selectedDog.id)

                if (error) {
                    console.error("❌ [DogDetailsSheet] Error fetching desired goal images count:", error)
                    return
                }

                setDesiredGoalImagesCount(count ?? 0)
            } catch (error) {
                console.error("❌ [DogDetailsSheet] Unexpected error fetching images count:", error)
            }
        }

        fetchImagesCount()
    }, [selectedDog?.id, open])

    // Fetch all dog details when dog is selected
    useEffect(() => {
        const fetchDogDetails = async () => {
            if (!selectedDog?.id || !open) {
                // Reset state when sheet closes
                setDogNotes("")
                setDogStaffNotes("")
                setDogGroomingNotes("")
                setOriginalNotes("")
                setOriginalStaffNotes("")
                setOriginalGroomingNotes("")
                setDogHealthNotes("")
                setOriginalHealthNotes("")
                setDogVetName("")
                setDogVetPhone("")
                setDogGender("")
                setDogBirthDate(null)
                setDogAggressionRisk(null)
                setDogPeopleAnxious(null)
                setDogIsSmall(null)
                setDogCustomerId(null)
                setDogOwnerPhone(null)
                setDogOwnerName(null)
                return
            }

            setIsLoadingDogDetails(true)
            try {
                const result = await getDogById(selectedDog.id)
                if (result.success && result.dog) {
                    const dog = result.dog
                    const notesValue = dog.notes || ""
                    const staffNotesValue = dog.staff_notes || ""
                    const groomingNotesValue = dog.grooming_notes || ""
                    const healthNotesValue = dog.health_notes || ""
                    setDogNotes(notesValue)
                    setDogStaffNotes(staffNotesValue)
                    setDogGroomingNotes(groomingNotesValue)
                    setDogHealthNotes(healthNotesValue)
                    setOriginalNotes(notesValue)
                    setOriginalStaffNotes(staffNotesValue)
                    setOriginalGroomingNotes(groomingNotesValue)
                    setOriginalHealthNotes(healthNotesValue)
                    setDogVetName(dog.vet_name || "")
                    setDogVetPhone(dog.vet_phone || "")
                    setDogGender(dog.gender === "male" ? "זכר" : dog.gender === "female" ? "נקבה" : "")
                    setDogBirthDate(dog.birth_date || null)
                    setDogAggressionRisk(dog.aggression_risk)
                    setDogPeopleAnxious(dog.people_anxious)
                    setDogIsSmall(dog.is_small)
                    setDogCustomerId(dog.customer_id)

                    // Fetch customer data if we have a customer ID
                    if (dog.customer_id) {
                        // Fetch customer info (phone, name) if not already available
                        if (!selectedDog?.owner?.phone || !selectedDog?.owner?.name) {
                            try {
                                const { data: customerData, error: customerError } = await supabase
                                    .from("customers")
                                    .select("id, full_name, phone")
                                    .eq("id", dog.customer_id)
                                    .single()

                                if (!customerError && customerData) {
                                    setDogOwnerPhone(customerData.phone || null)
                                    setDogOwnerName(customerData.full_name || null)
                                }
                            } catch (error) {
                                console.error("Error fetching customer data:", error)
                            }
                        } else {
                            // Use owner data from selectedDog if available
                            setDogOwnerPhone(selectedDog.owner.phone || null)
                            setDogOwnerName(selectedDog.owner.name || null)
                        }

                        // Fetch customer contacts
                        const { data: contactsData, error: contactsError } = await supabase
                            .from("customer_contacts")
                            .select("*")
                            .eq("customer_id", dog.customer_id)
                            .order("created_at", { ascending: true })

                        if (!contactsError && contactsData) {
                            setDogContacts(contactsData)
                        }
                    }
                } else {
                    console.error("Error fetching dog details:", result.error)
                }
            } catch (error) {
                console.error("Error fetching dog details:", error)
            } finally {
                setIsLoadingDogDetails(false)
            }
        }

        fetchDogDetails()
    }, [open, selectedDog?.id])

    const handleDogUpdated = async () => {
        // Refresh all dog details after dog is updated
        if (selectedDog?.id) {
            try {
                const result = await getDogById(selectedDog.id)
                if (result.success && result.dog) {
                    const dog = result.dog
                    const notesValue = dog.notes || ""
                    const staffNotesValue = dog.staff_notes || ""
                    const groomingNotesValue = dog.grooming_notes || ""
                    const healthNotesValue = dog.health_notes || ""
                    setDogNotes(notesValue)
                    setDogStaffNotes(staffNotesValue)
                    setDogGroomingNotes(groomingNotesValue)
                    setDogHealthNotes(healthNotesValue)
                    setOriginalNotes(notesValue)
                    setOriginalStaffNotes(staffNotesValue)
                    setOriginalGroomingNotes(groomingNotesValue)
                    setOriginalHealthNotes(healthNotesValue)
                    setDogVetName(dog.vet_name || "")
                    setDogVetPhone(dog.vet_phone || "")
                    setDogGender(dog.gender === "male" ? "זכר" : dog.gender === "female" ? "נקבה" : "")
                    setDogBirthDate(dog.birth_date || null)
                    setDogAggressionRisk(dog.aggression_risk)
                    setDogPeopleAnxious(dog.people_anxious)
                    setDogIsSmall(dog.is_small)
                    setDogCustomerId(dog.customer_id)

                    // Fetch customer data if we have a customer ID
                    if (dog.customer_id) {
                        // Fetch customer info (phone, name) if not already available
                        if (!selectedDog?.owner?.phone || !selectedDog?.owner?.name) {
                            try {
                                const { data: customerData, error: customerError } = await supabase
                                    .from("customers")
                                    .select("id, full_name, phone")
                                    .eq("id", dog.customer_id)
                                    .single()

                                if (!customerError && customerData) {
                                    setDogOwnerPhone(customerData.phone || null)
                                    setDogOwnerName(customerData.full_name || null)
                                }
                            } catch (error) {
                                console.error("Error fetching customer data:", error)
                            }
                        } else {
                            // Use owner data from selectedDog if available
                            setDogOwnerPhone(selectedDog.owner.phone || null)
                            setDogOwnerName(selectedDog.owner.name || null)
                        }

                        // Fetch customer contacts
                        const { data: contactsData, error: contactsError } = await supabase
                            .from("customer_contacts")
                            .select("*")
                            .eq("customer_id", dog.customer_id)
                            .order("created_at", { ascending: true })

                        if (!contactsError && contactsData) {
                            setDogContacts(contactsData)
                        }
                    }
                }
            } catch (error) {
                console.error("Error refreshing dog details:", error)
            }
        }
    }

    return (
        <>
            <Sheet open={open} onOpenChange={handleOpenChange}>
                <SheetContent side="right" className="w-full max-w-md overflow-y-auto pt-12" dir="rtl">
                    <SheetHeader>
                        <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1">
                                <SheetTitle className="text-right">פרטי כלב</SheetTitle>
                                <SheetDescription className="text-right">צפו בכל הפרטים על הכלב.</SheetDescription>
                            </div>
                            {selectedDog?.id && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex-shrink-0"
                                        >
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-1" align="end">
                                        <div className="space-y-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                onClick={handleOpenEditDog}
                                            >
                                                <Pencil className="h-4 w-4 ml-2" />
                                                ערוך פרטי כלב
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                onClick={() => selectedDog && onShowDogAppointments(selectedDog.id, selectedDog.name)}
                                            >
                                                <Calendar className="h-4 w-4 ml-2" />
                                                הצג תורים של הכלב
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    </SheetHeader>

                    {selectedDog ? (() => {
                        // Check if there are any unsaved changes
                        const hasUnsavedChanges = 
                            (dogHealthNotes !== originalHealthNotes) ||
                            (dogNotes !== originalNotes) ||
                            (dogGroomingNotes !== originalGroomingNotes) ||
                            (dogStaffNotes !== originalStaffNotes)

                        return (
                            <div className="mt-6 space-y-6 text-right">
                            <div className="space-y-3">
                                <div className="space-y-2 text-sm text-gray-600">
                                    <div>
                                        שם הכלב: <span className="font-medium text-gray-900">{selectedDog.name}</span>
                                    </div>
                                    {selectedDog.breed && (
                                        <div>
                                            גזע: <button
                                                type="button"
                                                onClick={() => {
                                                    navigate(`/settings?mode=breeds&search=${encodeURIComponent(selectedDog.breed || "")}`)
                                                }}
                                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                            >
                                                {selectedDog.breed}
                                            </button>
                                        </div>
                                    )}
                                    <div>
                                        סיווג: <span className="font-medium text-gray-900">{selectedDog.clientClassification || 'לא ידוע'}</span>
                                    </div>
                                    {selectedDog.owner && (
                                        <div>
                                            בעלים: <button
                                                type="button"
                                                onClick={() => {
                                                    const clientPayload: ClientDetails = {
                                                        ...selectedDog.owner!,
                                                        clientId: dogCustomerId || selectedDog.owner?.clientId || selectedDog.owner?.recordId || selectedDog.customer_id,
                                                        recordId: dogCustomerId || selectedDog.owner?.clientId || selectedDog.owner?.recordId || selectedDog.customer_id,
                                                    }
                                                    dispatch(setSelectedClient(clientPayload))
                                                    dispatch(setIsClientDetailsOpen(true))
                                                    handleOpenChange(false) // Close dog sheet when opening client sheet
                                                }}
                                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                            >
                                                {selectedDog.owner.name}
                                            </button>
                                        </div>
                                    )}
                                    {selectedDog.owner?.customerTypeName && (
                                        <div>
                                            סוג לקוח: <span className="font-medium text-gray-900">{selectedDog.owner.customerTypeName}</span>
                                        </div>
                                    )}
                                    {selectedDog.age && (
                                        <div>
                                            גיל: <span className="font-medium text-gray-900">{selectedDog.age}</span>
                                        </div>
                                    )}
                                    {selectedDog.weight && (
                                        <div>
                                            משקל: <span className="font-medium text-gray-900">{selectedDog.weight} ק"ג</span>
                                        </div>
                                    )}
                                    {(dogGender || selectedDog.gender) && (
                                        <div>
                                            מין: <span className="font-medium text-gray-900">{dogGender || selectedDog.gender}</span>
                                        </div>
                                    )}
                                    <div>
                                        תאריך לידה: <span className="font-medium text-gray-900">
                                            {(dogBirthDate || selectedDog.birthDate) ? formatBirthDateWithAge(dogBirthDate || selectedDog.birthDate) : ''}
                                        </span>
                                    </div>
                                    {selectedDog.id && (
                                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                            <span className="text-xs text-gray-500">מזהה:</span>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        await navigator.clipboard.writeText(selectedDog.id)
                                                        toast({
                                                            title: "הועתק",
                                                            description: "מזהה הכלב הועתק ללוח",
                                                        })
                                                    } catch (err) {
                                                        console.error("Failed to copy:", err)
                                                    }
                                                }}
                                                className="text-xs text-gray-600 hover:text-gray-900 font-mono cursor-pointer hover:underline"
                                            >
                                                {selectedDog.id.slice(0, 8)}...
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Appointments and Payments Section */}
                            <Separator />
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-gray-900">תורים ותשלומים</h3>
                                <div className="space-y-2">
                                    <Button
                                        variant="outline"
                                        className="w-full justify-center gap-2"
                                        onClick={() => selectedDog && onShowDogAppointments(selectedDog.id, selectedDog.name)}
                                    >
                                        <Calendar className="h-4 w-4" />
                                        הצג תורים של {selectedDog.name}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-center gap-2"
                                        onClick={() => selectedDog && setIsPaymentsModalOpen(true)}
                                    >
                                        <CreditCard className="h-4 w-4" />
                                        הצג תשלומים של {selectedDog.name}
                                    </Button>
                                </div>
                            </div>

                            {/* Desired Goal Images Section */}
                            <Separator />
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-gray-900">תמונות מטרה רצויה</h3>
                                <Button
                                    variant="outline"
                                    className="w-full justify-center gap-2"
                                    onClick={() => setIsDesiredGoalImagesModalOpen(true)}
                                >
                                    <ImageIcon className="h-4 w-4" />
                                    {desiredGoalImagesCount === null
                                        ? "טוען..."
                                        : desiredGoalImagesCount === 0
                                        ? "הצג תמונות (אין תמונות שהועלו)"
                                        : `הצג תמונות (${desiredGoalImagesCount} תמונות)`}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-center gap-2"
                                    onClick={() => setIsDogAppointmentImagesModalOpen(true)}
                                >
                                    <ImageIcon className="h-4 w-4" />
                                    הצג תמונות מכל התורים
                                </Button>
                            </div>

                            {/* Health Notes Section */}
                            <Separator />
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-red-900">הערות בריאות</h3>
                                <Textarea
                                    value={dogHealthNotes || ""}
                                    onChange={(e) => setDogHealthNotes(e.target.value)}
                                    placeholder="הזן הערות בריאות..."
                                    className="min-h-[100px] text-right bg-red-50 border-red-200"
                                    dir="rtl"
                                />
                                {(dogHealthNotes !== originalHealthNotes) && (
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleSaveHealthNotes}
                                            disabled={isSavingHealthNotes}
                                            size="sm"
                                            className="flex-1"
                                            variant="outline"
                                        >
                                            {isSavingHealthNotes ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                                    שומר...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="h-4 w-4 ml-2" />
                                                    שמור הערות בריאות
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            onClick={handleRevertHealthNotes}
                                            disabled={isSavingHealthNotes}
                                            size="sm"
                                            variant="outline"
                                            className="flex-shrink-0"
                                        >
                                            <X className="h-4 w-4 ml-2" />
                                            ביטול
                                        </Button>
                                    </div>
                                )}
                            </div>


                            {/* Behavioral Information */}
                            {(dogAggressionRisk !== null || dogPeopleAnxious !== null || selectedDog.tendsToBite || selectedDog.aggressiveWithOtherDogs) && (
                                <>
                                    <Separator />
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-medium text-purple-900">מידע התנהגותי</h3>
                                        {dogPeopleAnxious !== null && (
                                            <div>
                                                <span className="text-sm text-gray-600">נוטה להיבהל ממגע במסגרת חדשה: </span>
                                                <span className={`font-medium ${dogPeopleAnxious ? 'text-purple-800' : 'text-gray-600'}`}>
                                                    {dogPeopleAnxious ? 'כן' : 'לא'}
                                                </span>
                                            </div>
                                        )}
                                        {dogAggressionRisk !== null && (
                                            <div>
                                                <span className="text-sm text-gray-600">סיכון תוקפנות כלפי כלבים אחרים: </span>
                                                <span className={`font-medium ${dogAggressionRisk ? 'text-purple-800' : 'text-gray-600'}`}>
                                                    {dogAggressionRisk ? 'כן' : 'לא'}
                                                </span>
                                            </div>
                                        )}
                                        {/* Legacy fields - keep for backward compatibility */}
                                        {selectedDog.tendsToBite && (
                                            <div>
                                                <h4 className="text-xs font-medium text-purple-800 mb-1">האם הכלב נוטה לנשוך אנשים או להיבהל ממגע במסגרת חדשה:</h4>
                                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                                    <p className="text-sm text-purple-800">{selectedDog.tendsToBite}</p>
                                                </div>
                                            </div>
                                        )}
                                        {selectedDog.aggressiveWithOtherDogs && (
                                            <div>
                                                <h4 className="text-xs font-medium text-purple-800 mb-1">האם הכלב עלול להפגין תוקפנות כלפי כלבים אחרים:</h4>
                                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                                    <p className="text-sm text-purple-800">{selectedDog.aggressiveWithOtherDogs}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Garden Information */}
                            {(selectedDog.hasBeenToGarden !== undefined || selectedDog.suitableForGardenFromQuestionnaire !== undefined || selectedDog.notSuitableForGardenFromQuestionnaire !== undefined) && (
                                <>
                                    <Separator />
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-medium text-green-900">מידע גן</h3>
                                        {selectedDog.hasBeenToGarden !== undefined && (
                                            <div>
                                                <span className="text-sm text-gray-600">האם הכלב היה בגן: </span>
                                                <span className={`font-medium ${selectedDog.hasBeenToGarden ? 'text-green-800' : 'text-gray-600'}`}>
                                                    {selectedDog.hasBeenToGarden ? 'כן' : 'לא'}
                                                </span>
                                            </div>
                                        )}
                                        {selectedDog.suitableForGardenFromQuestionnaire !== undefined && (
                                            <div>
                                                <span className="text-sm text-gray-600">האם נמצא מתאים לגן מהשאלון: </span>
                                                <span className={`font-medium ${selectedDog.suitableForGardenFromQuestionnaire ? 'text-green-800' : 'text-gray-600'}`}>
                                                    {selectedDog.suitableForGardenFromQuestionnaire ? 'כן' : 'לא'}
                                                </span>
                                            </div>
                                        )}
                                        {selectedDog.notSuitableForGardenFromQuestionnaire !== undefined && (
                                            <div>
                                                <span className="text-sm text-gray-600">האם נמצא לא מתאים לגן מהשאלון: </span>
                                                <span className={`font-medium ${selectedDog.notSuitableForGardenFromQuestionnaire ? 'text-red-800' : 'text-gray-600'}`}>
                                                    {selectedDog.notSuitableForGardenFromQuestionnaire ? 'כן' : 'לא'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Important Notes */}
                            {selectedDog.importantNotes && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-orange-900">משהו נוסף שחשוב שנדע</h3>
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                            <p className="whitespace-pre-wrap text-sm text-orange-800">{selectedDog.importantNotes}</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Internal Notes */}
                            {selectedDog.internalNotes && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-blue-900">הערות פנימי</h3>
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <p className="whitespace-pre-wrap text-sm text-blue-800">{selectedDog.internalNotes}</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Customer-facing Notes */}
                            <Separator />
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-gray-900">משהו חשוב שנדע</h3>
                                <Textarea
                                    value={dogNotes !== undefined ? dogNotes : (selectedDog.notes || "")}
                                    onChange={(e) => setDogNotes(e.target.value)}
                                    placeholder="הזן הערות לקוח על הכלב..."
                                    className="min-h-[100px] text-right bg-gray-50 border-gray-200"
                                    dir="rtl"
                                />
                                {(dogNotes !== originalNotes) && (
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleSaveNotes}
                                            disabled={isSavingNotes}
                                            size="sm"
                                            className="flex-1"
                                            variant="outline"
                                        >
                                            {isSavingNotes ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                                    שומר...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="h-4 w-4 ml-2" />
                                                    שמור הערות
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            onClick={handleRevertNotes}
                                            disabled={isSavingNotes}
                                            size="sm"
                                            variant="outline"
                                            className="flex-shrink-0"
                                        >
                                            <X className="h-4 w-4 ml-2" />
                                            ביטול
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Grooming Notes Section */}
                            <Separator />
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-purple-900">הערות לתספורת</h3>
                                <Textarea
                                    value={dogGroomingNotes || ""}
                                    onChange={(e) => setDogGroomingNotes(e.target.value)}
                                    placeholder="הזן הערות לתספורת..."
                                    className="min-h-[100px] text-right bg-purple-50 border-purple-200"
                                    dir="rtl"
                                />
                                {(dogGroomingNotes !== originalGroomingNotes) && (
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleSaveGroomingNotes}
                                            disabled={isSavingGroomingNotes}
                                            size="sm"
                                            className="flex-1"
                                            variant="outline"
                                        >
                                            {isSavingGroomingNotes ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                                    שומר...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="h-4 w-4 ml-2" />
                                                    שמור הערות תספורת
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            onClick={handleRevertGroomingNotes}
                                            disabled={isSavingGroomingNotes}
                                            size="sm"
                                            variant="outline"
                                            className="flex-shrink-0"
                                        >
                                            <X className="h-4 w-4 ml-2" />
                                            ביטול
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Staff Notes Section */}
                            <Separator />
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-blue-900">הערות צוות על הכלב</h3>
                                <Textarea
                                    value={dogStaffNotes !== undefined ? dogStaffNotes : (selectedDog.staffNotes || "")}
                                    onChange={(e) => setDogStaffNotes(e.target.value)}
                                    placeholder="הזן הערות צוות על הכלב..."
                                    className="min-h-[100px] text-right bg-blue-50 border-blue-200"
                                    dir="rtl"
                                />
                                {(dogStaffNotes !== originalStaffNotes) && (
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleSaveStaffNotes}
                                            disabled={isSavingStaffNotes}
                                            size="sm"
                                            className="flex-1"
                                            variant="outline"
                                        >
                                            {isSavingStaffNotes ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                                    שומר...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="h-4 w-4 ml-2" />
                                                    שמור הערות צוות
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            onClick={handleRevertStaffNotes}
                                            disabled={isSavingStaffNotes}
                                            size="sm"
                                            variant="outline"
                                            className="flex-shrink-0"
                                        >
                                            <X className="h-4 w-4 ml-2" />
                                            ביטול
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Save All Changes Button */}
                            {hasUnsavedChanges && (
                                <div className="mt-4">
                                    <Button
                                        onClick={handleSaveAllChanges}
                                        disabled={isSavingAllChanges || isSavingHealthNotes || isSavingNotes || isSavingGroomingNotes || isSavingStaffNotes}
                                        size="lg"
                                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                                    >
                                        {isSavingAllChanges ? (
                                            <>
                                                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                                שומר את כל השינויים...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 ml-2" />
                                                שמור את כל השינויים
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {selectedDog.medicalNotes && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-red-900">הערות רפואיות</h3>
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                            <p className="whitespace-pre-wrap text-sm text-red-800">{selectedDog.medicalNotes}</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Record Information */}
                            {(selectedDog.recordId || selectedDog.recordNumber) && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-gray-900">פרטי רשומה</h3>
                                        <div className="text-xs text-gray-500 space-y-1">
                                            {selectedDog.recordId && (
                                                <div>מזהה רשומה: <span className="font-mono text-gray-700">{selectedDog.recordId}</span></div>
                                            )}
                                            {selectedDog.recordNumber && (
                                                <div>מספר רשומה: <span className="font-mono text-gray-700">{selectedDog.recordNumber}</span></div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Messaging Actions */}
                            <MessagingActions
                                phone={dogOwnerPhone || selectedDog.owner?.phone}
                                name={dogOwnerName || selectedDog.owner?.name}
                                contacts={dogContacts}
                                customerId={dogCustomerId}
                            />

                            </div>
                        )
                    })() : (
                        <div className="py-12 text-center text-sm text-gray-500">לא נבחר כלב</div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Edit Dog Dialog */}
            <EditDogDialog
                open={isEditDogDialogOpen}
                onOpenChange={setIsEditDogDialogOpen}
                dogId={selectedDog?.id || null}
                onSuccess={handleDogUpdated}
            />

            {/* Dog Payments Modal */}
            {selectedDog && (
                <DogPaymentsModal
                    open={isPaymentsModalOpen}
                    onOpenChange={setIsPaymentsModalOpen}
                    dogId={selectedDog.id}
                    dogName={selectedDog.name}
                />
            )}

            {/* Desired Goal Images Modal */}
            {selectedDog && currentUserId && (
                <ImageGalleryModal
                    open={isDesiredGoalImagesModalOpen}
                    onOpenChange={(open) => {
                        setIsDesiredGoalImagesModalOpen(open)
                        // Refresh count when modal closes
                        if (!open && selectedDog?.id) {
                            supabase
                                .from("dog_desired_goal_images")
                                .select("*", { count: "exact", head: true })
                                .eq("dog_id", selectedDog.id)
                                .then(({ count }) => {
                                    setDesiredGoalImagesCount(count ?? 0)
                                })
                        }
                    }}
                    title="תמונות מטרה רצויה"
                    imageType="dog-desired-goal"
                    entityId={selectedDog.id}
                    userId={currentUserId}
                />
            )}

            {/* Dog Appointment Images Modal */}
            {selectedDog && (
                <DogAppointmentImagesModal
                    open={isDogAppointmentImagesModalOpen}
                    onOpenChange={setIsDogAppointmentImagesModalOpen}
                    dogId={selectedDog.id}
                    dogName={selectedDog.name}
                />
            )}
        </>
    )
}
