import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

export interface TreatmentTypeWithRules {
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

export interface StationTreatmentTypeRule {
  id?: string
  station_id: string
  treatment_type_id: string
  is_active: boolean
  remote_booking_allowed: boolean
  requires_staff_approval: boolean
  duration_modifier_minutes: number
}

export interface SettingsData {
  treatmentTypes: TreatmentTypeWithRules[]
  stations: Station[]
  stationTreatmentTypeRules: Record<string, Record<string, StationTreatmentTypeRule>>
  durationInputValues: Record<string, Record<string, string>>
  groomingServiceId: string
  treatmentTypes: Array<{ id: string; name: string }>
  treatmentCategories: Array<{ id: string; name: string }>
  treatmentTypeTypesMap: Record<string, string[]>
  treatmentTypeCategoriesMap: Record<string, string[]>
}

/**
 * Load all settings data for treatmentTypes management
 */
async function loadTreatmentTypesSettingsData(): Promise<SettingsData> {
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

  // Fetch all treatment types and categories
  const { data: treatmentTypes, error: treatmentTypesError } = await supabase.from("treatment_types").select("*").order("name")

  if (treatmentTypesError) {
    throw treatmentTypesError
  }

  const { data: treatmentCategories, error: treatmentCategoriesError } = await supabase
    .from("treatment_categories")
    .select("*")
    .order("name")

  if (treatmentCategoriesError) {
    console.error("Error fetching treatment_categories:", treatmentCategoriesError)
  }

  // Fetch treatmentType-treatment_types and treatmentType-treatment_categories relationships
  const { data: treatmentTypeTypes, error: treatmentTypeTypesError } = await supabase
    .from("treatmentType_treatment_types")
    .select("treatment_type_id, related_treatment_type_id")

  if (treatmentTypeTypesError) {
    console.error("Error fetching treatmentType_treatment_types:", treatmentTypeTypesError)
  }

  const { data: treatmentTypeCategories, error: treatmentTypeCategoriesError } = await supabase
    .from("treatmentType_treatment_categories")
    .select("treatment_type_id, treatment_category_id")

  if (treatmentTypeCategoriesError) {
    console.error("Error fetching treatmentType_treatment_categories:", treatmentTypeCategoriesError)
  }

  // Map treatmentType IDs to their types and categories
  const treatmentTypeTypesMap: Record<string, string[]> = {}
  const treatmentTypeCategoriesMap: Record<string, string[]> = {}

  treatmentTypes?.forEach((treatmentType) => {
    treatmentTypeTypesMap[treatmentType.id] = []
    treatmentTypeCategoriesMap[treatmentType.id] = []
  })

  treatmentTypeTypes?.forEach((bt: { treatment_type_id: string; related_treatment_type_id: string }) => {
    if (treatmentTypeTypesMap[bt.treatment_type_id]) {
      treatmentTypeTypesMap[bt.treatment_type_id].push(bt.related_treatment_type_id)
    }
  })

  treatmentTypeCategories?.forEach((bc) => {
    if (treatmentTypeCategoriesMap[bc.treatment_type_id]) {
      treatmentTypeCategoriesMap[bc.treatment_type_id].push(bc.treatment_category_id)
    }
  })

  // Fetch all stations
  const { data: stations, error: stationsError } = await supabase
    .from("stations")
    .select("id, name, is_active, display_order")
    .order("display_order", { ascending: true })
    .order("name")

  if (stationsError) throw stationsError

  // Fetch all station treatmentType rules for all treatmentTypes in one query
  const treatmentTypeIds = treatmentTypes?.map((b) => b.id) || []
  let allRules: Array<{
    id: string
    treatment_type_id: string
    station_id: string
    is_active: boolean
    remote_booking_allowed: boolean
    requires_staff_approval: boolean
    duration_modifier_minutes: number
  }> = []
  if (treatmentTypeIds.length > 0) {
    const { data: rulesData, error: rulesError } = await supabase
      .from("station_treatmentType_rules")
      .select("*")
      .in("treatment_type_id", treatmentTypeIds)

    if (rulesError) throw rulesError
    allRules = rulesData || []
    console.log(
      "[loadTreatmentTypesSettingsData] Loaded station_treatmentType_rules without service filter:",
      allRules.length
    )
  }

  // Organize rules by treatment_type_id -> station_id
  const stationTreatmentTypeRules: Record<string, Record<string, StationTreatmentTypeRule>> = {}
  const durationInputValues: Record<string, Record<string, string>> = {}

  treatmentTypes?.forEach((treatmentType) => {
    const treatmentTypeRules = allRules?.filter((r) => r.treatment_type_id === treatmentType.id) || []
    const rulesMap: Record<string, StationTreatmentTypeRule> = {}
    const inputValuesMap: Record<string, string> = {}

    stations?.forEach((station) => {
      // Only process active stations
      if (!station.is_active) {
        return
      }

      const existingRule = treatmentTypeRules.find((r) => r.station_id === station.id)
      if (existingRule) {
        const minutes = existingRule.duration_modifier_minutes ?? 0
        rulesMap[station.id] = {
          id: existingRule.id,
          station_id: station.id,
          treatment_type_id: treatmentType.id,
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
          treatment_type_id: treatmentType.id,
          is_active: true,
          remote_booking_allowed: false,
          requires_staff_approval: false,
          duration_modifier_minutes: 0,
        }
        inputValuesMap[station.id] = "0:00"
      }
    })

    stationTreatmentTypeRules[treatmentType.id] = rulesMap
    durationInputValues[treatmentType.id] = inputValuesMap
  })

  return {
    treatmentTypes: treatmentTypes || [],
    stations: stations || [],
    stationTreatmentTypeRules,
    durationInputValues,
    groomingServiceId,
    treatmentCategories: treatmentCategories || [],
    treatmentTypeTypesMap,
    treatmentTypeCategoriesMap,
  }
}

/**
 * Hook for loading treatmentTypes settings data
 */
export function useTreatmentTypesSettings() {
  const [data, setData] = useState<SettingsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()

  const loadData = async (showLoading: boolean = true) => {
    if (showLoading) {
      setIsLoading(true)
    }
    try {
      console.log("[useTreatmentTypesSettings] Loading settings data...")
      const settingsData = await loadTreatmentTypesSettingsData()
      setData(settingsData)
      setError(null)
      console.log("[useTreatmentTypesSettings] Data loaded successfully")
    } catch (err) {
      console.error("[useTreatmentTypesSettings] Error loading data:", err)
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
