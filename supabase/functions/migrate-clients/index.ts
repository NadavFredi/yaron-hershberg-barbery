import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface ClientData {
  full_name: string
  phone: string
  email?: string
  customer_type?: string // name
  gender?: string
  date_of_birth?: string
  lead_source?: string // name
  external_id: string // CustomerID
  is_banned: boolean
  city?: string
  notes?: string
}

interface TreatmentData {
  customer_external_id: string // CustomerID
  treatment_date: string // ISO date string
  treatment_name: string
  worker_name: string
  price: number
}

interface MigrationBatch {
  clients?: ClientData[]
  treatments?: TreatmentData[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("🔍 [migrate-clients] Function called with method:", req.method)

    // Get auth token from request
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      console.error("❌ [migrate-clients] No authorization header")
      return new Response(JSON.stringify({ success: false, error: "Unauthorized - No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const batch: MigrationBatch = await req.json()
    console.log("📋 [migrate-clients] Received batch:", {
      clientsCount: batch.clients?.length || 0,
      treatmentsCount: batch.treatments?.length || 0,
    })

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL environment variable")
    }

    if (!supabaseServiceKey) {
      throw new Error(
        "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
          "For local development, this should be automatically available. " +
          "Check your Supabase configuration or set it manually."
      )
    }

    console.log("✅ [migrate-clients] Using Supabase URL:", supabaseUrl)

    // Use service role to bypass RLS
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Verify manager is authenticated
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()
    if (authError || !user) {
      console.error("❌ [migrate-clients] Authentication failed:", authError?.message)
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized - Invalid or expired session. Please log in again.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("✅ [migrate-clients] Manager authenticated:", user.id)

    const results = {
      clients: {
        created: 0,
        errors: [] as string[],
      },
      treatments: {
        created: 0,
        errors: [] as string[],
      },
    }

    // Helper function to find or create customer_type by name
    const findOrCreateCustomerType = async (name: string | null | undefined): Promise<string | null> => {
      if (!name || !name.trim()) {
        return null
      }

      const trimmedName = name.trim()

      // Try to find existing
      const { data: existing, error: findError } = await supabaseClient
        .from("customer_types")
        .select("id")
        .eq("name", trimmedName)
        .maybeSingle()

      if (findError) {
        console.error("❌ [migrate-clients] Error finding customer_type:", findError)
        throw new Error(`Failed to find customer_type: ${findError.message}`)
      }

      if (existing) {
        return existing.id
      }

      // Create new
      const { data: created, error: createError } = await supabaseClient
        .from("customer_types")
        .insert({
          name: trimmedName,
          priority: 1,
          is_active: true,
        })
        .select("id")
        .single()

      if (createError) {
        console.error("❌ [migrate-clients] Error creating customer_type:", createError)
        throw new Error(`Failed to create customer_type: ${createError.message}`)
      }

      console.log("✅ [migrate-clients] Created customer_type:", trimmedName, created.id)
      return created.id
    }

    // Helper function to find or create lead_source by name
    const findOrCreateLeadSource = async (name: string | null | undefined): Promise<string | null> => {
      if (!name || !name.trim()) {
        return null
      }

      const trimmedName = name.trim()

      // Try to find existing
      const { data: existing, error: findError } = await supabaseClient
        .from("lead_sources")
        .select("id")
        .eq("name", trimmedName)
        .maybeSingle()

      if (findError) {
        console.error("❌ [migrate-clients] Error finding lead_source:", findError)
        throw new Error(`Failed to find lead_source: ${findError.message}`)
      }

      if (existing) {
        return existing.id
      }

      // Create new
      const { data: created, error: createError } = await supabaseClient
        .from("lead_sources")
        .insert({
          name: trimmedName,
        })
        .select("id")
        .single()

      if (createError) {
        console.error("❌ [migrate-clients] Error creating lead_source:", createError)
        throw new Error(`Failed to create lead_source: ${createError.message}`)
      }

      console.log("✅ [migrate-clients] Created lead_source:", trimmedName, created.id)
      return created.id
    }

    // Helper function to normalize phone number
    const normalizePhone = (phone: string): string => {
      const digitsOnly = phone.replace(/\D/g, "")
      if (!digitsOnly) {
        return ""
      }

      const trimmedPhone = phone.trim()
      const hasExplicitPlus = trimmedPhone.startsWith("+")
      const looksLikeIsraeliMobile = digitsOnly.length === 10 && digitsOnly.startsWith("0")

      const normalized = hasExplicitPlus
        ? digitsOnly
        : looksLikeIsraeliMobile
        ? `972${digitsOnly.slice(1)}`
        : digitsOnly

      return normalized
    }

    // Helper function to normalize gender
    const normalizeGender = (gender: string | null | undefined): "male" | "female" | "other" | null => {
      if (!gender) {
        return null
      }

      const lower = gender.toLowerCase().trim()
      if (lower === "זכר" || lower === "male" || lower === "m") {
        return "male"
      }
      if (lower === "נקבה" || lower === "female" || lower === "f") {
        return "female"
      }
      return "other"
    }

    // Process clients
    if (batch.clients && batch.clients.length > 0) {
      for (const client of batch.clients) {
        try {
          // Check if customer already exists by external_id
          if (client.external_id) {
            const { data: existingCustomer } = await supabaseClient
              .from("customers")
              .select("id")
              .eq("external_id", client.external_id)
              .maybeSingle()

            if (existingCustomer) {
              console.log(
                `⏭️ [migrate-clients] Customer with external_id ${client.external_id} already exists, skipping`
              )
              continue
            }
          }

          // Normalize phone
          const normalizedPhone = normalizePhone(client.phone)
          if (!normalizedPhone || normalizedPhone.length < 9 || normalizedPhone.length > 15) {
            results.clients.errors.push(`Client ${client.full_name}: Invalid phone number ${client.phone}`)
            continue
          }

          // Check if customer exists by phone
          const { data: existingByPhone } = await supabaseClient
            .from("customers")
            .select("id")
            .eq("phone", normalizedPhone)
            .maybeSingle()

          if (existingByPhone) {
            console.log(`⏭️ [migrate-clients] Customer with phone ${normalizedPhone} already exists, skipping`)
            continue
          }

          // Find or create customer_type
          let customerTypeId: string | null = null
          if (client.customer_type) {
            customerTypeId = await findOrCreateCustomerType(client.customer_type)
          }

          // Find or create lead_source
          let leadSourceId: string | null = null
          if (client.lead_source) {
            leadSourceId = await findOrCreateLeadSource(client.lead_source)
          }

          // Normalize gender
          const gender = normalizeGender(client.gender)

          // Parse date_of_birth
          let dateOfBirth: string | null = null
          if (client.date_of_birth) {
            try {
              // Try to parse the date
              const parsed = new Date(client.date_of_birth)
              if (!isNaN(parsed.getTime())) {
                dateOfBirth = parsed.toISOString().split("T")[0]
              }
            } catch (e) {
              console.warn(
                `⚠️ [migrate-clients] Invalid date_of_birth for ${client.full_name}: ${client.date_of_birth}`
              )
            }
          }

          // Create auth user
          const phoneForAuth = `+${normalizedPhone}`
          const password = crypto.randomUUID() // Random password, user will need to reset

          const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
            phone: phoneForAuth,
            phone_confirm: true,
            password,
            user_metadata: {
              full_name: client.full_name,
              phone_number: normalizedPhone,
              phone_number_digits: normalizedPhone,
              phone_number_e164: phoneForAuth,
            },
          })

          if (authError) {
            console.error(`❌ [migrate-clients] Error creating auth user for ${client.full_name}:`, authError)
            results.clients.errors.push(`Client ${client.full_name}: Failed to create auth user - ${authError.message}`)
            continue
          }

          // Create searchable phone (digits only for searching)
          const phoneSearch = normalizedPhone

          // Create customer record
          const customerPayload: any = {
            auth_user_id: authData.user.id,
            full_name: client.full_name.trim(),
            phone: normalizedPhone,
            phone_search: phoneSearch,
            external_id: client.external_id || null,
            is_banned: client.is_banned || false,
            customer_type_id: customerTypeId,
            lead_source_id: leadSourceId,
            gender,
            date_of_birth: dateOfBirth,
            city: client.city?.trim() || null,
          }

          if (client.notes) {
            customerPayload.notes = client.notes.trim()
          }

          if (client.email) {
            customerPayload.email = client.email.trim()
          }
          if (client.notes) {
            customerPayload.notes = client.notes.trim()
          }

          const { data: customerData, error: customerError } = await supabaseClient
            .from("customers")
            .insert(customerPayload)
            .select("id")
            .single()

          if (customerError) {
            console.error(`❌ [migrate-clients] Error creating customer for ${client.full_name}:`, customerError)
            // Try to clean up auth user
            await supabaseClient.auth.admin.deleteUser(authData.user.id)
            results.clients.errors.push(
              `Client ${client.full_name}: Failed to create customer - ${customerError.message}`
            )
            continue
          }

          // Create profile
          const profilePayload: any = {
            id: authData.user.id,
            full_name: client.full_name.trim(),
            phone_number: normalizedPhone,
            client_id: customerData.id,
            role: "client",
          }

          if (client.email) {
            profilePayload.email = client.email.trim()
          }

          const { error: profileError } = await supabaseClient.from("profiles").insert(profilePayload)

          if (profileError) {
            console.error(`❌ [migrate-clients] Error creating profile for ${client.full_name}:`, profileError)
            // Don't fail the whole operation, but log it
          }

          results.clients.created++
          console.log(`✅ [migrate-clients] Created client: ${client.full_name} (${customerData.id})`)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.error(`❌ [migrate-clients] Error processing client ${client.full_name}:`, errorMsg)
          results.clients.errors.push(`Client ${client.full_name}: ${errorMsg}`)
        }
      }
    }

    // Process treatments
    if (batch.treatments && batch.treatments.length > 0) {
      // Build a map of external_id to customer_id for faster lookup
      const customerMap = new Map<string, string>()

      for (const treatment of batch.treatments) {
        try {
          // Find customer by external_id
          if (!customerMap.has(treatment.customer_external_id)) {
            const { data: customer } = await supabaseClient
              .from("customers")
              .select("id")
              .eq("external_id", treatment.customer_external_id)
              .maybeSingle()

            if (!customer) {
              results.treatments.errors.push(
                `Treatment for customer ${treatment.customer_external_id}: Customer not found`
              )
              continue
            }

            customerMap.set(treatment.customer_external_id, customer.id)
          }

          const customerId = customerMap.get(treatment.customer_external_id)!

          // Find or create service by treatment name
          let serviceId: string | null = null
          if (treatment.treatment_name && treatment.treatment_name.trim()) {
            const { data: existingService } = await supabaseClient
              .from("services")
              .select("id")
              .eq("name", treatment.treatment_name.trim())
              .maybeSingle()

            if (existingService) {
              serviceId = existingService.id
            } else {
              // Create service
              const { data: newService, error: serviceError } = await supabaseClient
                .from("services")
                .insert({
                  name: treatment.treatment_name.trim(),
                  category: "grooming",
                  display_order: 0,
                })
                .select("id")
                .single()

              if (serviceError) {
                console.error(`❌ [migrate-clients] Error creating service ${treatment.treatment_name}:`, serviceError)
              } else {
                serviceId = newService.id
              }
            }
          }

          // Find worker by name
          let workerId: string | null = null
          if (treatment.worker_name && treatment.worker_name.trim()) {
            const { data: worker } = await supabaseClient
              .from("profiles")
              .select("id")
              .eq("role", "worker")
              .ilike("full_name", treatment.worker_name.trim())
              .maybeSingle()

            if (worker) {
              workerId = worker.id
            } else {
              console.warn(`⚠️ [migrate-clients] Worker not found: ${treatment.worker_name}`)
            }
          }

          // Parse treatment date
          let treatmentDate: Date
          try {
            treatmentDate = new Date(treatment.treatment_date)
            if (isNaN(treatmentDate.getTime())) {
              throw new Error("Invalid date")
            }
          } catch (e) {
            results.treatments.errors.push(
              `Treatment for customer ${treatment.customer_external_id}: Invalid date ${treatment.treatment_date}`
            )
            continue
          }

          // Create payment record
          const paymentPayload: any = {
            customer_id: customerId,
            amount: treatment.price,
            currency: "ILS",
            status: "paid",
            method: "cash",
            metadata: {
              migrated: true,
              treatment_name: treatment.treatment_name || null,
              worker_name: treatment.worker_name || null,
              worker_id: workerId,
              service_id: serviceId,
            },
            created_at: treatmentDate.toISOString(),
          }

          const { error: paymentError } = await supabaseClient.from("payments").insert(paymentPayload)

          if (paymentError) {
            console.error(
              `❌ [migrate-clients] Error creating payment for customer ${treatment.customer_external_id}:`,
              paymentError
            )
            results.treatments.errors.push(
              `Treatment for customer ${treatment.customer_external_id}: ${paymentError.message}`
            )
            continue
          }

          results.treatments.created++
          console.log(
            `✅ [migrate-clients] Created payment: ${treatment.price} for customer ${treatment.customer_external_id}`
          )
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.error(
            `❌ [migrate-clients] Error processing treatment for customer ${treatment.customer_external_id}:`,
            errorMsg
          )
          results.treatments.errors.push(`Treatment for customer ${treatment.customer_external_id}: ${errorMsg}`)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("❌ [migrate-clients] General error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
