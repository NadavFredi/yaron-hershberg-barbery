import React, { useState, useMemo, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Loader2, Eye, Pencil, Trash2, Unlink, ChevronsDown, MoreVertical } from "lucide-react"
import { format, startOfToday, addDays } from "date-fns"
import { he } from "date-fns/locale"
import { useGetSeriesAppointmentsQuery } from "@/store/services/supabaseApi"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn, extractGroomingAppointmentId } from "@/lib/utils"
import { useAppDispatch } from "@/store/hooks"
import { setSelectedAppointment, setIsDetailsOpen } from "@/store/slices/managerScheduleSlice"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { getManyChatFlowId, getManyChatCustomFieldId } from "@/lib/manychat"
import { Label } from "@/components/ui/label"
import { BulkEditAppointmentsModal } from "./BulkEditAppointmentsModal"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"

interface ManagerStation {
    id: string
    name: string
}

interface SeriesAppointmentsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    seriesId: string
    currentAppointmentId?: string
    onAppointmentClick?: (appointment: ManagerAppointment) => void
    onEditAppointment?: (appointment: ManagerAppointment) => void
    onDeleteAppointment?: (appointment: ManagerAppointment) => void
}

export const SeriesAppointmentsModal: React.FC<SeriesAppointmentsModalProps> = ({
    open,
    onOpenChange,
    seriesId,
    currentAppointmentId,
    onAppointmentClick,
    onEditAppointment,
    onDeleteAppointment,
}) => {
    const dispatch = useAppDispatch()
    const { toast } = useToast()
    const { data: seriesData, isLoading, refetch } = useGetSeriesAppointmentsQuery(
        { seriesId },
        { skip: !open || !seriesId }
    )

    const appointments = seriesData?.appointments || []
    const count = seriesData?.count || 0

    // Fetch stations
    useEffect(() => {
        const fetchStations = async () => {
            try {
                const { data, error } = await supabase
                    .from("stations")
                    .select("id, name")
                    .order("name")

                if (error) throw error
                setStations(data || [])
            } catch (error) {
                console.error("Error fetching stations:", error)
            }
        }

        if (open) {
            fetchStations()
        }
    }, [open])

    // Get the dog name from the first appointment (all should be the same)
    const dogName = useMemo(() => {
        if (appointments.length === 0) return null
        const primaryDog = appointments[0].dogs[0]
        return primaryDog?.name ?? "ללא שיוך ללקוח"
    }, [appointments])

    // Sort appointments by date (earliest first)
    const sortedAppointments = useMemo(() => {
        return [...appointments].sort((a, b) =>
            new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
        )
    }, [appointments])

    const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<Set<string>>(new Set())
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
    const isShiftClickRef = useRef(false)
    const [stations, setStations] = useState<ManagerStation[]>([])
    const [bulkEditOpen, setBulkEditOpen] = useState(false)
    const [pendingEditFromHereAppointment, setPendingEditFromHereAppointment] = useState<ManagerAppointment | null>(null)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [pendingDeleteAppointment, setPendingDeleteAppointment] = useState<ManagerAppointment | null>(null)
    const [deleteFromHereOpen, setDeleteFromHereOpen] = useState(false)
    const [pendingDeleteFromHereAppointment, setPendingDeleteFromHereAppointment] = useState<ManagerAppointment | null>(null)
    const [deleteAllFutureOpen, setDeleteAllFutureOpen] = useState(false)
    const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false)
    const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false)
    const [pendingUnlinkAppointment, setPendingUnlinkAppointment] = useState<ManagerAppointment | null>(null)
    const [unlinkSelectedOpen, setUnlinkSelectedOpen] = useState(false)
    const [unlinkFromHereOpen, setUnlinkFromHereOpen] = useState(false)
    const [pendingUnlinkFromHereAppointment, setPendingUnlinkFromHereAppointment] = useState<ManagerAppointment | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [notifyClient, setNotifyClient] = useState(false)

    const handleOpenAppointment = (appointment: ManagerAppointment) => {
        dispatch(setSelectedAppointment(appointment))
        dispatch(setIsDetailsOpen(true))
        onOpenChange(false)
    }

    const handleToggleSelect = (appointmentId: string, isShiftClick: boolean = false) => {
        const currentIndex = sortedAppointments.findIndex(apt => apt.id === appointmentId)

        setSelectedAppointmentIds(prev => {
            const newSet = new Set(prev)

            if (isShiftClick && lastSelectedIndex !== null && currentIndex !== -1) {
                // Determine if we should check or uncheck based on the target item's current state
                const targetIsChecked = newSet.has(appointmentId)
                const startIndex = Math.min(lastSelectedIndex, currentIndex)
                const endIndex = Math.max(lastSelectedIndex, currentIndex)

                if (targetIsChecked) {
                    // Uncheck the entire range
                    for (let i = startIndex; i <= endIndex; i++) {
                        newSet.delete(sortedAppointments[i].id)
                    }
                } else {
                    // Check the entire range
                    for (let i = startIndex; i <= endIndex; i++) {
                        newSet.add(sortedAppointments[i].id)
                    }
                }
            } else {
                // Toggle single selection
                if (newSet.has(appointmentId)) {
                    newSet.delete(appointmentId)
                } else {
                    newSet.add(appointmentId)
                }
            }

            return newSet
        })

        // Always update last selected index to the current click
        setLastSelectedIndex(currentIndex !== -1 ? currentIndex : null)
    }

    const handleSelectAll = () => {
        if (selectedAppointmentIds.size === sortedAppointments.length) {
            setSelectedAppointmentIds(new Set())
        } else {
            setSelectedAppointmentIds(new Set(sortedAppointments.map(apt => apt.id)))
        }
    }

    const handleUnlink = async (appointment: ManagerAppointment) => {
        setIsProcessing(true)
        try {
            const tableName = appointment.serviceType === "grooming" ? "grooming_appointments" : "daycare_appointments"
            const appointmentId = appointment.serviceType === "grooming"
                ? extractGroomingAppointmentId(appointment.id, (appointment as any).groomingAppointmentId)
                : extractGardenAppointmentId(appointment.id, (appointment as any).gardenAppointmentId)

            const { error } = await supabase
                .from(tableName)
                .update({ series_id: null })
                .eq("id", appointmentId)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "התור נותק מהסדרה בהצלחה",
            })

            setUnlinkConfirmOpen(false)
            setPendingUnlinkAppointment(null)
            // Refetch to update the list
            refetch()
        } catch (error) {
            console.error("Error unlinking appointment:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לנתק את התור מהסדרה",
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const triggerManyChatNotification = async (appointments: ManagerAppointment[]) => {
        if (!notifyClient) {
            console.log("ℹ️ [SeriesAppointmentsModal] notifyClient is not checked, skipping ManyChat flow")
            return
        }

        const flowId = getManyChatFlowId("APPOINTMENT_DELETED")
        if (!flowId) {
            console.warn("⚠️ [SeriesAppointmentsModal] APPOINTMENT_DELETED flow ID not found")
            return
        }

        const appointmentsWithPhones = appointments.filter(
            (apt) => apt.clientPhone && apt.clientPhone.trim().length > 0
        )

        if (!appointmentsWithPhones.length) {
            console.log("ℹ️ [SeriesAppointmentsModal] No appointments with phone numbers to send ManyChat flow")
            return
        }

        const uniqueClients = new Map<string, { phone: string; name: string; fields: Record<string, string> }>()
        for (const apt of appointmentsWithPhones) {
            const normalizedPhone = apt.clientPhone!.replace(/\D/g, "")
            const dateFieldId = getManyChatCustomFieldId("BARBER_DATE_APPOINTMENT")
            const appointmentDate = format(new Date(apt.startDateTime), 'dd/MM/yyyy')

            const fields: Record<string, string> = {}
            if (dateFieldId) {
                fields[dateFieldId] = appointmentDate
            }

            if (!uniqueClients.has(normalizedPhone)) {
                uniqueClients.set(normalizedPhone, {
                    phone: normalizedPhone,
                    name: apt.clientName || "לקוח",
                    fields: fields,
                })
            } else {
                const existing = uniqueClients.get(normalizedPhone)!
                if (dateFieldId) {
                    existing.fields[dateFieldId] = appointmentDate
                }
            }
        }

        const users = Array.from(uniqueClients.values())

        try {
            console.log(`📤 [SeriesAppointmentsModal] Sending APPOINTMENT_DELETED flow to ${users.length} recipient(s)`)
            const { data, error } = await supabase.functions.invoke("set-manychat-fields-and-send-flow", {
                body: {
                    users,
                    flow_id: flowId,
                },
            })

            if (error) {
                console.error("❌ [SeriesAppointmentsModal] Error calling ManyChat function:", error)
                return
            }

            const results = data as Record<string, { success: boolean; error?: string }>
            const successCount = Object.values(results).filter((r) => r.success).length
            console.log(`✅ [SeriesAppointmentsModal] ManyChat flow sent: ${successCount} success`)
        } catch (error) {
            console.error("❌ [SeriesAppointmentsModal] Error triggering ManyChat flow:", error)
        }
    }

    const handleDelete = async (appointment: ManagerAppointment) => {
        setIsProcessing(true)
        try {
            // Send notification if requested
            await triggerManyChatNotification([appointment])

            if (onDeleteAppointment) {
                onDeleteAppointment(appointment)
            } else {
                // Fallback: delete directly
                const tableName = appointment.serviceType === "grooming" ? "grooming_appointments" : "daycare_appointments"
                const appointmentId = appointment.serviceType === "grooming"
                    ? extractGroomingAppointmentId(appointment.id, (appointment as any).groomingAppointmentId)
                    : extractGroomingAppointmentId(appointment.id, (appointment as any).groomingAppointmentId)

                const { error } = await supabase
                    .from(tableName)
                    .delete()
                    .eq("id", appointmentId)

                if (error) throw error

                toast({
                    title: "הצלחה",
                    description: "התור נמחק בהצלחה",
                })
            }

            setDeleteConfirmOpen(false)
            setPendingDeleteAppointment(null)
            setNotifyClient(false)
            refetch()
        } catch (error) {
            console.error("Error deleting appointment:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את התור",
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleDeleteFromHere = async (appointment: ManagerAppointment) => {
        setIsProcessing(true)
        try {
            const appointmentIndex = sortedAppointments.findIndex(apt => apt.id === appointment.id)
            if (appointmentIndex === -1) return

            const appointmentsToDelete = sortedAppointments.slice(appointmentIndex)

            // Send notification if requested
            await triggerManyChatNotification(appointmentsToDelete)

            const tableName = appointment.serviceType === "grooming" ? "grooming_appointments" : "daycare_appointments"

            for (const apt of appointmentsToDelete) {
                const appointmentId = apt.serviceType === "grooming"
                    ? extractGroomingAppointmentId(apt.id, (apt as any).groomingAppointmentId)
                    : extractGroomingAppointmentId(apt.id, (apt as any).groomingAppointmentId)
                const { error } = await supabase
                    .from(tableName)
                    .delete()
                    .eq("id", appointmentId)

                if (error) {
                    console.error(`Error deleting appointment ${apt.id}:`, error)
                }
            }

            toast({
                title: "הצלחה",
                description: `${appointmentsToDelete.length} תורים נמחקו בהצלחה`,
            })

            setDeleteFromHereOpen(false)
            setPendingDeleteFromHereAppointment(null)
            setNotifyClient(false)
            refetch()
        } catch (error) {
            console.error("Error deleting appointments:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את התורים",
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleDeleteSelected = async () => {
        if (selectedAppointmentIds.size === 0) return

        setIsProcessing(true)
        try {
            const appointmentsToDelete = sortedAppointments.filter(apt => selectedAppointmentIds.has(apt.id))

            // Send notification if requested
            await triggerManyChatNotification(appointmentsToDelete)

            for (const apt of appointmentsToDelete) {
                const tableName = apt.serviceType === "grooming" ? "grooming_appointments" : "daycare_appointments"
                const appointmentId = apt.serviceType === "grooming"
                    ? extractGroomingAppointmentId(apt.id, (apt as any).groomingAppointmentId)
                    : extractGroomingAppointmentId(apt.id, (apt as any).groomingAppointmentId)

                const { error } = await supabase
                    .from(tableName)
                    .delete()
                    .eq("id", appointmentId)

                if (error) {
                    console.error(`Error deleting appointment ${apt.id}:`, error)
                }
            }

            toast({
                title: "הצלחה",
                description: `${appointmentsToDelete.length} תורים נמחקו בהצלחה`,
            })

            setSelectedAppointmentIds(new Set())
            setDeleteSelectedOpen(false)
            setNotifyClient(false)
            refetch()
        } catch (error) {
            console.error("Error deleting selected appointments:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את התורים",
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleUnlinkSelected = async () => {
        if (selectedAppointmentIds.size === 0) return

        setIsProcessing(true)
        try {
            const appointmentsToUnlink = sortedAppointments.filter(apt => selectedAppointmentIds.has(apt.id))

            for (const apt of appointmentsToUnlink) {
                const tableName = apt.serviceType === "grooming" ? "grooming_appointments" : "daycare_appointments"
                const appointmentId = apt.serviceType === "grooming"
                    ? extractGroomingAppointmentId(apt.id, (apt as any).groomingAppointmentId)
                    : extractGroomingAppointmentId(apt.id, (apt as any).groomingAppointmentId)

                const { error } = await supabase
                    .from(tableName)
                    .update({ series_id: null })
                    .eq("id", appointmentId)

                if (error) {
                    console.error(`Error unlinking appointment ${apt.id}:`, error)
                }
            }

            toast({
                title: "הצלחה",
                description: `${appointmentsToUnlink.length} תורים נותקו מהסדרה בהצלחה`,
            })

            setUnlinkSelectedOpen(false)
            setSelectedAppointmentIds(new Set())
            refetch()
        } catch (error) {
            console.error("Error unlinking selected appointments:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לנתק את התורים מהסדרה",
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleUnlinkFromHere = async (appointment: ManagerAppointment) => {
        setIsProcessing(true)
        try {
            const appointmentIndex = sortedAppointments.findIndex(apt => apt.id === appointment.id)
            if (appointmentIndex === -1) return

            const appointmentsToUnlink = sortedAppointments.slice(appointmentIndex)

            for (const apt of appointmentsToUnlink) {
                const tableName = apt.serviceType === "grooming" ? "grooming_appointments" : "daycare_appointments"
                const appointmentId = apt.serviceType === "grooming"
                    ? extractGroomingAppointmentId(apt.id, (apt as any).groomingAppointmentId)
                    : extractGroomingAppointmentId(apt.id, (apt as any).groomingAppointmentId)

                const { error } = await supabase
                    .from(tableName)
                    .update({ series_id: null })
                    .eq("id", appointmentId)

                if (error) {
                    console.error(`Error unlinking appointment ${apt.id}:`, error)
                }
            }

            toast({
                title: "הצלחה",
                description: `${appointmentsToUnlink.length} תורים נותקו מהסדרה בהצלחה`,
            })

            setUnlinkFromHereOpen(false)
            setPendingUnlinkFromHereAppointment(null)
            refetch()
        } catch (error) {
            console.error("Error unlinking appointments:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לנתק את התורים מהסדרה",
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleDeleteAllFuture = async () => {
        const tomorrow = addDays(startOfToday(), 1)
        const futureAppointments = sortedAppointments.filter(apt =>
            new Date(apt.startDateTime).getTime() >= tomorrow.getTime()
        )

        if (futureAppointments.length === 0) {
            toast({
                title: "אין תורים עתידיים",
                description: "לא נמצאו תורים עתידיים למחיקה",
            })
            return
        }

        setIsProcessing(true)
        try {
            // Send notification if requested
            await triggerManyChatNotification(futureAppointments)

            for (const apt of futureAppointments) {
                const tableName = apt.serviceType === "grooming" ? "grooming_appointments" : "daycare_appointments"
                const appointmentId = apt.serviceType === "grooming"
                    ? extractGroomingAppointmentId(apt.id, (apt as any).groomingAppointmentId)
                    : extractGroomingAppointmentId(apt.id, (apt as any).groomingAppointmentId)

                const { error } = await supabase
                    .from(tableName)
                    .delete()
                    .eq("id", appointmentId)

                if (error) {
                    console.error(`Error deleting appointment ${apt.id}:`, error)
                }
            }

            toast({
                title: "הצלחה",
                description: `${futureAppointments.length} תורים עתידיים נמחקו בהצלחה`,
            })

            setDeleteAllFutureOpen(false)
            setNotifyClient(false)
            refetch()
        } catch (error) {
            console.error("Error deleting future appointments:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את התורים העתידיים",
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const getStatusColor = (status: string): string => {
        const normalized = status.toLowerCase()
        if (normalized.includes("cancel") || normalized.includes("בוטל") || normalized.includes("מבוטל")) {
            return "bg-red-100 text-red-800"
        }
        if (normalized.includes("pending") || normalized.includes("ממתין") || normalized.includes("בהמתנה")) {
            return "bg-yellow-100 text-yellow-800"
        }
        if (normalized.includes("confirm") || normalized.includes("מאושר") || normalized.includes("הושלם")) {
            return "bg-green-100 text-green-800"
        }
        return "bg-gray-100 text-gray-800"
    }

    const getServiceLabel = (serviceType: "grooming" | "garden"): string => {
        return serviceType === "grooming" ? "מספרה" : ""
    }

    const allSelected = sortedAppointments.length > 0 && selectedAppointmentIds.size === sortedAppointments.length
    const someSelected = selectedAppointmentIds.size > 0 && selectedAppointmentIds.size < sortedAppointments.length

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col p-6" dir="rtl">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle className="text-right">תורים בסדרה</DialogTitle>
                        <DialogDescription className="text-right">
                            {count > 0 ? (
                                <>
                                    נמצאו {count} תורים בסדרה זו
                                    {dogName && (
                                        <span className="block mt-1 text-sm font-medium text-gray-900">
                                            לקוח: {dogName}
                                        </span>
                                    )}
                                </>
                            ) : (
                                "טוען תורים..."
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0 max-h-full">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : sortedAppointments.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                לא נמצאו תורים בסדרה זו
                            </div>
                        ) : (
                            <>
                                {/* Action Bar */}
                                <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b px-1 flex-shrink-0">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            checked={allSelected}
                                            onCheckedChange={handleSelectAll}
                                            disabled={isProcessing}
                                        />
                                        <span className="text-sm text-gray-700">
                                            {selectedAppointmentIds.size > 0
                                                ? `נבחרו ${selectedAppointmentIds.size} תורים`
                                                : "בחר הכל"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {selectedAppointmentIds.size > 0 && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setBulkEditOpen(true)}
                                                    disabled={isProcessing}
                                                    className="border-primary/30 text-primary hover:text-primary hover:bg-primary/10 hover:border-primary/40"
                                                >
                                                    <Pencil className="h-4 w-4 ml-2" />
                                                    ערוך נבחרים ({selectedAppointmentIds.size})
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setUnlinkSelectedOpen(true)}
                                                    disabled={isProcessing}
                                                    className="border-orange-300 text-orange-600 hover:text-orange-700 hover:bg-orange-50 hover:border-orange-400"
                                                >
                                                    <Unlink className="h-4 w-4 ml-2" />
                                                    נתק נבחרים ({selectedAppointmentIds.size})
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setDeleteSelectedOpen(true)}
                                                    disabled={isProcessing}
                                                    className="border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-400"
                                                >
                                                    <Trash2 className="h-4 w-4 ml-2" />
                                                    מחק נבחרים ({selectedAppointmentIds.size})
                                                </Button>
                                            </>
                                        )}
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setDeleteAllFutureOpen(true)}
                                            disabled={isProcessing}
                                        >
                                            <Trash2 className="h-4 w-4 ml-2" />
                                            מחק כל התורים העתידיים
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 min-h-0 overflow-y-auto pr-2 pl-2">
                                    <table className="w-full border-collapse" dir="rtl">
                                        <thead className="sticky top-0 bg-white z-10">
                                            <tr className="border-b border-gray-200">
                                                <th className="text-right py-3 px-3 text-xs font-medium text-gray-700 w-12"></th>
                                                <th className="text-right py-3 px-4 text-xs font-medium text-gray-700">תאריך ושעה</th>
                                                <th className="text-right py-3 px-4 text-xs font-medium text-gray-700">עמדה</th>
                                                <th className="text-right py-3 px-4 text-xs font-medium text-gray-700">שירות</th>
                                                <th className="text-right py-3 px-4 text-xs font-medium text-gray-700">סטטוס</th>
                                                <th className="text-right py-3 px-4 text-xs font-medium text-gray-700">פעולות</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedAppointments.map((appointment) => {
                                                const startDate = new Date(appointment.startDateTime)
                                                const endDate = new Date(appointment.endDateTime)
                                                const isCurrentAppointment = currentAppointmentId === appointment.id
                                                const stationName = appointment.stationName || "לא משויך"
                                                const isSelected = selectedAppointmentIds.has(appointment.id)

                                                return (
                                                    <tr
                                                        key={appointment.id}
                                                        className={cn(
                                                            "border-b border-gray-100",
                                                            isCurrentAppointment && "bg-primary/10",
                                                            isSelected && "bg-primary/10",
                                                            "hover:bg-gray-50 transition-colors"
                                                        )}
                                                    >
                                                        <td className="py-3 px-3 text-center">
                                                            <div
                                                                onMouseDown={(e) => {
                                                                    if (e.shiftKey) {
                                                                        e.preventDefault()
                                                                        e.stopPropagation()
                                                                        isShiftClickRef.current = true
                                                                        handleToggleSelect(appointment.id, true)
                                                                        // Reset after a short delay to allow the checkbox state to update
                                                                        setTimeout(() => {
                                                                            isShiftClickRef.current = false
                                                                        }, 100)
                                                                    } else {
                                                                        isShiftClickRef.current = false
                                                                    }
                                                                }}
                                                            >
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onCheckedChange={(checked) => {
                                                                        // Only handle normal clicks (not shift-clicks)
                                                                        if (!isShiftClickRef.current) {
                                                                            handleToggleSelect(appointment.id, false)
                                                                        }
                                                                    }}
                                                                    disabled={isProcessing}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-right">
                                                            <div className="flex items-center gap-2 justify-end">
                                                                <div>
                                                                    <div className="font-medium text-gray-900">
                                                                        {format(startDate, "dd.MM.yyyy", { locale: he })}
                                                                    </div>
                                                                    <div className="text-xs text-gray-600">
                                                                        {format(startDate, "HH:mm", { locale: he })} - {format(endDate, "HH:mm", { locale: he })}
                                                                    </div>
                                                                </div>
                                                                {isCurrentAppointment && (
                                                                    <Badge variant="outline" className="text-xs bg-primary/20 text-primary border-primary/30 whitespace-nowrap">
                                                                        התור הנוכחי
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-right">
                                                            <span className="text-gray-900">{stationName}</span>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-right">
                                                            <Badge variant="outline" className={cn(
                                                                "text-xs",
                                                                appointment.serviceType === "grooming"
                                                                    ? "border-primary/20 bg-primary/20 text-primary"
                                                                    : "border-emerald-200 bg-emerald-100 text-emerald-800"
                                                            )}>
                                                                {getServiceLabel(appointment.serviceType)}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-right">
                                                            <Badge variant="outline" className={cn("text-xs", getStatusColor(appointment.status))}>
                                                                {appointment.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-right">
                                                            <div className="flex items-center gap-1 justify-end">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleOpenAppointment(appointment)
                                                                    }}
                                                                    title="פתח תור"
                                                                    disabled={isProcessing}
                                                                >
                                                                    <Eye className="h-3 w-3" />
                                                                </Button>
                                                                {onEditAppointment && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            onEditAppointment(appointment)
                                                                            onOpenChange(false)
                                                                        }}
                                                                        title="ערוך תור"
                                                                        disabled={isProcessing}
                                                                    >
                                                                        <Pencil className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleUnlink(appointment)
                                                                    }}
                                                                    title="נתק מהסדרה"
                                                                    disabled={isProcessing}
                                                                >
                                                                    <Unlink className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setPendingDeleteAppointment(appointment)
                                                                        setDeleteConfirmOpen(true)
                                                                    }}
                                                                    title="מחק תור"
                                                                    disabled={isProcessing}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 px-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                            }}
                                                                            title="עוד פעולות"
                                                                            disabled={isProcessing}
                                                                        >
                                                                            <MoreVertical className="h-3 w-3" />
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-48 p-1" align="end" dir="rtl">
                                                                        <div className="space-y-1">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation()
                                                                                    setPendingEditFromHereAppointment(appointment)
                                                                                    setBulkEditOpen(true)
                                                                                }}
                                                                                disabled={isProcessing}
                                                                            >
                                                                                <Pencil className="h-4 w-4 ml-2" />
                                                                                ערוך מכאן למטה
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation()
                                                                                    setPendingDeleteFromHereAppointment(appointment)
                                                                                    setDeleteFromHereOpen(true)
                                                                                }}
                                                                                disabled={isProcessing}
                                                                            >
                                                                                <Trash2 className="h-4 w-4 ml-2" />
                                                                                מחק מכאן למטה
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="w-full justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation()
                                                                                    setPendingUnlinkFromHereAppointment(appointment)
                                                                                    setUnlinkFromHereOpen(true)
                                                                                }}
                                                                                disabled={isProcessing}
                                                                            >
                                                                                <Unlink className="h-4 w-4 ml-2" />
                                                                                נתק מכאן למטה
                                                                            </Button>
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Single Appointment Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => {
                setDeleteConfirmOpen(open)
                if (!open) setNotifyClient(false)
            }}>
                <AlertDialogContent dir="rtl" className="sm:max-w-md">
                    <AlertDialogHeader className="text-right">
                        <AlertDialogTitle className="text-right">מחיקת תור</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 text-right">
                            {pendingDeleteAppointment && (
                                <>
                                    <div className="text-right">
                                        האם אתה בטוח שברצונך למחוק את התור הזה?
                                    </div>
                                    <div className="text-sm font-medium text-gray-900 text-right">
                                        תאריך: {format(new Date(pendingDeleteAppointment.startDateTime), "dd.MM.yyyy", { locale: he })} {format(new Date(pendingDeleteAppointment.startDateTime), "HH:mm", { locale: he })}
                                    </div>
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <div className="flex items-center gap-2 justify-end flex-row-reverse">
                            <Label
                                htmlFor="notify-client-single"
                                className="text-sm cursor-pointer text-right"
                            >
                                עדכן את הלקוח על המחיקה
                            </Label>
                            <Checkbox
                                id="notify-client-single"
                                checked={notifyClient}
                                onCheckedChange={(checked) => setNotifyClient(checked === true)}
                                disabled={isProcessing}
                            />
                        </div>
                    </div>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <AlertDialogAction
                            onClick={() => pendingDeleteAppointment && handleDelete(pendingDeleteAppointment)}
                            disabled={isProcessing}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            מחק
                        </AlertDialogAction>
                        <AlertDialogCancel disabled={isProcessing} onClick={() => setNotifyClient(false)}>ביטול</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete From Here Confirmation Dialog */}
            <AlertDialog open={deleteFromHereOpen} onOpenChange={(open) => {
                setDeleteFromHereOpen(open)
                if (!open) setNotifyClient(false)
            }}>
                <AlertDialogContent dir="rtl" className="sm:max-w-md">
                    <AlertDialogHeader className="text-right">
                        <AlertDialogTitle className="text-right">מחיקת תורים</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 text-right">
                            {pendingDeleteFromHereAppointment && (() => {
                                const appointmentIndex = sortedAppointments.findIndex(apt => apt.id === pendingDeleteFromHereAppointment.id)
                                const appointmentsToDelete = appointmentIndex >= 0 ? sortedAppointments.slice(appointmentIndex) : []
                                const firstDate = appointmentsToDelete[0] ? format(new Date(appointmentsToDelete[0].startDateTime), "dd.MM.yyyy", { locale: he }) : ""
                                const lastDate = appointmentsToDelete.length > 0 ? format(new Date(appointmentsToDelete[appointmentsToDelete.length - 1].startDateTime), "dd.MM.yyyy", { locale: he }) : ""

                                return (
                                    <>
                                        <div className="text-right">
                                            האם אתה בטוח שברצונך למחוק את {appointmentsToDelete.length} התורים החל מתאריך {firstDate} ועד {lastDate}?
                                        </div>
                                    </>
                                )
                            })()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <div className="flex items-center gap-2 flex-row-reverse justify-end">
                            <Label
                                htmlFor="notify-client-from-here"
                                className="text-sm cursor-pointer text-right"
                            >
                                עדכן את הלקוח על המחיקה
                            </Label>
                            <Checkbox
                                id="notify-client-from-here"
                                checked={notifyClient}
                                onCheckedChange={(checked) => setNotifyClient(checked === true)}
                                disabled={isProcessing}
                            />
                        </div>
                    </div>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <AlertDialogAction
                            onClick={() => pendingDeleteFromHereAppointment && handleDeleteFromHere(pendingDeleteFromHereAppointment)}
                            disabled={isProcessing}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            מחק מכאן למטה
                        </AlertDialogAction>
                        <AlertDialogCancel disabled={isProcessing} onClick={() => setNotifyClient(false)}>ביטול</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete All Future Confirmation Dialog */}
            <AlertDialog open={deleteAllFutureOpen} onOpenChange={(open) => {
                setDeleteAllFutureOpen(open)
                if (!open) setNotifyClient(false)
            }}>
                <AlertDialogContent dir="rtl" className="sm:max-w-md">
                    <AlertDialogHeader className="text-right">
                        <AlertDialogTitle className="text-right">מחיקת תורים עתידיים</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 text-right">
                            {(() => {
                                const tomorrow = addDays(startOfToday(), 1)
                                const futureAppointments = sortedAppointments.filter(apt =>
                                    new Date(apt.startDateTime).getTime() >= tomorrow.getTime()
                                )
                                const firstDate = futureAppointments.length > 0 ? format(new Date(futureAppointments[0].startDateTime), "dd.MM.yyyy", { locale: he }) : ""
                                const lastDate = futureAppointments.length > 0 ? format(new Date(futureAppointments[futureAppointments.length - 1].startDateTime), "dd.MM.yyyy", { locale: he }) : ""

                                return (
                                    <>
                                        <div className="text-right">
                                            האם אתה בטוח שברצונך למחוק את {futureAppointments.length} התורים העתידיים החל מתאריך {firstDate} ועד {lastDate}?
                                        </div>
                                    </>
                                )
                            })()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <div className="flex items-center gap-2 justify-end flex-row-reverse">
                            <Label
                                htmlFor="notify-client-future"
                                className="text-sm cursor-pointer text-right"
                            >
                                עדכן את הלקוח על המחיקה
                            </Label>
                            <Checkbox
                                id="notify-client-future"
                                checked={notifyClient}
                                onCheckedChange={(checked) => setNotifyClient(checked === true)}
                                disabled={isProcessing}
                            />
                        </div>
                    </div>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <AlertDialogAction
                            onClick={handleDeleteAllFuture}
                            disabled={isProcessing}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            מחק כל התורים העתידיים
                        </AlertDialogAction>
                        <AlertDialogCancel disabled={isProcessing} onClick={() => setNotifyClient(false)}>ביטול</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Selected Confirmation Dialog */}
            <AlertDialog open={deleteSelectedOpen} onOpenChange={(open) => {
                setDeleteSelectedOpen(open)
                if (!open) setNotifyClient(false)
            }}>
                <AlertDialogContent dir="rtl" className="sm:max-w-md">
                    <AlertDialogHeader className="text-right">
                        <AlertDialogTitle className="text-right">מחיקת תורים נבחרים</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 text-right">
                            {(() => {
                                const appointmentsToDelete = sortedAppointments.filter(apt => selectedAppointmentIds.has(apt.id))
                                const firstDate = appointmentsToDelete.length > 0 ? format(new Date(appointmentsToDelete[0].startDateTime), "dd.MM.yyyy", { locale: he }) : ""
                                const lastDate = appointmentsToDelete.length > 0 ? format(new Date(appointmentsToDelete[appointmentsToDelete.length - 1].startDateTime), "dd.MM.yyyy", { locale: he }) : ""

                                return (
                                    <>
                                        <div className="text-right">
                                            האם אתה בטוח שברצונך למחוק את {appointmentsToDelete.length} התורים הנבחרים החל מתאריך {firstDate} ועד {lastDate}?
                                        </div>
                                    </>
                                )
                            })()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <div className="flex items-center gap-2 justify-end flex-row-reverse">
                            <Label
                                htmlFor="notify-client-selected"
                                className="text-sm cursor-pointer text-right"
                            >
                                עדכן את הלקוח על המחיקה
                            </Label>
                            <Checkbox
                                id="notify-client-selected"
                                checked={notifyClient}
                                onCheckedChange={(checked) => setNotifyClient(checked === true)}
                                disabled={isProcessing}
                            />
                        </div>
                    </div>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <AlertDialogAction
                            onClick={handleDeleteSelected}
                            disabled={isProcessing}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            מחק נבחרים
                        </AlertDialogAction>
                        <AlertDialogCancel disabled={isProcessing} onClick={() => setNotifyClient(false)}>ביטול</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Unlink Single Confirmation Dialog */}
            <AlertDialog open={unlinkConfirmOpen} onOpenChange={setUnlinkConfirmOpen}>
                <AlertDialogContent dir="rtl" className="sm:max-w-md">
                    <AlertDialogHeader className="text-right">
                        <AlertDialogTitle className="text-right">נתיקת תור מהסדרה</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 text-right">
                            {pendingUnlinkAppointment && (() => {
                                const appointmentDate = format(new Date(pendingUnlinkAppointment.startDateTime), "dd.MM.yyyy", { locale: he })

                                return (
                                    <>
                                        <div className="text-right">
                                            האם אתה בטוח שברצונך לנתק את התור מתאריך {appointmentDate} מהסדרה?
                                        </div>
                                    </>
                                )
                            })()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <AlertDialogAction
                            onClick={() => pendingUnlinkAppointment && handleUnlink(pendingUnlinkAppointment)}
                            disabled={isProcessing}
                            className="bg-orange-600 hover:bg-orange-700"
                        >
                            נתק
                        </AlertDialogAction>
                        <AlertDialogCancel disabled={isProcessing}>ביטול</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Unlink Selected Confirmation Dialog */}
            <AlertDialog open={unlinkSelectedOpen} onOpenChange={setUnlinkSelectedOpen}>
                <AlertDialogContent dir="rtl" className="sm:max-w-md">
                    <AlertDialogHeader className="text-right">
                        <AlertDialogTitle className="text-right">נתיקת תורים מהסדרה</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 text-right">
                            {(() => {
                                const appointmentsToUnlink = sortedAppointments.filter(apt => selectedAppointmentIds.has(apt.id))
                                const firstDate = appointmentsToUnlink[0] ? format(new Date(appointmentsToUnlink[0].startDateTime), "dd.MM.yyyy", { locale: he }) : ""
                                const lastDate = appointmentsToUnlink.length > 0 ? format(new Date(appointmentsToUnlink[appointmentsToUnlink.length - 1].startDateTime), "dd.MM.yyyy", { locale: he }) : ""

                                return (
                                    <>
                                        <div className="text-right">
                                            האם אתה בטוח שברצונך לנתק את {appointmentsToUnlink.length} התורים הנבחרים החל מתאריך {firstDate} ועד {lastDate} מהסדרה?
                                        </div>
                                    </>
                                )
                            })()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <AlertDialogAction
                            onClick={handleUnlinkSelected}
                            disabled={isProcessing}
                            className="bg-orange-600 hover:bg-orange-700"
                        >
                            נתק נבחרים
                        </AlertDialogAction>
                        <AlertDialogCancel disabled={isProcessing}>ביטול</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Unlink From Here Confirmation Dialog */}
            <AlertDialog open={unlinkFromHereOpen} onOpenChange={setUnlinkFromHereOpen}>
                <AlertDialogContent dir="rtl" className="sm:max-w-md">
                    <AlertDialogHeader className="text-right">
                        <AlertDialogTitle className="text-right">נתיקת תורים מהסדרה</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 text-right">
                            {pendingUnlinkFromHereAppointment && (() => {
                                const appointmentIndex = sortedAppointments.findIndex(apt => apt.id === pendingUnlinkFromHereAppointment.id)
                                const appointmentsToUnlink = appointmentIndex >= 0 ? sortedAppointments.slice(appointmentIndex) : []
                                const firstDate = appointmentsToUnlink[0] ? format(new Date(appointmentsToUnlink[0].startDateTime), "dd.MM.yyyy", { locale: he }) : ""
                                const lastDate = appointmentsToUnlink.length > 0 ? format(new Date(appointmentsToUnlink[appointmentsToUnlink.length - 1].startDateTime), "dd.MM.yyyy", { locale: he }) : ""

                                return (
                                    <>
                                        <div className="text-right">
                                            האם אתה בטוח שברצונך לנתק את {appointmentsToUnlink.length} התורים החל מתאריך {firstDate} ועד {lastDate} מהסדרה?
                                        </div>
                                    </>
                                )
                            })()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <AlertDialogAction
                            onClick={() => pendingUnlinkFromHereAppointment && handleUnlinkFromHere(pendingUnlinkFromHereAppointment)}
                            disabled={isProcessing}
                            className="bg-orange-600 hover:bg-orange-700"
                        >
                            נתק מכאן למטה
                        </AlertDialogAction>
                        <AlertDialogCancel disabled={isProcessing}>ביטול</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Edit Modal */}
            <BulkEditAppointmentsModal
                open={bulkEditOpen}
                onOpenChange={(open) => {
                    setBulkEditOpen(open)
                    if (!open) {
                        setPendingEditFromHereAppointment(null)
                    }
                }}
                appointments={(() => {
                    if (pendingEditFromHereAppointment) {
                        // Edit from here to bottom
                        const appointmentIndex = sortedAppointments.findIndex(apt => apt.id === pendingEditFromHereAppointment.id)
                        return appointmentIndex >= 0 ? sortedAppointments.slice(appointmentIndex) : []
                    } else {
                        // Edit selected
                        return sortedAppointments.filter(apt => selectedAppointmentIds.has(apt.id))
                    }
                })()}
                stations={stations}
                onSuccess={() => {
                    setSelectedAppointmentIds(new Set())
                    refetch()
                }}
            />
        </>
    )
}
