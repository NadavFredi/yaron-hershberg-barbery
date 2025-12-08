import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, Clock, CheckCircle, Scissors, Loader2 } from "lucide-react"
import { reserveAppointment } from "@/integrations/supabase/supabaseService"
import { useGetAvailableDatesQuery, useGetAvailableTimesQuery } from "@/store/services/supabaseApi"
import { skipToken } from "@reduxjs/toolkit/query"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/integrations/supabase/client"
import { useSupabaseAuthWithClientId } from "@/hooks/useSupabaseAuthWithClientId"
import confetti from "canvas-confetti"

type ServiceOption = { id: string; name: string; description?: string | null }
type AvailableDate = { date: string; available: boolean; stationId: string | null; availableTimes?: AvailableTime[] }
type AvailableTime = { time: string; stationId: string; duration?: number; available?: boolean }

const BUSINESS_TIME_ZONE = "Asia/Jerusalem"
const jerusalemDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const toJerusalemDateString = (date: Date) => jerusalemDateFormatter.format(date)

const SetupAppointment: React.FC = () => {
  const navigate = useNavigate()
  const { session } = useSupabaseAuthWithClientId()

  const [services, setServices] = useState<ServiceOption[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<AvailableTime | undefined>(undefined)
  const [notes, setNotes] = useState("")
  const [isBooking, setIsBooking] = useState(false)

  useEffect(() => {
    const loadServices = async () => {
      const { data, error } = await supabase.from("services").select("id, name, description").order("display_order")
      if (error) {
        console.error("Failed to load services", error)
        return
      }
      setServices(data ?? [])
      if (!selectedServiceId && data && data.length > 0) {
        setSelectedServiceId(data[0].id)
      }
    }
    loadServices()
  }, [selectedServiceId])

  const datesQueryArg = selectedServiceId ? { serviceId: selectedServiceId } : skipToken
  const { data: availableDatesData, isFetching: isFetchingDates } = useGetAvailableDatesQuery(datesQueryArg, {
    skip: !selectedServiceId,
  })

  const availableDates = useMemo<AvailableDate[]>(() => {
    if (!availableDatesData) return []
    if (Array.isArray(availableDatesData)) return availableDatesData as AvailableDate[]
    return (availableDatesData as { availableDates?: AvailableDate[] }).availableDates ?? []
  }, [availableDatesData])

  const selectedDateKey = selectedDate ? toJerusalemDateString(selectedDate) : undefined

  const timesQueryArg =
    selectedServiceId && selectedDateKey
      ? {
          serviceId: selectedServiceId,
          date: selectedDateKey,
        }
      : skipToken

  const { data: availableTimesData, isFetching: isFetchingTimes } = useGetAvailableTimesQuery(timesQueryArg, {
    skip: !selectedServiceId || !selectedDateKey,
  })

  const availableTimes = useMemo<AvailableTime[]>(() => {
    if (!availableTimesData) return []
    if (Array.isArray(availableTimesData)) return availableTimesData as AvailableTime[]
    return (availableTimesData as { availableTimes?: AvailableTime[] }).availableTimes ?? []
  }, [availableTimesData])

  useEffect(() => {
    if (!availableTimes.length) {
      setSelectedTime(undefined)
      return
    }
    // Auto-select first available time when date changes
    setSelectedTime(availableTimes[0])
  }, [availableTimes])

  const handleBook = async () => {
    if (!selectedServiceId || !selectedDateKey || !selectedTime || !selectedTime.stationId) {
      return
    }
    setIsBooking(true)
    try {
      const result = await reserveAppointment(
        selectedServiceId,
        selectedDateKey,
        selectedTime.stationId,
        selectedTime.time,
        notes.trim() || undefined,
      )

      if (result.success) {
        confetti({ particleCount: 160, spread: 70, origin: { y: 0.7 } })
        navigate("/appointments")
      } else {
        throw new Error(result.error || "Failed to book appointment")
      }
    } catch (error) {
      console.error("Failed to reserve appointment", error)
      alert(error instanceof Error ? error.message : "Failed to reserve appointment")
    } finally {
      setIsBooking(false)
    }
  }

  const isAuthenticated = Boolean(session?.user)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg">
          <Scissors className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">קבעו תור לטיפול</h1>
        <p className="mt-2 text-gray-600">בחרו שירות, תאריך ושעה שנוחים לכם</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              שלבים מהירים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 h-6 w-6 rounded-full bg-indigo-100 text-center text-indigo-700">1</span>
              <div>
                <p className="font-semibold text-gray-900">בחרו שירות</p>
                <p className="text-gray-600">תספורת, טיפוח זקן או טיפול פרימיום.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 h-6 w-6 rounded-full bg-indigo-100 text-center text-indigo-700">2</span>
              <div>
                <p className="font-semibold text-gray-900">בחרו תאריך</p>
                <p className="text-gray-600">נפתח לפי הלו״ז שלנו ותחנות זמינות.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 h-6 w-6 rounded-full bg-indigo-100 text-center text-indigo-700">3</span>
              <div>
                <p className="font-semibold text-gray-900">בחרו שעה ואשרו</p>
                <p className="text-gray-600">נסיים לאשר ונעדכן ב-SMS.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scissors className="h-5 w-5 text-indigo-600" />
                שירות
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="בחרו שירות" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedServiceId && (
                <p className="text-sm text-gray-600">
                  {services.find((s) => s.id === selectedServiceId)?.description || "שירות מספרה מקצועי בהתאמה אישית."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarIcon className="h-5 w-5 text-indigo-600" />
                תאריך
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => setSelectedDate(date || undefined)}
                disabled={(date) => {
                  const key = toJerusalemDateString(date)
                  const available = availableDates.find((d) => d.date === key)
                  return !available
                }}
                className="rounded-md border"
              />
              {isFetchingDates && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" /> טוען זמינות...
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-indigo-600" />
                שעה
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedDateKey ? (
                isFetchingTimes ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" /> טוען שעות...
                  </div>
                ) : availableTimes.length ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {availableTimes.map((slot) => (
                      <Button
                        key={`${slot.stationId}-${slot.time}`}
                        variant={selectedTime?.time === slot.time && selectedTime?.stationId === slot.stationId ? "default" : "outline"}
                        onClick={() => setSelectedTime(slot)}
                      >
                        {slot.time} {slot.duration ? `(${slot.duration} דק')` : ""}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">אין שעות פנויות בתאריך זה.</p>
                )
              ) : (
                <p className="text-sm text-gray-600">בחרו תאריך כדי לראות שעות פנויות.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarIcon className="h-5 w-5 text-indigo-600" />
                הערות
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="הערות שחשוב לדעת לפני הטיפול (אופציונלי)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleBook}
                  disabled={!isAuthenticated || !selectedServiceId || !selectedDateKey || !selectedTime || isBooking}
                  className="min-w-[160px]"
                >
                  {isBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  אשר תור
                </Button>
              </div>
              {!isAuthenticated && (
                <p className="text-sm text-red-600">נדרש להיכנס לחשבון לפני קביעת תור.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default SetupAppointment
