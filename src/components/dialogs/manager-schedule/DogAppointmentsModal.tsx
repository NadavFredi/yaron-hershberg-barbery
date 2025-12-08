import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Loader2, Copy, Scissors, Bone, Grid3x3, Calendar, Pencil, Trash2, Sprout, Flower2 } from "lucide-react"
import { format, isSameDay } from "date-fns"
import { useGetMergedAppointmentsQuery } from "@/store/services/supabaseApi"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useStations } from "@/hooks/useStations"
import { useNavigate } from "react-router-dom"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { supabaseApi } from "@/store/services/supabaseApi"
import {
    setIsDetailsOpen,
    setIsDogDetailsOpen,
    setIsClientDetailsOpen,
    setIsConstraintDetailsOpen,
    setEditingGroomingAppointment,
    setEditingGardenAppointment,
    setGroomingEditOpen,
    setGardenEditOpen,
    setAppointmentToDelete,
    setDeleteConfirmationOpen,
    setShowBusinessAppointmentModal,
    setPrefillBusinessCustomer,
    setPrefillBusinessDog,
    setFinalizedDragTimes
} from "@/store/slices/managerScheduleSlice"
import { NewGardenAppointmentModal } from "./NewGardenAppointmentModal"
import { createManagerAppointment, managerDeleteAppointment } from "@/integrations/supabase/supabaseService"
import { extractGardenAppointmentId, extractGroomingAppointmentId } from "@/lib/utils"

interface MergedAppointmentApiResponse {
    id: string
    dogId: string
    dogName: string
    date: string
    time: string
    service: "grooming" | "garden" | "both"
    status: string
    stationId: string
    notes: string
    groomingNotes?: string
    gardenNotes?: string
    groomingStatus?: string
    gardenStatus?: string
    startDateTime: string
    endDateTime: string
    groomingAppointmentId?: string
    gardenAppointmentId?: string
    latePickupRequested?: boolean
    latePickupNotes?: string
    gardenTrimNails?: boolean
    gardenBrush?: boolean
    gardenBath?: boolean
}

interface DogAppointmentsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    dogId: string
    dogName: string
    onAppointmentClick: (appointment: ManagerAppointment) => void
}

export const DogAppointmentsModal: React.FC<DogAppointmentsModalProps> = ({
    open,
    onOpenChange,
    dogId,
    dogName,
    onAppointmentClick
}) => {
    const [activeTab, setActiveTab] = useState<'today' | 'future' | 'past'>('past')
    const [serviceFilter, setServiceFilter] = useState<'all' | 'garden' | 'grooming'>('all')
    const [confirmCopyDialogOpen, setConfirmCopyDialogOpen] = useState(false)
    const [groomingNotesToCopy, setGroomingNotesToCopy] = useState<string>("")
    const [isUpdatingGroomingNotes, setIsUpdatingGroomingNotes] = useState(false)
    const [isGardenModalOpen, setIsGardenModalOpen] = useState(false)
    const [dogBreedSize, setDogBreedSize] = useState<'small' | 'large' | null>(null)
    const [defaultGardenCustomer, setDefaultGardenCustomer] = useState<{ id: string; fullName?: string; phone?: string; email?: string } | null>(null)
    const [defaultGardenDog, setDefaultGardenDog] = useState<{ id: string; name: string; breed: string; size: string; isSmall: boolean; ownerId: string } | null>(null)
    const [defaultGardenDate, setDefaultGardenDate] = useState<Date | null>(null)
    const [isEditServiceSelectionOpen, setIsEditServiceSelectionOpen] = useState(false)
    const [pendingEditAppointment, setPendingEditAppointment] = useState<ManagerAppointment | null>(null)
    const [isDeleteServiceSelectionOpen, setIsDeleteServiceSelectionOpen] = useState(false)
    const [pendingDeleteAppointment, setPendingDeleteAppointment] = useState<ManagerAppointment | null>(null)
    const [gardenAppointmentTypes, setGardenAppointmentTypes] = useState<Map<string, { type: 'full-day' | 'hourly' | 'trial' | null; isTrial: boolean }>>(new Map())
    const { toast } = useToast()
    const navigate = useNavigate()
    const dispatch = useAppDispatch()

    // Fetch appointments for this specific dog
    const { data: dogAppointmentsData, isLoading, refetch } = useGetMergedAppointmentsQuery(dogId, {
        skip: !open, // Only fetch when modal is open
    })

    // Helper to safely refetch only when query is enabled
    const safeRefetch = () => {
        if (open && dogId) {
            try {
                refetch()
            } catch (error) {
                // Query might not be started yet, just invalidate tags instead
                console.warn("Could not refetch, invalidating tags instead:", error)
            }
        }
    }

    // Watch for edit/delete modal state changes to invalidate cache
    const groomingEditOpen = useAppSelector((state) => state.managerSchedule.groomingEditOpen)
    const gardenEditOpen = useAppSelector((state) => state.managerSchedule.gardenEditOpen)
    const deleteConfirmationOpen = useAppSelector((state) => state.managerSchedule.deleteConfirmationOpen)

    // Track previous states to detect when modals close
    const prevGroomingEditOpen = useRef(groomingEditOpen)
    const prevGardenEditOpen = useRef(gardenEditOpen)
    const prevDeleteConfirmationOpen = useRef(deleteConfirmationOpen)

    // Invalidate cache when edit/delete modals close (indicating an update/delete happened)
    useEffect(() => {
        const groomingJustClosed = prevGroomingEditOpen.current && !groomingEditOpen
        const gardenJustClosed = prevGardenEditOpen.current && !gardenEditOpen
        const deleteJustClosed = prevDeleteConfirmationOpen.current && !deleteConfirmationOpen

        if (groomingJustClosed || gardenJustClosed || deleteJustClosed) {
            // Invalidate the merged appointments cache for this dog
            dispatch(
                supabaseApi.util.invalidateTags([
                    "ManagerSchedule", // Invalidate manager schedule board
                    "Appointment",
                    "GardenAppointment",
                    { type: "Appointment", id: dogId },
                    { type: "Appointment", id: `getMergedAppointments-${dogId}` },
                ])
            )
            // Also refetch to ensure we have the latest data (only if query is enabled)
            if (open && dogId) {
                safeRefetch()
            }
        }

        // Update refs
        prevGroomingEditOpen.current = groomingEditOpen
        prevGardenEditOpen.current = gardenEditOpen
        prevDeleteConfirmationOpen.current = deleteConfirmationOpen
    }, [groomingEditOpen, gardenEditOpen, deleteConfirmationOpen, dogId, dispatch, refetch])

    // Fetch stations to get station names
    const { data: stations = [] } = useStations()

    // Create a map of station ID to station name
    const stationNameMap = useMemo(() => {
        const map = new Map<string, string>()
        stations.forEach(station => {
            map.set(station.id, station.name)
        })
        return map
    }, [stations])

    // Store original appointment data with grooming notes and service type
    const appointmentsWithGroomingNotes: Array<{
        appointment: ManagerAppointment
        groomingNotes?: string
        originalService: 'grooming' | 'garden' | 'both'
        date: string
        groomingAppointmentId?: string
        gardenAppointmentId?: string
    }> = Array.isArray(dogAppointmentsData) ? dogAppointmentsData.map((apt: any) => {
        const stationId = apt.stationId || ''
        // For garden-only appointments, don't show station name (garden doesn't use stations)
        // But for "both" appointments, show the station name (from the grooming appointment)
        const isGardenOnly = apt.service === 'garden'
        const stationName = isGardenOnly ? '' : (stationId ? (stationNameMap.get(stationId) || stationId) : 'לא ידוע')
        const appointment: ManagerAppointment = {
            id: apt.id,
            serviceType: apt.service === 'both' ? 'grooming' : apt.service as 'grooming' | 'garden',
            stationId: stationId,
            stationName: stationName,
            startDateTime: apt.startDateTime,
            endDateTime: apt.endDateTime,
            status: apt.status || 'confirmed',
            notes: apt.notes || '',
            internalNotes: apt.groomingNotes || apt.gardenNotes || '',
            groomingNotes: apt.groomingNotes || undefined,
            dogs: [{
                id: apt.dogId,
                name: apt.dogName,
                breed: '',
                size: '',
                isSmall: false,
                ownerId: '',
                clientName: '',
                clientPhone: '',
                clientEmail: '',
                clientClassification: '',
                internalNotes: ''
            }],
            clientId: '',
            clientName: '',
            clientPhone: '',
            clientEmail: '',
            clientClassification: '',
            latePickupRequested: apt.latePickupRequested,
            latePickupNotes: apt.latePickupNotes,
            gardenTrimNails: apt.gardenTrimNails,
            gardenBrush: apt.gardenBrush,
            gardenBath: apt.gardenBath,
        }
        return {
            appointment,
            groomingNotes: apt.groomingNotes || undefined,
            originalService: apt.service || 'grooming',
            date: format(new Date(apt.startDateTime), 'yyyy-MM-dd'),
            groomingAppointmentId: apt.groomingAppointmentId,
            gardenAppointmentId: apt.gardenAppointmentId,
        }
    }) : []

    const transformedAppointments: ManagerAppointment[] = appointmentsWithGroomingNotes.map(item => item.appointment)

    // Fetch dog breed size information and garden appointment types
    useEffect(() => {
        if (open && dogId) {
            const fetchDogBreedSize = async () => {
                try {
                    const { data: dogData, error } = await supabase
                        .from("dogs")
                        .select("breed_id, breeds(size_class)")
                        .eq("id", dogId)
                        .single()

                    if (!error && dogData) {
                        const breed = Array.isArray(dogData.breeds) ? dogData.breeds[0] : dogData.breeds
                        if (breed?.size_class === 'small') {
                            setDogBreedSize('small')
                        } else if (breed?.size_class === 'large') {
                            setDogBreedSize('large')
                        } else {
                            setDogBreedSize(null)
                        }
                    }
                } catch (error) {
                    console.error("Error fetching dog breed size:", error)
                    setDogBreedSize(null)
                }
            }

            const fetchGardenAppointmentTypes = async () => {
                try {
                    const { data: gardenAppointments, error } = await supabase
                        .from("daycare_appointments")
                        .select("id, service_type, questionnaire_result")
                        .eq("dog_id", dogId)

                    if (!error && gardenAppointments) {
                        const typesMap = new Map<string, { type: 'full-day' | 'hourly' | 'trial' | null; isTrial: boolean }>()
                        gardenAppointments.forEach((apt: any) => {
                            const serviceType = apt.service_type
                            const isTrial = serviceType === 'trial' || apt.questionnaire_result === 'pending'
                            let type: 'full-day' | 'hourly' | 'trial' | null = null

                            if (serviceType === 'trial') {
                                type = 'trial'
                            } else if (serviceType === 'hourly') {
                                type = 'hourly'
                            } else if (serviceType === 'full_day' || serviceType === 'full-day') {
                                type = 'full-day'
                            }

                            typesMap.set(apt.id, { type, isTrial })
                        })
                        setGardenAppointmentTypes(typesMap)
                    }
                } catch (error) {
                    console.error("Error fetching garden appointment types:", error)
                }
            }

            fetchDogBreedSize()
            fetchGardenAppointmentTypes()
        }
    }, [open, dogId])

    // Reset active tab and service filter when modal closes
    useEffect(() => {
        if (!open) {
            setActiveTab('past')
            setServiceFilter('all')
            setIsGardenModalOpen(false)
            setIsEditServiceSelectionOpen(false)
            setPendingEditAppointment(null)
            setIsDeleteServiceSelectionOpen(false)
            setPendingDeleteAppointment(null)
        }
    }, [open])

    // Helper to check if a date has both services
    const getDateServices = (date: string): { hasGarden: boolean; hasGrooming: boolean } => {
        const dateAppointments = appointmentsWithGroomingNotes.filter(item => item.date === date)
        return {
            hasGarden: dateAppointments.some(item => item.originalService === 'garden' || item.originalService === 'both'),
            hasGrooming: dateAppointments.some(item => item.originalService === 'grooming' || item.originalService === 'both')
        }
    }

    // Filter appointments by service type
    const filterByService = (appointments: ManagerAppointment[]): ManagerAppointment[] => {
        if (serviceFilter === 'all') return appointments
        return appointments.filter(apt => {
            const item = appointmentsWithGroomingNotes.find(item => item.appointment.id === apt.id)
            if (!item) return false
            if (serviceFilter === 'garden') {
                return item.originalService === 'garden' || item.originalService === 'both'
            }
            if (serviceFilter === 'grooming') {
                return item.originalService === 'grooming' || item.originalService === 'both'
            }
            return true
        })
    }

    // Split into future, past, and today's appointments
    const now = new Date()

    const todayAppointmentsRaw = transformedAppointments.filter(apt => {
        const aptDate = new Date(apt.startDateTime)
        return isSameDay(aptDate, now)
    }).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))

    const futureAppointmentsRaw = transformedAppointments.filter(apt => {
        const aptDate = new Date(apt.startDateTime)
        return aptDate > now && !isSameDay(aptDate, now)
    }).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))

    const pastAppointmentsRaw = transformedAppointments.filter(apt => {
        const aptDate = new Date(apt.startDateTime)
        return aptDate < now && !isSameDay(aptDate, now)
    }).sort((a, b) => b.startDateTime.localeCompare(a.startDateTime))

    // Apply service filter
    const todayAppointments = filterByService(todayAppointmentsRaw)
    const futureAppointments = filterByService(futureAppointmentsRaw)
    const pastAppointments = filterByService(pastAppointmentsRaw)

    // Helper function to get grooming notes for an appointment
    const getGroomingNotes = (appointmentId: string): string | undefined => {
        const item = appointmentsWithGroomingNotes.find(item => item.appointment.id === appointmentId)
        return item?.groomingNotes
    }

    // Helper function to get garden extras for an appointment
    const getGardenExtras = (appointment: ManagerAppointment): string[] => {
        const extras: string[] = []
        if (appointment.gardenTrimNails) {
            extras.push("גזירת ציפורניים")
        }
        if (appointment.gardenBrush) {
            extras.push("סירוק")
        }
        if (appointment.gardenBath) {
            extras.push("מקלחת")
        }
        return extras
    }

    // Handler for opening garden appointment modal
    const handleOpenGardenModal = async (appointment: ManagerAppointment) => {
        try {
            // Get dog ID from appointment
            const dog = appointment.dogs?.[0]
            if (!dog || !dog.id) {
                toast({
                    title: "שגיאה",
                    description: "לא ניתן למצוא את פרטי הכלב",
                    variant: "destructive",
                })
                return
            }

            // Fetch dog data with customer info
            const { data: dogData, error: dogError } = await supabase
                .from("dogs")
                .select("id, name, breed_id, customer_id, breeds(name)")
                .eq("id", dog.id)
                .single()

            if (dogError || !dogData) {
                toast({
                    title: "שגיאה",
                    description: "לא ניתן למצוא את פרטי הכלב",
                    variant: "destructive",
                })
                return
            }

            if (!dogData.customer_id) {
                toast({
                    title: "שגיאה",
                    description: "לא ניתן למצוא את פרטי הלקוח של הכלב",
                    variant: "destructive",
                })
                return
            }

            // Fetch customer data
            const { data: customerData, error: customerError } = await supabase
                .from("customers")
                .select("id, full_name, phone, email")
                .eq("id", dogData.customer_id)
                .single()

            if (customerError || !customerData) {
                toast({
                    title: "שגיאה",
                    description: "לא ניתן למצוא את פרטי הלקוח",
                    variant: "destructive",
                })
                return
            }

            const breed = Array.isArray(dogData.breeds) ? dogData.breeds[0] : dogData.breeds

            // Fetch breed size info
            const { data: breedData } = await supabase
                .from("breeds")
                .select("size_class")
                .eq("id", dogData.breed_id)
                .single()

            // Set default customer and dog for the modal
            setDefaultGardenCustomer({
                id: customerData.id,
                fullName: customerData.full_name || "",
                phone: customerData.phone || "",
                email: customerData.email || "",
            })
            setDefaultGardenDog({
                id: dogData.id,
                name: dogData.name || "",
                breed: breed?.name || "",
                size: breedData?.size_class === 'small' ? 'קטן' : breedData?.size_class === 'large' ? 'גדול' : '',
                isSmall: breedData?.size_class === 'small',
                ownerId: dogData.customer_id,
            })
            setDefaultGardenDate(new Date(appointment.startDateTime))
            setIsGardenModalOpen(true)
        } catch (error) {
            console.error("Error opening garden modal:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לפתוח את הטופס ליצירת תור גן",
                variant: "destructive",
            })
        }
    }

    // Handler for opening grooming appointment modal
    const handleOpenGroomingModal = async (appointment: ManagerAppointment) => {
        try {
            // Get dog ID from appointment
            const dog = appointment.dogs?.[0]
            if (!dog || !dog.id) {
                toast({
                    title: "שגיאה",
                    description: "לא ניתן למצוא את פרטי הכלב",
                    variant: "destructive",
                })
                return
            }

            // Fetch dog data with customer info
            const { data: dogData, error: dogError } = await supabase
                .from("dogs")
                .select("id, name, breed_id, customer_id, breeds(name)")
                .eq("id", dog.id)
                .single()

            if (dogError || !dogData) {
                toast({
                    title: "שגיאה",
                    description: "לא ניתן למצוא את פרטי הכלב",
                    variant: "destructive",
                })
                return
            }

            if (!dogData.customer_id) {
                toast({
                    title: "שגיאה",
                    description: "לא ניתן למצוא את פרטי הלקוח של הכלב",
                    variant: "destructive",
                })
                return
            }

            // Fetch customer data
            const { data: customerData, error: customerError } = await supabase
                .from("customers")
                .select("id, full_name, phone, email")
                .eq("id", dogData.customer_id)
                .single()

            if (customerError || !customerData) {
                toast({
                    title: "שגיאה",
                    description: "לא ניתן למצוא את פרטי הלקוח",
                    variant: "destructive",
                })
                return
            }

            const breed = Array.isArray(dogData.breeds) ? dogData.breeds[0] : dogData.breeds

            // Fetch breed size info
            const { data: breedData } = await supabase
                .from("breeds")
                .select("size_class")
                .eq("id", dogData.breed_id)
                .single()

            // Find the first active grooming station
            // Station interface uses is_active (snake_case)
            const activeStations = stations.filter(s => s.is_active === true)
            const defaultStationId = activeStations.length > 0 ? activeStations[0].id : null

            if (!defaultStationId) {
                toast({
                    title: "שגיאה",
                    description: "לא נמצאו עמדות מספרה זמינות",
                    variant: "destructive",
                })
                return
            }

            // Set appointment date/time (use the same date as garden appointment, default time)
            const appointmentDate = new Date(appointment.startDateTime)
            const defaultStartTime = new Date(appointmentDate)
            defaultStartTime.setHours(9, 0, 0, 0) // Default to 9:00 AM
            const defaultEndTime = new Date(defaultStartTime)
            defaultEndTime.setHours(10, 0, 0, 0) // Default to 10:00 AM (1 hour duration)

            // Set prefill data in Redux
            dispatch(setPrefillBusinessCustomer({
                id: customerData.id,
                fullName: customerData.full_name || "",
                phone: customerData.phone || "",
                email: customerData.email || "",
            }))
            dispatch(setPrefillBusinessDog({
                id: dogData.id,
                name: dogData.name || "",
                breed: breed?.name || "",
                size: breedData?.size_class === 'small' ? 'קטן' : breedData?.size_class === 'large' ? 'גדול' : '',
                isSmall: breedData?.size_class === 'small',
                ownerId: dogData.customer_id,
            }))
            dispatch(setFinalizedDragTimes({
                startTime: defaultStartTime.toISOString(),
                endTime: defaultEndTime.toISOString(),
                stationId: defaultStationId,
            }))
            dispatch(setShowBusinessAppointmentModal(true))
        } catch (error) {
            console.error("Error opening grooming modal:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לפתוח את הטופס ליצירת תור מספרה",
                variant: "destructive",
            })
        }
    }

    // Handle copying grooming notes to dog's general grooming notes
    const handleCopyGroomingNotes = (groomingNotes: string) => {
        setGroomingNotesToCopy(groomingNotes)
        setConfirmCopyDialogOpen(true)
    }

    const confirmCopyGroomingNotes = async () => {
        if (!groomingNotesToCopy || !dogId) return

        setIsUpdatingGroomingNotes(true)
        try {
            const { error } = await supabase
                .from("dogs")
                .update({
                    grooming_notes: groomingNotesToCopy.trim() || null
                })
                .eq("id", dogId)

            if (error) {
                console.error("Error updating dog grooming notes:", error)
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לעדכן את הערות התספורת הכלליות",
                    variant: "destructive",
                })
            } else {
                toast({
                    title: "הערות עודכנו",
                    description: "הערות התספורת הכלליות של הכלב עודכנו בהצלחה",
                })
            }
        } catch (error) {
            console.error("Error updating dog grooming notes:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לעדכן את הערות התספורת הכלליות",
                variant: "destructive",
            })
        } finally {
            setIsUpdatingGroomingNotes(false)
            setConfirmCopyDialogOpen(false)
            setGroomingNotesToCopy("")
        }
    }

    const handleShowOnCalendar = (appointment: ManagerAppointment) => {
        // Close ALL drawers/sheets
        dispatch(setIsDetailsOpen(false))
        dispatch(setIsDogDetailsOpen(false))
        dispatch(setIsClientDetailsOpen(false))
        dispatch(setIsConstraintDetailsOpen(false))

        // Find the appointment data to get the actual appointment IDs
        const appointmentData = appointmentsWithGroomingNotes.find(item => item.appointment.id === appointment.id)

        // Use the actual appointment ID (groomingAppointmentId or gardenAppointmentId) instead of merged ID
        // This ensures the highlighting works correctly in the calendar
        // In the calendar, "both" appointments appear as two separate cards, so we need to use the specific ID
        let appointmentIdToHighlight = appointment.id
        if (appointmentData) {
            if (appointmentData.originalService === 'both') {
                // For "both" appointments, use grooming ID (primary) since calendar shows separate cards
                appointmentIdToHighlight = appointmentData.groomingAppointmentId || appointmentData.gardenAppointmentId || appointment.id
            } else if (appointmentData.originalService === 'grooming' && appointmentData.groomingAppointmentId) {
                appointmentIdToHighlight = appointmentData.groomingAppointmentId
            } else if (appointmentData.originalService === 'garden' && appointmentData.gardenAppointmentId) {
                appointmentIdToHighlight = appointmentData.gardenAppointmentId
            }
        }

        const appointmentDate = format(new Date(appointment.startDateTime), 'yyyy-MM-dd')
        navigate(`/manager?highlightAppointment=${appointmentIdToHighlight}&date=${appointmentDate}`)
        onOpenChange(false)
    }

    const handleEditAppointment = (appointment: ManagerAppointment) => {
        const appointmentData = appointmentsWithGroomingNotes.find(item => item.appointment.id === appointment.id)
        if (!appointmentData) return

        // If it's a "both" appointment, show selection dialog
        if (appointmentData.originalService === 'both') {
            setPendingEditAppointment(appointment)
            setIsEditServiceSelectionOpen(true)
            return
        }

        // Determine which edit modal to open based on service type
        if (appointmentData.originalService === 'grooming' || appointment.serviceType === 'grooming') {
            // Extract the actual grooming appointment ID if it's a combined appointment
            const actualGroomingId = extractGroomingAppointmentId(appointment.id, appointmentData.groomingAppointmentId)
            const groomingAppointment: ManagerAppointment = {
                ...appointment,
                id: actualGroomingId
            }
            dispatch(setEditingGroomingAppointment(groomingAppointment))
            dispatch(setGroomingEditOpen(true))
        } else if (appointmentData.originalService === 'garden' || appointment.serviceType === 'garden') {
            // Extract the actual garden appointment ID if it's a combined appointment
            const actualGardenId = extractGardenAppointmentId(appointment.id, appointmentData.gardenAppointmentId)
            const gardenAppointment: ManagerAppointment = {
                ...appointment,
                id: actualGardenId
            }
            dispatch(setEditingGardenAppointment(gardenAppointment))
            dispatch(setGardenEditOpen(true))
        }
    }

    const handleEditServiceSelection = (serviceType: 'grooming' | 'garden') => {
        if (!pendingEditAppointment) return

        const appointmentData = appointmentsWithGroomingNotes.find(item => item.appointment.id === pendingEditAppointment.id)
        
        if (serviceType === 'grooming') {
            // Extract the actual grooming appointment ID if it's a combined appointment
            const actualGroomingId = extractGroomingAppointmentId(pendingEditAppointment.id, appointmentData?.groomingAppointmentId)
            const groomingAppointment: ManagerAppointment = {
                ...pendingEditAppointment,
                id: actualGroomingId
            }
            dispatch(setEditingGroomingAppointment(groomingAppointment))
            dispatch(setGroomingEditOpen(true))
        } else {
            // Extract the actual garden appointment ID if it's a combined appointment
            const actualGardenId = extractGardenAppointmentId(pendingEditAppointment.id, appointmentData?.gardenAppointmentId)
            const gardenAppointment: ManagerAppointment = {
                ...pendingEditAppointment,
                id: actualGardenId
            }
            dispatch(setEditingGardenAppointment(gardenAppointment))
            dispatch(setGardenEditOpen(true))
        }

        setIsEditServiceSelectionOpen(false)
        setPendingEditAppointment(null)
    }

    const handleDeleteAppointment = (appointment: ManagerAppointment) => {
        const appointmentData = appointmentsWithGroomingNotes.find(item => item.appointment.id === appointment.id)

        // If it's a "both" appointment, show selection dialog
        if (appointmentData?.originalService === 'both') {
            setPendingDeleteAppointment(appointment)
            setIsDeleteServiceSelectionOpen(true)
            return
        }

        // For single service appointments, use the existing delete flow
        dispatch(setAppointmentToDelete(appointment))
        dispatch(setDeleteConfirmationOpen(true))
    }

    const handleDeleteServiceSelection = async (serviceType: 'grooming' | 'garden' | 'both') => {
        if (!pendingDeleteAppointment) return

        const appointmentData = appointmentsWithGroomingNotes.find(item => item.appointment.id === pendingDeleteAppointment.id)
        if (!appointmentData) return

        if (serviceType === 'both') {
            // Delete both appointments directly
            setIsDeleteServiceSelectionOpen(false)
            setPendingDeleteAppointment(null)

            try {
                const deletePromises: Promise<any>[] = []

                // Delete grooming appointment
                if (appointmentData.groomingAppointmentId) {
                    const groomingAppointment: ManagerAppointment = {
                        ...pendingDeleteAppointment,
                        id: appointmentData.groomingAppointmentId,
                        serviceType: 'grooming',
                    }
                    deletePromises.push(
                        managerDeleteAppointment({
                            appointmentId: groomingAppointment.id,
                            appointmentTime: groomingAppointment.startDateTime,
                            serviceType: 'grooming',
                            dogId: groomingAppointment.dogs[0]?.id,
                            stationId: groomingAppointment.stationId,
                            updateCustomer: false,
                            clientName: groomingAppointment.clientName,
                            dogName: groomingAppointment.dogs[0]?.name,
                            appointmentDate: new Date(groomingAppointment.startDateTime).toLocaleDateString('he-IL'),
                        })
                    )
                }

                // Delete garden appointment
                if (appointmentData.gardenAppointmentId) {
                    const gardenAppointment: ManagerAppointment = {
                        ...pendingDeleteAppointment,
                        id: appointmentData.gardenAppointmentId,
                        serviceType: 'garden',
                    }
                    deletePromises.push(
                        managerDeleteAppointment({
                            appointmentId: gardenAppointment.id,
                            appointmentTime: gardenAppointment.startDateTime,
                            serviceType: 'garden',
                            dogId: gardenAppointment.dogs[0]?.id,
                            stationId: gardenAppointment.stationId,
                            updateCustomer: false,
                            clientName: gardenAppointment.clientName,
                            dogName: gardenAppointment.dogs[0]?.name,
                            appointmentDate: new Date(gardenAppointment.startDateTime).toLocaleDateString('he-IL'),
                        })
                    )
                }

                // Delete both appointments in parallel
                const results = await Promise.all(deletePromises)

                // Check if all deletions succeeded
                const allSucceeded = results.every(result => result.success)

                if (allSucceeded) {
                    toast({
                        title: "התורים נמחקו בהצלחה",
                        description: "תור המספרה ותור הגן נמחקו בהצלחה",
                        variant: "default",
                    })

                    // Invalidate cache and refetch
                    dispatch(
                        supabaseApi.util.invalidateTags([
                            "ManagerSchedule",
                            "Appointment",
                            "GardenAppointment",
                            { type: "Appointment", id: dogId },
                            { type: "Appointment", id: `getMergedAppointments-${dogId}` },
                        ])
                    )
                    if (open && dogId) {
                        safeRefetch()
                    }
                } else {
                    const errors = results.filter(r => !r.success).map(r => r.error).join(', ')
                    throw new Error(`Failed to delete some appointments: ${errors}`)
                }
            } catch (error) {
                console.error("Error deleting both appointments:", error)
                toast({
                    title: "שגיאה במחיקה",
                    description: error instanceof Error ? error.message : "לא ניתן למחוק את התורים",
                    variant: "destructive",
                })
            }
        } else if (serviceType === 'grooming' && appointmentData.groomingAppointmentId) {
            // Create a grooming-only appointment for deletion
            const groomingAppointment: ManagerAppointment = {
                ...pendingDeleteAppointment,
                id: appointmentData.groomingAppointmentId,
                serviceType: 'grooming',
            }
            dispatch(setAppointmentToDelete(groomingAppointment))
            dispatch(setDeleteConfirmationOpen(true))
            setIsDeleteServiceSelectionOpen(false)
            setPendingDeleteAppointment(null)
        } else if (serviceType === 'garden' && appointmentData.gardenAppointmentId) {
            // Create a garden-only appointment for deletion
            const gardenAppointment: ManagerAppointment = {
                ...pendingDeleteAppointment,
                id: appointmentData.gardenAppointmentId,
                serviceType: 'garden',
            }
            dispatch(setAppointmentToDelete(gardenAppointment))
            dispatch(setDeleteConfirmationOpen(true))
            setIsDeleteServiceSelectionOpen(false)
            setPendingDeleteAppointment(null)
        }
    }

    // Helper function to get garden type label
    const getGardenTypeLabel = (appointment: ManagerAppointment, gardenAppointmentId?: string): string | null => {
        if (appointment.serviceType !== 'garden' && !gardenAppointmentId) return null

        const aptId = gardenAppointmentId || appointment.id
        const gardenType = gardenAppointmentTypes.get(aptId)

        if (!gardenType || !gardenType.type) return null

        if (gardenType.type === 'trial') {
            return 'ניסיון'
        } else if (gardenType.type === 'full-day') {
            return 'יום מלא'
        } else if (gardenType.type === 'hourly') {
            return 'שעתי'
        }

        return null
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0" dir="rtl">
                <div className="px-6 pt-6 pb-4 flex-shrink-0">
                    <DialogHeader>
                        <DialogTitle className="text-right">תורים של {dogName}</DialogTitle>
                        <DialogDescription className="text-right">
                            כל התורים (עתידיים וקודמים) של הכלב
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12 px-6">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        <span className="mr-2 text-gray-500">טוען תורים...</span>
                    </div>
                ) : (
                    <div className="flex flex-col flex-1 min-h-0 px-6 pb-6">
                        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'today' | 'future' | 'past')} dir="rtl" className="w-full flex flex-col flex-1 min-h-0">
                            <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
                                <TabsTrigger value="past" className="text-sm">
                                    קודמים ({pastAppointments.length})
                                </TabsTrigger>
                                <TabsTrigger value="today" className="text-sm">
                                    היום ({todayAppointments.length})
                                </TabsTrigger>
                                <TabsTrigger value="future" className="text-sm">
                                    עתידיים ({futureAppointments.length})
                                </TabsTrigger>
                            </TabsList>

                            {/* Service Type Filter Tabs */}
                            <div className="mt-4 flex-shrink-0">
                                <Tabs value={serviceFilter} onValueChange={(value) => setServiceFilter(value as 'all' | 'garden' | 'grooming')} dir="rtl" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3">
                                        <TabsTrigger value="all" className="text-xs flex items-center gap-1.5 justify-center">
                                            <Grid3x3 className="h-3.5 w-3.5" />
                                            הכל
                                        </TabsTrigger>
                                        <TabsTrigger value="garden" className="text-xs flex items-center gap-1.5 justify-center">
                                            <Bone className="h-3.5 w-3.5" />
                                            גן
                                        </TabsTrigger>
                                        <TabsTrigger value="grooming" className="text-xs flex items-center gap-1.5 justify-center">
                                            <Scissors className="h-3.5 w-3.5" />
                                            מספרה
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            <TabsContent value="today" className="mt-4 space-y-2 flex-1 overflow-y-auto pl-4">
                                {todayAppointments.length > 0 ? (
                                    <div className="space-y-2">
                                        {todayAppointments.map((appointment) => {
                                            const groomingNotes = getGroomingNotes(appointment.id)
                                            const isGrooming = appointment.serviceType === 'grooming'
                                            const appointmentDate = format(new Date(appointment.startDateTime), 'yyyy-MM-dd')
                                            const dateServices = getDateServices(appointmentDate)
                                            const hasBothServices = dateServices.hasGarden && dateServices.hasGrooming
                                            const item = appointmentsWithGroomingNotes.find(item => item.appointment.id === appointment.id)
                                            const originalService = item?.originalService || 'grooming'
                                            return (
                                                <div
                                                    key={appointment.id}
                                                    className={`w-full text-right rounded-lg border px-4 py-3 ${hasBothServices
                                                        ? 'border-purple-300 bg-purple-50'
                                                        : appointment.serviceType === 'garden'
                                                            ? 'border-emerald-200 bg-emerald-50'
                                                            : 'border-blue-200 bg-blue-50'
                                                        }`}
                                                >
                                                    <div
                                                        onClick={() => {
                                                            onAppointmentClick(appointment)
                                                            onOpenChange(false)
                                                        }}
                                                        className={`w-full text-right transition-colors rounded cursor-pointer ${hasBothServices
                                                            ? 'hover:bg-purple-100'
                                                            : appointment.serviceType === 'garden'
                                                                ? 'hover:bg-emerald-100'
                                                                : 'hover:bg-blue-100'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="text-sm font-semibold flex-1 text-right" style={{
                                                                color: hasBothServices ? '#6b21a8' : appointment.serviceType === 'garden' ? '#065f46' : '#1e3a8a'
                                                            }}>
                                                                {format(new Date(appointment.startDateTime), 'HH:mm')} - היום
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                {hasBothServices && (
                                                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-200 text-purple-900 whitespace-nowrap">
                                                                        גן + מספרה
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleEditAppointment(appointment)
                                                                    }}
                                                                    className="p-1.5 hover:bg-opacity-80 rounded transition-colors"
                                                                    style={{
                                                                        color: hasBothServices ? '#6b21a8' : appointment.serviceType === 'garden' ? '#065f46' : '#1e3a8a'
                                                                    }}
                                                                    title="ערוך תור"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </button>
                                                                {isGrooming && dogBreedSize === 'small' && !hasBothServices && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleOpenGardenModal(appointment)
                                                                        }}
                                                                        className="p-1.5 hover:bg-emerald-100 rounded transition-colors text-emerald-600"
                                                                        title="צור תור גן לאותו יום"
                                                                    >
                                                                        <Sprout className="h-4 w-4" />
                                                                    </button>
                                                                )}
                                                                {(appointment.serviceType === 'garden' || originalService === 'garden') && !hasBothServices && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleOpenGroomingModal(appointment)
                                                                        }}
                                                                        className="p-1.5 hover:bg-blue-100 rounded transition-colors text-blue-600"
                                                                        title="צור תור מספרה לאותו יום"
                                                                    >
                                                                        <Scissors className="h-4 w-4" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleDeleteAppointment(appointment)
                                                                    }}
                                                                    className="p-1.5 hover:bg-red-100 rounded transition-colors text-red-600"
                                                                    title="מחק תור"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className={`text-xs mt-1 ${hasBothServices
                                                            ? 'text-purple-700'
                                                            : appointment.serviceType === 'garden'
                                                                ? 'text-emerald-700'
                                                                : 'text-blue-700'
                                                            }`}>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span>
                                                                    {originalService === 'both' ? 'גן + מספרה' : appointment.serviceType === 'garden' ? 'גן' : 'מספרה'}
                                                                    {appointment.serviceType === 'garden' && (() => {
                                                                        const gardenTypeLabel = getGardenTypeLabel(appointment)
                                                                        return gardenTypeLabel ? ` • ${gardenTypeLabel}` : ''
                                                                    })()}
                                                                    {originalService === 'both' && (() => {
                                                                        const gardenTypeLabel = getGardenTypeLabel(appointment, item?.gardenAppointmentId)
                                                                        return gardenTypeLabel ? ` • גן: ${gardenTypeLabel}` : ''
                                                                    })()}
                                                                    {appointment.stationName && ` • ${appointment.stationName}`}
                                                                </span>
                                                                {((appointment.serviceType === 'garden' || originalService === 'both') && (() => {
                                                                    const gardenExtras = getGardenExtras(appointment)
                                                                    return gardenExtras.length > 0 && (
                                                                        <span className="flex items-center gap-1 flex-wrap">
                                                                            {gardenExtras.map((label) => (
                                                                                <Badge
                                                                                    key={`${appointment.id}-${label}`}
                                                                                    className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0.5"
                                                                                >
                                                                                    {label}
                                                                                </Badge>
                                                                            ))}
                                                                        </span>
                                                                    )
                                                                })())}
                                                            </div>
                                                            {appointment.notes && ` • ${appointment.notes.substring(0, 50)}${appointment.notes.length > 50 ? '...' : ''}`}
                                                        </div>
                                                    </div>
                                                    {isGrooming && (
                                                        <div className="mt-1.5">
                                                            <div className="text-xs text-purple-700">
                                                                {groomingNotes && groomingNotes.trim() ? (
                                                                    <>
                                                                        <span className="font-medium text-purple-800">הערות לתספורת: </span>
                                                                        <span className="whitespace-pre-wrap">{groomingNotes}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-500">אין הערות מיוחדות</span>
                                                                )}
                                                            </div>
                                                            {groomingNotes && groomingNotes.trim() && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="w-full text-xs h-7 mt-1.5"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleCopyGroomingNotes(groomingNotes)
                                                                    }}
                                                                >
                                                                    <Copy className="h-3 w-3 ml-1" />
                                                                    הגדר כהערות כלליות לכלב
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="mt-1.5">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full text-xs h-7"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleShowOnCalendar(appointment)
                                                            }}
                                                        >
                                                            <Calendar className="h-3 w-3 ml-1" />
                                                            הצג בלוח שנה
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center text-sm text-gray-500 py-12 bg-blue-50 rounded-lg border border-blue-100">
                                        אין תורים היום
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="future" className="mt-4 space-y-2 flex-1 overflow-y-auto pl-4">
                                {futureAppointments.length > 0 ? (
                                    <div className="space-y-2">
                                        {futureAppointments.map((appointment) => {
                                            const groomingNotes = getGroomingNotes(appointment.id)
                                            const isGrooming = appointment.serviceType === 'grooming'
                                            const appointmentDate = format(new Date(appointment.startDateTime), 'yyyy-MM-dd')
                                            const dateServices = getDateServices(appointmentDate)
                                            const hasBothServices = dateServices.hasGarden && dateServices.hasGrooming
                                            const item = appointmentsWithGroomingNotes.find(item => item.appointment.id === appointment.id)
                                            const originalService = item?.originalService || 'grooming'
                                            return (
                                                <div
                                                    key={appointment.id}
                                                    className={`w-full text-right rounded-lg border px-4 py-3 ${hasBothServices
                                                        ? 'border-purple-300 bg-purple-50'
                                                        : appointment.serviceType === 'garden'
                                                            ? 'border-emerald-200 bg-emerald-50'
                                                            : 'border-green-200 bg-green-50'
                                                        }`}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onAppointmentClick(appointment)
                                                            onOpenChange(false)
                                                        }}
                                                        className={`w-full text-right transition-colors rounded ${hasBothServices
                                                            ? 'hover:bg-purple-100'
                                                            : appointment.serviceType === 'garden'
                                                                ? 'hover:bg-emerald-100'
                                                                : 'hover:bg-green-100'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="text-sm font-semibold flex-1 text-right" style={{
                                                                color: hasBothServices ? '#6b21a8' : appointment.serviceType === 'garden' ? '#065f46' : '#166534'
                                                            }}>
                                                                {format(new Date(appointment.startDateTime), 'HH:mm')} - {format(new Date(appointment.startDateTime), 'dd.MM.yyyy')}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                {hasBothServices && (
                                                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-200 text-purple-900 whitespace-nowrap">
                                                                        גן + מספרה
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleEditAppointment(appointment)
                                                                    }}
                                                                    className="p-1.5 hover:bg-opacity-80 rounded transition-colors"
                                                                    style={{
                                                                        color: hasBothServices ? '#6b21a8' : appointment.serviceType === 'garden' ? '#065f46' : '#166534'
                                                                    }}
                                                                    title="ערוך תור"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </button>
                                                                {isGrooming && dogBreedSize === 'small' && !hasBothServices && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleOpenGardenModal(appointment)
                                                                        }}
                                                                        className="p-1.5 hover:bg-emerald-100 rounded transition-colors text-emerald-600"
                                                                        title="צור תור גן לאותו יום"
                                                                    >
                                                                        <Sprout className="h-4 w-4" />
                                                                    </button>
                                                                )}
                                                                {(appointment.serviceType === 'garden' || originalService === 'garden') && !hasBothServices && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleOpenGroomingModal(appointment)
                                                                        }}
                                                                        className="p-1.5 hover:bg-blue-100 rounded transition-colors text-blue-600"
                                                                        title="צור תור מספרה לאותו יום"
                                                                    >
                                                                        <Scissors className="h-4 w-4" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleDeleteAppointment(appointment)
                                                                    }}
                                                                    className="p-1.5 hover:bg-red-100 rounded transition-colors text-red-600"
                                                                    title="מחק תור"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className={`text-xs mt-1 ${hasBothServices
                                                            ? 'text-purple-700'
                                                            : appointment.serviceType === 'garden'
                                                                ? 'text-emerald-700'
                                                                : 'text-green-700'
                                                            }`}>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span>
                                                                    {originalService === 'both' ? 'גן + מספרה' : appointment.serviceType === 'garden' ? 'גן' : 'מספרה'}
                                                                    {appointment.serviceType === 'garden' && (() => {
                                                                        const gardenTypeLabel = getGardenTypeLabel(appointment)
                                                                        return gardenTypeLabel ? ` • ${gardenTypeLabel}` : ''
                                                                    })()}
                                                                    {originalService === 'both' && (() => {
                                                                        const gardenTypeLabel = getGardenTypeLabel(appointment, item?.gardenAppointmentId)
                                                                        return gardenTypeLabel ? ` • גן: ${gardenTypeLabel}` : ''
                                                                    })()}
                                                                    {appointment.stationName && ` • ${appointment.stationName}`}
                                                                </span>
                                                                {((appointment.serviceType === 'garden' || originalService === 'both') && (() => {
                                                                    const gardenExtras = getGardenExtras(appointment)
                                                                    return gardenExtras.length > 0 && (
                                                                        <span className="flex items-center gap-1 flex-wrap">
                                                                            {gardenExtras.map((label) => (
                                                                                <Badge
                                                                                    key={`${appointment.id}-${label}`}
                                                                                    className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0.5"
                                                                                >
                                                                                    {label}
                                                                                </Badge>
                                                                            ))}
                                                                        </span>
                                                                    )
                                                                })())}
                                                            </div>
                                                            {appointment.notes && ` • ${appointment.notes.substring(0, 50)}${appointment.notes.length > 50 ? '...' : ''}`}
                                                        </div>
                                                    </button>
                                                    {isGrooming && (
                                                        <div className="mt-1.5">
                                                            <div className="text-xs text-purple-700">
                                                                {groomingNotes && groomingNotes.trim() ? (
                                                                    <>
                                                                        <span className="font-medium text-purple-800">הערות לתספורת: </span>
                                                                        <span className="whitespace-pre-wrap">{groomingNotes}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-500">אין הערות מיוחדות</span>
                                                                )}
                                                            </div>
                                                            {groomingNotes && groomingNotes.trim() && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="w-full text-xs h-7 mt-1.5"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleCopyGroomingNotes(groomingNotes)
                                                                    }}
                                                                >
                                                                    <Copy className="h-3 w-3 ml-1" />
                                                                    הגדר כהערות כלליות לכלב
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )
                                                    }
                                                    <div className="mt-1.5">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full text-xs h-7"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleShowOnCalendar(appointment)
                                                            }}
                                                        >
                                                            <Calendar className="h-3 w-3 ml-1" />
                                                            הצג בלוח שנה
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center text-sm text-gray-500 py-12 bg-green-50 rounded-lg border border-green-100">
                                        אין תורים עתידיים
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="past" className="mt-4 space-y-2 flex-1 overflow-y-auto pl-4">
                                {pastAppointments.length > 0 ? (
                                    <div className="space-y-2">
                                        {pastAppointments.map((appointment) => {
                                            const groomingNotes = getGroomingNotes(appointment.id)
                                            const isGrooming = appointment.serviceType === 'grooming'
                                            const appointmentDate = format(new Date(appointment.startDateTime), 'yyyy-MM-dd')
                                            const dateServices = getDateServices(appointmentDate)
                                            const hasBothServices = dateServices.hasGarden && dateServices.hasGrooming
                                            const item = appointmentsWithGroomingNotes.find(item => item.appointment.id === appointment.id)
                                            const originalService = item?.originalService || 'grooming'
                                            return (
                                                <div
                                                    key={appointment.id}
                                                    className={`w-full text-right rounded-lg border px-4 py-3 ${hasBothServices
                                                        ? 'border-purple-300 bg-purple-50'
                                                        : appointment.serviceType === 'garden'
                                                            ? 'border-emerald-200 bg-emerald-50'
                                                            : 'border-gray-200 bg-gray-50'
                                                        }`}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onAppointmentClick(appointment)
                                                            onOpenChange(false)
                                                        }}
                                                        className={`w-full text-right transition-colors rounded ${hasBothServices
                                                            ? 'hover:bg-purple-100'
                                                            : appointment.serviceType === 'garden'
                                                                ? 'hover:bg-emerald-100'
                                                                : 'hover:bg-gray-100'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="text-sm font-semibold flex-1 text-right" style={{
                                                                color: hasBothServices ? '#6b21a8' : appointment.serviceType === 'garden' ? '#065f46' : '#111827'
                                                            }}>
                                                                {format(new Date(appointment.startDateTime), 'HH:mm')} - {format(new Date(appointment.startDateTime), 'dd.MM.yyyy')}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                {hasBothServices && (
                                                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-200 text-purple-900 whitespace-nowrap">
                                                                        גן + מספרה
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleEditAppointment(appointment)
                                                                    }}
                                                                    className="p-1.5 hover:bg-opacity-80 rounded transition-colors"
                                                                    style={{
                                                                        color: hasBothServices ? '#6b21a8' : appointment.serviceType === 'garden' ? '#065f46' : '#111827'
                                                                    }}
                                                                    title="ערוך תור"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </button>
                                                                {(appointment.serviceType === 'garden' || originalService === 'garden') && !hasBothServices && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleOpenGroomingModal(appointment)
                                                                        }}
                                                                        className="p-1.5 hover:bg-blue-100 rounded transition-colors text-blue-600"
                                                                        title="צור תור מספרה לאותו יום"
                                                                    >
                                                                        <Scissors className="h-4 w-4" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleDeleteAppointment(appointment)
                                                                    }}
                                                                    className="p-1.5 hover:bg-red-100 rounded transition-colors text-red-600"
                                                                    title="מחק תור"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className={`text-xs mt-1 ${hasBothServices
                                                            ? 'text-purple-700'
                                                            : appointment.serviceType === 'garden'
                                                                ? 'text-emerald-700'
                                                                : 'text-gray-700'
                                                            }`}>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span>
                                                                    {originalService === 'both' ? 'גן + מספרה' : appointment.serviceType === 'garden' ? 'גן' : 'מספרה'}
                                                                    {appointment.serviceType === 'garden' && (() => {
                                                                        const gardenTypeLabel = getGardenTypeLabel(appointment)
                                                                        return gardenTypeLabel ? ` • ${gardenTypeLabel}` : ''
                                                                    })()}
                                                                    {originalService === 'both' && (() => {
                                                                        const gardenTypeLabel = getGardenTypeLabel(appointment, item?.gardenAppointmentId)
                                                                        return gardenTypeLabel ? ` • גן: ${gardenTypeLabel}` : ''
                                                                    })()}
                                                                    {appointment.stationName && ` • ${appointment.stationName}`}
                                                                </span>
                                                                {((appointment.serviceType === 'garden' || originalService === 'both') && (() => {
                                                                    const gardenExtras = getGardenExtras(appointment)
                                                                    return gardenExtras.length > 0 && (
                                                                        <span className="flex items-center gap-1 flex-wrap">
                                                                            {gardenExtras.map((label) => (
                                                                                <Badge
                                                                                    key={`${appointment.id}-${label}`}
                                                                                    className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0.5"
                                                                                >
                                                                                    {label}
                                                                                </Badge>
                                                                            ))}
                                                                        </span>
                                                                    )
                                                                })())}
                                                            </div>
                                                            {appointment.notes && ` • ${appointment.notes.substring(0, 50)}${appointment.notes.length > 50 ? '...' : ''}`}
                                                        </div>
                                                    </button>
                                                    {isGrooming && (
                                                        <div className="mt-1.5">
                                                            <div className="text-xs text-purple-700">
                                                                {groomingNotes && groomingNotes.trim() ? (
                                                                    <>
                                                                        <span className="font-medium text-purple-800">הערות לתספורת: </span>
                                                                        <span className="whitespace-pre-wrap">{groomingNotes}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-500">אין הערות מיוחדות</span>
                                                                )}
                                                            </div>
                                                            {groomingNotes && groomingNotes.trim() && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="w-full text-xs h-7 mt-1.5"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleCopyGroomingNotes(groomingNotes)
                                                                    }}
                                                                >
                                                                    <Copy className="h-3 w-3 ml-1" />
                                                                    הגדר כהערות כלליות לכלב
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="mt-1.5">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full text-xs h-7"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleShowOnCalendar(appointment)
                                                            }}
                                                        >
                                                            <Calendar className="h-3 w-3 ml-1" />
                                                            הצג בלוח שנה
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center text-sm text-gray-500 py-12 bg-gray-50 rounded-lg border border-gray-100">
                                        אין תורים קודמים
                                    </div>
                                )}
                            </TabsContent>

                            {transformedAppointments.length === 0 && activeTab === 'today' && (
                                <div className="text-center text-sm text-gray-500 py-8">
                                    אין תורים עבור כלב זה
                                </div>
                            )}
                        </Tabs>
                    </div >
                )}
            </DialogContent>

            {/* Confirmation Dialog for Copying Grooming Notes */}
            <AlertDialog open={confirmCopyDialogOpen} onOpenChange={setConfirmCopyDialogOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>הגדר הערות כלליות לכלב</AlertDialogTitle>
                        <AlertDialogDescription className="text-right">
                            האם אתה בטוח שברצונך להגדיר את הערות התספורת של תור זה כהערות התספורת הכלליות של הכלב?
                            <br />
                            <br />
                            <div className="bg-purple-50 border border-purple-200 rounded p-2 mt-2 text-sm text-purple-800 whitespace-pre-wrap">
                                {groomingNotesToCopy}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-2">
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmCopyGroomingNotes}
                            disabled={isUpdatingGroomingNotes}
                            className="bg-primary text-primary-foreground"
                        >
                            {isUpdatingGroomingNotes ? "מעדכן..." : "אישור"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog >

            {/* New Garden Appointment Modal */}
            < NewGardenAppointmentModal
                open={isGardenModalOpen}
                onOpenChange={setIsGardenModalOpen}
                appointmentType={null}
                defaultDate={defaultGardenDate || undefined}
                defaultCustomer={defaultGardenCustomer}
                defaultDog={defaultGardenDog}
                onConfirm={async (data) => {
                    if (!data.customer || !data.dog || !data.date) {
                        toast({
                            title: "שגיאה",
                            description: "יש למלא את כל השדות הנדרשים",
                            variant: "destructive",
                        })
                        return
                    }

                    try {
                        // For garden appointments, station_id should be null (garden doesn't use physical stations)
                        // The backend will handle this correctly
                        const dateStr = format(data.date, 'yyyy-MM-dd')
                        const startTime = data.appointmentType === 'full-day' ? '07:00' : data.startTime
                        const endTime = data.appointmentType === 'full-day' ? '19:00' : data.endTime

                        const result = await createManagerAppointment({
                            name: `תור גן - ${data.dog.name}`,
                            stationId: 'garden-station', // Placeholder, will be filtered out by backend
                            selectedStations: ['garden-station'], // Placeholder, will be filtered out by backend
                            startTime: `${dateStr}T${startTime}:00`,
                            endTime: `${dateStr}T${endTime}:00`,
                            appointmentType: "garden",
                            customerId: data.customer.id,
                            dogId: data.dog.id,
                            gardenAppointmentType: data.appointmentType,
                            services: {
                                gardenTrimNails: data.gardenTrimNails,
                                gardenBrush: data.gardenBrush,
                                gardenBath: data.gardenBath,
                            },
                            latePickupRequested: data.latePickupRequested,
                            latePickupNotes: data.latePickupNotes || undefined,
                            notes: data.notes || undefined,
                            internalNotes: data.internalNotes || undefined,
                        })

                        if (result.success) {
                            toast({
                                title: "תור נוצר בהצלחה",
                                description: `תור גן נוצר עבור ${data.dog.name}`,
                            })

                            // Invalidate cache and refetch appointments
                            // This ensures both the manager schedule board and dog appointments list update immediately
                            dispatch(
                                supabaseApi.util.invalidateTags([
                                    "ManagerSchedule", // Critical: invalidates the manager schedule board
                                    "Appointment",
                                    "GardenAppointment",
                                    { type: "Appointment", id: dogId },
                                    { type: "Appointment", id: `getMergedAppointments-${dogId}` },
                                ])
                            )
                            if (open && dogId) {
                                safeRefetch()
                            }

                            setIsGardenModalOpen(false)
                            setDefaultGardenCustomer(null)
                            setDefaultGardenDog(null)
                            setDefaultGardenDate(null)
                        } else {
                            throw new Error(result.message || "Failed to create appointment")
                        }
                    } catch (error) {
                        console.error("Error creating garden appointment:", error)
                        toast({
                            title: "שגיאה",
                            description: error instanceof Error ? error.message : "לא ניתן ליצור את התור",
                            variant: "destructive",
                        })
                    }
                }}
            />

            {/* Edit Service Selection Dialog */}
            <Dialog open={isEditServiceSelectionOpen} onOpenChange={setIsEditServiceSelectionOpen}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right">עריכת תור</DialogTitle>
                        <DialogDescription className="text-right">
                            תור זה כולל גם מספרה וגם גן. איזה תור תרצה לערוך?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-3">
                        <Button
                            onClick={() => {
                                handleEditServiceSelection('grooming')
                                setIsEditServiceSelectionOpen(false)
                            }}
                            className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                            variant="outline"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                                    <Scissors className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="text-right flex-1">
                                    <div className="font-semibold">מספרה</div>
                                    <div className="text-sm text-gray-500">ערוך את תור המספרה</div>
                                </div>
                            </div>
                        </Button>

                        <Button
                            onClick={() => {
                                handleEditServiceSelection('garden')
                                setIsEditServiceSelectionOpen(false)
                            }}
                            className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                            variant="outline"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
                                    <Flower2 className="h-5 w-5 text-green-600" />
                                </div>
                                <div className="text-right flex-1">
                                    <div className="font-semibold">גן</div>
                                    <div className="text-sm text-gray-500">ערוך את תור הגן</div>
                                </div>
                            </div>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Service Selection Dialog */}
            <Dialog open={isDeleteServiceSelectionOpen} onOpenChange={setIsDeleteServiceSelectionOpen}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right">מחיקת תור</DialogTitle>
                        <DialogDescription className="text-right">
                            תור זה כולל גם מספרה וגם גן. איזה תור תרצה למחוק?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-3">
                        <Button
                            onClick={() => {
                                handleDeleteServiceSelection('grooming')
                                setIsDeleteServiceSelectionOpen(false)
                            }}
                            className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                            variant="outline"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                                    <Scissors className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="text-right flex-1">
                                    <div className="font-semibold">מספרה</div>
                                    <div className="text-sm text-gray-500">מחק את תור המספרה</div>
                                </div>
                            </div>
                        </Button>

                        <Button
                            onClick={() => {
                                handleDeleteServiceSelection('garden')
                                setIsDeleteServiceSelectionOpen(false)
                            }}
                            className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                            variant="outline"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
                                    <Flower2 className="h-5 w-5 text-green-600" />
                                </div>
                                <div className="text-right flex-1">
                                    <div className="font-semibold">גן</div>
                                    <div className="text-sm text-gray-500">מחק את תור הגן</div>
                                </div>
                            </div>
                        </Button>

                        <Button
                            onClick={() => {
                                handleDeleteServiceSelection('both')
                                setIsDeleteServiceSelectionOpen(false)
                            }}
                            className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right border-red-200 hover:bg-red-50"
                            variant="outline"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100">
                                    <Trash2 className="h-5 w-5 text-red-600" />
                                </div>
                                <div className="text-right flex-1">
                                    <div className="font-semibold text-red-700">גן + מספרה</div>
                                    <div className="text-sm text-gray-500">מחק את שני התורים</div>
                                </div>
                            </div>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Dialog >
    )
}

