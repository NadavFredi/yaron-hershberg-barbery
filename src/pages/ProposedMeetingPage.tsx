import { useEffect, useMemo, useState } from "react"
import { useParams, useLocation, Link, useNavigate } from "react-router-dom"
import { skipToken } from "@reduxjs/toolkit/query"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, CalendarIcon, Clock, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSupabaseAuthWithClientId } from "@/hooks/useSupabaseAuthWithClientId"
import {
  useGetProposedMeetingPublicQuery,
  useBookProposedMeetingMutation,
  useGetClientProfileQuery,
  useListOwnerDogsQuery,
} from "@/store/services/supabaseApi"
import { useToast } from "@/components/ui/use-toast"
import { Label } from "@/components/ui/label"

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
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const authState = useSupabaseAuthWithClientId()
  const { user, clientId, isLoading: authLoading } = authState
  const ownerId = user?.id

  const {
    data: meeting,
    isLoading: meetingLoading,
    error: meetingError,
  } = useGetProposedMeetingPublicQuery(meetingId ?? "", { skip: !meetingId })

  const { data: profile } = useGetClientProfileQuery(clientId ?? skipToken, {
    skip: !clientId,
  })

  const { data: dogsData, isLoading: dogsLoading } = useListOwnerDogsQuery(ownerId ?? skipToken)

  const [selectedDogId, setSelectedDogId] = useState<string>("")
  const [codeInput, setCodeInput] = useState("")
  const [bookingCompleted, setBookingCompleted] = useState(false)
  const [bookMeeting, { isLoading: isBooking }] = useBookProposedMeetingMutation()

  const visibleDogs = dogsData?.dogs ?? []
  const isReschedule = Boolean(meeting?.rescheduleAppointmentId)
  const requiredDogId = meeting?.rescheduleDogId ?? null
  const dogsForSelection = useMemo(() => {
    if (!requiredDogId) {
      return visibleDogs
    }
    return visibleDogs.filter((dog) => dog.id === requiredDogId)
  }, [requiredDogId, visibleDogs])
  const missingRequiredDog = Boolean(requiredDogId) && dogsForSelection.length === 0

  useEffect(() => {
    if (requiredDogId) {
      setSelectedDogId(requiredDogId)
    }
  }, [requiredDogId])

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
  const dogAllowed = requiredDogId ? selectedDogId === requiredDogId : Boolean(selectedDogId)
  const canSubmit = Boolean(
    meeting &&
    !bookingCompleted &&
    dogAllowed &&
    !missingRequiredDog &&
    (hasAutomaticAccess || hasCodeAccess)
  )

  const meetingUnavailable =
    Boolean(meetingError) ||
    (meeting && meeting.status && meeting.status !== "proposed") ||
    !meetingId

  const handleBookMeeting = async () => {
    if (!meetingId || !selectedDogId) {
      return
    }
    try {
      await bookMeeting({
        meetingId,
        dogId: selectedDogId,
        code: enteredCode || undefined,
      }).unwrap()
      setBookingCompleted(true)
      toast({
        title: "התור נשמר עבורך",
        description: "נשלחה אליך הודעת אישור על ההזמנה.",
      })
      navigate("/my-appointments", { replace: true })
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

  if (!meetingId) {
    return (
      <div className="container max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>המפגש לא נמצא</CardTitle>
            <CardDescription>בדקו שהקישור שהזנתם תקין.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (meetingLoading) {
    return (
      <div className="container max-w-3xl px-4 py-10 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-lime-600" />
      </div>
    )
  }

  if (meetingUnavailable || !meeting) {
    return (
      <div className="container max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>המפגש כבר נתפס</CardTitle>
            <CardDescription>בחייכם, בפעם הבאה תהיו זריזים יותר 🙂</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!user && !authLoading) {
    return (
      <div className="container max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>התחברו כדי להצטרף למפגש</CardTitle>
            <CardDescription>הכניסה למפגש שמורה ללקוחות שנרשמו למערכת.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              התחברו או הירשמו, ואז חזרו לקישור הזה, ונבדוק אם המפגש מחכה לכם.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-lime-600 hover:bg-lime-700 text-white">
                <Link to={`/login?redirect=${encodeURIComponent(location.pathname)}`}>התחברות</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to={`/signup?redirect=${encodeURIComponent(location.pathname)}`}>הרשמה</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (authLoading || !clientId) {
    return (
      <div className="container max-w-3xl px-4 py-10 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-lime-600" />
      </div>
    )
  }

  const needsCode = !hasAutomaticAccess
  const timeRangeLabel = formatTimeRange(meeting.startAt, meeting.endAt)
  const originalRangeLabel = meeting.rescheduleOriginalStartAt && meeting.rescheduleOriginalEndAt
    ? formatTimeRange(meeting.rescheduleOriginalStartAt, meeting.rescheduleOriginalEndAt)
    : null

  return (
    <div className="container max-w-3xl px-4 py-10 space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">{meeting.title || "מפגש מוצע"}</CardTitle>
          <CardDescription>שריינו את החלון לפני שמישהו אחר עושה זאת.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-lime-600" />
              {formatDate(meeting.startAt)}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-lime-600" />
              {timeRangeLabel}
            </div>
          </div>
          {meeting.summary && (
            <div className="rounded-md border border-lime-100 bg-lime-50 p-3 text-sm text-gray-800">{meeting.summary}</div>
          )}
          <div className="flex flex-wrap gap-2">
            {meeting.categories.map((category) => (
              <Badge key={category.id} variant="secondary" className="bg-lime-100 text-lime-800">
                {category.customerTypeName || "קטגוריה"} · לקוחות ייעודיים
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {isReschedule && (
        <Alert className="border-blue-200 bg-blue-50" dir="rtl">
          <AlertTitle>הצעה לשינוי תור קיים</AlertTitle>
          <AlertDescription>
            {originalRangeLabel
              ? `התור הקיים שלכם נקבע ל-${originalRangeLabel}. אם תאשרו, נעביר את התור לשעה החדשה שמוצעת כאן ונמחק את ההצעה.`
              : "ברגע שתאשרו, נעביר את התור הקיים שלכם לשעה החדשה ונמחק את ההצעה."}
          </AlertDescription>
        </Alert>
      )}

      {!hasAutomaticAccess && (
        <Alert>
          <AlertTitle>נדרשת הזנה של קוד</AlertTitle>
          <AlertDescription>אם קיבלתם את הקוד מהמנהל – הזינו אותו כאן, אחרת בקשו הזמנה מחדש.</AlertDescription>
        </Alert>
      )}

      {bookingCompleted && (
        <Alert className="border-lime-300 bg-lime-50">
          <AlertTitle>המפגש שייך לכם!</AlertTitle>
          <AlertDescription>הוספנו את התור ליומן שלכם ופסלנו את ההזמנה לכל השאר.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">אנחנו חייבים לדעת מי מגיע</CardTitle>
          <CardDescription>
            {isReschedule
              ? "התור החדש יישמר עבור אותו כלב מהתור המקורי. אם הכלב אינו מופיע, צרו קשר עם הצוות."
              : "בחרו כלב/ה, ואם צריך – הזינו קוד מילה אישית."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-800">בחרו כלב</div>
            {dogsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                טוען כלבים...
              </div>
            ) : missingRequiredDog ? (
              <Alert className="border-red-200 bg-red-50">
                <AlertTitle>לא הצלחנו למצוא את הכלב המתאים</AlertTitle>
                <AlertDescription>
                  התור הזה מיועד לכלב ספציפי שלא מופיע אצלכם. צרו קשר עם הצוות כדי לעדכן את פרטי החשבון.
                </AlertDescription>
              </Alert>
            ) : dogsForSelection.length === 0 ? (
              <Alert>
                <AlertTitle>לא מצאנו כלבים בחשבון</AlertTitle>
                <AlertDescription>
                  הוסיפו כלב דרך <Link to="/my-dogs" className="text-lime-700 underline">איזור הכלבים</Link> ואז חזרו לכאן.
                </AlertDescription>
              </Alert>
            ) : (
              <RadioGroup value={selectedDogId} onValueChange={setSelectedDogId} className="space-y-2">
                {dogsForSelection.map((dog) => (
                  <label
                    key={dog.id}
                    htmlFor={`dog-${dog.id}`}
                    className={cn(
                      "flex items-center justify-end gap-2 rounded-lg border px-3 py-2 text-right text-sm transition",
                      selectedDogId === dog.id ? "border-lime-400 bg-lime-50" : "border-slate-200"
                    )}
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{dog.name}</div>
                      {dog.breeds?.name && <div className="text-xs text-gray-500">{dog.breeds.name}</div>}
                    </div>
                    <RadioGroupItem id={`dog-${dog.id}`} value={dog.id} />
                  </label>
                ))}
              </RadioGroup>
            )}
          </div>

          {needsCode && (
            <div className="space-y-2">
              <Label>הזינו קוד שקיבלתם</Label>
              <Input
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                maxLength={6}
                placeholder="לדוגמה: 123456"
                className="text-center tracking-[0.3em] font-semibold text-lg"
              />
            </div>
          )}

          <div className="text-sm text-gray-600 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-lime-600" />
            השמירה מאשרת את המפגש ומוחקת את ההצעה עבור כולם.
          </div>

          <Button
            className="w-full bg-lime-600 hover:bg-lime-700 text-white"
            disabled={!canSubmit}
            onClick={handleBookMeeting}
          >
            {isBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : "אשרו את המפגש"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default ProposedMeetingPage
