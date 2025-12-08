import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { addDays, format, startOfDay } from "date-fns"
import { he } from "date-fns/locale"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useDeleteWaitingListEntryMutation } from "@/store/services/supabaseApi"
import { useAppDispatch } from "@/store/hooks"
import { setSelectedDog, setIsDogDetailsOpen, setSelectedClient, setIsClientDetailsOpen } from "@/store/slices/managerScheduleSlice"
import type { ManagerWaitlistEntry, WaitlistBucketGroup, WaitlistServiceScope } from "../../types"

// Re-export types for backward compatibility
export type { ManagerWaitlistEntry, WaitlistBucketGroup }

interface UseWaitingListProps {
  selectedDate: Date
  selectedDateStr?: string // Optional stable date string for dependency comparison
}

const UNCLASSIFIED_CUSTOMER_TYPE_ID = "uncategorized-customer-type"
const UNCLASSIFIED_CATEGORY_ID = "uncategorized-dog-category"

export function useWaitingList({ selectedDate, selectedDateStr: propSelectedDateStr }: UseWaitingListProps) {
  const { toast } = useToast()
  const dispatch = useAppDispatch()

  const [waitingListEntries, setWaitingListEntries] = useState<ManagerWaitlistEntry[]>([])
  const [isLoadingWaitingList, setIsLoadingWaitingList] = useState(false)
  const [waitingListError, setWaitingListError] = useState<string | null>(null)
  const [waitingListSearchTerm, setWaitingListSearchTerm] = useState("")
  const [selectedCustomerTypes, setSelectedCustomerTypes] = useState<Array<{ id: string; name: string }>>([])
  const [selectedDogCategories, setSelectedDogCategories] = useState<Array<{ id: string; name: string }>>([])
  const [customerTypeQuery, setCustomerTypeQuery] = useState("")
  const [dogCategoryQuery, setDogCategoryQuery] = useState("")
  const [waitingListLastUpdated, setWaitingListLastUpdated] = useState<Date | null>(null)
  const [waitlistSection, setWaitlistSection] = useState<string | null>("client-types")
  const [activeWaitlistBucket, setActiveWaitlistBucket] = useState<string | null>(null)

  const customerTypeSuggestionsRef = useRef<Record<string, { id: string; name: string }>>({})
  const dogCategorySuggestionsRef = useRef<Record<string, { id: string; name: string }>>({})

  // Use provided stable date string or create one from Date object
  const selectedDateStr = propSelectedDateStr || useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate])

  const loadWaitingListEntries = useCallback(async () => {
    setIsLoadingWaitingList(true)
    setWaitingListError(null)
    try {
      // Daycare waitlist doesn't exist in this system - return empty array
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
      let query = supabase
        .from("customer_types")
        .select("id, name")
        .order("priority", { ascending: true })
        .limit(8)

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

  const searchDogCategories = useCallback(async (searchTerm: string) => {
    try {
      const trimmed = searchTerm.trim()
      let query = supabase
        .from("dog_categories")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(8)

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
      dogCategorySuggestionsRef.current = lookup
      return (data || []).map((item) => item.name)
    } catch (error) {
      console.error("Error searching dog categories:", error)
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

  const handleSelectDogCategory = useCallback((label: string) => {
    const match = dogCategorySuggestionsRef.current[label]
    if (!match) {
      return
    }
    setSelectedDogCategories((prev) => {
      if (prev.some((item) => item.id === match.id)) {
        return prev
      }
      return [...prev, match]
    })
    setDogCategoryQuery("")
  }, [])

  const removeCustomerType = useCallback((id: string) => {
    setSelectedCustomerTypes((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const removeDogCategory = useCallback((id: string) => {
    setSelectedDogCategories((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearWaitingListFilters = useCallback(() => {
    setWaitingListSearchTerm("")
    setSelectedCustomerTypes([])
    setSelectedDogCategories([])
    setCustomerTypeQuery("")
    setDogCategoryQuery("")
  }, [])

  const filteredWaitingListEntries = useMemo(() => {
    const search = waitingListSearchTerm.trim().toLowerCase()
    const customerTypeIds = new Set(selectedCustomerTypes.map((item) => item.id))
    const categoryIds = new Set(selectedDogCategories.map((item) => item.id))

    return waitingListEntries.filter((entry) => {
      if (search) {
        const haystack = [
          entry.dogName,
          entry.customerName,
          entry.customerPhone,
          entry.customerEmail,
          entry.breedName,
          entry.notes,
        ]
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

      if (categoryIds.size > 0) {
        if (!entry.dogCategories.length || !entry.dogCategories.some((category) => categoryIds.has(category.id))) {
          return false
        }
      }

      return true
    })
  }, [waitingListEntries, waitingListSearchTerm, selectedCustomerTypes, selectedDogCategories])

  const handleWaitlistCardClick = useCallback(
    (entry: ManagerWaitlistEntry) => {
      // Handle dog details
      if (entry.dogId) {
        dispatch(
          setSelectedDog({
            id: entry.dogId,
            name: entry.dogName,
            clientClassification: entry.customerTypeName ?? undefined,
            owner: entry.customerName
              ? {
                  name: entry.customerName,
                  classification: entry.customerTypeName ?? undefined,
                  phone: entry.customerPhone ?? undefined,
                  email: entry.customerEmail ?? undefined,
                }
              : undefined,
            breed: entry.breedName ?? undefined,
            notes: entry.notes ?? undefined,
          })
        )
        dispatch(setIsDogDetailsOpen(true))
      }

      // Handle client details
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
      daycare: 0,
      both: 0,
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

  // Group entries into buckets by customer type
  const waitlistBuckets = useMemo(() => {
    const clientTypesMap = new Map<string, ManagerWaitlistEntry[]>()
    const dogCategoriesMap = new Map<string, ManagerWaitlistEntry[]>()

    filteredWaitingListEntries.forEach((entry) => {
      // Group by customer type
      const customerTypeId = entry.customerTypeId || UNCLASSIFIED_CUSTOMER_TYPE_ID
      const customerTypeName = entry.customerTypeName || "ללא סיווג"
      if (!clientTypesMap.has(customerTypeId)) {
        clientTypesMap.set(customerTypeId, [])
      }
      clientTypesMap.get(customerTypeId)!.push(entry)

      // Group by dog categories
      if (entry.dogCategories.length > 0) {
        entry.dogCategories.forEach((category) => {
          if (!dogCategoriesMap.has(category.id)) {
            dogCategoriesMap.set(category.id, [])
          }
          dogCategoriesMap.get(category.id)!.push(entry)
        })
      } else {
        // Entries without categories go to unclassified
        const unclassifiedId = UNCLASSIFIED_CATEGORY_ID
        if (!dogCategoriesMap.has(unclassifiedId)) {
          dogCategoriesMap.set(unclassifiedId, [])
        }
        dogCategoriesMap.get(unclassifiedId)!.push(entry)
      }
    })

    const clientTypes: WaitlistBucketGroup[] = Array.from(clientTypesMap.entries()).map(([id, entries]) => ({
      id,
      label: entries[0]?.customerTypeName || "ללא סיווג",
      entries,
    }))

    const dogCategories: WaitlistBucketGroup[] = Array.from(dogCategoriesMap.entries()).map(([id, entries]) => ({
      id,
      label: entries[0]?.dogCategories.find((cat) => cat.id === id)?.name || "ללא קטגוריה",
      entries,
    }))

    return { clientTypes, dogCategories }
  }, [filteredWaitingListEntries])

  const waitingListDateLabel = useMemo(() => format(selectedDate, "EEEE, d MMMM", { locale: he }), [selectedDate])

  const waitingListLastUpdatedLabel = useMemo(
    () => (waitingListLastUpdated ? format(waitingListLastUpdated, "HH:mm") : "—"),
    [waitingListLastUpdated]
  )

  const waitingListActiveFiltersCount = useMemo(() => {
    return (
      (waitingListSearchTerm.trim() ? 1 : 0) +
      selectedCustomerTypes.length +
      selectedDogCategories.length
    )
  }, [waitingListSearchTerm, selectedCustomerTypes.length, selectedDogCategories.length])

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
    selectedDogCategories,
    customerTypeQuery,
    setCustomerTypeQuery,
    dogCategoryQuery,
    setDogCategoryQuery,
    searchCustomerTypes,
    searchDogCategories,
    handleSelectCustomerType,
    handleSelectDogCategory,
    removeCustomerType,
    removeDogCategory,
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

