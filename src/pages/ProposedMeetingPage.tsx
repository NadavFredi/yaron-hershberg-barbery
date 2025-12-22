import { useEffect, useMemo, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, CalendarIcon, Clock, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSupabaseAuthWithClientId } from "@/hooks/useSupabaseAuthWithClientId"
import {
  useGetProposedMeetingPublicQuery,
  useBookProposedMeetingMutation,
  useGetClientProfileQuery,
} from "@/store/services/supabaseApi"
import { useToast } from "@/components/ui/use-toast"
import { Label } from "@/components/ui/label"
import { skipToken } from "@reduxjs/toolkit/query"

const formatDate = (value: string) => {
  try {
    return format(new Date(value), "EEEE, d MMMM yyyy", { locale: he })
  } catch {
    return value
  }
}

const formatTimeRange = (start: string, end: string) => {
  try {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`
  } catch {
    return ""
  }
}

const ProposedMeetingPage = () => {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, clientId, isLoading: authLoading } = useSupabaseAuthWithClientId()

  const {
    data: meeting,
    isLoading: meetingLoading,
    error: meetingError,
  } = useGetProposedMeetingPublicQuery(meetingId ?? "", { skip: !meetingId })

  const { data: profile } = useGetClientProfileQuery(clientId ?? skipToken, { skip: !clientId })

  const [codeInput, setCodeInput] = useState("")
  const [bookingCompleted, setBookingCompleted] = useState(false)
  const [bookMeeting, { isLoading: isBooking }] = useBookProposedMeetingMutation()

  const isInvited = useMemo(() => {
    if (!clientId || !meeting?.invites) {
      return false
    }
    return meeting.invites.some((invite) => invite.customerId === clientId)
  }, [clientId, meeting?.invites])

  const isCategoryAllowed = useMemo(() => {
    if (!profile?.customerTypeId || !meeting?.categories) {
      return false
    }
    return meeting.categories.some((category) => category.customerTypeId === profile.customerTypeId)
  }, [profile?.customerTypeId, meeting?.categories])

  const hasAutomaticAccess = isInvited || isCategoryAllowed
  const enteredCode = codeInput.trim()
  const hasCodeAccess = enteredCode.length === 6

  const canSubmit = Boolean(
    meeting &&
    !bookingCompleted &&
    (hasAutomaticAccess || hasCodeAccess),
  )

  const meetingUnavailable =
    Boolean(meetingError) ||
    (meeting && meeting.status && meeting.status !== "proposed") ||
    !meetingId

  const handleBookMeeting = async () => {
    if (!meetingId) {
      return
    }
    try {
      await bookMeeting({
        meetingId,
        code: enteredCode || undefined,
      }).unwrap()
      setBookingCompleted(true)
      toast({
        title: "התור נשמר עבורך",
        description: "נשלחה אליך הודעת אישור על ההזמנה.",
      })
      navigate("/appointments", { replace: true })
    } catch (error) {
      const message =
        typeof error === "object" && error !== null && "data" in error
          ? (error as { data?: unknown }).data
          : error instanceof Error
            ? error.message
            : "לא ניתן לשמור את המפגש"
      toast({
        title: "שמירת התור נכשלה",
        description: typeof message === "string" ? message : "בדקו את הנתונים ונסו שוב.",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    if (meetingUnavailable) {
      toast({
        title: "לא ניתן להציג את ההצעה",
        description: "ההזמנה אינה זמינה עוד.",
        variant: "destructive",
      })
    }
  }, [meetingUnavailable, toast])

  if (!meetingId) {
    return (
      <div className="container max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-600">קישור ההזמנה חסר.</p>
            <Button asChild className="mt-4">
              <Link to="/">חזרה לדף הבית</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (meetingLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (meetingUnavailable || !meeting) {
    return (
      <div className="container max-w-3xl px-4 py-10">
        <Alert className="border-red-200 bg-red-50" dir="rtl">
          <AlertTitle className="flex items-center justify-end gap-2">
            <ShieldCheck className="h-4 w-4" />
            ההצעה אינה זמינה
          </AlertTitle>
          <AlertDescription className="text-right">
            נראה שהמפגש כבר הוזמן או שאינו זמין.
          </AlertDescription>
        </Alert>
        <div className="flex justify-end mt-4">
          <Button asChild variant="outline">
            <Link to="/">חזרה לדף הבית</Link>
          </Button>
        </div>
      </div>
    )
  }

  const hasAccess = hasAutomaticAccess || hasCodeAccess

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-primary/20 rounded-full mb-4">
            <CalendarIcon className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">אישור הזמנה</h1>
          <p className="text-slate-600 mt-2">בחרו לאשר את המפגש או הזינו קוד הזמנה אם נדרש.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900">פרטי המפגש</CardTitle>
              <CardDescription>בדקו את הפרטים לפני אישור</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">סטטוס</span>
                <Badge variant={bookingCompleted ? "success" : "secondary"}>
                  {bookingCompleted ? "הוזמן" : "ממתין לאישור"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">תאריך</span>
                <span className="text-sm font-medium text-slate-900">
                  {meeting.startAt ? formatDate(meeting.startAt) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">שעה</span>
                <span className="text-sm font-medium text-slate-900">
                  {meeting.startAt && meeting.endAt ? formatTimeRange(meeting.startAt, meeting.endAt) : "—"}
                </span>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-sm font-semibold text-slate-900">{meeting.title || "מפגש מוצע"}</p>
                {meeting.summary && <p className="text-sm text-slate-600">{meeting.summary}</p>}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {!hasAutomaticAccess && (
              <Alert className="border-yellow-200 bg-yellow-50 text-right" dir="rtl">
                <AlertTitle className="flex items-center justify-end gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  נדרש קוד להזמנה
                </AlertTitle>
                <AlertDescription className="text-sm text-slate-700">
                  ההזמנה מוגבלת. אם קיבלת קוד, הזן אותו כדי לאשר.
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900 text-right">אימות הזמנה</CardTitle>
                <CardDescription className="text-right">
                  ההזמנה מקושרת לחשבון המחובר. אם נדרש קוד, הזינו אותו והמשיכו.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!hasAutomaticAccess && (
                  <div className="space-y-2">
                    <Label htmlFor="code-input" className="text-right block">
                      הזן קוד הזמנה
                    </Label>
                    <Input
                      id="code-input"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder="123456"
                      dir="ltr"
                      className="text-right"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => navigate("/")}>
                חזרה לדף הבית
              </Button>
              <Button disabled={!canSubmit || isBooking} onClick={handleBookMeeting}>
                {isBooking ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    קובע...
                  </span>
                ) : (
                  "אשר הזמנה"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProposedMeetingPage
