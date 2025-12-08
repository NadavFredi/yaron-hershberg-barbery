import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

export interface BreedWithRules {
  id: string
  name: string
  size_class?: string | null
  requires_staff_approval?: boolean
  min_groom_price?: number | null
  max_groom_price?: number | null
}

export interface Station {
  id: string
  name: string
  is_active: boolean
}

export interface StationBreedRule {
  id?: string
  station_id: string
  breed_id: string
  is_active: boolean
  remote_booking_allowed: boolean
  requires_staff_approval: boolean
  duration_modifier_minutes: number
}

export interface SettingsData {
  breeds: BreedWithRules[]
  stations: Station[]
  stationBreedRules: Record<string, Record<string, StationBreedRule>>
  durationInputValues: Record<string, Record<string, string>>
  groomingServiceId: string
  dogCategories: Array<{ id: string; name: string }>
  breedCategoriesMap: Record<string, string[]>
}

/**
 * Load all settings data for breeds management
 */
async function loadBreedsSettingsData(): Promise<SettingsData> {
  // Get or find grooming service
  let { data: serviceData, error: serviceError } = await supabase
    .from("services")
    .select("id")
    .eq("name", "grooming")
    .maybeSingle()

  if (serviceError) throw serviceError

  if (!serviceData) {
    // Create grooming service if it doesn't exist
    const { data: newService, error: createError } = await supabase
      .from("services")
      .insert({ name: "grooming", description: "שירות טיפוח" })
      .select("id")
      .single()

    if (createError) throw createError
    serviceData = newService
  }

  const groomingServiceId = serviceData.id

  // Fetch all breeds
  const { data: breeds, error: breedsError } = await supabase.from("breeds").select("*").order("name")

  if (breedsError) throw breedsError

  // Fetch dog categories
  const { data: dogCategories, error: dogCategoriesError } = await supabase
    .from("dog_categories")
    .select("*")
    .order("name")

  if (dogCategoriesError) {
    console.error("Error fetching dog_categories:", dogCategoriesError)
  }

  // Fetch breed-dog_categories relationships
  const { data: breedCategories, error: breedCategoriesError } = await supabase
    .from("breed_dog_categories")
    .select("breed_id, dog_category_id")

  if (breedCategoriesError) {
    console.error("Error fetching breed_dog_categories:", breedCategoriesError)
  }

  // Map breed IDs to their categories
  const breedCategoriesMap: Record<string, string[]> = {}

  breeds?.forEach((breed) => {
    breedCategoriesMap[breed.id] = []
  })

  breedCategories?.forEach((bc) => {
    if (breedCategoriesMap[bc.breed_id]) {
      breedCategoriesMap[bc.breed_id].push(bc.dog_category_id)
    }
  })

  // Fetch all stations
  const { data: stations, error: stationsError } = await supabase
    .from("stations")
    .select("id, name, is_active, display_order")
    .order("display_order", { ascending: true })
    .order("name")

  if (stationsError) throw stationsError

  // Fetch all station breed rules for all breeds in one query
  const breedIds = breeds?.map((b) => b.id) || []
  let allRules: Array<{
    id: string
    breed_id: string
    station_id: string
    is_active: boolean
    remote_booking_allowed: boolean
    requires_staff_approval: boolean
    duration_modifier_minutes: number
  }> = []
  if (breedIds.length > 0) {
    const { data: rulesData, error: rulesError } = await supabase
      .from("station_breed_rules")
      .select("*")
      .in("breed_id", breedIds)

    if (rulesError) throw rulesError
    allRules = rulesData || []
    console.log(
      "[loadBreedsSettingsData] Loaded station_breed_rules without service filter:",
      allRules.length
    )
  }

  // Organize rules by breed_id -> station_id
  const stationBreedRules: Record<string, Record<string, StationBreedRule>> = {}
  const durationInputValues: Record<string, Record<string, string>> = {}

  breeds?.forEach((breed) => {
    const breedRules = allRules?.filter((r) => r.breed_id === breed.id) || []
    const rulesMap: Record<string, StationBreedRule> = {}
    const inputValuesMap: Record<string, string> = {}

    stations?.forEach((station) => {
      // Only process active stations
      if (!station.is_active) {
        return
      }

      const existingRule = breedRules.find((r) => r.station_id === station.id)
      if (existingRule) {
        const minutes = existingRule.duration_modifier_minutes ?? 0
        rulesMap[station.id] = {
          id: existingRule.id,
          station_id: station.id,
          breed_id: breed.id,
          is_active: existingRule.is_active ?? true,
          remote_booking_allowed: existingRule.remote_booking_allowed ?? false,
          requires_staff_approval: existingRule.requires_staff_approval ?? false,
          duration_modifier_minutes: minutes,
        }
        // Format duration as "H:MM"
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        inputValuesMap[station.id] = `${hours}:${mins.toString().padStart(2, "0")}`
      } else {
        // Create default rule for stations that don't have one
        rulesMap[station.id] = {
          station_id: station.id,
          breed_id: breed.id,
          is_active: true,
          remote_booking_allowed: false,
          requires_staff_approval: false,
          duration_modifier_minutes: 0,
        }
        inputValuesMap[station.id] = "0:00"
      }
    })

    stationBreedRules[breed.id] = rulesMap
    durationInputValues[breed.id] = inputValuesMap
  })

  return {
    breeds: breeds || [],
    stations: stations || [],
    stationBreedRules,
    durationInputValues,
    groomingServiceId,
    dogCategories: dogCategories || [],
    breedCategoriesMap,
  }
}

/**
 * Hook for loading breeds settings data
 */
export function useBreedsSettings() {
  const [data, setData] = useState<SettingsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()

  const loadData = async (showLoading: boolean = true) => {
    if (showLoading) {
      setIsLoading(true)
    }
    try {
      console.log("[useBreedsSettings] Loading settings data...")
      const settingsData = await loadBreedsSettingsData()
      setData(settingsData)
      setError(null)
      console.log("[useBreedsSettings] Data loaded successfully")
    } catch (err) {
      console.error("[useBreedsSettings] Error loading data:", err)
      const error = err instanceof Error ? err : new Error("Failed to load settings data")
      setError(error)
      if (showLoading) {
        toast({
          title: "שגיאה",
          description: "לא ניתן לטעון את הנתונים",
          variant: "destructive",
        })
      }
    } finally {
      if (showLoading) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return {
    data,
    isLoading,
    error,
    refetch: () => loadData(true),
  }
}
