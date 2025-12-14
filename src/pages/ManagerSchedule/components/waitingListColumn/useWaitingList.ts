import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { addDays, format, startOfDay } from "date-fns"
import { he } from "date-fns/locale"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useDeleteWaitingListEntryMutation } from "@/store/services/supabaseApi"
import { useAppDispatch } from "@/store/hooks"
import { setSelectedClient, setIsClientDetailsOpen } from "@/store/slices/managerScheduleSlice"
import type { ManagerWaitlistEntry, WaitlistBucketGroup, WaitlistServiceScope } from "../../types"

// Re-export types for backward compatibility
export type { ManagerWaitlistEntry, WaitlistBucketGroup }

interface UseWaitingListProps {
  selectedDate: Date
  selectedDateStr?: string // Optional stable date string for dependency comparison
}

const UNCLASSIFIED_CUSTOMER_TYPE_ID = "uncategorized-customer-type"

export function useWaitingList({ selectedDate, selectedDateStr: propSelectedDateStr }: UseWaitingListProps) {
  const { toast } = useToast()
  const dispatch = useAppDispatch()

  const [waitingListEntries, setWaitingListEntries] = useState<ManagerWaitlistEntry[]>([])
  const [isLoadingWaitingList, setIsLoadingWaitingList] = useState(false)
  const [waitingListError, setWaitingListError] = useState<string | null>(null)
  const [waitingListSearchTerm, setWaitingListSearchTerm] = useState("")
  const [selectedCustomerTypes, setSelectedCustomerTypes] = useState<Array<{ id: string; name: string }>>([])
  const [customerTypeQuery, setCustomerTypeQuery] = useState("")
  const [waitingListLastUpdated, setWaitingListLastUpdated] = useState<Date | null>(null)
  const [waitlistSection, setWaitlistSection] = useState<string | null>("client-types")
  const [activeWaitlistBucket, setActiveWaitlistBucket] = useState<string | null>(null)

  const customerTypeSuggestionsRef = useRef<Record<string, { id: string; name: string }>>({})

  // Use provided stable date string or create one from Date object
  const selectedDateStr = propSelectedDateStr || useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate])

  const loadWaitingListEntries = useCallback(async () => {
    setIsLoadingWaitingList(true)
    setWaitingListError(null)
    try {
      setWaitingListEntries([])
      setWaitingListLastUpdated(new Date())
    } catch (error) {
      console.error("Error loading waiting list entries:", error)
      setWaitingListEntries([])
      setWaitingListError("לא ניתן לטעון את רשימת ההמתנה להיום")
      toast({
        title: "שגיאה בטעינת רשימת ההמתנה",
        description: "בדקו את החיבור ונסו שוב.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingWaitingList(false)
    }
  }, [selectedDateStr, toast])

  useEffect(() => {
    loadWaitingListEntries()
  }, [loadWaitingListEntries])

  const searchCustomerTypes = useCallback(async (searchTerm: string) => {
    try {
      const trimmed = searchTerm.trim()
      let query = supabase.from("customer_types").select("id, name").order("priority", { ascending: true }).limit(8)

      if (trimmed) {
        query = query.ilike("name", `%${trimmed}%`)
      }

      const { data, error } = await query
      if (error) {
        throw error
      }

      const lookup: Record<string, { id: string; name: string }> = {}
      ;(data || []).forEach((item) => {
        lookup[item.name] = { id: item.id, name: item.name }
      })
      customerTypeSuggestionsRef.current = lookup
      return (data || []).map((item) => item.name)
    } catch (error) {
      console.error("Error searching customer types:", error)
      return []
    }
  }, [])

  const handleSelectCustomerType = useCallback((label: string) => {
    const match = customerTypeSuggestionsRef.current[label]
    if (!match) {
      return
    }
    setSelectedCustomerTypes((prev) => {
      if (prev.some((item) => item.id === match.id)) {
        return prev
      }
      return [...prev, match]
    })
    setCustomerTypeQuery("")
  }, [])

  const removeCustomerType = useCallback((id: string) => {
    setSelectedCustomerTypes((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearWaitingListFilters = useCallback(() => {
    setWaitingListSearchTerm("")
    setSelectedCustomerTypes([])
    setCustomerTypeQuery("")
  }, [])

  const filteredWaitingListEntries = useMemo(() => {
    const search = waitingListSearchTerm.trim().toLowerCase()
    const customerTypeIds = new Set(selectedCustomerTypes.map((item) => item.id))

    return waitingListEntries.filter((entry) => {
      if (search) {
        const haystack = [entry.customerName, entry.customerPhone, entry.customerEmail, entry.notes]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()

        if (!haystack.includes(search)) {
          return false
        }
      }

      if (customerTypeIds.size > 0) {
        if (!entry.customerTypeId || !customerTypeIds.has(entry.customerTypeId)) {
          return false
        }
      }

      return true
    })
  }, [waitingListEntries, waitingListSearchTerm, selectedCustomerTypes])

  const handleWaitlistCardClick = useCallback(
    (entry: ManagerWaitlistEntry) => {
      if (entry.customerId || entry.customerName) {
        dispatch(
          setSelectedClient({
            name: entry.customerName || "לקוח",
            classification: entry.customerTypeName ?? undefined,
            phone: entry.customerPhone ?? undefined,
            email: entry.customerEmail ?? undefined,
          })
        )
        dispatch(setIsClientDetailsOpen(true))
      }
    },
    [dispatch]
  )

  useEffect(() => {
    setActiveWaitlistBucket(null)
  }, [filteredWaitingListEntries])

  const waitingListSummary = useMemo(() => {
    const scopeCounts: Record<WaitlistServiceScope, number> = {
      grooming: 0,
    }

    waitingListEntries.forEach((entry) => {
      scopeCounts[entry.serviceScope] = (scopeCounts[entry.serviceScope] || 0) + 1
    })

    return {
      total: waitingListEntries.length,
      filtered: filteredWaitingListEntries.length,
      scopeCounts,
    }
  }, [waitingListEntries, filteredWaitingListEntries])

  const waitlistBuckets = useMemo(() => {
    const clientTypesMap = new Map<string, ManagerWaitlistEntry[]>()

    filteredWaitingListEntries.forEach((entry) => {
      const customerTypeId = entry.customerTypeId || UNCLASSIFIED_CUSTOMER_TYPE_ID
      const customerTypeName = entry.customerTypeName || "ללא סיווג"
      if (!clientTypesMap.has(customerTypeId)) {
        clientTypesMap.set(customerTypeId, [])
      }
      clientTypesMap.get(customerTypeId)!.push(entry)
    })

    const clientTypes: WaitlistBucketGroup[] = Array.from(clientTypesMap.entries()).map(([id, entries]) => ({
      id,
      label: entries[0]?.customerTypeName || "ללא סיווג",
      entries,
    }))

    return { clientTypes, dogCategories: [] as WaitlistBucketGroup[] }
  }, [filteredWaitingListEntries])

  const waitingListDateLabel = useMemo(() => format(selectedDate, "EEEE, d MMMM", { locale: he }), [selectedDate])

  const waitingListLastUpdatedLabel = useMemo(
    () => (waitingListLastUpdated ? format(waitingListLastUpdated, "HH:mm") : "—"),
    [waitingListLastUpdated]
  )

  const waitingListActiveFiltersCount = useMemo(() => {
    return (waitingListSearchTerm.trim() ? 1 : 0) + selectedCustomerTypes.length
  }, [waitingListSearchTerm, selectedCustomerTypes.length])

  const waitlistHasFilters = waitingListActiveFiltersCount > 0
  const waitlistHasEntries = waitingListEntries.length > 0

  return {
    // Data
    waitingListEntries,
    filteredWaitingListEntries,
    isLoadingWaitingList,
    waitingListError,
    waitingListSummary,
    waitlistBuckets,
    waitingListDateLabel,
    waitingListLastUpdatedLabel,
    waitlistHasEntries,
    waitlistHasFilters,
    waitingListActiveFiltersCount,

    // Search & Filters
    waitingListSearchTerm,
    setWaitingListSearchTerm,
    selectedCustomerTypes,
    customerTypeQuery,
    setCustomerTypeQuery,
    searchCustomerTypes,
    handleSelectCustomerType,
    removeCustomerType,
    clearWaitingListFilters,

    // UI State
    waitlistSection,
    setWaitlistSection,
    activeWaitlistBucket,
    setActiveWaitlistBucket,

    // Handlers
    handleWaitlistCardClick,
    loadWaitingListEntries,
  }
}
