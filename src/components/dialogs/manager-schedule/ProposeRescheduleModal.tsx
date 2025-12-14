import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AppointmentDetailsSection, type AppointmentTimes, type AppointmentStation } from "@/pages/ManagerSchedule/components/AppointmentDetailsSection"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { RecipientSelector, type RecipientSelection } from "./RecipientSelector"

interface ProposeRescheduleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: ManagerAppointment | null
  stations: AppointmentStation[]
  initialTimes: AppointmentTimes | null
  submitting: boolean
  onSubmit: (payload: { times: AppointmentTimes; summary: string; sendWhatsApp: boolean; recipientSelection?: RecipientSelection }) => void
}

const formatRange = (start?: Date | null, end?: Date | null) => {
  if (!start || !end) {
    return "—"
  }
  try {
    return `${format(start, "dd.MM.yyyy", { locale: he })} · ${format(start, "HH:mm")} - ${format(end, "HH:mm")}`
  } catch {
    return "—"
  }
}

const buildDefaultSummary = (appointment: ManagerAppointment | null) => {
  if (!appointment) {
    return "הצעת זמן חדש עבור התור הקיים"
  }
  const dogName = appointment.dogs?.[0]?.name
  const clientName = appointment.clientName
  if (dogName && clientName) {
    return `הצעת זמן חדש עבור ${dogName} (${clientName})`
  }
  if (dogName) {
    return `הצעת זמן חדש עבור ${dogName}`
  }
  if (clientName) {
    return `הצעת זמן חדש ל${clientName}`
  }
  return "הצעת זמן חדש עבור התור הקיים"
}

export const ProposeRescheduleModal = ({
  open,
  onOpenChange,
  appointment,
  stations,
  initialTimes,
  submitting,
  onSubmit,
}: ProposeRescheduleModalProps) => {
  const [times, setTimes] = useState<AppointmentTimes | null>(initialTimes)
  const [summary, setSummary] = useState<string>(buildDefaultSummary(appointment))
  const [sendWhatsApp, setSendWhatsApp] = useState(true) // Default to checked
  const [recipientSelection, setRecipientSelection] = useState<RecipientSelection>({
    ownerPhone: null,
    selectedContactIds: [],
    customPhones: []
  })

  // Reset form when modal opens
  useEffect(() => {
    if (!open) {
      return
    }
    setTimes(initialTimes)
    setSummary(buildDefaultSummary(appointment))
    setSendWhatsApp(true) // Reset to checked when modal opens
    setRecipientSelection({
      ownerPhone: null,
      selectedContactIds: [],
      customPhones: []
    })
  }, [open, initialTimes, appointment])

  const originalRange = useMemo(() => {
    if (!appointment) {
      return "—"
    }
    const start = appointment.startDateTime ? new Date(appointment.startDateTime) : null
    const end = appointment.endDateTime ? new Date(appointment.endDateTime) : null
    return formatRange(start, end)
  }, [appointment])

  const handleConfirm = () => {
    if (!times || !times.startTime || !times.endTime || !times.stationId) {
      return
    }
    onSubmit({
      times,
      summary: summary.trim(),
      sendWhatsApp,
      recipientSelection: sendWhatsApp ? recipientSelection : undefined
    })
  }

  const customerName = appointment?.clientName ?? "לקוח"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[75vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">הצע זמן חדש</DialogTitle>
          <DialogDescription className="text-right text-sm text-gray-600">
            ניצור הצעה חדשה עבור {customerName} בלבד. לאחר האישור, התור המקורי יעבור לשעה שתבחרו.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(75vh-180px)]">
          <div className="space-y-4 pr-2">
            <div className="rounded-lg border border-lime-200 bg-lime-50/80 p-3 text-right text-sm text-lime-800">
              <div className="font-semibold text-lime-900">תור מקורי</div>
              <div>{originalRange}</div>
            </div>

            {times && (
              <AppointmentDetailsSection
                isOpen={open}
                finalizedTimes={times}
                stations={stations}
                onTimesChange={(nextTimes) => setTimes(nextTimes)}
                theme="mint"
                stationFilter={(station) =>
                  !appointment?.serviceType || station.serviceType === appointment.serviceType
                }
              />
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600" htmlFor="reschedule-summary">
                הודעה קצרה ללקוח (מוצגת גם בהזמנה)
              </label>
              <Textarea
                id="reschedule-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                maxLength={200}
                className={cn("text-right", "min-h-[90px]")}
                placeholder="הזינו כמה מילים על הרעיון של המועד החדש"
              />
              <div className="text-xs text-gray-400 text-right">נשארו {200 - summary.length} תווים</div>
            </div>

            {/* WhatsApp Banner */}
            <div className="rounded-lg border border-lime-300 bg-lime-50/90 p-3 shadow-sm" dir="rtl">
              <label htmlFor="send-whatsapp-reschedule" className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  id="send-whatsapp-reschedule"
                  checked={sendWhatsApp}
                  onCheckedChange={(checked) => setSendWhatsApp(checked === true)}
                  className="h-5 w-5"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-lime-900">שלח וואטסאפ</div>
                  <div className="text-xs text-lime-700">שלח הודעה ללקוח עם פרטי ההצעה החדשה</div>
                </div>
              </label>
            </div>

            {/* Contact Selection - Only show when sendWhatsApp is checked */}
            {sendWhatsApp && (
              <RecipientSelector
                customerId={appointment?.clientId || null}
                customerPhone={appointment?.clientPhone || null}
                customerName={appointment?.clientName || null}
                forceOwner
                onSelectionChange={setRecipientSelection}
              />
            )}
          </div>
        </ScrollArea>

        <DialogFooter dir="ltr" className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            ביטול
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || !times?.startTime || !times?.endTime}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {sendWhatsApp ? "שלח הצעה" : "שמור הצעה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}



