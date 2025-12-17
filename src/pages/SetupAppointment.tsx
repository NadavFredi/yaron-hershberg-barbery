import React, { useEffect, useMemo, useState, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, Clock, CheckCircle, Scissors, Loader2, ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { reserveAppointment } from "@/integrations/supabase/supabaseService"
import { useGetAvailableDatesQuery, useGetAvailableTimesQuery } from "@/store/services/supabaseApi"
import { skipToken } from "@reduxjs/toolkit/query"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/integrations/supabase/client"
import { useSupabaseAuthWithClientId } from "@/hooks/useSupabaseAuthWithClientId"
import confetti from "canvas-confetti"
import { AddWaitlistEntryModal } from "@/components/dialogs/AddWaitlistEntryModal"
import { Bell, CreditCard } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { CreditCardSetupModal } from "@/components/dialogs/billing/CreditCardSetupModal"

type ServiceOption = { id: string; name: string; description?: string | null }
type AvailableDate = { date: string; available: boolean; stationId: string | null; availableTimes?: AvailableTime[] }
type AvailableTime = { time: string; stationId: string; stationName?: string; duration?: number; available?: boolean }

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
  const { user, clientId } = useSupabaseAuthWithClientId()
  const { toast } = useToast()

  const [services, setServices] = useState<ServiceOption[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<AvailableTime | undefined>(undefined)
  const [notes, setNotes] = useState("")
  const [isBooking, setIsBooking] = useState(false)
  const [serviceSearchQuery, setServiceSearchQuery] = useState("")
  const [isServicePopoverOpen, setIsServicePopoverOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const listContainerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false)
  const [customer, setCustomer] = useState<{ id: string; full_name: string; phone: string; email: string | null } | null>(null)
  const [creditToken, setCreditToken] = useState<{ id: string } | null>(null)
  const [isLoadingCreditToken, setIsLoadingCreditToken] = useState(false)
  const [isCreditCardModalOpen, setIsCreditCardModalOpen] = useState(false)

  const filteredServices = useMemo(() => {
    return serviceSearchQuery.trim()
      ? services.filter((service) =>
        service.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())
      )
      : services.slice(0, 5) // Show first 5 when no search query
  }, [services, serviceSearchQuery])

  // Reset highlighted index when search changes or popover opens
  useEffect(() => {
    if (isServicePopoverOpen) {
      setHighlightedIndex(-1)
      itemRefs.current = []
    }
  }, [serviceSearchQuery, isServicePopoverOpen])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      })
    }
  }, [highlightedIndex])

  const handleServiceSelect = useCallback(
    (serviceId: string) => {
      setSelectedServiceId(serviceId)
      setServiceSearchQuery("")
      setIsServicePopoverOpen(false)
      setHighlightedIndex(-1)
    },
    []
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isServicePopoverOpen || filteredServices.length === 0) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setHighlightedIndex((prev) =>
            prev < filteredServices.length - 1 ? prev + 1 : 0
          )
          break
        case "ArrowUp":
          e.preventDefault()
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredServices.length - 1
          )
          break
        case "Enter":
          e.preventDefault()
          if (highlightedIndex >= 0 && highlightedIndex < filteredServices.length) {
            handleServiceSelect(filteredServices[highlightedIndex].id)
          } else if (filteredServices.length > 0) {
            // If nothing is highlighted, select the first item
            handleServiceSelect(filteredServices[0].id)
          }
          break
        case "Escape":
          e.preventDefault()
          setIsServicePopoverOpen(false)
          setHighlightedIndex(-1)
          break
      }
    },
    [isServicePopoverOpen, filteredServices, highlightedIndex, handleServiceSelect]
  )

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

  useEffect(() => {
    const loadCustomer = async () => {
      if (!user?.id) {
        setCustomer(null)
        return
      }
      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, phone, email")
        .eq("auth_user_id", user.id)
        .maybeSingle()
      if (error) {
        console.error("Failed to load customer", error)
        return
      }
      if (data) {
        setCustomer(data)
      }
    }
    loadCustomer()
  }, [user])

  // Fetch credit token to check if card is configured
  useEffect(() => {
    const fetchCreditToken = async () => {
      if (!clientId) {
        setCreditToken(null)
        return
      }

      try {
        setIsLoadingCreditToken(true)
        const { data, error } = await supabase
          .from("credit_tokens")
          .select("id")
          .eq("customer_id", clientId)
          .maybeSingle()

        if (error) {
          console.error("Error fetching credit token:", error)
          setCreditToken(null)
          return
        }

        setCreditToken(data)
      } catch (error) {
        console.error("Error fetching credit token:", error)
        setCreditToken(null)
      } finally {
        setIsLoadingCreditToken(false)
      }
    }

    fetchCreditToken()
  }, [clientId])

  // Listen for credit card saved event to refresh
  useEffect(() => {
    const handleCreditCardSaved = () => {
      console.log("🔄 [SetupAppointment] Credit card saved event received, refreshing...")
      if (clientId) {
        const fetchCreditToken = async () => {
          try {
            const { data, error } = await supabase
              .from("credit_tokens")
              .select("id")
              .eq("customer_id", clientId)
              .maybeSingle()

            if (error) {
              console.error("Error fetching credit token:", error)
              return
            }

            setCreditToken(data)
          } catch (error) {
            console.error("Error fetching credit token:", error)
          }
        }
        fetchCreditToken()
      }
    }

    window.addEventListener("creditCardSaved", handleCreditCardSaved)
    return () => {
      window.removeEventListener("creditCardSaved", handleCreditCardSaved)
    }
  }, [clientId])

  const handleCreditCardSetupSuccess = useCallback(() => {
    // Refetch credit token after successful setup
    if (!clientId) return

    const fetchCreditToken = async () => {
      try {
        const { data, error } = await supabase
          .from("credit_tokens")
          .select("id")
          .eq("customer_id", clientId)
          .maybeSingle()

        if (error) {
          console.error("Error fetching credit token:", error)
          return
        }

        setCreditToken(data)
        if (data) {
          toast({
            title: "כרטיס אשראי נשמר בהצלחה",
            description: "פרטי כרטיס האשראי שלך נשמרו בהצלחה",
          })
        }
      } catch (error) {
        console.error("Error fetching credit token:", error)
      }
    }

    fetchCreditToken()
  }, [clientId, toast])

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
    // Handle response structure: { success: true, availableTimes: [...] }
    const response = availableTimesData as { availableTimes?: AvailableTime[] }
    return response.availableTimes ?? []
  }, [availableTimesData])

  useEffect(() => {
    if (!availableTimes.length) {
      setSelectedTime(undefined)
      return
    }
    setSelectedTime(availableTimes[0])
  }, [availableTimes])

  const handleBook = async () => {
    if (!selectedServiceId || !selectedDateKey || !selectedTime || !selectedTime.stationId) {
      return
    }

    // Check if credit card is required and not set
    if (isAuthenticated && clientId && !creditToken && !isLoadingCreditToken) {
      toast({
        title: "נדרש כרטיס אשראי",
        description: "יש להגדיר כרטיס אשראי לפני קביעת תור",
        variant: "destructive",
      })
      setIsCreditCardModalOpen(true)
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

  const isAuthenticated = Boolean(user)

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
              <Popover
                open={isServicePopoverOpen}
                onOpenChange={(open) => {
                  setIsServicePopoverOpen(open)
                  if (!open) {
                    setServiceSearchQuery("")
                    setHighlightedIndex(-1)
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                      !selectedServiceId && "text-muted-foreground"
                    )}
                  >
                    <span className="truncate">
                      {selectedServiceId
                        ? services.find((s) => s.id === selectedServiceId)?.name || "בחרו שירות"
                        : "בחרו שירות"}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="flex items-center border-b px-3">
                    <Input
                      placeholder="חפש שירות..."
                      value={serviceSearchQuery}
                      onChange={(e) => setServiceSearchQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="h-9 border-0 focus-visible:ring-0"
                      autoFocus
                    />
                  </div>
                  <div ref={listContainerRef} className="max-h-[300px] overflow-y-auto">
                    {filteredServices.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        לא נמצאו שירותים
                      </div>
                    ) : (
                      <div className="p-1">
                        {filteredServices.map((service, index) => (
                          <button
                            key={service.id}
                            ref={(el) => {
                              itemRefs.current[index] = el
                            }}
                            type="button"
                            className={cn(
                              "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                              selectedServiceId === service.id && "bg-accent text-accent-foreground",
                              highlightedIndex === index && "bg-accent text-accent-foreground"
                            )}
                            onClick={() => handleServiceSelect(service.id)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                          >
                            {service.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
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
              {selectedServiceId && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAuthenticated) {
                        toast({
                          title: "נדרש להתחבר",
                          description: "יש להתחבר לחשבון כדי להירשם לרשימת ההמתנה",
                          variant: "destructive",
                        })
                        return
                      }
                      setIsWaitlistModalOpen(true)
                    }}
                    className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
                  >
                    <Bell className="h-4 w-4" />
                    לא מצאתם את התאריך שאתם מחפשים? הירשמו לרשימת ההמתנה
                  </button>
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
                  <Select
                    value={selectedTime ? `${selectedTime.stationId}-${selectedTime.time}` : undefined}
                    onValueChange={(value) => {
                      const [stationId, time] = value.split("-", 2)
                      const slot = availableTimes.find(
                        (s) => s.stationId === stationId && s.time === time
                      )
                      if (slot) setSelectedTime(slot)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="בחרו שעה ותחנה" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTimes.map((slot) => (
                        <SelectItem key={`${slot.stationId}-${slot.time}`} value={`${slot.stationId}-${slot.time}`}>
                          {slot.time}
                          {slot.stationName ? ` - ${slot.stationName}` : ""}
                          {slot.duration ? ` (${slot.duration} דק')` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              
              {/* Credit Card Warning - Show only when card is not defined and user is authenticated */}
              {isAuthenticated && clientId && !isLoadingCreditToken && !creditToken && (
                <div className="rounded-lg border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50 p-4 space-y-3 shadow-sm" dir="rtl">
                  <div className="flex items-start gap-3">
                    <CreditCard className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-2 text-right">
                      <h4 className="text-sm font-semibold text-yellow-900">
                        רגע לפני שנקבע את התור...
                      </h4>
                      <p className="text-xs text-yellow-800 leading-relaxed">
                        בואו נגדיר את כרטיס האשראי שלך כדי שנוכל לקחת את התשלום עבור השירותים. זה ייקח רק רגע קטן!
                      </p>
                      <Button
                        onClick={() => setIsCreditCardModalOpen(true)}
                        className="mt-2 bg-yellow-600 hover:bg-yellow-700 text-white shadow-md hover:shadow-lg transition-all"
                        size="sm"
                      >
                        <CreditCard className="h-4 w-4 ml-2" />
                        הגדר כרטיס אשראי עכשיו
                      </Button>
                    </div>
                  </div>
                </div>
              )}

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
              {!isAuthenticated && <p className="text-sm text-red-600">נדרש להיכנס לחשבון לפני קביעת תור.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddWaitlistEntryModal
        open={isWaitlistModalOpen}
        onOpenChange={setIsWaitlistModalOpen}
        defaultCustomer={customer ? { id: customer.id, full_name: customer.full_name, phone: customer.phone, email: customer.email } : null}
        disableCustomerSelection={!!customer}
        title="הירשמו לרשימת ההמתנה"
        description="בחרו תאריכים מועדפים ואנו נודיע לכם כשיתפנה מקום"
        submitLabel="הירשם לרשימת המתנה"
        serviceScopeOptions={[{ value: "grooming" as const, label: "מספרה" }]}
        initialServiceScope="grooming"
        onSuccess={() => {
          toast({
            title: "הצלחה",
            description: "נרשמת לרשימת ההמתנה בהצלחה",
          })
          setIsWaitlistModalOpen(false)
        }}
      />

      {clientId && (
        <CreditCardSetupModal
          open={isCreditCardModalOpen}
          onOpenChange={setIsCreditCardModalOpen}
          customerId={clientId}
          onSuccess={handleCreditCardSetupSuccess}
        />
      )}
    </div>
  )
}

export default SetupAppointment
