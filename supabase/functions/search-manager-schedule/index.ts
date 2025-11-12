import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase configuration for search-manager-schedule function")
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

type ManagerServiceType = "grooming" | "garden"

interface ManagerTreatment {
  id: string
  name: string
  treatmentType?: string
  ownerId?: string
  clientClassification?: string
  clientName?: string
  recordId?: string
  recordNumber?: string
  minGroomingPrice?: number
  maxGroomingPrice?: number
}

interface ManagerAppointment {
  id: string
  serviceType: ManagerServiceType
  stationId: string
  stationName: string
  startDateTime: string
  endDateTime: string
  status: string
  paymentStatus?: string
  notes: string
  internalNotes?: string
  hasCrossServiceAppointment?: boolean
  treatments: ManagerTreatment[]
  clientId?: string
  clientName?: string
  clientClassification?: string
  clientEmail?: string
  clientPhone?: string
  durationMinutes?: number
  gardenAppointmentType?: "full-day" | "hourly"
  gardenIsTrial?: boolean
  latePickupRequested?: boolean
  latePickupNotes?: string
  gardenTrimNails?: boolean
  gardenBrush?: boolean
  gardenBath?: boolean
  appointmentType?: "private" | "business"
  isPersonalAppointment?: boolean
  personalAppointmentDescription?: string
  price?: number
  isProposedMeeting?: boolean
  proposedMeetingId?: string
  proposedMeetingCode?: string
  proposedStatus?: string
  proposedTitle?: string
  proposedSummary?: string
  proposedNotes?: string
  proposedLinkedAppointmentId?: string
  proposedLinkedCustomerId?: string
  proposedLinkedTreatmentId?: string
  proposedOriginalStart?: string
  proposedOriginalEnd?: string
}

interface ClientSearchResult {
  id: string
  name: string
  classification?: string
  customerTypeName?: string
  phone?: string
  email?: string
  address?: string
}

interface TreatmentSearchResult {
  treatment: ManagerTreatment
  owner?: ClientSearchResult
}

const GROOMING_SELECT = `
  id,
  status,
  station_id,
  start_at,
  end_at,
  customer_notes,
  internal_notes,
  payment_status,
  appointment_kind,
  amount_due,
  treatment_id,
  customer_id,
  stations(id, name),
  treatments(
    id,
    name,
    treatment_type_id,
    customer_id,
    treatmentTypes(name, size_class, min_groom_price, max_groom_price)
  ),
  customers(
    id,
    full_name,
    phone,
    email,
    classification
  )
`

const DAYCARE_SELECT = `
  id,
  status,
  station_id,
  start_at,
  end_at,
  customer_notes,
  internal_notes,
  payment_status,
  service_type,
  questionnaire_result,
  late_pickup_requested,
  late_pickup_notes,
  garden_trim_nails,
  garden_brush,
  garden_bath,
  amount_due,
  treatment_id,
  customer_id,
  stations(id, name),
  treatments(
    id,
    name,
    treatment_type_id,
    customer_id,
    treatmentTypes(name, size_class, min_groom_price, max_groom_price)
  ),
  customers(
    id,
    full_name,
    phone,
    email,
    classification
  )
`

const TREATMENT_SEARCH_SELECT = `
  id,
  name,
  treatment_type_id,
  customer_id,
  gender,
  health_notes,
  vet_name,
  vet_phone,
  treatmentTypes(name, min_groom_price, max_groom_price),
  customers(
    id,
    full_name,
    phone,
    email,
    address,
    classification,
    customer_type:customer_types(name)
  )
`

const CLIENT_SEARCH_SELECT = `
  id,
  full_name,
  phone,
  email,
  address,
  classification,
  customer_type:customer_types(name)
`

const PROPOSED_MEETING_SELECT = `
  id,
  station_id,
  service_type,
  start_at,
  end_at,
  status,
  code,
  title,
  summary,
  notes,
  reschedule_appointment_id,
  reschedule_customer_id,
  reschedule_treatment_id,
  reschedule_original_start_at,
  reschedule_original_end_at,
  stations(id, name)
`

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const rawTerm = typeof body?.term === "string" ? body.term : ""
    const limitInput = typeof body?.limit === "number" ? body.limit : parseInt(body?.limit, 10)
    const trimmedTerm = rawTerm.trim()

    if (!trimmedTerm) {
      return new Response(JSON.stringify({ success: true, appointments: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const normalizedWhitespace = trimmedTerm.replace(/\s+/g, " ")
    const digitsOnly = normalizedWhitespace.replace(/\D/g, "")
    const likeValue = `%${escapeLike(normalizedWhitespace)}%`
    const looseDigitsPattern = digitsOnly ? buildLooseDigitsPattern(digitsOnly) : null
    const limit = clampLimit(limitInput)

    const [treatmentSearch, clientSearch] = await Promise.all([
      searchTreatments(normalizedWhitespace, limit * 2),
      searchClients(normalizedWhitespace, looseDigitsPattern, limit * 2),
    ])

    const treatmentIds = treatmentSearch.ids
    const customerIdSet = new Set(clientSearch.ids)
    treatmentSearch.records.forEach((record) => {
      if (record.owner?.id) {
        customerIdSet.add(record.owner.id)
      }
    })
    const customerIds = Array.from(customerIdSet)

    const [groomingAppointments, daycareAppointments, proposedMeetings] = await Promise.all([
      fetchGroomingAppointments({ likeValue, treatmentIds, customerIds, limit }),
      fetchDaycareAppointments({ likeValue, treatmentIds, customerIds, limit }),
      fetchProposedMeetings({ likeValue, digitsPattern: looseDigitsPattern, limit }),
    ])

    const combinedMap = new Map<string, ManagerAppointment>()
    for (const appointment of [...groomingAppointments, ...daycareAppointments, ...proposedMeetings]) {
      const key = `${appointment.serviceType}:${appointment.id}`
      if (!combinedMap.has(key)) {
        combinedMap.set(key, appointment)
      }
    }

    const combined = Array.from(combinedMap.values()).sort((a, b) => {
      return new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime()
    })

    return new Response(
      JSON.stringify({
        success: true,
        appointments: combined.slice(0, limit),
        treatments: treatmentSearch.records.slice(0, limit),
        clients: clientSearch.records.slice(0, limit),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("❌ [search-manager-schedule] Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})

function clampLimit(value?: number): number {
  if (!Number.isFinite(value)) {
    return 20
  }
  return Math.min(Math.max(Math.trunc(value as number), 1), 50)
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (character) => `\\${character}`)
}

function buildLooseDigitsPattern(digits: string): string {
  const spread = digits.split("").join("%")
  return `%${spread}%`
}

type FetchArgs = {
  likeValue: string
  treatmentIds: string[]
  customerIds: string[]
  limit: number
}

async function fetchGroomingAppointments({ likeValue, treatmentIds, customerIds, limit }: FetchArgs): Promise<ManagerAppointment[]> {
  const filters = buildAppointmentFilters({
    treatmentIds,
    customerIds,
    likeValue,
  })

  if (!filters.length) {
    return []
  }

  const { data, error } = await supabase
    .from("grooming_appointments")
    .select(GROOMING_SELECT)
    .order("start_at", { ascending: false })
    .limit(limit * 2)
    .or(filters.join(","))

  if (error) {
    throw error
  }

  const appointments: ManagerAppointment[] = []
  for (const row of data ?? []) {
    const mapped = mapGroomingRow(row)
    if (mapped) {
      appointments.push(mapped)
    }
  }
  return appointments
}

async function fetchDaycareAppointments({ likeValue, treatmentIds, customerIds, limit }: FetchArgs): Promise<ManagerAppointment[]> {
  const filters = buildAppointmentFilters({
    treatmentIds,
    customerIds,
    likeValue,
    extraColumns: ["late_pickup_notes"],
  })

  if (!filters.length) {
    return []
  }

  const { data, error } = await supabase
    .from("daycare_appointments")
    .select(DAYCARE_SELECT)
    .order("start_at", { ascending: false })
    .limit(limit * 2)
    .or(filters.join(","))

  if (error) {
    throw error
  }

  const appointments: ManagerAppointment[] = []
  for (const row of data ?? []) {
    const mapped = mapDaycareRow(row)
    if (mapped) {
      appointments.push(mapped)
    }
  }
  return appointments
}

async function fetchProposedMeetings({
  likeValue,
  digitsPattern,
  limit,
}: {
  likeValue: string
  digitsPattern: string | null
  limit: number
}): Promise<ManagerAppointment[]> {
  const filters: string[] = []
  if (digitsPattern) {
    filters.push(`code.ilike.${digitsPattern}`)
  }
  if (likeValue) {
    filters.push(`title.ilike.${likeValue}`)
    filters.push(`summary.ilike.${likeValue}`)
    filters.push(`notes.ilike.${likeValue}`)
  }

  if (!filters.length) {
    return []
  }

  const { data, error } = await supabase
    .from("proposed_meetings")
    .select(PROPOSED_MEETING_SELECT)
    .order("start_at", { ascending: false })
    .limit(limit * 2)
    .or(filters.join(","))

  if (error) {
    throw error
  }

  const appointments: ManagerAppointment[] = []
  for (const row of data ?? []) {
    const mapped = mapProposedMeetingRow(row)
    if (mapped) {
      appointments.push(mapped)
    }
  }
  return appointments
}

type FilterArgs = {
  treatmentIds: string[]
  customerIds: string[]
  likeValue: string
  extraColumns?: string[]
}

function buildAppointmentFilters({ treatmentIds, customerIds, likeValue, extraColumns = [] }: FilterArgs): string[] {
  const filters: string[] = []
  const trimmedTreatmentIds = treatmentIds.slice(0, 50)
  const trimmedCustomerIds = customerIds.slice(0, 50)

  if (trimmedTreatmentIds.length) {
    filters.push(`treatment_id.in.(${trimmedTreatmentIds.join(",")})`)
  }
  if (trimmedCustomerIds.length) {
    filters.push(`customer_id.in.(${trimmedCustomerIds.join(",")})`)
  }

  if (likeValue) {
    filters.push(`customer_notes.ilike.${likeValue}`)
    filters.push(`internal_notes.ilike.${likeValue}`)
    for (const column of extraColumns) {
      filters.push(`${column}.ilike.${likeValue}`)
    }
  }

  return filters
}

function mapCustomerRowToClientResult(row: Record<string, unknown> | null | undefined): ClientSearchResult | undefined {
  if (!row) {
    return undefined
  }
  return {
    id: String(row.id),
    name: typeof row.full_name === "string" ? row.full_name : "",
    classification: typeof row.classification === "string" ? row.classification : undefined,
    customerTypeName:
      typeof (row as Record<string, any>).customer_type?.name === "string"
        ? (row as Record<string, any>).customer_type.name
        : undefined,
    phone: typeof row.phone === "string" ? row.phone : undefined,
    email: typeof row.email === "string" ? row.email : undefined,
    address: typeof row.address === "string" ? row.address : undefined,
  }
}

function mapProposedMeetingRow(row: Record<string, any> | null | undefined): ManagerAppointment | null {
  if (!row || typeof row !== "object") {
    return null
  }

  const start = typeof row.start_at === "string" ? row.start_at : null
  const end = typeof row.end_at === "string" ? row.end_at : null

  if (!start || !end) {
    return null
  }

  const station = row.stations
    ? Array.isArray(row.stations)
      ? row.stations[0] ?? null
      : row.stations
    : null

  const durationMinutes = Math.max(
    1,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  )

  return {
    id: `proposed-${row.id}`,
    serviceType: row.service_type === "garden" ? "garden" : "grooming",
    stationId: row.station_id || station?.id || `proposed-${row.id}`,
    stationName: station?.name || "מפגש מוצע",
    startDateTime: start,
    endDateTime: end,
    status: typeof row.status === "string" ? row.status : "proposed",
    notes: typeof row.summary === "string" && row.summary.trim() ? row.summary : "מפגש מוצע",
    internalNotes: typeof row.notes === "string" && row.notes.trim() ? row.notes : undefined,
    hasCrossServiceAppointment: false,
    treatments: [],
    appointmentType: "business",
    durationMinutes,
    isProposedMeeting: true,
    proposedMeetingId: row.id,
    proposedMeetingCode: typeof row.code === "string" ? row.code : undefined,
    proposedStatus: typeof row.status === "string" ? row.status : undefined,
    proposedTitle: typeof row.title === "string" ? row.title : undefined,
    proposedSummary: typeof row.summary === "string" ? row.summary : undefined,
    proposedNotes: typeof row.notes === "string" ? row.notes : undefined,
    proposedLinkedAppointmentId:
      typeof row.reschedule_appointment_id === "string" ? row.reschedule_appointment_id : undefined,
    proposedLinkedCustomerId:
      typeof row.reschedule_customer_id === "string" ? row.reschedule_customer_id : undefined,
    proposedLinkedTreatmentId: typeof row.reschedule_treatment_id === "string" ? row.reschedule_treatment_id : undefined,
    proposedOriginalStart:
      typeof row.reschedule_original_start_at === "string" ? row.reschedule_original_start_at : undefined,
    proposedOriginalEnd:
      typeof row.reschedule_original_end_at === "string" ? row.reschedule_original_end_at : undefined,
  }
}

async function searchTreatments(term: string, limit: number): Promise<{ ids: string[]; records: TreatmentSearchResult[] }> {
  if (!term) {
    return { ids: [], records: [] }
  }
  const likeValue = `%${escapeLike(term)}%`
  const { data, error } = await supabase
    .from("treatments")
    .select(TREATMENT_SEARCH_SELECT)
    .ilike("name", likeValue)
    .order("name")
    .limit(limit)

  if (error) {
    throw error
  }

  const records: TreatmentSearchResult[] = (data ?? []).map((row) => {
    const treatmentType = extractSingleRecord<any>(row.treatmentTypes)
    const ownerRow = extractSingleRecord<any>(row.customers)
    const owner = mapCustomerRowToClientResult(ownerRow)
    const treatment: ManagerTreatment = {
      id: row.id,
      name: row.name ?? "",
      treatmentType: treatmentType?.name ?? undefined,
      ownerId: row.customer_id ?? undefined,
      clientName: owner?.name,
      clientClassification: owner?.classification,
      minGroomingPrice: treatmentType?.min_groom_price != null ? Number(treatmentType.min_groom_price) : undefined,
      maxGroomingPrice: treatmentType?.max_groom_price != null ? Number(treatmentType.max_groom_price) : undefined,
      gender: row.gender ?? undefined,
      medicalNotes: row.health_notes ?? undefined,
      vetName: row.vet_name ?? undefined,
      vetPhone: row.vet_phone ?? undefined,
    }
    return {
      treatment,
      owner,
    }
  })

  return {
    ids: records.map((record) => record.treatment.id),
    records,
  }
}

async function searchClients(
  term: string,
  looseDigitsPattern: string | null,
  limit: number
): Promise<{ ids: string[]; records: ClientSearchResult[] }> {
  if (!term && !looseDigitsPattern) {
    return { ids: [], records: [] }
  }

  const likeValue = term ? `%${escapeLike(term)}%` : null

  const [nameMatches, phoneMatches] = await Promise.all([
    likeValue
      ? supabase
          .from("customers")
          .select(CLIENT_SEARCH_SELECT)
          .or(`full_name.ilike.${likeValue},email.ilike.${likeValue}`)
          .order("full_name")
          .limit(limit)
      : Promise.resolve({ data: [], error: null }),
    looseDigitsPattern
      ? supabase
          .from("customers")
          .select(CLIENT_SEARCH_SELECT)
          .ilike("phone", looseDigitsPattern)
          .order("full_name")
          .limit(limit)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (nameMatches.error) {
    throw nameMatches.error
  }
  if (phoneMatches.error) {
    throw phoneMatches.error
  }

  const merged = new Map<string, ClientSearchResult>()
  ;[...(nameMatches.data ?? []), ...(phoneMatches.data ?? [])].forEach((row) => {
    if (!row?.id) {
      return
    }
    merged.set(row.id, mapCustomerRowToClientResult(row)!)
  })

  const records = Array.from(merged.values()).slice(0, limit)
  return {
    ids: records.map((record) => record.id),
    records,
  }
}

function mapGroomingRow(row: Record<string, unknown>): ManagerAppointment | null {
  const start = typeof row.start_at === "string" ? row.start_at : null
  const end = typeof row.end_at === "string" ? row.end_at : null
  if (!start || !end) {
    return null
  }

  const station = extractSingleRecord<{ id?: string; name?: string }>(row.stations)
  const treatment = extractSingleRecord<any>(row.treatments)
  const customer = extractSingleRecord<any>(row.customers)
  const treatmentType = treatment?.treatmentTypes ? extractSingleRecord<any>(treatment.treatmentTypes) : null

  const durationMinutes = calculateDurationMinutes(start, end)
  const treatmentEntry: ManagerTreatment | undefined = treatment
    ? {
        id: treatment.id,
        name: treatment.name ?? "",
        treatmentType: treatmentType?.name ?? undefined,
        ownerId: treatment.customer_id ?? undefined,
        clientClassification: customer?.classification ?? undefined,
        clientName: customer?.full_name ?? undefined,
        minGroomingPrice: treatmentType?.min_groom_price != null ? Number(treatmentType.min_groom_price) : undefined,
        maxGroomingPrice: treatmentType?.max_groom_price != null ? Number(treatmentType.max_groom_price) : undefined,
      }
    : undefined

  const appointmentKind = typeof row.appointment_kind === "string" ? row.appointment_kind : "business"
  const isPersonal = appointmentKind === "personal"

  return {
    id: String(row.id),
    serviceType: "grooming",
    stationId: (row.station_id as string) || station?.id || "",
    stationName: station?.name || "לא ידוע",
    startDateTime: start,
    endDateTime: end,
    status: typeof row.status === "string" ? row.status : "pending",
    paymentStatus: typeof row.payment_status === "string" ? row.payment_status : undefined,
    notes: typeof row.customer_notes === "string" ? row.customer_notes : "",
    internalNotes: typeof row.internal_notes === "string" ? row.internal_notes : undefined,
    hasCrossServiceAppointment: false,
    treatments: treatmentEntry ? [treatmentEntry] : [],
    clientId: customer?.id ?? undefined,
    clientName: customer?.full_name ?? undefined,
    clientClassification: customer?.classification ?? undefined,
    clientEmail: customer?.email ?? undefined,
    clientPhone: customer?.phone ?? undefined,
    durationMinutes,
    appointmentType: isPersonal ? "private" : "business",
    isPersonalAppointment: isPersonal,
    price: row.amount_due != null ? Number(row.amount_due) : undefined,
  }
}

function mapDaycareRow(row: Record<string, unknown>): ManagerAppointment | null {
  const start = typeof row.start_at === "string" ? row.start_at : null
  const end = typeof row.end_at === "string" ? row.end_at : null
  if (!start || !end) {
    return null
  }

  const station = extractSingleRecord<{ id?: string; name?: string }>(row.stations)
  const treatment = extractSingleRecord<any>(row.treatments)
  const customer = extractSingleRecord<any>(row.customers)
  const treatmentType = treatment?.treatmentTypes ? extractSingleRecord<any>(treatment.treatmentTypes) : null

  const durationMinutes = calculateDurationMinutes(start, end)
  const treatmentEntry: ManagerTreatment | undefined = treatment
    ? {
        id: treatment.id,
        name: treatment.name ?? "",
        treatmentType: treatmentType?.name ?? undefined,
        ownerId: treatment.customer_id ?? undefined,
        clientClassification: customer?.classification ?? undefined,
        clientName: customer?.full_name ?? undefined,
        minGroomingPrice: treatmentType?.min_groom_price != null ? Number(treatmentType.min_groom_price) : undefined,
        maxGroomingPrice: treatmentType?.max_groom_price != null ? Number(treatmentType.max_groom_price) : undefined,
      }
    : undefined

  const rawServiceType = typeof row.service_type === "string" ? row.service_type : null
  const questionnaireResult = typeof row.questionnaire_result === "string" ? row.questionnaire_result : null
  const gardenIsTrial =
    rawServiceType === "trial" || (rawServiceType == null && questionnaireResult === "pending")
  const gardenAppointmentType = rawServiceType === "hourly" ? "hourly" : "full-day"

  return {
    id: String(row.id),
    serviceType: "garden",
    stationId: (row.station_id as string) || station?.id || "garden-station",
    stationName: station?.name || "חלל המספרה",
    startDateTime: start,
    endDateTime: end,
    status: typeof row.status === "string" ? row.status : "pending",
    paymentStatus: typeof row.payment_status === "string" ? row.payment_status : undefined,
    notes: typeof row.customer_notes === "string" ? row.customer_notes : "",
    internalNotes: typeof row.internal_notes === "string" ? row.internal_notes : undefined,
    hasCrossServiceAppointment: false,
    treatments: treatmentEntry ? [treatmentEntry] : [],
    clientId: customer?.id ?? undefined,
    clientName: customer?.full_name ?? undefined,
    clientClassification: customer?.classification ?? undefined,
    clientEmail: customer?.email ?? undefined,
    clientPhone: customer?.phone ?? undefined,
    durationMinutes,
    gardenAppointmentType,
    gardenIsTrial,
    latePickupRequested: Boolean(row.late_pickup_requested),
    latePickupNotes: typeof row.late_pickup_notes === "string" ? row.late_pickup_notes : undefined,
    gardenTrimNails: Boolean(row.garden_trim_nails),
    gardenBrush: Boolean(row.garden_brush),
    gardenBath: Boolean(row.garden_bath),
    price: row.amount_due != null ? Number(row.amount_due) : undefined,
    appointmentType: "business",
  }
}

function extractSingleRecord<T>(value: unknown): T | undefined {
  if (!value) {
    return undefined
  }
  if (Array.isArray(value)) {
    return (value[0] as T) ?? undefined
  }
  return value as T
}

function calculateDurationMinutes(start: string, end: string): number | undefined {
  const startMs = Date.parse(start)
  const endMs = Date.parse(end)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return undefined
  }
  const diffMinutes = Math.round((endMs - startMs) / 60000)
  return diffMinutes > 0 ? diffMinutes : undefined
}
