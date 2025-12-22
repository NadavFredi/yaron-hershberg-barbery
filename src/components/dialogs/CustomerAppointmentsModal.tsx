import { useState, useEffect, useMemo } from "react"
import type { MouseEvent as ReactMouseEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Calendar, Clock, MapPin, CreditCard, FileText, CheckCircle2, XCircle, AlertCircle, Filter, Eye, ExternalLink } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import type { Database } from "@/integrations/supabase/types"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { DatePickerInput } from "@/components/DatePickerInput"
import { Button } from "@/components/ui/button"
import { useAppDispatch } from "@/store/hooks"
import { setSelectedAppointment, setIsDetailsOpen, setSelectedDate } from "@/store/slices/managerScheduleSlice"
import { useLazyGetManagerAppointmentQuery } from "@/store/services/supabaseApi"
import { useNavigate } from "react-router-dom"

type GroomingAppointment = Database["public"]["Tables"]["grooming_appointments"]["Row"]
type Station = Database["public"]["Tables"]["stations"]["Row"]
type Service = Database["public"]["Tables"]["services"]["Row"]

interface AppointmentWithDetails {
  id: string
  start_at: string
  end_at: string
  status: Database["public"]["Enums"]["appointment_status"]
  payment_status: Database["public"]["Enums"]["payment_status"]
  appointment_kind: Database["public"]["Enums"]["appointment_kind"]
  amount_due: number | null
  customer_notes: string | null
  internal_notes: string | null
  station?: Station | Station[]
  service?: Service | Service[]
}

interface CustomerAppointmentsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  customerName?: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  approved: "אושר",
  cancelled: "בוטל",
  matched: "הותאם",
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "לא שולם",
  paid: "שולם",
  partial: "חלקי",
}

const APPOINTMENT_KIND_LABELS: Record<string, string> = {
  business: "עסקי",
  personal: "פרטי",
}

export function CustomerAppointmentsModal({
  open,
  onOpenChange,
  customerId,
  customerName,
}: CustomerAppointmentsModalProps) {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<Date | null>(null)
  const dispatch = useAppDispatch()
  const [fetchManagerAppointment] = useLazyGetManagerAppointmentQuery()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open || !customerId) {
      setAppointments([])
      return
    }

    const fetchCustomerAppointments = async () => {
      setIsLoading(true)
      try {
        // Get all grooming appointments for this customer with related data
        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from("grooming_appointments")
          .select(`
            *,
            station:stations(*),
            service:services(*)
          `)
          .eq("customer_id", customerId)
          .order("start_at", { ascending: false })

        if (appointmentsError) {
          console.error("❌ [CustomerAppointmentsModal] Error fetching appointments:", appointmentsError)
          setIsLoading(false)
          return
        }

        if (!appointmentsData || appointmentsData.length === 0) {
          setAppointments([])
          setIsLoading(false)
          return
        }

        const mappedAppointments = appointmentsData.map((apt) => apt as unknown as AppointmentWithDetails)
        setAppointments(mappedAppointments)
      } catch (error) {
        console.error("❌ [CustomerAppointmentsModal] Unexpected error:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCustomerAppointments()
  }, [open, customerId])

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      // Status filter
      if (statusFilter !== "all" && apt.status !== statusFilter) {
        return false
      }

      // Payment status filter
      if (paymentStatusFilter !== "all" && apt.payment_status !== paymentStatusFilter) {
        return false
      }

      // Date filter
      if (dateFilter) {
        const appointmentDate = new Date(apt.start_at)
        const filterDate = new Date(dateFilter)
        // Compare dates (ignore time)
        if (
          appointmentDate.getFullYear() !== filterDate.getFullYear() ||
          appointmentDate.getMonth() !== filterDate.getMonth() ||
          appointmentDate.getDate() !== filterDate.getDate()
        ) {
          return false
        }
      }

      return true
    })
  }, [appointments, statusFilter, paymentStatusFilter, dateFilter])

  // Calculate total payments
  const totalPayments = useMemo(() => {
    return filteredAppointments.reduce((sum, apt) => {
      return sum + (apt.amount_due || 0)
    }, 0)
  }, [filteredAppointments])

  // Count appointments
  const appointmentsCount = filteredAppointments.length
  const totalAppointmentsCount = appointments.length

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "default"
      case "cancelled":
        return "destructive"
      case "pending":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getPaymentStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "default"
      case "unpaid":
        return "destructive"
      case "partial":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="h-3 w-3" />
      case "cancelled":
        return <XCircle className="h-3 w-3" />
      case "pending":
        return <AlertCircle className="h-3 w-3" />
      default:
        return null
    }
  }

  const handleAppointmentClick = async (appointment: AppointmentWithDetails) => {
    try {
      // Fetch fresh appointment data from API
      const result = await fetchManagerAppointment({
        appointmentId: appointment.id,
        serviceType: "grooming",
      }).unwrap()

      if (result?.appointment) {
        // Set the appointment and open the details sheet
        dispatch(setSelectedAppointment(result.appointment))
        dispatch(setIsDetailsOpen(true))
        // Close the modal
        onOpenChange(false)
      }
    } catch (error) {
      console.error("❌ [CustomerAppointmentsModal] Error fetching appointment:", error)
    }
  }

  const handleSeeOnCalendar = (appointment: AppointmentWithDetails, event: ReactMouseEvent) => {
    event.stopPropagation()
    // Close the sheet if it's open
    dispatch(setIsDetailsOpen(false))
    // Set the selected date to the appointment date
    const appointmentDate = new Date(appointment.start_at)
    dispatch(setSelectedDate(appointmentDate.toISOString()))
    // Close the modal first
    onOpenChange(false)
    // Navigate to manager schedule
    navigate("/manager")
  }

  const handleOpenAppointmentSheet = async (appointment: AppointmentWithDetails, event: ReactMouseEvent) => {
    event.stopPropagation()
    // Close the modal first to prevent any conflicts
    onOpenChange(false)
    
    try {
      // Fetch fresh appointment data from API
      const result = await fetchManagerAppointment({
        appointmentId: appointment.id,
        serviceType: "grooming",
      }).unwrap()

      if (result?.appointment) {
        // Set the appointment and open the details sheet
        dispatch(setSelectedAppointment(result.appointment))
        dispatch(setIsDetailsOpen(true))
      }
    } catch (error) {
      console.error("❌ [CustomerAppointmentsModal] Error fetching appointment:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {customerName ? `תורים של ${customerName}` : "תורים של לקוח"}
          </DialogTitle>
          <div className="flex items-center justify-between gap-4 mt-2 text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>
                סה"כ תורים: <span className="font-semibold text-gray-900">{totalAppointmentsCount}</span>
              </span>
              {filteredAppointments.length !== totalAppointmentsCount && (
                <span>
                  תורים מסוננים: <span className="font-semibold text-gray-900">{appointmentsCount}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-primary font-semibold">
              <CreditCard className="h-4 w-4" />
              סה"כ תשלומים: {totalPayments.toFixed(2)} ₪
            </div>
          </div>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">סינון:</span>
          </div>

          <div className="flex-1 min-w-[150px]">
            <Label className="text-xs text-gray-600 mb-1 block">סטטוס</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="כל הסטטוסים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="pending">ממתין</SelectItem>
                <SelectItem value="approved">אושר</SelectItem>
                <SelectItem value="cancelled">בוטל</SelectItem>
                <SelectItem value="matched">הותאם</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <Label className="text-xs text-gray-600 mb-1 block">סטטוס תשלום</Label>
            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="כל הסטטוסים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="unpaid">לא שולם</SelectItem>
                <SelectItem value="paid">שולם</SelectItem>
                <SelectItem value="partial">חלקי</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <Label className="text-xs text-gray-600 mb-1 block">תאריך</Label>
            <DatePickerInput
              value={dateFilter}
              onChange={setDateFilter}
              placeholder="בחר תאריך..."
              wrapperClassName="w-full"
              displayFormat="dd/MM/yyyy"
            />
          </div>

          <div className="text-sm text-gray-600">
            {filteredAppointments.length} {filteredAppointments.length === 1 ? "תור" : "תורים"}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-gray-600">טוען תורים...</p>
            </div>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Calendar className="h-12 w-12 mb-4 opacity-50" />
            <p>אין תורים עבור לקוח זה</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">תאריך ושעה</TableHead>
                  <TableHead className="text-right">תחנה</TableHead>
                  <TableHead className="text-right">שירות</TableHead>
                  <TableHead className="text-center">סטטוס</TableHead>
                  <TableHead className="text-center">תשלום</TableHead>
                  <TableHead className="text-center">סוג</TableHead>
                  <TableHead className="text-right">סכום</TableHead>
                  <TableHead className="text-right">הערות</TableHead>
                  <TableHead className="text-center">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.map((appointment) => {
                  const startDate = new Date(appointment.start_at)
                  const endDate = new Date(appointment.end_at)
                  const dateFormatted = format(startDate, "d/M/yyyy", { locale: he })
                  const startTime = format(startDate, "HH:mm", { locale: he })
                  const endTime = format(endDate, "HH:mm", { locale: he })
                  const station = Array.isArray(appointment.station) ? appointment.station[0] : appointment.station
                  const service = Array.isArray(appointment.service) ? appointment.service[0] : appointment.service
                  const hasNotes = appointment.customer_notes || appointment.internal_notes

                  return (
                    <TableRow
                      key={appointment.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleAppointmentClick(appointment)}
                    >
                      <TableCell className="text-right">
                        <div className="flex flex-col">
                          <span className="font-medium">{dateFormatted}</span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {startTime} - {endTime}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {station ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            {station.name}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {service ? (
                          <div className="flex items-center gap-1 text-sm">
                            <FileText className="h-3 w-3 text-gray-400" />
                            {service.name}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getStatusBadgeVariant(appointment.status)} className="gap-1 text-xs">
                          {getStatusIcon(appointment.status)}
                          {STATUS_LABELS[appointment.status] || appointment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getPaymentStatusBadgeVariant(appointment.payment_status)} className="text-xs">
                          {PAYMENT_STATUS_LABELS[appointment.payment_status] || appointment.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {appointment.appointment_kind && (
                          <Badge variant="outline" className="text-xs">
                            {APPOINTMENT_KIND_LABELS[appointment.appointment_kind] || appointment.appointment_kind}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {appointment.amount_due ? (
                          <div className="flex items-center gap-1 text-sm">
                            <CreditCard className="h-3 w-3 text-gray-400" />
                            {appointment.amount_due.toFixed(2)} ₪
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right max-w-[200px]">
                        {hasNotes ? (
                          <div className="text-xs text-gray-600">
                            {appointment.customer_notes && (
                              <div className="truncate" title={appointment.customer_notes}>
                                לקוח: {appointment.customer_notes}
                              </div>
                            )}
                            {appointment.internal_notes && (
                              <div className="truncate" title={appointment.internal_notes}>
                                פנימי: {appointment.internal_notes}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => handleOpenAppointmentSheet(appointment, e)}
                            title="פתח פרטי תור"
                          >
                            <ExternalLink className="h-3 w-3 ml-1" />
                            פרטי תור
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => handleSeeOnCalendar(appointment, e)}
                            title="הצג בלוח"
                          >
                            <Eye className="h-3 w-3 ml-1" />
                            הצג בלוח
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
