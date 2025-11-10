import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, Clock, Dog, MapPin, CheckCircle, Scissors, Bone, PlusCircle, ClipboardList, CreditCard, Loader2 } from "lucide-react"
import { reserveAppointment } from "@/integrations/supabase/supabaseService"
import confetti from "canvas-confetti"
import { skipToken } from "@reduxjs/toolkit/query"
import {
    supabaseApi,
    useGetAvailableDatesQuery,
    useGetClientSubscriptionsQuery,
    useGetDogGardenAppointmentsQuery,
    useListOwnerDogsQuery,
    type ListOwnerDogsResponse,
} from "@/store/services/supabaseApi"
import { useToast } from "@/components/ui/use-toast"
import { AddDogDialog } from "@/components/AddDogDialog"
import { useSupabaseAuthWithClientId } from "@/hooks/useSupabaseAuthWithClientId"
import { useAppDispatch } from "@/store/hooks"
import { FirstTimeGardenBanner } from "@/components/FirstTimeGardenBanner"
import { groomingPriceCopy, groomingPriceSections } from "@/copy/pricing"

const BUSINESS_TIME_ZONE = "Asia/Jerusalem"
const jerusalemDateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
})

// Utility function to convert date to Jerusalem time (DST-aware) for consistent date matching
function toJerusalemDateString(date: Date): string {
    const parts = jerusalemDateFormatter.formatToParts(date)
    const year = parts.find(part => part.type === "year")?.value ?? "0000"
    const month = parts.find(part => part.type === "month")?.value ?? "01"
    const day = parts.find(part => part.type === "day")?.value ?? "01"
    return `${year}-${month}-${day}`
}

// Confetti celebration function
const triggerConfetti = () => {
    console.log("🎊 triggerConfetti called!");
    const count = 200;
    const defaults = {
        origin: { y: 0.7 }
    };

    type ConfettiOptions = Parameters<typeof confetti>[0]

    function fire(particleRatio: number, opts: ConfettiOptions = {}) {
        console.log("🎊 Firing confetti with ratio:", particleRatio);
        confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio)
        });
    }

    fire(0.25, {
        spread: 26,
        startVelocity: 55,
    });

    fire(0.2, {
        spread: 60,
    });

    fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8
    });

    fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2
    });

    fire(0.1, {
        spread: 120,
        startVelocity: 45,
    });
};

interface Dog {
    id: string
    name: string
    breed: string
    size: string
    isSmall: boolean
    ownerId: string
    hasBeenToGarden?: boolean
    requiresSpecialApproval?: boolean
    groomingMinPrice?: number | null
    groomingMaxPrice?: number | null
    // Garden suitability fields
    questionnaireSuitableForGarden?: boolean // האם נמצא מתאים לגן מהשאלון
    staffApprovedForGarden?: string // האם מתאים לגן מילוי צוות (נמצא מתאים/נמצא לא מתאים/empty)
    hasRegisteredToGardenBefore?: boolean // האם הכלב נרשם בעבר לגן
}

interface AvailableDate {
    date: string
    available: boolean
    slots: number
    stationId: string
    availableTimes: AvailableTime[] // Add this to include cached time slots
}

interface AvailableTime {
    time: string
    available: boolean
    duration: number
    stationId: string
    requiresStaffApproval?: boolean
}

interface GardenQuestionnaireStatus {
    required: boolean
    completed: boolean
    formUrl?: string
    message?: string
}

interface SubscriptionCard {
    id: string
    planName: string | null
    status: string | null
    remainingUses: number | null
    totalUses: number | null
    purchasedAt: string | null
}

interface ClientSubscriptionsResponse {
    subscriptions: SubscriptionCard[]
}

interface ServiceSection {
    title: string
    content: React.ReactNode
}

const INACTIVE_STATUS_KEYWORDS = ["לאפעילה", "לאפעיל", "inactive", "בוטל", "בוטלה", "הוקפאה", "מושהה", "הסתיים", "לאזמין"]
const ACTIVE_STATUS_KEYWORDS = ["פעילה", "פעיל", "active", "available", "זמין", "בתוקף", "פתוחה"]

function normalizeStatus(status: string | null): string {
    return status?.toString().replace(/\s+/g, "").toLowerCase() ?? ""
}

function isSubscriptionActive(subscription: SubscriptionCard): boolean {
    const normalizedStatus = normalizeStatus(subscription.status)

    if (normalizedStatus && INACTIVE_STATUS_KEYWORDS.some((keyword) => normalizedStatus.includes(keyword))) {
        return false
    }

    const hasRemainingUses = typeof subscription.remainingUses === "number"
        ? subscription.remainingUses > 0
        : true

    if (!hasRemainingUses) {
        return false
    }

    if (!normalizedStatus) {
        return hasRemainingUses
    }

    return ACTIVE_STATUS_KEYWORDS.some((keyword) => normalizedStatus.includes(keyword))
}

function formatSubscriptionDate(value: string | null): string | null {
    if (!value) {
        return null
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return value
    }

    return parsed.toLocaleDateString("he-IL", { day: "2-digit", month: "short", year: "numeric" })
}

const ilsFormatter = new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
})

function formatIls(value: number): string {
    return ilsFormatter.format(value)
}

type ListOwnerDogsResponse = { dogs: Dog[] }
interface AvailableDatesResponse {
    availableDates: AvailableDate[]
    gardenQuestionnaire?: GardenQuestionnaireStatus
}

export default function SetupAppointment() {
    const [searchParams, setSearchParams] = useSearchParams()
    const navigate = useNavigate()
    const {
        user,
        clientId,
        clientIdError,
        isLoading: isAuthLoading,
        isFetchingClientId,
    } = useSupabaseAuthWithClientId()
    const dispatch = useAppDispatch()
    const [selectedDog, setSelectedDog] = useState<string>("")
    const [selectedServiceType, setSelectedServiceType] = useState<string>("grooming") // Default to barber
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
    const [selectedTime, setSelectedTime] = useState<string>("")
    const [selectedStationId, setSelectedStationId] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [comment, setComment] = useState("")
    const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string>("")
    const [selectedGardenVisitType, setSelectedGardenVisitType] = useState<"trial" | "regular" | undefined>(undefined)
    const [termsApproved, setTermsApproved] = useState(false)
    const [latePickupRequested, setLatePickupRequested] = useState(false)
    const [latePickupNotes, setLatePickupNotes] = useState("")
    const [gardenTrimNails, setGardenTrimNails] = useState(false)
    const [gardenBrush, setGardenBrush] = useState(false)
    const [gardenBath, setGardenBath] = useState(false)
    const [formStep, setFormStep] = useState<1 | 2>(1)
    const [isAddDogDialogOpen, setIsAddDogDialogOpen] = useState(false)
    const { toast } = useToast()

    const hasProcessedQueryParams = useRef(false)
    const selectedDogFromParams = useRef(false)

    const ownerId = useMemo(() => {
        if (clientId) {
            return clientId
        }

        if (!user) {
            return null
        }

        return user.user_metadata?.client_id || null
    }, [clientId, user])

    const {
        data: dogsQueryData,
        isFetching: isFetchingDogs,
        refetch: refetchDogs,
    } = useListOwnerDogsQuery(ownerId ?? skipToken, {
        skip: !ownerId,
    })

    const openAddDogForm = useCallback(() => {
        if (!ownerId) {
            console.warn("Cannot open add-dog form without ownerId")
            toast({
                title: "שגיאה",
                description: "לא ניתן להוסיף כלב ללא זיהוי לקוח",
                variant: "destructive",
            })
            return
        }
        setIsAddDogDialogOpen(true)
    }, [ownerId, toast])

    const handleAddDogSuccess = useCallback(async (dogId: string) => {
        // Refetch dogs and select the newly created dog
        const refetchResult = await refetchDogs()
        if (refetchResult.data) {
            const response = refetchResult.data as ListOwnerDogsResponse
            const newDog = response.dogs?.find((d) => d.id === dogId)
            if (newDog) {
                setSelectedDog(dogId)
            }
        }
    }, [refetchDogs, setSelectedDog])


    const {
        data: subscriptionsData,
        isFetching: isFetchingSubscriptions,
    } = useGetClientSubscriptionsQuery(ownerId ?? skipToken, {
        skip: !ownerId,
    })

    const dogs = useMemo<Dog[]>(() => {
        const response = dogsQueryData as ListOwnerDogsResponse | undefined
        return response?.dogs ?? []
    }, [dogsQueryData])

    const subscriptionsResponse = useMemo(() => subscriptionsData as ClientSubscriptionsResponse | undefined, [subscriptionsData])

    const subscriptions = useMemo<SubscriptionCard[]>(() => {
        return subscriptionsResponse?.subscriptions ?? []
    }, [subscriptionsResponse])

    const activeSubscriptions = useMemo<SubscriptionCard[]>(() => {
        return subscriptions.filter(isSubscriptionActive)
    }, [subscriptions])

    const selectedSubscription = useMemo<SubscriptionCard | null>(() => {
        if (!selectedSubscriptionId) {
            return null
        }
        return activeSubscriptions.find((subscription) => subscription.id === selectedSubscriptionId) ?? null
    }, [activeSubscriptions, selectedSubscriptionId])

    const selectedSubscriptionPurchaseDate = useMemo(() => {
        if (!selectedSubscription) {
            return null
        }
        return formatSubscriptionDate(selectedSubscription.purchasedAt)
    }, [selectedSubscription])

    const selectedDogDetails = useMemo(() => {
        return dogs.find((dog) => dog.id === selectedDog) ?? null
    }, [dogs, selectedDog])

    const groomingPriceRange = useMemo(() => {
        if (!selectedDogDetails) {
            return null
        }

        const min = typeof selectedDogDetails.groomingMinPrice === "number" ? selectedDogDetails.groomingMinPrice : null
        const max = typeof selectedDogDetails.groomingMaxPrice === "number" ? selectedDogDetails.groomingMaxPrice : null

        if (min === null && max === null) {
            return null
        }

        return { min, max }
    }, [selectedDogDetails])

    const includesGroomingService = useMemo(() => {
        return selectedServiceType === "grooming" || selectedServiceType === "both"
    }, [selectedServiceType])


    const serviceIntro = useMemo(() => {
        switch (selectedServiceType) {
            case "both":
                return "החבילה השלמה: תספורת מפנקת ויום כיף בגן שלנו."
            default:
                return null
        }
    }, [selectedServiceType])

    const serviceSections = useMemo<ServiceSection[]>(() => {
        const groomingSections: ServiceSection[] = groomingPriceSections.map((section) => ({
            title: section.title,
            content: (
                <div className="space-y-2">
                    {section.paragraphs.map((paragraph, index) => (
                        <p key={`${section.title}-${index}`}>{paragraph}</p>
                    ))}
                </div>
            ),
        }))

        const gardenSections: ServiceSection[] = [
            {
                title: "מה קורה בגן?",
                content: (
                    <div className="space-y-2">
                        <p>הגן שלנו הוא מקום קטן, אישי ומשפחתי – לכלבים קטנים בלבד 🐾</p>
                        <p>
                            בגן, הכלבלב שלכם יפרוק אנרגיה פיזית ומנטלית בקבוצה אינטימית של עד 10 כלבים. במהלך היום נשחק, נקשקש, נכיר חברים חדשים, נצא לטיול בפארק הסמוך, ננשנש – וגם נלקק 😉🐶
                        </p>
                        <p>הכל תמיד תחת השגחה צמודה, בסביבה נקייה ומטופחת, עם המון יחס אישי ואהבה 💛</p>
                    </div>
                ),
            },
            {
                title: "⏰ מתי מגיעים ומתי אוספים?",
                content: (
                    <div className="space-y-2">
                        <p>ניתן להביא את הכלב לגן החל מהשעה 08:30 בבוקר.</p>
                        <p>האיסוף הרגיל מתבצע עד 15:30.</p>
                        <p>ישנה אפשרות לאיסוף מאוחר עד 17:30.</p>
                    </div>
                ),
            },
        ]

        switch (selectedServiceType) {
            case "grooming":
                return groomingSections
            case "garden":
                return gardenSections
            case "both":
                return [
                    { title: "תספורת – מה כולל הטיפול?", content: groomingSections[0].content },
                    { title: "תספורת – כמה זה עולה?", content: groomingSections[1].content },
                    { title: "תספורת – כמה זמן זה לוקח?", content: groomingSections[2].content },
                    { title: "גן – מה מצפה לכלבלב?", content: gardenSections[0].content },
                    { title: "גן – מתי מגיעים ומתי אוספים?", content: gardenSections[1].content },
                ]
            default:
                return []
        }
    }, [selectedServiceType])

    // Fetch garden appointments for the selected dog to check if they already have scheduled appointments
    const {
        data: existingGardenAppointments = [],
        isFetching: isFetchingGardenAppointments,
    } = useGetDogGardenAppointmentsQuery(
        selectedDogDetails?.id ?? skipToken,
        {
            skip: !selectedDogDetails?.id,
        }
    )

    const datesQueryArg = selectedDog && selectedServiceType
        ? {
            dogId: selectedDog,
            serviceType: selectedServiceType,
            ...(selectedGardenVisitType ? { visitType: selectedGardenVisitType } : {}),
        }
        : skipToken

    const {
        data: availableDatesData,
        isFetching: isFetchingDates,
    } = useGetAvailableDatesQuery(datesQueryArg, {
        skip: !selectedDog || !selectedServiceType,
    })

    const availableDates = useMemo<AvailableDate[]>(() => {
        if (!availableDatesData) {
            return []
        }

        if (Array.isArray(availableDatesData)) {
            return availableDatesData as AvailableDate[]
        }

        return (availableDatesData as AvailableDatesResponse).availableDates ?? []
    }, [availableDatesData])

    // Track if we've completed initial data loading
    const hasInitialDataLoaded = useMemo(() => {
        const dogsLoaded = !isFetchingDogs && dogs.length > 0

        // If garden service is selected and we have a dog, also wait for garden appointments
        if (selectedServiceType === "garden" && selectedDogDetails?.id) {
            return dogsLoaded && !isFetchingGardenAppointments
        }

        return dogsLoaded
    }, [isFetchingDogs, dogs.length, selectedServiceType, selectedDogDetails?.id, isFetchingGardenAppointments])

    // Comprehensive loading state - only show full page loader for initial data loading
    const isPageLoading = useMemo(() => {
        // Only show full page loader if we haven't loaded initial data yet
        if (!hasInitialDataLoaded) {
            return true
        }

        return false
    }, [hasInitialDataLoaded])

    const isSelectedDogSmall = useMemo(() => {
        if (!selectedDogDetails) {
            return false
        }

        if (selectedDogDetails.isSmall === true) {
            return true
        }

        const rawSize = selectedDogDetails.size?.toString()
        if (!rawSize) {
            return false
        }

        const normalized = rawSize
            .normalize("NFKD")
            .toLowerCase()
            .replace(/[\s\u200f\u200e\p{P}\p{M}]/gu, "")

        if (!normalized) {
            return false
        }

        const SMALL_PATTERNS = [
            /קטן/, // Hebrew "small"
            /קטנה/, // feminine form
            /קט/, // fallback for combined strings like "גודל:קטן"
            /small/,
            /mini/,
        ]

        return SMALL_PATTERNS.some((pattern) => pattern.test(normalized))
    }, [selectedDogDetails])

    const gardenQuestionnaireStatus = useMemo<GardenQuestionnaireStatus | null>(() => {
        if (!availableDatesData || Array.isArray(availableDatesData)) {
            return null
        }

        return (availableDatesData as AvailableDatesResponse).gardenQuestionnaire ?? null
    }, [availableDatesData])

    const isGardenServiceSelected = selectedServiceType === "garden" || selectedServiceType === "both"
    const isExtrasStep = formStep === 2

    const isQuestionnaireBlocking = Boolean(
        isGardenServiceSelected && gardenQuestionnaireStatus?.required && !gardenQuestionnaireStatus.completed
    )

    const isSizeBlocking = Boolean(isGardenServiceSelected && !isSelectedDogSmall)

    useEffect(() => {
        if (!isGardenServiceSelected) {
            setLatePickupRequested(false)
            setLatePickupNotes("")
            setGardenTrimNails(false)
            setGardenBrush(false)
            setGardenBath(false)
        }
    }, [isGardenServiceSelected])

    // Garden suitability logic based on questionnaire and staff approval
    const gardenSuitabilityStatus = useMemo(() => {
        console.log("🌱 Garden suitability check:", {
            isGardenServiceSelected,
            selectedDogDetails: selectedDogDetails ? {
                id: selectedDogDetails.id,
                name: selectedDogDetails.name,
                questionnaireSuitableForGarden: selectedDogDetails.questionnaireSuitableForGarden,
                staffApprovedForGarden: selectedDogDetails.staffApprovedForGarden,
                hasBeenToGarden: selectedDogDetails.hasBeenToGarden
            } : null
        })

        if (!isGardenServiceSelected || !selectedDogDetails) {
            console.log("🌱 Garden suitability: No garden service or dog selected, allowing all")
            return { canBookFullDay: true, canBookTrial: true, message: null, isExplicitlyRejected: false }
        }

        const { questionnaireSuitableForGarden, staffApprovedForGarden, hasRegisteredToGardenBefore } = selectedDogDetails

        // If staff explicitly rejected for garden (נמצא לא מתאים), show rejection message
        if (staffApprovedForGarden === "נמצא לא מתאים") {
            console.log("🌱 Garden suitability: Staff explicitly rejected (נמצא לא מתאים), showing rejection message")
            return {
                canBookFullDay: false,
                canBookTrial: false,
                message: "מצטערים, נראה שהכלב שלכם לא מתאים לגן שלנו. אם אתם חושבים שזו טעות, אנא צרו איתנו קשר באופן פרטי",
                isExplicitlyRejected: true
            }
        }

        // If staff approved for garden (נמצא מתאים), allow full day regardless of questionnaire or registration history
        if (staffApprovedForGarden === "נמצא מתאים") {
            console.log("🌱 Garden suitability: Staff approved (נמצא מתאים), allowing full day")
            return { canBookFullDay: true, canBookTrial: true, message: null, isExplicitlyRejected: false }
        }

        // If questionnaire shows suitable for garden, allow full day regardless of staff approval
        // But if dog registered before, only allow full day (no trial)
        if (questionnaireSuitableForGarden === true) {
            console.log("🌱 Garden suitability: Questionnaire shows suitable, allowing full day")
            if (hasRegisteredToGardenBefore) {
                console.log("🌱 Garden suitability: Dog registered before, allowing only full day (no trial)")
                return { canBookFullDay: true, canBookTrial: false, message: null, isExplicitlyRejected: false }
            }
            return { canBookFullDay: true, canBookTrial: true, message: null, isExplicitlyRejected: false }
        }

        // If dog registered to garden before but questionnaire shows not suitable and no staff approval
        if (hasRegisteredToGardenBefore && questionnaireSuitableForGarden === false && staffApprovedForGarden !== "נמצא מתאים") {
            console.log("🌱 Garden suitability: Dog registered before but questionnaire shows not suitable and no staff approval, blocking completely")
            return {
                canBookFullDay: false,
                canBookTrial: false,
                message: "הכלב שלכם נרשם בעבר לגן אבל עדיין לא אושר על ידי הצוות. אנא המתינו לאישור הצוות לפני קביעת תור נוסף",
                isExplicitlyRejected: false
            }
        }

        // If dog registered to garden before, only allow full day (no trial)
        if (hasRegisteredToGardenBefore) {
            console.log("🌱 Garden suitability: Dog registered before, allowing only full day")
            return { canBookFullDay: true, canBookTrial: false, message: null, isExplicitlyRejected: false }
        }

        // If questionnaire shows not suitable but staff hasn't explicitly approved and dog never registered, only allow trial
        if (questionnaireSuitableForGarden === false && staffApprovedForGarden !== "נמצא מתאים") {
            console.log("🌱 Garden suitability: Questionnaire shows not suitable and no staff approval, restricting to trial only")
            return {
                canBookFullDay: false,
                canBookTrial: true,
                message: "מצאנו שהכלב שלכם עלול לא להתאים לגן שלנו. אתם יכולים להכניס אותו רק לניסיון עכשיו, אם נראה שהכלב יתאים טוב - נאפשר לכם לקבוע ימים מלאים",
                isExplicitlyRejected: false
            }
        }

        // If questionnaire field is empty/undefined (no questionnaire filled), allow full day by default
        if (questionnaireSuitableForGarden === undefined || questionnaireSuitableForGarden === null) {
            console.log("🌱 Garden suitability: No questionnaire filled, allowing full day by default")
            return { canBookFullDay: true, canBookTrial: true, message: null, isExplicitlyRejected: false }
        }

        // Default case - allow both
        console.log("🌱 Garden suitability: Default case, allowing all")
        return { canBookFullDay: true, canBookTrial: true, message: null, isExplicitlyRejected: false }
    }, [isGardenServiceSelected, selectedDogDetails])

    const isGardenBlocked = Boolean(isQuestionnaireBlocking || isSizeBlocking || gardenSuitabilityStatus.isExplicitlyRejected ||
        (gardenSuitabilityStatus.message && !gardenSuitabilityStatus.canBookTrial))


    const requiresGardenSubscription = isGardenServiceSelected && !isGardenBlocked && selectedGardenVisitType !== "trial"

    // Check if this is truly the first garden visit (never been to garden AND no existing garden appointments)
    // Only show banner for 'garden' service type, not for 'both' service type
    const hasExistingGardenAppointments = existingGardenAppointments?.appointments && existingGardenAppointments.appointments.length > 0
    const isFirstGardenVisit = Boolean(
        selectedServiceType === "garden" &&
        selectedDogDetails &&
        !selectedDogDetails.hasBeenToGarden &&
        !hasExistingGardenAppointments
    )

    // Log first garden visit status for debugging
    useEffect(() => {
        console.log("🌱 First garden visit check:", {
            isGardenServiceSelected,
            selectedDogDetails: selectedDogDetails ? {
                id: selectedDogDetails.id,
                name: selectedDogDetails.name,
                hasBeenToGarden: selectedDogDetails.hasBeenToGarden
            } : null,
            existingGardenAppointments: existingGardenAppointments?.appointments?.length || 0,
            existingGardenAppointmentsData: existingGardenAppointments,
            hasExistingGardenAppointments,
            isFirstGardenVisit,
            isGardenBlocked,
            isFetchingGardenAppointments
        })
    }, [isGardenServiceSelected, selectedDogDetails, isFirstGardenVisit, isGardenBlocked, existingGardenAppointments, hasExistingGardenAppointments, isFetchingGardenAppointments])

    useEffect(() => {
        if (!isGardenServiceSelected || !selectedDogDetails) {
            setSelectedGardenVisitType(undefined)
            return
        }

        setSelectedGardenVisitType((current) => {
            // For 'both' service type, always set to 'regular' (full day)
            if (selectedServiceType === "both") {
                console.log("🔄 Service type is 'both', setting visit type to 'regular' (full day)")
                return "regular"
            }

            // If dog can't book full day due to suitability restrictions, force trial
            if (!gardenSuitabilityStatus.canBookFullDay) {
                return "trial"
            }

            const defaultType = selectedDogDetails.hasBeenToGarden ? "regular" : "trial"

            if (selectedDogDetails.hasBeenToGarden && current === "trial") {
                return "regular"
            }

            return current ?? defaultType
        })
    }, [isGardenServiceSelected, selectedDogDetails, gardenSuitabilityStatus.canBookFullDay, selectedServiceType])

    useEffect(() => {
        if (!isGardenServiceSelected || !selectedGardenVisitType) {
            return
        }

        setSelectedDate(undefined)
        setSelectedTime("")
        setSelectedStationId("")
    }, [isGardenServiceSelected, selectedGardenVisitType])

    useEffect(() => {
        if (!requiresGardenSubscription) {
            if (selectedSubscriptionId) {
                setSelectedSubscriptionId("")
            }
            return
        }

        if (activeSubscriptions.length === 0) {
            if (selectedSubscriptionId) {
                setSelectedSubscriptionId("")
            }
            return
        }

        setSelectedSubscriptionId((current) => {
            if (current && activeSubscriptions.some((subscription) => subscription.id === current)) {
                return current
            }
            return activeSubscriptions[0]?.id ?? ""
        })
    }, [activeSubscriptions, requiresGardenSubscription, selectedSubscriptionId])

    const gardenQuestionnaireUrl = useMemo(() => {
        if (gardenQuestionnaireStatus?.formUrl) {
            return gardenQuestionnaireStatus.formUrl
        }

        if (isQuestionnaireBlocking && selectedDog) {
            const params = new URLSearchParams({
                If_been_on_garden: "0",
                if_want_to_garden: "1",
                id: selectedDog,
            })
            return `https://forms.fillout.com/t/7Py7msgepQus?${params.toString()}`
        }

        return undefined
    }, [gardenQuestionnaireStatus?.formUrl, isQuestionnaireBlocking, selectedDog])

    const gardenQuestionnaireMessage = useMemo(
        () =>
            gardenQuestionnaireStatus?.message ||
            "היי! לפני שנציע תורים לגן, נשמח שתמלאו את שאלון ההתאמה לגן עבור הכלב הזה.",
        [gardenQuestionnaireStatus?.message]
    )

    const gardenBlockingMessage = isSizeBlocking
        ? "מצטערים, הגן שלנו מיועד לכלבים קטנים שעברו התאמה."
        : gardenQuestionnaireMessage

    useEffect(() => {
        if (!selectedDog) {
            return
        }

        console.log("🐾 Garden eligibility", {
            selectedDog,
            dogName: selectedDogDetails?.name,
            rawSize: selectedDogDetails?.size,
            isSmallFlag: selectedDogDetails?.isSmall,
            computedIsSmall: isSelectedDogSmall,
            questionnaireCompleted: gardenQuestionnaireStatus?.completed,
            questionnaireRequired: gardenQuestionnaireStatus?.required,
            isGardenServiceSelected,
            isSizeBlocking,
            isQuestionnaireBlocking,
            isGardenBlocked,
        })
    }, [
        selectedDog,
        selectedDogDetails?.name,
        selectedDogDetails?.size,
        selectedDogDetails?.isSmall,
        isSelectedDogSmall,
        gardenQuestionnaireStatus?.completed,
        gardenQuestionnaireStatus?.required,
        isGardenServiceSelected,
        isSizeBlocking,
        isQuestionnaireBlocking,
        isGardenBlocked,
    ])

    const selectedDateKey = useMemo(() => (
        selectedDate ? toJerusalemDateString(selectedDate) : null
    ), [selectedDate])

    const selectedDateAvailability = useMemo(() => {
        if (!selectedDateKey) {
            return null
        }
        return availableDates.find((date) => date.date === selectedDateKey) ?? null
    }, [availableDates, selectedDateKey])

    const allAvailableTimes = useMemo<AvailableTime[]>(() => {
        if (availableDates.length === 0) {
            return []
        }
        return availableDates.flatMap((date) => date.availableTimes ?? [])
    }, [availableDates])

    const hasApprovalFreeSlotAcrossDates = useMemo(() => {
        if (allAvailableTimes.length === 0) {
            return false
        }
        const hasSlotWithoutApproval = allAvailableTimes.some((slot) => slot.requiresStaffApproval !== true && slot.available !== false)
        console.log("🧭 Approval-free slot scan", {
            totalSlots: allAvailableTimes.length,
            hasSlotWithoutApproval,
            requiresSpecialApproval: selectedDogDetails?.requiresSpecialApproval,
        })
        return hasSlotWithoutApproval
    }, [allAvailableTimes, selectedDogDetails?.requiresSpecialApproval])

    const requiresApprovalForAllSlots = useMemo(() => {
        const requiresBreedApproval = selectedDogDetails?.requiresSpecialApproval === true
        const approvalOnly = requiresBreedApproval && !hasApprovalFreeSlotAcrossDates
        console.log("🛡️ Approval mode evaluation", {
            requiresBreedApproval,
            hasApprovalFreeSlotAcrossDates,
            approvalOnly,
            serviceType: selectedServiceType,
        })
        return approvalOnly
    }, [hasApprovalFreeSlotAcrossDates, selectedDogDetails?.requiresSpecialApproval, selectedServiceType])

    const availableTimes = useMemo<AvailableTime[]>(() => {
        if (!selectedDateAvailability) {
            return []
        }

        const times = selectedDateAvailability.availableTimes ?? []
        if (times.length === 0) {
            return times
        }

        if (selectedDogDetails?.requiresSpecialApproval) {
            const hasFlexibleOption = times.some((slot) => slot.requiresStaffApproval !== true && slot.available !== false)
            const hasApprovalOnlyOption = times.some((slot) => slot.requiresStaffApproval === true)
            if (hasFlexibleOption && hasApprovalOnlyOption) {
                const filtered = times.filter((slot) => slot.requiresStaffApproval !== true)
                console.log("🟢 Filtering approval-required slots", {
                    date: selectedDateAvailability.date,
                    originalSlots: times.length,
                    filteredSlots: filtered.length,
                })
                return filtered
            }
        }

        return times
    }, [selectedDateAvailability, selectedDogDetails?.requiresSpecialApproval])

    useEffect(() => {
        if (!selectedTime) {
            return
        }

        const currentSlotExists = availableTimes.some((slot) => slot.time === selectedTime)
        if (currentSlotExists) {
            return
        }

        const fallbackSlot = availableTimes.find((slot) => slot.available !== false)
        if (fallbackSlot) {
            console.log("🔄 Switching to approval-free slot", {
                previousTime: selectedTime,
                newTime: fallbackSlot.time,
                stationId: fallbackSlot.stationId,
            })
            setSelectedTime(fallbackSlot.time)
            setSelectedStationId(fallbackSlot.stationId)
        } else {
            console.log("⚠️ No suitable slot available after filtering. Clearing selection.")
            setSelectedTime("")
            setSelectedStationId("")
        }
    }, [availableTimes, selectedTime])

    // Determine which button to show based on service type and approval availability
    const shouldShowRequestButton = useMemo(() => {
        if (selectedServiceType !== "grooming" && selectedServiceType !== "both") {
            return false
        }
        return requiresApprovalForAllSlots
    }, [requiresApprovalForAllSlots, selectedServiceType])

    const shouldShowBookButton = useMemo(() => {
        if (selectedServiceType === "garden") {
            return true
        }

        if (selectedServiceType === "grooming" || selectedServiceType === "both") {
            return !requiresApprovalForAllSlots
        }

        return false
    }, [requiresApprovalForAllSlots, selectedServiceType])

    const isLoadingDates = useMemo(() => (
        selectedDog && selectedServiceType ? isFetchingDates && availableDates.length === 0 : false
    ), [selectedDog, selectedServiceType, isFetchingDates, availableDates.length])

    const isGardenSubscriptionMissing = requiresGardenSubscription && (activeSubscriptions.length === 0 || !selectedSubscriptionId)
    const shouldShowPurchasePrompt = requiresGardenSubscription && !isFetchingSubscriptions && activeSubscriptions.length === 0
    const canShowScheduling = !requiresGardenSubscription || activeSubscriptions.length > 0 || isFetchingSubscriptions || shouldShowPurchasePrompt

    // Check if booking button is actually enabled (exact opposite of button disabled logic)
    const isBookingButtonEnabled = useMemo(() => {
        // For request button (special approval breeds) - requires time selection for grooming and both services
        if (shouldShowRequestButton) {
            const requiresTime = selectedServiceType === "grooming" || selectedServiceType === "both"
            const baseConditions = !selectedDog || !selectedServiceType || !selectedDate || isGardenBlocked || isGardenSubscriptionMissing || isLoading || !termsApproved
            const timeCondition = requiresTime ? !selectedTime : false
            const enabled = !(baseConditions || timeCondition)
            console.log("🔘 REQUEST BUTTON:", { enabled, shouldShowRequestButton, selectedServiceType, termsApproved })
            return enabled
        }

        // For book button (direct booking) - opposite of its disabled condition  
        if (shouldShowBookButton) {
            // For garden service, require dog, service, and date selection (but not time)
            if (selectedServiceType === "garden") {
                const enabled = !(!selectedDog || !selectedServiceType || !selectedDate || isGardenBlocked || isGardenSubscriptionMissing || isLoading || !termsApproved)
                console.log("🔘 GARDEN BOOK BUTTON:", { enabled, shouldShowBookButton, selectedDog: !!selectedDog, selectedServiceType, selectedDate: !!selectedDate, termsApproved })
                return enabled
            }
            // For grooming and both services, require date and time selection
            const enabled = !(!selectedDog || !selectedServiceType || !selectedDate || !selectedTime || isGardenBlocked || isGardenSubscriptionMissing || isLoading || !termsApproved)
            console.log("🔘 GROOMING/BOTH BOOK BUTTON:", { enabled, shouldShowBookButton, selectedServiceType, termsApproved })
            return enabled
        }

        console.log("🔘 NO BUTTON:", { shouldShowRequestButton, shouldShowBookButton })
        return false
    }, [selectedDog, selectedServiceType, selectedDate, selectedTime, isGardenBlocked, isGardenSubscriptionMissing, isLoading, shouldShowRequestButton, shouldShowBookButton, termsApproved])

    const requiresTimeSelection = selectedServiceType !== "garden"

    const canProceedToExtras = Boolean(
        selectedDog &&
        selectedServiceType &&
        selectedDate &&
        (!requiresTimeSelection || selectedTime) &&
        !isGardenBlocked &&
        !isGardenSubscriptionMissing &&
        !shouldShowPurchasePrompt
    )

    const bookingSteps = useMemo(() => ([
        { id: 1 as const, label: "פרטי התור" },
        { id: 2 as const, label: "תוספות ואישור" },
    ]), [])

    const isApprovalRequestMode = useMemo(() => shouldShowRequestButton && !shouldShowBookButton, [shouldShowBookButton, shouldShowRequestButton])

    const pageTitle = isApprovalRequestMode ? "בקשת תור" : "קבע תור"
    const pageSubtitle = isApprovalRequestMode
        ? "שלחו בקשה לטיפוח הכלב שלכם. הצוות יאשר את המועד לאחר בדיקה."
        : "קבע תור לטיפוח הכלב שלך"

    useEffect(() => {
        if (!selectedDate || !selectedDateKey) {
            return
        }

        if (isFetchingDates) {
            return
        }

        if (selectedServiceType === "garden") {
            return
        }

        if (selectedDateAvailability && selectedDateAvailability.available && (selectedDateAvailability.availableTimes?.length ?? 0) > 0) {
            return
        }

        setSelectedDate(undefined)
        setSelectedTime("")
        setSelectedStationId("")

        const params = new URLSearchParams(searchParams)
        params.delete('date')
        setSearchParams(params)
    }, [
        isFetchingDates,
        searchParams,
        selectedDate,
        selectedDateAvailability,
        selectedDateKey,
        setSearchParams,
        selectedServiceType,
    ])

    useEffect(() => {
        if (!isExtrasStep) {
            return
        }

        if (!canProceedToExtras) {
            setFormStep(1)
        }
    }, [isExtrasStep, canProceedToExtras])

    // Function to update URL with current selections
    const updateURL = useCallback((newServiceType?: string, newDate?: Date, newDogId?: string) => {
        const params = new URLSearchParams(searchParams)

        if (newServiceType) {
            params.set('serviceType', newServiceType)
        }

        if (newDate) {
            params.set('date', newDate.toISOString().split('T')[0])
        }

        const dogIdToUse = newDogId || selectedDog
        if (dogIdToUse) {
            params.set('dogId', dogIdToUse)
        }

        setSearchParams(params)
    }, [searchParams, selectedDog, setSearchParams])

    // Function to handle query parameters
    const processQueryParams = useCallback(() => {
        const serviceType = searchParams.get('serviceType')
        const date = searchParams.get('date')
        const dogId = searchParams.get('dogId')

        console.log('🔍 Processing query params:', { serviceType, date, dogId })

        selectedDogFromParams.current = false

        if (dogId) {
            const dogExists = dogs.some((dog) => dog.id === dogId)
            if (dogExists) {
                console.log('✅ Setting dog from query param:', dogId)
                setSelectedDog(dogId)
                selectedDogFromParams.current = true
            } else {
                console.warn('❌ Dog ID from query param not found:', dogId)
                selectedDogFromParams.current = false
            }
        }

        if (serviceType && ['grooming', 'garden', 'both'].includes(serviceType)) {
            console.log('✅ Setting service type from query param:', serviceType)
            setSelectedServiceType(serviceType)
        }

        if (date) {
            const parsedDate = new Date(date)
            if (!isNaN(parsedDate.getTime())) {
                console.log('✅ Setting date from query param:', parsedDate)
                setSelectedDate(parsedDate)
            } else {
                console.warn('❌ Invalid date in query param:', date)
            }
        }
    }, [dogs, searchParams])

    const handleSubscriptionChange = useCallback((value: string) => {
        if (value === "__add_subscription__") {
            navigate('/subscriptions')
            return
        }

        setSelectedSubscriptionId(value)
    }, [navigate])

    useEffect(() => {
        if (!hasProcessedQueryParams.current && dogs.length > 0) {
            processQueryParams()
            hasProcessedQueryParams.current = true
        }
    }, [dogs.length, processQueryParams])

    useEffect(() => {
        if (dogs.length > 0 && !selectedDog && hasProcessedQueryParams.current && !selectedDogFromParams.current) {
            const fallbackDogId = dogs[0].id
            setSelectedDog(fallbackDogId)
            const params = new URLSearchParams(searchParams)
            params.set('dogId', fallbackDogId)
            setSearchParams(params)
        }
    }, [dogs, selectedDog, searchParams, setSearchParams])

    // Early returns after all hooks are called
    if (isAuthLoading || isFetchingClientId) {
        return (
            <div className="min-h-screen flex items-center justify-center" dir="rtl">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">
                        {isFetchingClientId ? "מאמת פרטי חשבון..." : "טוען נתוני משתמש..."}
                    </p>
                </div>
            </div>
        )
    }

    if (!user || !ownerId) {
        return (
            <div className="min-h-screen flex items-center justify-center" dir="rtl">
                <Card className="w-full max-w-md">
                    <CardContent className="p-6 text-center">
                        <p className="text-gray-600">
                            {clientIdError
                                ? `לא הצלחנו לזהות את החשבון: ${clientIdError.message}`
                                : "אנא התחבר כדי לקבוע תורים"}
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Show loading state while fetching dogs
    if (isFetchingDogs) {
        return (
            <div className="min-h-screen flex items-center justify-center" dir="rtl">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">טוען רשימת כלבים...</p>
                </div>
            </div>
        )
    }

    // Guard for users with no dogs - only show after API call completes
    if (!isFetchingDogs && dogs.length === 0) {
        return (
            <div className="min-h-screen py-8" dir="rtl">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{pageTitle}</h1>
                        <p className="text-gray-600">{pageSubtitle}</p>
                    </div>

                    <div className="flex justify-center">
                        <Card className="w-full max-w-md">
                            <CardContent className="p-8 text-center">
                                <div className="mb-6">
                                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Dog className="h-8 w-8 text-blue-600" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                        אין לך כלבים רשומים
                                    </h2>
                                    <p className="text-gray-600 mb-6">
                                        כדי לקבוע תור, אנא מלא את הטופס להוספת כלב
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <Button
                                        onClick={openAddDogForm}
                                        className="w-full"
                                        size="lg"
                                    >
                                        <PlusCircle className="h-4 w-4 mr-2" />
                                        הוסף כלב חדש
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Add Dog Dialog - rendered here so it's available when no dogs exist */}
                <AddDogDialog
                    open={isAddDogDialogOpen}
                    onOpenChange={setIsAddDogDialogOpen}
                    customerId={ownerId}
                    onSuccess={handleAddDogSuccess}
                />
            </div>
        )
    }

    const handleDogChange = (dogId: string) => {
        if (dogId === "__add_new__") {
            openAddDogForm()
            // Reset select to previous value (don't actually select __add_new__)
            return
        }

        setSelectedDog(dogId)
        setSelectedDate(undefined)
        setSelectedTime("")
        setSelectedStationId("")
        setComment("")
        setTermsApproved(false)
        setLatePickupRequested(false)
        setLatePickupNotes("")
        setFormStep(1)

        selectedDogFromParams.current = false
        updateURL(undefined, undefined, dogId)
    }

    const handleServiceTypeChange = (serviceType: string) => {
        setSelectedServiceType(serviceType)
        setSelectedDate(undefined)
        setSelectedTime("")
        setSelectedStationId("")
        setComment("")
        setTermsApproved(false)
        setLatePickupRequested(false)
        setLatePickupNotes("")
        setFormStep(1)

        // Update URL with new service type
        updateURL(serviceType)
    }

    const handleDateSelect = (date: Date | undefined) => {
        if (date) {
            const dateKey = toJerusalemDateString(date)
            const availability = availableDates.find((availableDate) => availableDate.date === dateKey)
            const requiresTimes = selectedServiceType !== "garden"
            const hasTimes = (availability?.availableTimes?.length ?? 0) > 0

            if (!availability || !availability.available || availability.slots === 0) {
                return
            }
            if (requiresTimes && !hasTimes) {
                return
            }
        }

        setSelectedDate(date)
        setSelectedTime("")
        setSelectedStationId("")
        setFormStep(1)

        if (date) {
            updateURL(selectedServiceType, date)
        }
    }

    const handleContinueToExtras = () => {
        const requiresTime = selectedServiceType !== "garden"

        if (!selectedDog) {
            setError("אנא בחר כלב לפני המעבר לשלב הבא")
            return
        }

        if (!selectedServiceType) {
            setError("אנא בחר סוג שירות כדי להמשיך")
            return
        }

        if (!selectedDate) {
            setError("אנא בחר תאריך לתור לפני המעבר לשלב הבא")
            return
        }

        if (requiresTime && !selectedTime) {
            setError("אנא בחר שעה פנויה כדי להמשיך")
            return
        }

        if (isGardenBlocked) {
            setError(gardenBlockingMessage)
            return
        }

        if (isGardenSubscriptionMissing || shouldShowPurchasePrompt) {
            setError("כדי לקבוע תור לגן יש לבחור כרטיסייה פעילה לחיוב")
            return
        }

        setError(null)
        setSuccess(null)
        setFormStep(2)
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    const handleBackToDetails = () => {
        setFormStep(1)
    }

    const handleReservation = async () => {
        if (!selectedDog || !selectedServiceType || !selectedDate) {
            setError("אנא בחר כלב, סוג שירות ותאריך")
            return
        }

        if (!termsApproved) {
            setError("אנא אשר את תקנון הגן והמספרה כדי להמשיך")
            setSuccess(null)
            return
        }

        if (isGardenBlocked) {
            setError(gardenBlockingMessage)
            setSuccess(null)
            return
        }

        if (isGardenSubscriptionMissing) {
            setError("כדי להזמין מקום לגן יש לבחור כרטיסייה פעילה לחיוב")
            setSuccess(null)
            return
        }

        setIsLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const dateString = toJerusalemDateString(selectedDate)
            const trimmedNotes = comment.trim()
            const subscriptionNote = requiresGardenSubscription && selectedSubscription
                ? `כרטיסייה לחיוב: ${selectedSubscription.planName ? `${selectedSubscription.planName} (ID: ${selectedSubscription.id})` : selectedSubscription.id}`
                : null
            const finalNotes = [subscriptionNote, trimmedNotes].filter((value) => value && value.length > 0).join(" | ")
            const notesPayload = finalNotes.length > 0 ? finalNotes : undefined
            const trimmedLatePickupNotes = latePickupNotes.trim()
            console.log("Reserving appointment with:", {
                selectedDog,
                dateString,
                selectedStationId,
                selectedTime,
                notes: notesPayload,
                subscriptionId: selectedSubscription?.id,
            })
            const result = await reserveAppointment(
                selectedDog,
                dateString,
                selectedStationId,
                selectedTime,
                notesPayload,
                selectedGardenVisitType === "trial",
                selectedServiceType,
                isGardenServiceSelected ? latePickupRequested : undefined,
                isGardenServiceSelected ? (trimmedLatePickupNotes || undefined) : undefined,
                isGardenServiceSelected ? gardenTrimNails : undefined,
                isGardenServiceSelected ? gardenBrush : undefined,
                isGardenServiceSelected ? gardenBath : undefined
            )
            console.log("Reserve appointment result:", result)

            if (result.success) {
                console.log("✅ Reservation successful, triggering confetti!")
                setSuccess("הבקשה נשלחה בהצלחה!")

                // Trigger confetti celebration
                console.log("🎉 About to trigger confetti...")
                triggerConfetti()
                console.log("🎉 Confetti triggered!")

                dispatch(supabaseApi.util.invalidateTags(["Availability", "Appointment", "GardenAppointment", "WaitingList"]))

                // Redirect to appointments page after a short delay
                setTimeout(() => {
                    navigate('/appointments')
                }, 2000) // 2 second delay to let user see the success message and confetti

                // Reset form
                setSelectedDate(undefined)
                setSelectedTime("")
                setSelectedStationId("")
                setComment("")
                setTermsApproved(false)
                setLatePickupRequested(false)
                setLatePickupNotes("")
                setGardenTrimNails(false)
                setGardenBrush(false)
                setGardenBath(false)
                setFormStep(1)
                setSearchParams(new URLSearchParams())
                selectedDogFromParams.current = false
            } else {
                console.log("❌ Reservation failed:", result.error)
                setError(result.error || "שגיאה בשליחת הבקשה")
            }
        } catch (err) {
            console.error("Failed to submit reservation:", err)
            setError("שגיאה בשליחת הבקשה")
        } finally {
            setIsLoading(false)
        }
    }

    const handleBookAppointment = async () => {
        // For garden service, only require dog, service, and date
        if (selectedServiceType === "garden") {
            if (!selectedDog || !selectedServiceType || !selectedDate) {
                setError("אנא בחר כלב, סוג שירות ותאריך")
                return
            }
        } else {
            // For grooming and both services, require all fields
            if (!selectedDog || !selectedServiceType || !selectedDate || !selectedTime || !selectedStationId) {
                setError("אנא בחר כלב, סוג שירות, תאריך, שעה ועמדה")
                return
            }
        }

        if (!termsApproved) {
            setError("אנא אשר את התקנון הגן והמספרה כדי להמשיך")
            setSuccess(null)
            return
        }

        if (isGardenBlocked) {
            setError(gardenBlockingMessage)
            setSuccess(null)
            return
        }

        if (isGardenSubscriptionMissing) {
            setError("כדי לקבוע תור לגן יש לבחור כרטיסייה פעילה לחיוב")
            setSuccess(null)
            return
        }

        setIsLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const dateString = toJerusalemDateString(selectedDate)
            const trimmedNotes = comment.trim()
            const subscriptionNote = requiresGardenSubscription && selectedSubscription
                ? `כרטיסייה לחיוב: ${selectedSubscription.planName ? `${selectedSubscription.planName} (ID: ${selectedSubscription.id})` : selectedSubscription.id}`
                : null
            const finalNotes = [subscriptionNote, trimmedNotes].filter((value) => value && value.length > 0).join(" | ")
            const notesPayload = finalNotes.length > 0 ? finalNotes : undefined
            // For garden service, use default values for station and time
            const stationId = selectedServiceType === "garden" ? "garden-default" : selectedStationId
            const time = selectedServiceType === "garden" ? "09:00" : selectedTime
            const trimmedLatePickupNotes = latePickupNotes.trim()

            console.log("Booking appointment with:", {
                selectedDog,
                dateString,
                stationId,
                time,
                notes: notesPayload,
                subscriptionId: selectedSubscription?.id,
                serviceType: selectedServiceType,
                appointmentType: selectedServiceType // Logging the appointment type being sent to webhook
            })
            const result = await reserveAppointment(
                selectedDog,
                dateString,
                stationId,
                time,
                notesPayload,
                selectedGardenVisitType === "trial",
                selectedServiceType,
                isGardenServiceSelected ? latePickupRequested : undefined,
                isGardenServiceSelected ? (trimmedLatePickupNotes || undefined) : undefined,
                isGardenServiceSelected ? gardenTrimNails : undefined,
                isGardenServiceSelected ? gardenBrush : undefined,
                isGardenServiceSelected ? gardenBath : undefined
            )
            console.log("Reserve appointment result:", result)

            if (result.success) {
                console.log("✅ Appointment booked successfully, triggering confetti!")
                setSuccess("התור נקבע בהצלחה!")

                // Trigger confetti celebration
                console.log("🎉 About to trigger confetti...")
                triggerConfetti()
                console.log("🎉 Confetti triggered!")

                dispatch(supabaseApi.util.invalidateTags(["Availability", "Appointment", "GardenAppointment", "WaitingList"]))

                // Redirect to appointments page after a short delay
                setTimeout(() => {
                    navigate('/appointments')
                }, 2000) // 2 second delay to let user see the success message and confetti

                // Reset form
                setSelectedDog("")
                setSelectedServiceType("grooming")
                setSelectedDate(undefined)
                setSelectedTime("")
                setSelectedStationId("")
                setComment("")
                setTermsApproved(false)
                setLatePickupRequested(false)
                setLatePickupNotes("")
                setGardenTrimNails(false)
                setGardenBrush(false)
                setGardenBath(false)
                setFormStep(1)
                setSearchParams(new URLSearchParams())
                selectedDogFromParams.current = false
            } else {
                console.log("❌ Appointment booking failed:", result.error)
                setError(result.error || "שגיאה בקביעת התור")
            }
        } catch (err) {
            console.error("Failed to book appointment:", err)
            setError("שגיאה בקביעת התור")
        } finally {
            setIsLoading(false)
        }
    }

    // Show loading spinner while waiting for all API calls to complete
    if (isPageLoading) {
        return (
            <div className="min-h-screen py-8 flex items-center justify-center" dir="rtl">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">טוען נתונים...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen py-8" dir="rtl">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{pageTitle}</h1>
                    <p className="text-gray-600">{pageSubtitle}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Side - Appointment Form */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5" />
                                <span>פרטי התור</span>
                            </CardTitle>
                            <CardDescription>
                                בחר את הכלב שלך, התאריך והשעה המועדפים
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col gap-3 mt-3">
                                <div className="flex justify-center gap-6 sm:gap-8">
                                    {bookingSteps.map((step) => {
                                        const isActive = formStep === step.id
                                        const isCompleted = formStep > step.id
                                        const circleClass = isActive
                                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                            : isCompleted
                                                ? "bg-blue-100 text-blue-700 border-blue-200"
                                                : "border-gray-300 text-gray-500"
                                        const labelClass = isActive ? "text-blue-700 font-semibold" : "text-gray-500"
                                        const isClickable = step.id < formStep

                                        return (
                                            <button
                                                key={step.id}
                                                type="button"
                                                onClick={() => {
                                                    if (isClickable) {
                                                        setFormStep(step.id)
                                                        window.scrollTo({ top: 0, behavior: "smooth" })
                                                    }
                                                }}
                                                className={`flex flex-col items-center gap-2 transition ${isClickable ? "hover:scale-[1.02]" : "cursor-default"}`}
                                                disabled={!isClickable}
                                            >
                                                <div className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm ${circleClass} ${isClickable ? "border-blue-400" : ""}`}>
                                                    {step.id}
                                                </div>
                                                <span className={`text-xs ${labelClass}`}>{step.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>

                                {formStep === 2 && (
                                    <div className="flex justify-center">
                                        <Button
                                            variant="ghost"
                                            onClick={handleBackToDetails}
                                            className="flex flex-row-reverse items-center justify-center gap-2 text-sm text-slate-700 hover:text-slate-900"
                                        >
                                            <span className="font-medium">חזרה לשלב הקודם</span>
                                            <span className="text-lg">→</span>
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div className={formStep === 1 ? "space-y-6" : "hidden"}>
                                {/* Dog Selection */}
                                <div className="space-y-2 ">
                                    <label className="text-sm font-medium text-gray-700 text-right block">בחר כלב</label>
                                    <Select value={selectedDog} onValueChange={handleDogChange}>
                                        <SelectTrigger className="text-right [&>span]:text-right" dir="rtl">
                                            <SelectValue placeholder="בחר את הכלב שלך" />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                            {dogs.map((dog) => (
                                                <SelectItem key={dog.id} value={dog.id} className="text-right">
                                                    <div className="flex items-center justify-end w-full gap-2">
                                                        <Dog className="h-4 w-4" />
                                                        <span>{dog.name}</span>
                                                        <Badge variant="outline">{dog.breed}</Badge>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                            <SelectItem value="__add_new__" className="text-right text-blue-600">
                                                <div className="flex items-center justify-end w-full gap-2">
                                                    <PlusCircle className="h-4 w-4" />
                                                    <span>הוסף כלב חדש</span>
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Service Type Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 text-right block">בחר סוג שירות</label>
                                    <Select value={selectedServiceType} onValueChange={handleServiceTypeChange}>
                                        <SelectTrigger className="text-right [&>span]:text-right" dir="rtl">
                                            <SelectValue placeholder="בחר את סוג השירות" />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                            <SelectItem value="grooming" className="text-right">
                                                <div className="flex items-center justify-end w-full gap-2">
                                                    <Scissors className="h-4 w-4 text-blue-600" />
                                                    <span>תספורת</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="garden" className="text-right">
                                                <div className="flex items-center justify-end w-full gap-2">
                                                    <Bone className="h-4 w-4 text-amber-600" />
                                                    <span>גן</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="both" className="text-right">
                                                <div className="flex items-center justify-end w-full gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <Scissors className="h-3 w-3 text-blue-600" />
                                                        <Bone className="h-3 w-3 text-amber-600" />
                                                    </div>
                                                    <span>תספורת וגן</span>
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {includesGroomingService && groomingPriceRange && (
                                        <p className="text-sm text-gray-600 text-right">
                                            מחיר לתספורת: {groomingPriceRange.max !== null ? formatIls(groomingPriceRange.max) : "נקבע בפגישה"} - {groomingPriceRange.min !== null ? formatIls(groomingPriceRange.min) : "נקבע בפגישה"}
                                        </p>
                                    )}

                                    {selectedDog && selectedServiceType === 'grooming' && isSelectedDogSmall && (
                                        <label
                                            htmlFor="add-garden-option"
                                            className="mt-2 flex items-center justify-end gap-2 flex-row-reverse text-xs text-gray-600 cursor-pointer"
                                            dir="rtl"
                                        >
                                            <span>אשמח להשאיר את הגור גם בגן 💛</span>
                                            <input
                                                id="add-garden-option"
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300"
                                                onChange={(event) => {
                                                    if (event.target.checked) {
                                                        handleServiceTypeChange('both')
                                                    }
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>

                                {isGardenServiceSelected && isSizeBlocking && (
                                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-5 space-y-3 text-right">
                                        <div className="flex items-center justify-between flex-row-reverse gap-3">
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-semibold text-orange-800">הגן שלנו לחברים קטנים</h4>
                                                <p className="text-xs text-orange-700 leading-relaxed">
                                                    מצטערים, הגן שלנו מיועד לגורים קטנים בלבד. נשמח לראות אתכם בתספורת או בשירותים אחרים!
                                                </p>
                                            </div>
                                            <Bone className="hidden sm:block h-8 w-8 text-orange-400" />
                                        </div>
                                    </div>
                                )}

                                {isQuestionnaireBlocking && !isSizeBlocking && (
                                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2 text-right">
                                        <div className="flex items-center justify-between flex-row-reverse gap-3">
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-semibold text-blue-900">כמעט סיימנו!</h4>
                                                <p className="text-xs text-blue-700 leading-relaxed">
                                                    {gardenQuestionnaireMessage}
                                                </p>
                                            </div>
                                            <ClipboardList className="hidden sm:block h-8 w-8 text-blue-400" />
                                        </div>
                                        <div className="flex justify-start">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="border-blue-300 text-blue-700 hover:bg-blue-100 flex flex-row items-center gap-2"
                                                onClick={() => gardenQuestionnaireUrl && window.open(gardenQuestionnaireUrl, "_blank", "noopener,noreferrer")}
                                                disabled={!gardenQuestionnaireUrl}
                                            >
                                                <ClipboardList className="h-4 w-4" />
                                                מלאו את שאלון ההתאמה
                                            </Button>
                                        </div>
                                    </div>
                                )}



                                {/* Garden Explicit Rejection Warning */}
                                {isGardenServiceSelected && !isQuestionnaireBlocking && !isSizeBlocking && gardenSuitabilityStatus.isExplicitlyRejected && (
                                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3 text-right">
                                        <div className="flex items-center justify-between flex-row-reverse gap-3">
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-semibold text-red-800">לא מתאים לגן</h4>
                                                <p className="text-xs text-red-700 leading-relaxed">
                                                    {gardenSuitabilityStatus.message}
                                                </p>
                                            </div>
                                            <Bone className="hidden sm:block h-8 w-8 text-red-400" />
                                        </div>
                                    </div>
                                )}

                                {/* Garden Suitability Warning - Shows for trial-only or completely blocked cases */}
                                {isGardenServiceSelected && !isQuestionnaireBlocking && !isSizeBlocking && !gardenSuitabilityStatus.isExplicitlyRejected &&
                                    gardenSuitabilityStatus.message && (
                                        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-3 text-right">
                                            <div className="flex items-center justify-between flex-row-reverse gap-3">
                                                <div className="space-y-1">
                                                    <h4 className="text-sm font-semibold text-yellow-800">
                                                        {!gardenSuitabilityStatus.canBookTrial ? "המתינו לאישור הצוות" : "הגבלה זמנית לגן"}
                                                    </h4>
                                                    <p className="text-xs text-yellow-700 leading-relaxed">
                                                        {gardenSuitabilityStatus.message}
                                                    </p>
                                                </div>
                                                <Clock className="hidden sm:block h-8 w-8 text-yellow-400" />
                                            </div>
                                        </div>
                                    )}


                                {isFirstGardenVisit && !isGardenBlocked && !gardenSuitabilityStatus.isExplicitlyRejected && (
                                    <FirstTimeGardenBanner
                                        dogName={selectedDogDetails?.name ?? "החבר שלכם"}
                                        onSelectTrial={() => setSelectedGardenVisitType("trial")}
                                        onSkipTrial={() => setSelectedGardenVisitType("regular")}
                                        canSkipTrial={gardenSuitabilityStatus.canBookFullDay}
                                    />
                                )}

                                {requiresGardenSubscription && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 text-right block">
                                            בחר כרטיסייה לחיוב
                                        </label>

                                        {isFetchingSubscriptions ? (
                                            <div className="flex items-center justify-end gap-2 text-sm text-gray-500 py-2">
                                                <span>טוען כרטיסיות פעילות...</span>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            </div>
                                        ) : (
                                            <>
                                                <Select
                                                    value={selectedSubscriptionId}
                                                    onValueChange={handleSubscriptionChange}
                                                >
                                                    <SelectTrigger className="text-right [&>span]:text-right" dir="rtl">
                                                        <SelectValue placeholder={activeSubscriptions.length > 0 ? "בחר כרטיסייה פעילה" : "אין כרטיסיות פעילות"} />
                                                    </SelectTrigger>
                                                    <SelectContent dir="rtl">
                                                        {activeSubscriptions.map((subscription) => {
                                                            const purchaseDate = formatSubscriptionDate(subscription.purchasedAt)

                                                            return (
                                                                <SelectItem key={subscription.id} value={subscription.id} className="text-right">
                                                                    <div className="flex w-full items-center justify-between gap-3 flex-row">
                                                                        <CreditCard className="h-4 w-4 text-blue-500" />
                                                                        <div className="text-right">
                                                                            <div className="text-sm text-gray-900">
                                                                                {subscription.planName ?? "כרטיסייה ללא שם"}
                                                                            </div>
                                                                            {purchaseDate && (
                                                                                <div className="text-xs text-gray-500">
                                                                                    נרכש: {purchaseDate}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </SelectItem>
                                                            )
                                                        })}
                                                        <SelectItem value="__add_subscription__" className="text-right text-blue-600">
                                                            <div className="flex w-full items-center justify-between gap-3 flex-row-reverse">
                                                                <PlusCircle className="h-4 w-4" />
                                                                <span>רכישת כרטיסייה חדשה</span>
                                                            </div>
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>

                                                {selectedSubscription && (
                                                    <p className="text-xs text-gray-500 text-right">
                                                        נבחרה כרטיסייה: {selectedSubscription.planName ?? selectedSubscription.id}
                                                        {selectedSubscriptionPurchaseDate ? ` • נרכש: ${selectedSubscriptionPurchaseDate}` : ""}
                                                    </p>
                                                )}

                                                {activeSubscriptions.length === 0 && (
                                                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3 text-right">
                                                        <p className="text-sm text-blue-900 font-medium">
                                                            כדי לקבוע תור לגן יש לרכוש כרטיסייה פעילה.
                                                        </p>
                                                        <p className="text-xs text-blue-700">
                                                            ניתן לרכוש כרטיסייה חדשה בלחיצה על הכפתור הבא.
                                                        </p>
                                                        <div className="flex justify-start">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                className="border-blue-300 text-blue-700 hover:bg-blue-100 flex flex-row items-center gap-2"
                                                                onClick={() => navigate('/subscriptions')}
                                                            >
                                                                <CreditCard className="h-4 w-4" />
                                                                לרכישת כרטיסייה
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Date Selection - Hide when waiting list is enabled */}
                                {!isGardenBlocked && canShowScheduling && (!selectedDog || !selectedServiceType || isLoadingDates) && (
                                    <div className="space-y-4 text-center py-8">
                                        <div className="flex justify-center">
                                            <div className="relative">
                                                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                                    <Clock className="h-8 w-8 text-blue-600 animate-spin" />
                                                </div>
                                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full flex items-center justify-center animate-bounce">
                                                    <span className="text-sm">🔍</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-lg font-semibold text-gray-800">
                                                מחפשים עבורך את התור הקרוב ביותר...
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                אנחנו בודקים את כל התאריכים הזמינים עבור {selectedServiceType === 'grooming' ? 'תספורת' : selectedServiceType === 'garden' ? 'גן' : 'תספורת וגן'}
                                            </p>

                                        </div>
                                    </div>
                                )}

                                {/* Calendar - Hide when waiting list is enabled */}
                                {!isGardenBlocked && canShowScheduling && selectedDog && selectedServiceType && !isLoadingDates && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 text-right block">בחר תאריך</label>
                                        <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={handleDateSelect}
                                            className="rounded-md border"
                                            fromDate={new Date()} // Allow dates from today
                                            toDate={(() => {
                                                if (availableDates.length === 0) return new Date()
                                                const lastDate = new Date(availableDates[availableDates.length - 1].date)
                                                return new Date(lastDate.getTime() + 24 * 60 * 60 * 1000) // Add one day to include the last date
                                            })()}
                                            disabled={(date) => {
                                                if (availableDates.length === 0) return true;

                                                const dateString = toJerusalemDateString(date);
                                                const availableDate = availableDates.find(d => d.date === dateString);

                                                if (!availableDate || !availableDate.available || availableDate.slots === 0) {
                                                    return true;
                                                }

                                                if (selectedServiceType === "garden") {
                                                    return false;
                                                }

                                                const hasTimes = (availableDate.availableTimes?.length ?? 0) > 0
                                                return !hasTimes;
                                            }}
                                        />
                                        {availableDates.length === 0 && !isLoadingDates && (
                                            <p className="text-sm text-yellow-600 text-center">
                                                אין תאריכים זמינים עבור כלב זה החודש
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Time Selection - Hide when waiting list is enabled or garden-only service */}
                                {!isGardenBlocked && canShowScheduling && selectedDate && availableTimes.length > 0 && selectedServiceType !== "garden" && (
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-gray-700 text-right block">בחר שעה</label>
                                        <Select
                                            value={selectedTime}
                                            onValueChange={(value) => {
                                                if (value === "__clear__") {
                                                    setSelectedTime("")
                                                    setSelectedStationId("")
                                                    setFormStep(1)
                                                } else {
                                                    const timeSlot = availableTimes.find(t => t.time === value)
                                                    if (timeSlot) {
                                                        setSelectedTime(timeSlot.time)
                                                        setSelectedStationId(timeSlot.stationId)
                                                        setFormStep(1)
                                                    }
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="text-right [&>span]:text-right" dir="rtl">
                                                <SelectValue placeholder="בחר שעה" />
                                            </SelectTrigger>
                                            <SelectContent dir="rtl">
                                                {selectedTime && (
                                                    <SelectItem value="__clear__" className="text-right text-red-600">
                                                        <div className="flex items-center justify-end w-full gap-2 text-right">
                                                            <span>×</span>
                                                            <span>בטל בחירה</span>
                                                        </div>
                                                    </SelectItem>
                                                )}
                                                {availableTimes.map((timeSlot) => (
                                                    <SelectItem key={timeSlot.time} value={timeSlot.time} disabled={!timeSlot.available} className="text-right">
                                                        <div className="flex items-center justify-between w-full text-right gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <Clock className="h-4 w-4 text-gray-600" />
                                                                <span className="font-medium">{timeSlot.time}</span>
                                                            </div>
                                                            <div className="text-sm text-gray-500">
                                                                {timeSlot.duration} דקות - עמדה {timeSlot.stationId.slice(-4)}
                                                            </div>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                    </div>
                                )}

                                {!isGardenBlocked && selectedDog && !isLoadingDates && !shouldShowPurchasePrompt && selectedServiceType !== 'garden' && !selectedTime && (
                                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-2 text-right">
                                        <div className="flex items-center justify-between gap-3 flex-row-reverse">
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-semibold text-orange-800">לא מצאת שעה מתאימה?</h4>
                                                <p className="text-xs text-orange-600">
                                                    אין שעה בתאריך שאתם מחפשים? הרשמו לרשימת המתנה שלנו ונודיע לכם מיד כשיתפנה מקום.
                                                </p>
                                            </div>
                                            <CalendarIcon className="hidden sm:block h-8 w-8 text-orange-400" />
                                        </div>
                                        <div className="flex justify-start">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="border-orange-300 text-orange-700 hover:bg-orange-100 flex flex-rowitems-center gap-2"
                                                onClick={() => {
                                                    const params = new URLSearchParams()
                                                    params.set('tab', 'waitingList')
                                                    params.set('action', 'new')
                                                    params.set('dogId', selectedDog)
                                                    params.set('serviceType', selectedServiceType)
                                                    navigate(`/appointments?${params.toString()}`)
                                                }}
                                            >
                                                <CalendarIcon className="h-4 w-4" />
                                                בקש להתריע כשיש תור
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Comment Box */}
                                {!isGardenBlocked && canShowScheduling && selectedDate && (selectedTime || selectedServiceType === "garden") && (
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-gray-700 text-right block">
                                            הערות (אופציונלי)
                                        </label>
                                        <textarea
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            placeholder="השאר הערות או בקשות מיוחדות..."
                                            className="w-full p-3 border border-gray-300 rounded-md text-right resize-none"
                                            rows={3}
                                            dir="rtl"
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Button
                                        onClick={handleContinueToExtras}
                                        disabled={!canProceedToExtras}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-200 disabled:text-gray-500"
                                    >
                                        המשך לשלב הבא
                                    </Button>
                                    {!canProceedToExtras && (
                                        <p className="text-xs text-gray-500 text-right">
                                            מלאו את פרטי התור לפני מעבר לשלב הבא.
                                        </p>
                                    )}
                                </div>

                            </div>

                            <div className={formStep === 2 ? "space-y-6" : "hidden"}>
                                <div className="space-y-3">
                                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-right space-y-3">
                                        <h3 className="text-sm font-semibold text-slate-800">סיכום הבחירה</h3>
                                        <div className="space-y-2 text-xs text-slate-600">
                                            <div>
                                                <span className="font-medium">כלב:</span> {selectedDogDetails?.name ?? "לא נבחר"}
                                            </div>
                                            <div>
                                                <span className="font-medium">שירות:</span> {selectedServiceType === "grooming" ? "תספורת" : selectedServiceType === "garden" ? "גן" : "תספורת וגן"}
                                            </div>
                                            <div>
                                                <span className="font-medium">תאריך:</span> {selectedDate ? selectedDate.toLocaleDateString("he-IL", { day: "2-digit", month: "short", year: "numeric" }) : "לא נבחר"}
                                            </div>
                                            <div>
                                                <span className="font-medium">שעה:</span> {selectedServiceType === "garden" ? "יום מלא" : selectedTime || "לא נבחר"}
                                            </div>
                                            {comment.trim() && (
                                                <div>
                                                    <span className="font-medium">הערות:</span> {comment}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Garden add-on grooming options */}
                                {isGardenServiceSelected && !isGardenBlocked && canShowScheduling && selectedDate && (selectedTime || selectedServiceType === "garden") && (
                                    <div className="space-y-3" dir="rtl">
                                        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                                            <div>
                                                <h3 className="text-sm font-medium text-emerald-900">
                                                    שירותים נוספים בזמן הגן (אופציונלי)
                                                </h3>
                                                <p className="text-xs text-emerald-800 mt-1">
                                                    בחרו אם תרצו שנבצע טיפוח קצר במהלך השהות בגן.
                                                </p>
                                            </div>
                                            <div className="grid gap-2">
                                                <label
                                                    htmlFor="garden-trim-nails"
                                                    className="flex  items-center  gap-3 rounded-md border border-emerald-100 bg-white px-3 py-2 cursor-pointer hover:bg-emerald-50"
                                                >
                                                    <input
                                                        id="garden-trim-nails"
                                                        type="checkbox"
                                                        checked={gardenTrimNails}
                                                        onChange={(event) => setGardenTrimNails(event.target.checked)}
                                                        className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="text-sm text-emerald-900">לגזוז ציפורניים</span>
                                                </label>
                                                <label
                                                    htmlFor="garden-brush"
                                                    className="flex  items-center  gap-3 rounded-md border border-emerald-100 bg-white px-3 py-2 cursor-pointer hover:bg-emerald-50"
                                                >
                                                    <input
                                                        id="garden-brush"
                                                        type="checkbox"
                                                        checked={gardenBrush}
                                                        onChange={(event) => setGardenBrush(event.target.checked)}
                                                        className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="text-sm text-emerald-900">לסרק</span>
                                                </label>
                                                <label
                                                    htmlFor="garden-bath"
                                                    className="flex  items-center  gap-3 rounded-md border border-emerald-100 bg-white px-3 py-2 cursor-pointer hover:bg-emerald-50"
                                                >
                                                    <input
                                                        id="garden-bath"
                                                        type="checkbox"
                                                        checked={gardenBath}
                                                        onChange={(event) => setGardenBath(event.target.checked)}
                                                        className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="text-sm text-emerald-900">לקלח</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Late Pickup Preference */}
                                {isGardenServiceSelected && !isGardenBlocked && canShowScheduling && selectedDate && (selectedTime || selectedServiceType === "garden") && (
                                    <div className="space-y-3">
                                        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 space-y-3" dir="rtl">
                                            <div className="flex items-start gap-3">
                                                <input
                                                    id="late-pickup"
                                                    type="checkbox"
                                                    checked={latePickupRequested}
                                                    onChange={(event) => {
                                                        const checked = event.target.checked
                                                        setLatePickupRequested(checked)
                                                        if (!checked) {
                                                            setLatePickupNotes("")
                                                        }
                                                    }}
                                                    className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div className="text-right">
                                                    <label htmlFor="late-pickup" className="text-sm font-medium text-blue-900 cursor-pointer">
                                                        אני רוצה לאסוף את הכלב מאוחר יותר
                                                    </label>
                                                    <p className="text-xs text-blue-700 mt-1">
                                                        איסוף מאוחר זמין עד 17:30. נשמח לדעת אם יש פרטים מיוחדים שכדאי שנדע.
                                                    </p>
                                                </div>
                                            </div>

                                            {latePickupRequested && (
                                                <div className="space-y-2" dir="rtl">
                                                    <label className="text-sm font-medium text-blue-900 text-right block" htmlFor="late-pickup-notes">
                                                        פירוט האיסוף המאוחר (אופציונלי)
                                                    </label>
                                                    <textarea
                                                        id="late-pickup-notes"
                                                        value={latePickupNotes}
                                                        onChange={(event) => setLatePickupNotes(event.target.value)}
                                                        placeholder="ספרו לנו מתי תרצו לאסוף ומדוע"
                                                        className="w-full p-3 border border-blue-200 rounded-md text-right resize-none focus:border-blue-300 focus:ring-blue-300"
                                                        rows={3}
                                                        dir="rtl"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Terms and Conditions Checkbox */}
                                {!isGardenBlocked && canShowScheduling && selectedDate && (selectedTime || selectedServiceType === "garden") && (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-md">
                                            <input
                                                type="checkbox"
                                                id="terms-approval"
                                                checked={termsApproved}
                                                onChange={(e) => setTermsApproved(e.target.checked)}
                                                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <label htmlFor="terms-approval" className="text-sm text-gray-700 cursor-pointer text-right" dir="rtl">
                                                אני מאשר את{" "}
                                                <a
                                                    href="https://forms.fillout.com/t/9LotW8cYZHus"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:text-blue-800 underline"
                                                >
                                                    תקנון הגן והמספרה
                                                </a>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons - Show only one button based on service and breed requirements */}
                                <>
                                    {/* Request Button - for breeds requiring special approval */}
                                    {shouldShowRequestButton && (
                                        <>
                                            <Button
                                                onClick={handleReservation}
                                                disabled={
                                                    !selectedDog ||
                                                    !selectedServiceType ||
                                                    !selectedDate ||
                                                    (selectedServiceType === "grooming" && !selectedTime) ||
                                                    isGardenBlocked ||
                                                    isGardenSubscriptionMissing ||
                                                    isLoading ||
                                                    !termsApproved
                                                }
                                                className="w-full bg-green-600 hover:bg-green-700"
                                            >
                                                {isLoading ? "שולח בקשה..." : "שלח בקשה לתור"}
                                            </Button>

                                            {/* Warning message for request-only appointments */}
                                            {!(
                                                !selectedDog ||
                                                !selectedServiceType ||
                                                !selectedDate ||
                                                (selectedServiceType === "grooming" && !selectedTime) ||
                                                isGardenBlocked ||
                                                isGardenSubscriptionMissing ||
                                                isLoading ||
                                                !termsApproved
                                            ) && <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                                    <div className="flex items-start gap-2">
                                                        <div className="text-yellow-600 mt-0.5">⚠️</div>
                                                        <div className="text-sm text-yellow-800">
                                                            <p className="font-medium">התור לא נקבע עדיין</p>
                                                            <p className="text-xs mt-1">
                                                                הגזע של הכלב דורש אישור מיוחד. התור נשלח כבקשה ויאושר על ידי הצוות.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>}
                                        </>
                                    )}

                                    {/* Book Button - for direct booking */}
                                    {shouldShowBookButton && (
                                        <Button
                                            onClick={handleBookAppointment}
                                            disabled={!isBookingButtonEnabled}
                                            className="w-full bg-blue-600 hover:bg-blue-700"
                                        >
                                            {isLoading ? "קובע תור..." : "קבע תור"}
                                        </Button>
                                    )}
                                </>

                            </div>


                            {/* Error/Success Messages */}
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                                    <p className="text-red-600 text-sm">{error}</p>
                                </div>
                            )}

                            {success && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                                    <p className="text-green-600 text-sm flex items-center">
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        {success}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Right Side - Information */}
                    <div className="space-y-6">
                        {/* Selected Dog Info */}
                        {selectedDog && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Dog className="h-5 w-5" />
                                        <span>הכלב שנבחר</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {(() => {
                                        const dog = dogs.find(d => d.id === selectedDog)
                                        if (!dog) return null
                                        return (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                                        <Dog className="h-6 w-6 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-lg">{dog.name}</h3>
                                                        <p className="text-gray-600">{dog.breed}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </CardContent>
                            </Card>
                        )}

                        {/* Selected Service Type Info */}
                        {selectedServiceType && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Clock className="h-5 w-5" />
                                        <span>סוג השירות שנבחר</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-6">
                                        <div className="flex flex-col items-start gap-3">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedServiceType === 'grooming' ? 'bg-blue-100' :
                                                selectedServiceType === 'garden' ? 'bg-amber-100' :
                                                    'bg-purple-100'
                                                }`}>
                                                {selectedServiceType === 'grooming' && <Scissors className="h-6 w-6 text-blue-600" />}
                                                {selectedServiceType === 'garden' && <Bone className="h-6 w-6 text-amber-600" />}
                                                {selectedServiceType === 'both' && (
                                                    <div className="flex items-center gap-1">
                                                        <Scissors className="h-4 w-4 text-blue-600" />
                                                        <Bone className="h-4 w-4 text-amber-600" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="font-semibold text-lg">
                                                    {selectedServiceType === 'grooming' && 'תספורת'}
                                                    {selectedServiceType === 'garden' && 'גן'}
                                                    {selectedServiceType === 'both' && 'תספורת וגן'}
                                                </h3>
                                                {serviceIntro && (
                                                    <p className="text-sm text-gray-600">{serviceIntro}</p>
                                                )}
                                            </div>
                                        </div>
                                        {serviceSections.length > 0 && (
                                            <div className="space-y-5 text-sm leading-6 text-gray-700">
                                                {serviceSections.map((section, index) => (
                                                    <div key={section.title} className="space-y-2">
                                                        <p className="font-semibold text-gray-900">{section.title}</p>
                                                        {section.content}
                                                        {index === serviceSections.length - 1 && (
                                                            <p className="text-xs text-blue-700">
                                                                לפרטים נוספים בקרו בעמוד{' '}
                                                                <a href="/about" className="underline">האודות שלנו</a>.
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}




                    </div>
                </div>
            </div>

            {/* Add Dog Dialog */}
            <AddDogDialog
                open={isAddDogDialogOpen}
                onOpenChange={setIsAddDogDialogOpen}
                customerId={ownerId}
                onSuccess={handleAddDogSuccess}
            />
        </div>
    )
}
