import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, UserPlus, Users, Search, X, Sparkles, Copy, LinkIcon, Dog } from "lucide-react"

import { AppointmentDetailsSection, type AppointmentTimes, type AppointmentStation } from "@/pages/ManagerSchedule/components/AppointmentDetailsSection"
import { useSearchCustomersQuery, useSendManualProposedMeetingWebhookMutation, useListOwnerDogsQuery } from "@/store/services/supabaseApi"
import { useDebounce } from "@/hooks/useDebounce"
import type { Customer } from "@/components/CustomerSearchInput"
import type { DogRecord } from "@/integrations/supabase/supabaseService"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { CustomerTypeMultiSelect, type CustomerTypeOption } from "@/components/customer-types/CustomerTypeMultiSelect"
import { useCreateCustomerType } from "@/hooks/useCreateCustomerType"
import { DogCategoryMultiSelect, type DogCategoryOption } from "@/components/dog-categories/DogCategoryMultiSelect"
import { useCreateDogCategory } from "@/hooks/useCreateDogCategory"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { skipToken } from "@reduxjs/toolkit/query"

type ManagerStation = AppointmentStation & { serviceType: "grooming" | "garden" }

// Component to select a dog for a specific customer
function CustomerDogSelector({
  customer,
  selectedDogId,
  onDogSelect,
  onRemove,
}: {
  customer: Customer
  selectedDogId: string
  onDogSelect: (dogId: string | null) => void
  onRemove: () => void
}) {
  const { data: dogsData, isLoading: isLoadingDogs } = useListOwnerDogsQuery(
    customer.id || skipToken,
    { skip: !customer.id }
  )

  const dogs = useMemo<DogRecord[]>(() => dogsData?.dogs ?? [], [dogsData])

  return (
    <div className="rounded-md border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-2">
            <span>{customer.fullName || "לקוח ללא שם"}</span>
            <button
              type="button"
              onClick={onRemove}
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      </div>
      {isLoadingDogs ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען כלבים...
        </div>
      ) : dogs.length > 0 ? (
        <div className="space-y-1">
          <Label className="text-xs text-slate-600 text-right block">בחר כלב (אופציונלי)</Label>
          <Select
            value={selectedDogId || "__all__"}
            onValueChange={(value) => onDogSelect(value === "__all__" ? null : value)}
            dir="rtl"
          >
            <SelectTrigger className="w-full text-right">
              <SelectValue placeholder="כל הכלבים" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">כל הכלבים</SelectItem>
              {dogs.map((dog) => (
                <SelectItem key={dog.id} value={dog.id}>
                  {dog.name || "כלב ללא שם"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="text-xs text-slate-500 text-right">
          ללקוח זה אין כלבים רשומים
        </div>
      )}
    </div>
  )
}

export interface ProposedMeetingModalSubmission {
  title: string
  summary: string
  notes: string
  stationId: string
  startTime: string
  endTime: string
  serviceType: "grooming" | "garden"
  customerIds: string[]
  customerTypeIds: string[]
  dogCategoryIds: string[]
  dogIds?: Array<{ customerId: string; dogId: string }>
  meetingId?: string
}

export interface ProposedMeetingInitialData {
  meetingId: string
  title?: string
  summary?: string
  notes?: string
  stationId: string
  serviceType: "grooming" | "garden"
  startDateTime: string
  endDateTime: string
  manualInvites?: Array<{ id: string; fullName?: string | null; phone?: string | null; email?: string | null; dogId?: string | null }>
  customerTypeIds?: string[]
  dogCategoryIds?: string[]
  code?: string
}

interface ProposedMeetingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  stations: ManagerStation[]
  defaultTimes: AppointmentTimes | null
  initialData?: ProposedMeetingInitialData | null
  loading?: boolean
  onSubmit: (payload: ProposedMeetingModalSubmission) => Promise<void> | void
}


export const ProposedMeetingModal = ({
  open,
  onOpenChange,
  mode,
  stations,
  defaultTimes,
  initialData,
  loading = false,
  onSubmit,
}: ProposedMeetingModalProps) => {
  const [meetingTimes, setMeetingTimes] = useState<AppointmentTimes | null>(defaultTimes)
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [notes, setNotes] = useState("")
  const [selectedStationId, setSelectedStationId] = useState<string | null>(defaultTimes?.stationId ?? null)
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([])
  const [selectedCustomerTypeIds, setSelectedCustomerTypeIds] = useState<string[]>([])
  const [customerTypeOptions, setCustomerTypeOptions] = useState<CustomerTypeOption[]>([])
  const [isLoadingCustomerTypes, setIsLoadingCustomerTypes] = useState(false)
  const [selectedDogCategoryIds, setSelectedDogCategoryIds] = useState<string[]>([])
  const [dogCategoryOptions, setDogCategoryOptions] = useState<DogCategoryOption[]>([])
  const [isLoadingDogCategories, setIsLoadingDogCategories] = useState(false)
  const [selectedDogIds, setSelectedDogIds] = useState<Map<string, string>>(new Map()) // customerId -> dogId

  const { createCustomerType } = useCreateCustomerType({
    onSuccess: (id, name) => {
      // Add to local state immediately
      const newCustomerType: CustomerTypeOption = {
        id,
        name,
      }
      setCustomerTypeOptions((prev) => [...prev, newCustomerType])
    },
  })
  const { createDogCategory } = useCreateDogCategory({
    onSuccess: (id, name) => {
      // Add to local state immediately
      const newDogCategory: DogCategoryOption = {
        id,
        name,
      }
      setDogCategoryOptions((prev) => [...prev, newDogCategory])
    },
  })
  const [customerSearchTerm, setCustomerSearchTerm] = useState("")
  const [customerHighlightIndex, setCustomerHighlightIndex] = useState(-1)
  const [isCustomerInputFocused, setIsCustomerInputFocused] = useState(false)
  const customerSuggestionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [manualContact, setManualContact] = useState({ name: "", phone: "", email: "" })
  const [manualSending, setManualSending] = useState(false)
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false)
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false)

  const { toast } = useToast()
  const [sendManualWebhook] = useSendManualProposedMeetingWebhookMutation()

  const debouncedSearchTerm = useDebounce(customerSearchTerm.trim(), 300)
  // Show results when focused (even with empty search) or when search term is 2+ chars
  const shouldSearchCustomers = isCustomerInputFocused && (debouncedSearchTerm.length === 0 || debouncedSearchTerm.length >= 2)
  const { data: customerSearchData, isFetching: isSearchingCustomers } = useSearchCustomersQuery(
    { searchTerm: debouncedSearchTerm },
    { skip: !shouldSearchCustomers }
  )
  const customerResults = useMemo(() => customerSearchData?.customers ?? [], [customerSearchData?.customers])
  const visibleCustomerResults = useMemo(
    () => (shouldSearchCustomers ? customerResults.slice(0, 20) : []),
    [customerResults, shouldSearchCustomers]
  )

  const meetingLink = useMemo(() => {
    if (!initialData?.meetingId) {
      return null
    }
    const origin =
      typeof globalThis !== "undefined" &&
        typeof globalThis.location === "object" &&
        typeof globalThis.location?.origin === "string"
        ? globalThis.location.origin
        : null
    if (!origin) {
      return null
    }
    return `${origin}/proposed/${initialData.meetingId}`
  }, [initialData?.meetingId])

  const handleCopyLink = async () => {
    if (!meetingLink) {
      return
    }
    try {
      await navigator.clipboard.writeText(meetingLink)
      setCopyLinkSuccess(true)
      setTimeout(() => setCopyLinkSuccess(false), 2500)
    } catch (error) {
      console.error("❌ [ProposedMeetingModal] Failed to copy meeting link:", error)
      toast({
        title: "לא ניתן להעתיק קישור",
        description: "נסו שוב או העתיקו ידנית.",
        variant: "destructive",
      })
    }
  }

  const handleCopyCode = async () => {
    if (!initialData?.code) {
      return
    }
    try {
      await navigator.clipboard.writeText(initialData.code)
      setCopyCodeSuccess(true)
      setTimeout(() => setCopyCodeSuccess(false), 2500)
    } catch (error) {
      console.error("❌ [ProposedMeetingModal] Failed to copy meeting code:", error)
      toast({
        title: "לא ניתן להעתיק קוד",
        description: "בדקו את ההרשאות לדפדפן ונסו שוב.",
        variant: "destructive",
      })
    }
  }

  const handleSendManualInvitation = async () => {
    if (!initialData?.meetingId || !initialData?.code || !meetingLink) {
      toast({
        title: "לא ניתן לשלוח הזמנה",
        description: "שמירת המפגש נדרשת לפני שליחת הזמנה ידנית.",
        variant: "destructive",
      })
      return
    }

    const trimmedName = manualContact.name.trim()
    const trimmedPhone = manualContact.phone.trim()
    const trimmedEmail = manualContact.email.trim()

    if (!trimmedPhone && !trimmedEmail) {
      toast({
        title: "חסר פרטי קשר",
        description: "הזינו לפחות מספר טלפון או אימייל.",
        variant: "destructive",
      })
      return
    }

    console.log("📨 [ProposedMeetingModal] Sending manual invite", {
      meetingId: initialData.meetingId,
      hasPhone: Boolean(trimmedPhone),
      hasEmail: Boolean(trimmedEmail),
    })

    setManualSending(true)
    try {
      await sendManualWebhook({
        proposedMeetingId: initialData.meetingId,
        code: initialData.code,
        meetingLink,
        contact: {
          name: trimmedName || undefined,
          phone: trimmedPhone || undefined,
          email: trimmedEmail || undefined,
        },
      }).unwrap()

      toast({
        title: "ההודעה נשלחה",
        description: "שלחנו את הקישור והקוד לנמען שבחרתם.",
      })
      setManualContact({ name: "", phone: "", email: "" })
    } catch (error) {
      const message = error instanceof Error ? error.message : "שליחת ההודעה נכשלה"
      toast({
        title: "שליחה נכשלה",
        description: message,
        variant: "destructive",
      })
    } finally {
      setManualSending(false)
    }
  }

  const activeStation = useMemo(() => {
    if (!selectedStationId) {
      return undefined
    }
    return stations.find((station) => station.id === selectedStationId)
  }, [stations, selectedStationId])

  const resolvedServiceType: "grooming" | "garden" = activeStation?.serviceType ?? initialData?.serviceType ?? "grooming"

  // Initialize form fields when modal opens
  useEffect(() => {
    if (!open) {
      return
    }

    const editingTimes =
      initialData && initialData.startDateTime && initialData.endDateTime
        ? {
          startTime: new Date(initialData.startDateTime),
          endTime: new Date(initialData.endDateTime),
          stationId: initialData.stationId,
        }
        : null

    setMeetingTimes(editingTimes ?? defaultTimes)
    setSelectedStationId(initialData?.stationId ?? defaultTimes?.stationId ?? null)
    setTitle(initialData?.title ?? "")
    setSummary(initialData?.summary ?? "")
    setNotes(initialData?.notes ?? "")

    if (initialData?.manualInvites?.length) {
      const uniqueCustomers = new Map<string, Customer>()
      const dogIdsMap = new Map<string, string>()
      initialData.manualInvites.forEach((invite) => {
        if (invite.id) {
          uniqueCustomers.set(invite.id, {
            id: invite.id,
            fullName: invite.fullName ?? "לקוח לא מזוהה",
            phone: invite.phone ?? undefined,
            email: invite.email ?? undefined,
          })
          if (invite.dogId) {
            dogIdsMap.set(invite.id, invite.dogId)
          }
        }
      })
      setSelectedCustomers(Array.from(uniqueCustomers.values()))
      setSelectedDogIds(dogIdsMap)
    } else {
      setSelectedCustomers([])
      setSelectedDogIds(new Map())
    }

    setSelectedCustomerTypeIds(initialData?.customerTypeIds ?? [])
    setSelectedDogCategoryIds(initialData?.dogCategoryIds ?? [])
    setCustomerSearchTerm("")
    setCopyLinkSuccess(false)
    setCopyCodeSuccess(false)
    setManualContact({ name: "", phone: "", email: "" })
  }, [open, initialData, defaultTimes])

  useEffect(() => {
    customerSuggestionRefs.current = []
    setCustomerHighlightIndex(-1)
  }, [customerResults, shouldSearchCustomers, isSearchingCustomers])

  // Load customer type options when modal opens
  useEffect(() => {
    if (!open) {
      return
    }
    let isMounted = true

    setIsLoadingCustomerTypes(true)
    supabase
      .from("customer_types")
      .select("id, name")
      .order("priority", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) {
          return
        }
        if (error) {
          console.error("❌ [ProposedMeetingModal] Failed to load customer types:", error)
          setCustomerTypeOptions([])
        } else {
          setCustomerTypeOptions(data ?? [])
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingCustomerTypes(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [open])

  // Load dog category options when modal opens
  useEffect(() => {
    if (!open) {
      return
    }
    let isMounted = true

    setIsLoadingDogCategories(true)
    supabase
      .from("dog_categories")
      .select("id, name")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) {
          return
        }
        if (error) {
          console.error("❌ [ProposedMeetingModal] Failed to load dog categories:", error)
          setDogCategoryOptions([])
        } else {
          setDogCategoryOptions(data ?? [])
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingDogCategories(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [open])

  const handleAddCustomer = (customer: Customer) => {
    if (!customer?.id) {
      return
    }
    setSelectedCustomers((prev) => {
      if (prev.some((item) => item.id === customer.id)) {
        return prev
      }
      return [...prev, customer]
    })
    setCustomerSearchTerm("")
    setCustomerHighlightIndex(-1)
  }

  const handleRemoveCustomer = (customerId: string) => {
    setSelectedCustomers((prev) => prev.filter((customer) => customer.id !== customerId))
  }

  const handleCustomerSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!visibleCustomerResults.length) {
      if (event.key === "Enter") {
        event.preventDefault()
      }
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setCustomerHighlightIndex((prev) => {
        const next = Math.min(prev + 1, visibleCustomerResults.length - 1)
        requestAnimationFrame(() => customerSuggestionRefs.current[next]?.scrollIntoView({ block: "nearest" }))
        return next
      })
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setCustomerHighlightIndex((prev) => {
        if (prev <= 0) {
          return -1
        }
        const next = prev - 1
        requestAnimationFrame(() => customerSuggestionRefs.current[next]?.scrollIntoView({ block: "nearest" }))
        return next
      })
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      if (customerHighlightIndex >= 0 && visibleCustomerResults[customerHighlightIndex]) {
        handleAddCustomer({
          id: visibleCustomerResults[customerHighlightIndex].id,
          fullName: visibleCustomerResults[customerHighlightIndex].fullName,
          phone: visibleCustomerResults[customerHighlightIndex].phone,
          email: visibleCustomerResults[customerHighlightIndex].email,
        })
      }
      return
    }

    if (event.key === "Escape") {
      setCustomerHighlightIndex(-1)
    }
  }

  const disableSubmit =
    loading ||
    !meetingTimes?.startTime ||
    !meetingTimes?.endTime ||
    !selectedStationId ||
    !title.trim()

  const handleSubmit = async () => {
    if (disableSubmit || !meetingTimes?.startTime || !meetingTimes?.endTime || !selectedStationId) {
      return
    }

    // Build dogIds array from selectedDogIds map
    const dogIds: Array<{ customerId: string; dogId: string }> = []
    selectedDogIds.forEach((dogId, customerId) => {
      if (dogId) {
        dogIds.push({ customerId, dogId })
      }
    })

    await onSubmit({
      title: title.trim(),
      summary: summary.trim(),
      notes: notes.trim(),
      stationId: selectedStationId,
      startTime: meetingTimes.startTime.toISOString(),
      endTime: meetingTimes.endTime.toISOString(),
      serviceType: resolvedServiceType,
      customerIds: selectedCustomers.map((customer) => customer.id),
      customerTypeIds: selectedCustomerTypeIds,
      dogCategoryIds: selectedDogCategoryIds,
      dogIds: dogIds.length > 0 ? dogIds : undefined,
      meetingId: initialData?.meetingId,
    })
  }

  const sectionTitle = mode === "create" ? "יצירת מפגש מוצע" : "עדכון מפגש מוצע"
  const sectionDescription =
    mode === "create"
      ? "הגדירו חלון זמן שמור והזמינו לקוחות או קטגוריות מתאימות."
      : "עדכנו את פרטי המפגש, הלקוחות או סוגי הלקוחות ששמורים עבורו."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2 ">
            <Sparkles className="h-5 w-5 text-lime-600" />
            {sectionTitle}
          </DialogTitle>
          <DialogDescription className="text-right">
            {sectionDescription}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="pr-2 max-h-[calc(85vh-11rem)]">
          <div className="space-y-6 px-3 py-2">
            {meetingTimes && (
              <AppointmentDetailsSection
                isOpen={open}
                finalizedTimes={meetingTimes}
                stations={stations}
                onTimesChange={(times) => {
                  setMeetingTimes(times)
                  if (times.stationId) {
                    setSelectedStationId(times.stationId)
                  }
                }}
                stationFilter={(station) => station.serviceType === resolvedServiceType}
                theme="mint"
                hideStation
              />
            )}

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="proposed-title" className="mb-1 block text-right">
                  כותרת המפגש *
                </Label>
                <Input
                  id="proposed-title"
                  value={title}
                  maxLength={80}
                  placeholder="לדוגמה: תור שישי ללקוחות VIP"
                  onChange={(event) => setTitle(event.target.value)}
                  className="text-right"
                />
              </div>
              <div>
                <Label htmlFor="proposed-summary" className="mb-1 block text-right">
                  תיאור ללקוחות / צוות
                </Label>
                <Textarea
                  id="proposed-summary"
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="הסבר כללי על המפגש, מי מיועד להגיע וכו'..."
                  className="text-right min-h-[90px]"
                />
              </div>
              <div>
                <Label htmlFor="proposed-notes" className="mb-1 block text-right">
                  הערות פנימיות
                </Label>
                <Textarea
                  id="proposed-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="מחשבות צוות, שיקולים מיוחדים"
                  className="text-right min-h-[80px]"
                />
              </div>
            </div>

            <div className="space-y-6 border-t pt-6" dir="rtl">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Users className="h-5 w-5 text-lime-600" />
                  בחירת קהל היעד
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  בחרו את הקהל שיוזמן למפגש זה - ניתן לבחור לפי קטגוריות לקוחות, קטגוריות כלבים, או לקוחות ספציפיים
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2" dir="rtl">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-right font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4 text-lime-600" />
                        קטגוריות לקוחות
                      </Label>
                      <Badge variant="outline" className="text-[11px]">
                        {selectedCustomerTypeIds.length} נבחרו
                      </Badge>
                    </div>
                    <CustomerTypeMultiSelect
                      options={customerTypeOptions}
                      selectedIds={selectedCustomerTypeIds}
                      onSelectionChange={setSelectedCustomerTypeIds}
                      placeholder="בחר קטגוריות לקוחות..."
                      isLoading={isLoadingCustomerTypes}
                      onCreateCustomerType={createCustomerType}
                      onRefreshOptions={async () => {
                        setIsLoadingCustomerTypes(true)
                        try {
                          const { data, error } = await supabase
                            .from("customer_types")
                            .select("id, name")
                            .order("priority", { ascending: true })
                            .order("name", { ascending: true })

                          if (error) {
                            console.error("❌ [ProposedMeetingModal] Failed to refresh customer types:", error)
                          } else {
                            setCustomerTypeOptions(data ?? [])
                          }
                        } finally {
                          setIsLoadingCustomerTypes(false)
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-right font-semibold flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-lime-600" />
                        לקוחות ספציפיים
                      </Label>
                      <Badge variant="outline" className="text-[11px]">
                        {selectedCustomers.length} נבחרו
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          value={customerSearchTerm}
                          onChange={(event) => setCustomerSearchTerm(event.target.value)}
                          onKeyDown={handleCustomerSearchKeyDown}
                          onFocus={() => setIsCustomerInputFocused(true)}
                          onBlur={() => {
                            // Delay to allow click on customer item
                            setTimeout(() => setIsCustomerInputFocused(false), 200)
                          }}
                          placeholder="חיפוש לפי שם, טלפון או אימייל..."
                          className="pr-9 text-right"
                        />
                        <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                      {isCustomerInputFocused && customerSearchTerm && customerSearchTerm.length > 0 && customerSearchTerm.length < 2 && (
                        <p className="text-xs text-slate-500 text-right">הקלידו לפחות שתי אותיות כדי לחפש לקוחות.</p>
                      )}
                      {shouldSearchCustomers && (
                        <div className="rounded-md border border-slate-200">
                          <ScrollArea className="max-h-48">
                            {isSearchingCustomers ? (
                              <div className="flex items-center justify-center py-4 text-sm text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                מחפש לקוחות...
                              </div>
                            ) : visibleCustomerResults.length ? (
                              <div className="divide-y divide-slate-100">
                                {visibleCustomerResults.map((customer, index) => (
                                  <button
                                    type="button"
                                    key={customer.id}
                                    ref={(el) => (customerSuggestionRefs.current[index] = el)}
                                    className={cn(
                                      "w-full px-3 py-2 text-right text-sm hover:bg-slate-50",
                                      customerHighlightIndex === index && "bg-lime-50"
                                    )}
                                    onClick={() =>
                                      handleAddCustomer({
                                        id: customer.id,
                                        fullName: customer.fullName,
                                        phone: customer.phone,
                                        email: customer.email,
                                      })
                                    }
                                  >
                                    <div className="font-medium text-gray-800">{customer.fullName || "לקוח ללא שם"}</div>
                                    <div className="text-xs text-gray-500">
                                      {customer.phone || customer.email ? `${customer.phone ?? ""} ${customer.email ?? ""}` : "ללא פרטי קשר"}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="py-4 text-center text-sm text-slate-500">
                                לא נמצאו לקוחות מתאימים לחיפוש זה.
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      )}
                      {selectedCustomers.length > 0 && (
                        <div className="space-y-3">
                          {selectedCustomers.map((customer) => (
                            <CustomerDogSelector
                              key={customer.id}
                              customer={customer}
                              selectedDogId={selectedDogIds.get(customer.id) || ""}
                              onDogSelect={(dogId) => {
                                if (dogId) {
                                  setSelectedDogIds(prev => new Map(prev).set(customer.id, dogId))
                                } else {
                                  setSelectedDogIds(prev => {
                                    const next = new Map(prev)
                                    next.delete(customer.id)
                                    return next
                                  })
                                }
                              }}
                              onRemove={() => {
                                handleRemoveCustomer(customer.id)
                                setSelectedDogIds(prev => {
                                  const next = new Map(prev)
                                  next.delete(customer.id)
                                  return next
                                })
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-right font-semibold flex items-center gap-2">
                      <Dog className="h-4 w-4 text-lime-600" />
                      קטגוריות כלבים
                    </Label>
                    <Badge variant="outline" className="text-[11px]">
                      {selectedDogCategoryIds.length} נבחרו
                    </Badge>
                  </div>
                  <DogCategoryMultiSelect
                    options={dogCategoryOptions}
                    selectedIds={selectedDogCategoryIds}
                    onSelectionChange={setSelectedDogCategoryIds}
                    placeholder="בחר קטגוריות כלבים..."
                    isLoading={isLoadingDogCategories}
                    onCreateDogCategory={createDogCategory}
                    onRefreshOptions={async () => {
                      setIsLoadingDogCategories(true)
                      try {
                        const { data, error } = await supabase
                          .from("dog_categories")
                          .select("id, name")
                          .order("name", { ascending: true })

                        if (error) {
                          console.error("❌ [ProposedMeetingModal] Failed to refresh dog categories:", error)
                        } else {
                          setDogCategoryOptions(data ?? [])
                        }
                      } finally {
                        setIsLoadingDogCategories(false)
                      }
                    }}
                  />
                </div>
              </div>
            </div>


          </div>
        </ScrollArea>
        <DialogFooter dir="ltr">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={disableSubmit}
            className="bg-lime-600 text-white hover:bg-lime-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                שומר...
              </>
            ) : mode === "create" ? (
              "צור מפגש"
            ) : (
              "עדכן מפגש"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
