#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"
import XLSX from "xlsx"
import { existsSync } from "fs"
import { randomUUID } from "crypto"
import * as readline from "readline"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://localhost:54321"
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

/**
 * Wait for user approval to continue
 */
function waitForApproval(): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    console.log("")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("⏸️  Worker creation complete!")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("")
    console.log("Please review the workers created above.")
    console.log("Press ENTER or type 'yes' to continue with the migration,")
    console.log("or type 'no' to exit without continuing.")
    console.log("")

    rl.question("Continue? (yes/no, default: yes): ", (answer) => {
      rl.close()
      const normalizedAnswer = answer.trim().toLowerCase()
      if (normalizedAnswer === "no" || normalizedAnswer === "n") {
        console.log("")
        console.log(
          "❌ Migration cancelled by user. Workers have been created, but the rest of the migration was not executed."
        )
        console.log("")
        process.exit(0)
      } else {
        console.log("")
        console.log("✅ Continuing with migration...")
        console.log("")
        resolve()
      }
    })
  })
}

/**
 * Format error for logging - handles various error types
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>
    if (err.message) return String(err.message)
    if (err.code) return `Code: ${err.code}`
    if (err.details) return String(err.details)
    if (err.hint) return `Hint: ${err.hint}`
    try {
      return JSON.stringify(error, null, 2)
    } catch {
      return String(error)
    }
  }
  return String(error)
}

/**
 * Convert Excel date serial number to ISO date string (YYYY-MM-DD)
 * Excel epoch is 1900-01-01 = 25569 days since Unix epoch (1970-01-01)
 * Uses UTC methods to avoid timezone shifts
 */
function excelDateToISO(excelSerial: number | null | undefined): string | null {
  if (!excelSerial || isNaN(excelSerial)) {
    return null
  }

  try {
    // Excel epoch is 1900-01-01 = 25569 days since Unix epoch (1970-01-01)
    // Multiply by 86400000 milliseconds per day
    const jsDate = new Date((excelSerial - 25569) * 86400 * 1000)

    // Excel incorrectly treats 1900 as a leap year, so subtract 1 day for dates after Feb 28, 1900
    if (excelSerial > 59) {
      jsDate.setUTCDate(jsDate.getUTCDate() - 1) // Use UTC methods
    }

    // Return ISO date string (YYYY-MM-DD) using UTC methods to avoid timezone shifts
    const year = jsDate.getUTCFullYear()
    const month = String(jsDate.getUTCMonth() + 1).padStart(2, "0")
    const day = String(jsDate.getUTCDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  } catch (_e) {
    console.warn(`⚠️  Failed to convert Excel date ${excelSerial}`)
    return null
  }
}

/**
 * Normalize gender value from Hebrew/English to database enum
 */
function normalizeGender(gender: string | null | undefined): "male" | "female" | "other" | null {
  if (!gender) {
    return null
  }

  const lower = String(gender).toLowerCase().trim()
  if (lower === "זכר" || lower === "male" || lower === "m") {
    return "male"
  }
  if (lower === "נקבה" || lower === "female" || lower === "f") {
    return "female"
  }
  return "other"
}

/**
 * Parse date of birth from various formats
 */
function parseDateOfBirth(dob: unknown): string | null {
  if (!dob) return null

  // Try to parse as Excel date serial
  if (typeof dob === "number") {
    const iso = excelDateToISO(dob)
    if (iso) return iso
  }

  // Try to parse as string date
  if (typeof dob === "string") {
    const parsed = new Date(dob)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0]
    }
  }

  return null
}

/**
 * Normalize phone number for storage
 */
function normalizePhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "")
  if (!digitsOnly) {
    return ""
  }

  const trimmedPhone = phone.trim()
  const hasExplicitPlus = trimmedPhone.startsWith("+")
  const looksLikeIsraeliMobile = digitsOnly.length === 10 && digitsOnly.startsWith("0")

  const normalized = hasExplicitPlus ? digitsOnly : looksLikeIsraeliMobile ? `972${digitsOnly.slice(1)}` : digitsOnly

  return normalized
}

interface ClientData {
  full_name: string | null
  phone: string | null
  email?: string
  customer_type?: string
  gender?: string
  date_of_birth?: string
  lead_source?: string
  external_id: string
  is_banned: boolean
  city?: string
  notes?: string
}

interface TreatmentData {
  customer_external_id: string
  treatment_date: string
  treatment_name: string
  worker_name: string
  price: number | null // Can be 0 (valid) or null (missing)
  treatment_external_id?: string // Optional external ID for the treatment itself
}

/**
 * Find or create customer_type by name
 */
async function findOrCreateCustomerType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  name: string
): Promise<string | null> {
  if (!name || !name.trim()) {
    return null
  }

  const trimmedName = name.trim()

  // Try to find existing
  const { data: existing, error: findError } = await supabase
    .from("customer_types")
    .select("id")
    .eq("name", trimmedName)
    .maybeSingle()

  if (findError) {
    console.error("❌ Error finding customer_type:", formatError(findError))
    throw new Error(`Failed to find customer_type: ${formatError(findError)}`)
  }

  if (existing) {
    return existing.id
  }

  // Create new
  const { data: created, error: createError } = await supabase
    .from("customer_types")
    .insert({
      name: trimmedName,
      priority: 1,
      is_active: true,
    })
    .select("id")
    .single()

  if (createError) {
    console.error("❌ Error creating customer_type:", formatError(createError))
    throw new Error(`Failed to create customer_type: ${formatError(createError)}`)
  }

  console.log(`✅ Created customer_type: ${trimmedName} (${created.id})`)
  return created.id
}

/**
 * Find or create lead_source by name
 */
async function findOrCreateLeadSource(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  name: string
): Promise<string | null> {
  if (!name || !name.trim()) {
    return null
  }

  const trimmedName = name.trim()

  // Try to find existing
  const { data: existing, error: findError } = await supabase
    .from("lead_sources")
    .select("id")
    .eq("name", trimmedName)
    .maybeSingle()

  if (findError) {
    console.error("❌ Error finding lead_source:", formatError(findError))
    throw new Error(`Failed to find lead_source: ${formatError(findError)}`)
  }

  if (existing) {
    return existing.id
  }

  // Create new
  const { data: created, error: createError } = await supabase
    .from("lead_sources")
    .insert({
      name: trimmedName,
    })
    .select("id")
    .single()

  if (createError) {
    console.error("❌ Error creating lead_source:", formatError(createError))
    throw new Error(`Failed to create lead_source: ${formatError(createError)}`)
  }

  console.log(`✅ Created lead_source: ${trimmedName} (${created.id})`)
  return created.id
}

/**
 * Process a batch of clients
 */
async function processClientBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  clients: ClientData[]
): Promise<{ created: number; errors: string[] }> {
  const results = { created: 0, errors: [] as string[] }

  for (const client of clients) {
    try {
      // Check if customer already exists by external_id (always check since we generate one if missing)
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("external_id", client.external_id)
        .maybeSingle()

      if (existingCustomer) {
        console.log(`⏭️  Customer with external_id ${client.external_id} already exists, skipping`)
        continue
      }

      // Normalize phone - allow empty/null phones (keep as null)
      let normalizedPhone: string | null = null
      if (client.phone) {
        const normalized = normalizePhone(client.phone)
        if (normalized && normalized.length >= 9 && normalized.length <= 15) {
          normalizedPhone = normalized
        }
      }

      // If phone exists, check for duplicates
      if (normalizedPhone) {
        const { data: existingByPhone } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", normalizedPhone)
          .maybeSingle()

        if (existingByPhone) {
          console.log(`⏭️  Customer with phone ${normalizedPhone} already exists, skipping`)
          continue
        }
      }

      // Find or create customer_type
      let customerTypeId: string | null = null
      if (client.customer_type) {
        customerTypeId = await findOrCreateCustomerType(supabase, client.customer_type)
      }

      // Find or create lead_source
      let leadSourceId: string | null = null
      if (client.lead_source) {
        leadSourceId = await findOrCreateLeadSource(supabase, client.lead_source)
      }

      // Normalize gender
      const gender = normalizeGender(client.gender)

      // Parse date_of_birth
      let dateOfBirth: string | null = null
      if (client.date_of_birth) {
        dateOfBirth = parseDateOfBirth(client.date_of_birth)
      }

      // Create auth user only if phone exists
      let authUserId: string | null = null
      if (normalizedPhone) {
        const phoneForAuth = `+${normalizedPhone}`
        const password = randomUUID() // Random password, user will need to reset

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          phone: phoneForAuth,
          phone_confirm: true,
          password,
          user_metadata: {
            full_name: client.full_name || "",
            phone_number: normalizedPhone,
            phone_number_digits: normalizedPhone,
            phone_number_e164: phoneForAuth,
          },
        })

        if (authError) {
          // Log but don't fail - skip auth user creation and continue with customer creation
          console.error(
            `❌ Error creating auth user for ${client.full_name || client.external_id}:`,
            formatError(authError)
          )
          console.log(`   Continuing without auth user for ${client.full_name || client.external_id}`)
        } else {
          authUserId = authData.user.id
        }
      } else {
        console.log(
          `   No phone number for ${client.full_name || client.external_id}, creating customer without auth user`
        )
      }

      // Create customer record
      const customerPayload: Record<string, unknown> = {
        auth_user_id: authUserId,
        full_name: client.full_name ? client.full_name.trim() : null,
        phone: normalizedPhone,
        phone_search: normalizedPhone ? normalizedPhone.replace(/\D/g, "") : null,
        external_id: client.external_id || null,
        is_banned: client.is_banned || false,
        customer_type_id: customerTypeId,
        lead_source_id: leadSourceId,
        gender,
        date_of_birth: dateOfBirth,
        city: client.city?.trim() || null,
      }

      if (client.email) {
        customerPayload.email = client.email.trim()
      }
      if (client.notes) {
        customerPayload.notes = client.notes.trim()
      }

      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .insert(customerPayload)
        .select("id")
        .single()

      if (customerError) {
        console.error(
          `❌ Error creating customer for ${client.full_name || client.external_id}:`,
          formatError(customerError)
        )
        // Try to clean up auth user if we created one
        if (authUserId) {
          await supabase.auth.admin.deleteUser(authUserId)
        }
        results.errors.push(
          `Client ${client.full_name || client.external_id}: Failed to create customer - ${formatError(customerError)}`
        )
        continue
      }

      // Create profile if auth user exists
      if (authUserId) {
        const profilePayload: Record<string, unknown> = {
          id: authUserId,
          full_name: client.full_name ? client.full_name.trim() : "",
          phone_number: normalizedPhone || null,
          client_id: customerData.id,
          role: "client",
        }

        if (client.email) {
          profilePayload.email = client.email.trim()
        }

        const { error: profileError } = await supabase.from("profiles").insert(profilePayload)

        if (profileError) {
          console.error(
            `❌ Error creating profile for ${client.full_name || client.external_id}:`,
            formatError(profileError)
          )
          // Don't fail the whole operation, but log it
        }
      }

      results.created++
      console.log(`✅ Created client: ${client.full_name || client.external_id} (${customerData.id})`)
    } catch (error) {
      const errorMsg = formatError(error)
      console.error(`❌ Error processing client ${client.full_name || client.external_id}:`, errorMsg)
      results.errors.push(`Client ${client.full_name || client.external_id}: ${errorMsg}`)
    }
  }

  return results
}

/**
 * Extract unique worker names from treatments
 */
function extractUniqueWorkerNames(treatments: TreatmentData[]): string[] {
  const workerNames = new Set<string>()
  for (const treatment of treatments) {
    if (treatment.worker_name && treatment.worker_name.trim()) {
      workerNames.add(treatment.worker_name.trim())
    }
  }
  return Array.from(workerNames)
}

/**
 * Create workers from unique worker names
 */
async function createWorkers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  workerNames: string[]
): Promise<{ created: number; errors: string[]; workerMap: Map<string, string> }> {
  const results = { created: 0, errors: [] as string[], workerMap: new Map<string, string>() }

  // Get existing workers to avoid duplicates
  const { data: existingWorkers } = await supabase.from("profiles").select("id, full_name").eq("role", "worker")

  const existingWorkerMap = new Map<string, string>()
  if (existingWorkers) {
    for (const worker of existingWorkers) {
      if (worker.full_name) {
        const normalizedName = worker.full_name.replace(/\s+/g, " ").trim().toLowerCase()
        existingWorkerMap.set(normalizedName, worker.id)
      }
    }
  }

  for (const workerName of workerNames) {
    try {
      // Normalize name for comparison
      const normalizedName = workerName.replace(/\s+/g, " ").trim().toLowerCase()

      // Check if worker already exists
      if (existingWorkerMap.has(normalizedName)) {
        const existingId = existingWorkerMap.get(normalizedName)!
        results.workerMap.set(workerName, existingId)
        console.log(`⏭️  Worker "${workerName}" already exists, skipping`)
        continue
      }

      // Validate worker name
      if (!workerName || !workerName.trim()) {
        results.errors.push(`Invalid worker name: empty or whitespace only`)
        continue
      }

      // Create auth user for worker using email (no phone required)
      // Generate a unique email address - use UUID for uniqueness since names may contain Hebrew characters
      const workerNameTrimmed = workerName.trim()
      const uniqueId = randomUUID().substring(0, 8) // Use first 8 chars of UUID for uniqueness
      const workerEmail = `worker.${uniqueId}@migrated.local`

      const password = randomUUID() // Random password, user will need to reset

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: workerEmail,
        email_confirm: true,
        password,
        user_metadata: {
          full_name: workerNameTrimmed,
          role: "worker",
        },
      })

      if (authError) {
        // Log but continue - try to find existing user by name
        console.error(`❌ Error creating auth user for worker "${workerName}":`, formatError(authError))
        results.errors.push(`Worker "${workerName}": Failed to create auth user - ${formatError(authError)}`)
        continue
      }

      if (!authData?.user) {
        results.errors.push(`Worker "${workerName}": Auth user creation returned no user`)
        continue
      }

      const authUserId = authData.user.id

      // Create profile for worker
      const profilePayload: Record<string, unknown> = {
        id: authUserId,
        full_name: workerName.trim(),
        email: workerEmail,
        role: "worker",
        worker_is_active: true,
      }

      const { error: profileError } = await supabase.from("profiles").insert(profilePayload)

      if (profileError) {
        console.error(`❌ Error creating profile for worker "${workerName}":`, formatError(profileError))
        // Try to clean up auth user if we created one
        await supabase.auth.admin.deleteUser(authUserId)
        results.errors.push(`Worker "${workerName}": Failed to create profile - ${formatError(profileError)}`)
        continue
      }

      results.created++
      results.workerMap.set(workerName, authUserId)
      // Also add to existing map for future lookups
      existingWorkerMap.set(normalizedName, authUserId)
      console.log(`✅ Created worker: ${workerName} (${authUserId})`)
    } catch (error) {
      const errorMsg = formatError(error)
      console.error(`❌ Error processing worker "${workerName}":`, errorMsg)
      results.errors.push(`Worker "${workerName}": ${errorMsg}`)
    }
  }

  return results
}

/**
 * Process a batch of treatments
 */
async function processTreatmentBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  treatments: TreatmentData[],
  workerMap: Map<string, string>
): Promise<{ created: number; errors: string[] }> {
  const results = { created: 0, errors: [] as string[] }
  const customerMap = new Map<string, string>()

  for (const treatment of treatments) {
    try {
      // Find customer by external_id
      if (!customerMap.has(treatment.customer_external_id)) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("external_id", treatment.customer_external_id)
          .maybeSingle()

        if (!customer) {
          results.errors.push(`Treatment for customer ${treatment.customer_external_id}: Customer not found`)
          continue
        }

        customerMap.set(treatment.customer_external_id, customer.id)
      }

      const customerId = customerMap.get(treatment.customer_external_id)!

      // Find or create service by treatment name
      let serviceId: string | null = null
      if (treatment.treatment_name && treatment.treatment_name.trim()) {
        const { data: existingService } = await supabase
          .from("services")
          .select("id")
          .eq("name", treatment.treatment_name.trim())
          .maybeSingle()

        if (existingService) {
          serviceId = existingService.id
        } else {
          // Create service
          const { data: newService, error: serviceError } = await supabase
            .from("services")
            .insert({
              name: treatment.treatment_name.trim(),
              category: "grooming",
              display_order: 0,
            })
            .select("id")
            .single()

          if (serviceError) {
            console.error(`❌ Error creating service ${treatment.treatment_name}:`, formatError(serviceError))
          } else {
            serviceId = newService.id
          }
        }
      }

      // Find worker by name using the worker map
      let workerId: string | null = null
      if (treatment.worker_name && treatment.worker_name.trim()) {
        const workerNameTrimmed = treatment.worker_name.trim()

        // Try exact match first
        if (workerMap.has(workerNameTrimmed)) {
          workerId = workerMap.get(workerNameTrimmed)!
        } else {
          // Try normalized match (handle multiple spaces)
          const normalizedName = workerNameTrimmed.replace(/\s+/g, " ").trim()
          for (const [name, id] of workerMap.entries()) {
            const normalizedMapName = name.replace(/\s+/g, " ").trim()
            if (normalizedMapName.toLowerCase() === normalizedName.toLowerCase()) {
              workerId = id
              break
            }
          }

          // If still not found, try partial match (first word)
          if (!workerId && normalizedName.includes(" ")) {
            const firstWord = normalizedName.split(" ")[0]
            const matchingEntries = Array.from(workerMap.entries()).filter(([name]) => {
              const normalizedMapName = name.replace(/\s+/g, " ").trim()
              return normalizedMapName.toLowerCase().startsWith(firstWord.toLowerCase())
            })
            if (matchingEntries.length === 1) {
              workerId = matchingEntries[0][1]
            }
          }

          if (!workerId) {
            console.warn(`⚠️  Worker not found: ${treatment.worker_name}`)
          }
        }
      }

      // Parse treatment date (YYYY-MM-DD format) - use UTC to avoid timezone shifts
      let startAt: Date
      let endAt: Date
      try {
        // Parse YYYY-MM-DD string and create date at UTC midnight to avoid timezone shifts
        const [year, month, day] = treatment.treatment_date.split("-").map(Number)

        // Create date at UTC midnight, then set to 10:00 AM UTC (this preserves the correct date)
        startAt = new Date(Date.UTC(year, month - 1, day, 10, 0, 0, 0)) // month is 0-indexed
        endAt = new Date(Date.UTC(year, month - 1, day, 11, 0, 0, 0)) // 1 hour later

        if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
          throw new Error("Invalid date")
        }
      } catch (_e) {
        results.errors.push(
          `Treatment for customer ${treatment.customer_external_id}: Invalid date ${treatment.treatment_date}`
        )
        continue
      }

      const STATION_ID = "e9b1d67c-ac32-4d6a-acbd-8efe31e73186"

      // Use CustomerId as treatment_id (external ID from old system)
      const treatmentExternalId = treatment.customer_external_id

      // Create grooming appointment
      const appointmentPayload: Record<string, unknown> = {
        customer_id: customerId,
        treatment_id: treatmentExternalId, // Store external ID (CustomerId) from old system
        service_id: serviceId,
        station_id: STATION_ID,
        status: "completed",
        payment_status: "paid",
        appointment_kind: "business",
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        amount_due: treatment.price ?? null, // Use null if price is null, otherwise use value (can be 0)
        created_at: startAt.toISOString(), // Already in UTC, will preserve date correctly
      }

      if (workerId) {
        appointmentPayload.worker_id = workerId
      }

      const { data: appointment, error: appointmentError } = await supabase
        .from("grooming_appointments")
        .insert(appointmentPayload)
        .select("id")
        .single()

      if (appointmentError) {
        console.error(
          `❌ Error creating appointment for customer ${treatment.customer_external_id}:`,
          formatError(appointmentError)
        )
        results.errors.push(
          `Treatment for customer ${treatment.customer_external_id}: Failed to create appointment - ${formatError(
            appointmentError
          )}`
        )
        continue
      }

      // Create payment record only if price is not null
      // If price is null, skip payment creation (appointment exists but no payment)
      let paymentError = null
      if (treatment.price !== null) {
        const paymentPayload: Record<string, unknown> = {
          customer_id: customerId,
          amount: treatment.price, // Can be 0, which is valid
          currency: "ILS",
          status: "paid",
          method: "cash",
          metadata: {
            migrated: true,
            treatment_name: treatment.treatment_name || null,
            worker_name: treatment.worker_name || null,
            worker_id: workerId,
            service_id: serviceId,
            appointment_id: appointment.id,
          },
          created_at: startAt.toISOString(), // Use startAt for consistent date
        }

        const { error: err } = await supabase.from("payments").insert(paymentPayload)
        paymentError = err

        if (paymentError) {
          console.error(
            `❌ Error creating payment for customer ${treatment.customer_external_id}:`,
            formatError(paymentError)
          )
          // Don't fail the whole operation if payment creation fails, appointment is already created
        }
      }

      // Link payment to appointment via appointment_payments table
      if (!paymentError && treatment.price !== null) {
        const { data: payment } = await supabase
          .from("payments")
          .select("id")
          .eq("customer_id", customerId)
          .eq("amount", treatment.price)
          .eq("created_at", startAt.toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (payment) {
          await supabase.from("appointment_payments").insert({
            payment_id: payment.id,
            grooming_appointment_id: appointment.id,
            amount: treatment.price,
          })
        }
      }

      results.created++
      const priceDisplay = treatment.price !== null ? treatment.price : "-"
      console.log(
        `✅ Created appointment${
          treatment.price !== null ? ` and payment: ${priceDisplay}` : " (no payment)"
        } for customer ${treatment.customer_external_id}`
      )
    } catch (error) {
      const errorMsg = formatError(error)
      console.error(`❌ Error processing treatment for customer ${treatment.customer_external_id}:`, errorMsg)
      results.errors.push(`Treatment for customer ${treatment.customer_external_id}: ${errorMsg}`)
    }
  }

  return results
}

/**
 * Load migration data from Excel file into memory
 */
function loadMigrationData(excelPath: string): {
  clients: ClientData[]
  treatments: TreatmentData[]
  uniqueWorkerNames: string[]
} {
  console.log("📊 Loading migration data from Excel...")
  console.log(`   Reading: ${excelPath}`)

  if (!existsSync(excelPath)) {
    throw new Error(`Excel file not found: ${excelPath}`)
  }

  const workbook = XLSX.readFile(excelPath)

  // Process clients sheet
  const clientsSheet = workbook.Sheets["clients"]
  if (!clientsSheet) {
    throw new Error("'clients' sheet not found in Excel file")
  }
  const clientsData = XLSX.utils.sheet_to_json(clientsSheet, { defval: null })

  const clients: ClientData[] = clientsData.map((row: Record<string, unknown>) => {
    const externalId = row["CustomerID"] ? String(row["CustomerID"]).trim() : ""
    const emailValue = row['דוא"ל'] ? String(row['דוא"ל']).trim() : undefined

    // Generate email if missing, based on external_id
    let email = emailValue
    if (!email && externalId) {
      email = `client-${externalId}@migrated.local`
    }

    return {
      full_name: String(row["שם ושם משפחה"] || "").trim() || null,
      phone: String(row["טלפון נייד"] || row["טלפון"] || "").trim() || null,
      email: email,
      customer_type: row["סיווג לקוח"] ? String(row["סיווג לקוח"]).trim() : undefined,
      gender: normalizeGender(row["מין"] as string | null | undefined) || undefined,
      date_of_birth: parseDateOfBirth(row["תאריך לידה"]) || undefined,
      lead_source: row["מקור הגעה"] ? String(row["מקור הגעה"]).trim() : undefined,
      external_id: externalId || `generated-${randomUUID()}`,
      is_banned: String(row["isBlockedMarketingMessages"] || "False").toLowerCase() === "true",
      city: row["עיר"] ? String(row["עיר"]).trim() : undefined,
      notes: row["הערות כרטיס לקוח"] ? String(row["הערות כרטיס לקוח"]).trim() : undefined,
    }
  })

  console.log(`   Loaded ${clients.length} clients (ALL rows from Excel, no filtering)`)

  // Process treatments sheet
  const treatmentsSheet = workbook.Sheets["treatments"]
  if (!treatmentsSheet) {
    throw new Error("'treatments' sheet not found in Excel file")
  }
  const treatmentsData = XLSX.utils.sheet_to_json(treatmentsSheet, { defval: null })

  const treatments: TreatmentData[] = treatmentsData
    .map((row: Record<string, unknown>) => {
      const excelDate = typeof row["ת. עריכת חשבון"] === "number" ? row["ת. עריכת חשבון"] : null
      const treatmentDate = excelDateToISO(excelDate)

      if (!treatmentDate || !row["CustomerId"]) {
        return null
      }

      // Parse price - distinguish between 0 and null/empty
      const priceValue = row["מ.מעודכן"]
      let price: number | null = null
      if (priceValue !== null && priceValue !== undefined && priceValue !== "") {
        const parsed = parseFloat(String(priceValue))
        if (!isNaN(parsed)) {
          price = parsed // This can be 0, which is valid
        }
      }

      return {
        customer_external_id: String(row["CustomerId"]).trim(),
        treatment_date: treatmentDate,
        treatment_name: row["טיפול"] ? String(row["טיפול"]).trim() : "",
        worker_name: row["שם המטפל"] ? String(row["שם המטפל"]).trim() : "",
        price: price,
      }
    })
    .filter((t): t is TreatmentData => t !== null) // Accept all treatments, even with price 0

  console.log(`   Loaded ${treatments.length} treatments (from ${treatmentsData.length} total rows)`)

  // Extract unique worker names from treatments
  const uniqueWorkerNames = extractUniqueWorkerNames(treatments)
  console.log(`   Found ${uniqueWorkerNames.length} unique workers in treatments`)

  return { clients, treatments, uniqueWorkerNames }
}

/**
 * Run migration - process all data in memory
 * Priority: First create workers, then create clients with treatments, then create appointments, then create remaining clients
 */
async function runMigration(
  clients: ClientData[],
  treatments: TreatmentData[],
  uniqueWorkerNames: string[]
): Promise<void> {
  console.log("🚀 Starting migration...")
  console.log(`   Connecting to: ${SUPABASE_URL}`)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Test connection
  const { error: healthError } = await supabase.from("customers").select("id").limit(1)
  if (healthError) {
    throw new Error(`Cannot connect to Supabase: ${formatError(healthError)}`)
  }

  console.log("✅ Connected to Supabase")
  console.log("")

  // Step 0: Create workers first (before everything else)
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("STEP 0: Creating workers...")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("")
  const workerResults = await createWorkers(supabase, uniqueWorkerNames)

  console.log(`✅ Workers: ${workerResults.created} created, ${workerResults.errors.length} errors`)
  if (workerResults.errors.length > 0) {
    console.log(`   First 10 errors:`)
    workerResults.errors.slice(0, 10).forEach((err) => {
      console.log(`      - ${err}`)
    })
    if (workerResults.errors.length > 10) {
      console.log(`      ... and ${workerResults.errors.length - 10} more errors`)
    }
  }
  console.log("")

  // Wait for user approval before continuing
  await waitForApproval()

  // Step 1: Extract unique customer external IDs from treatments
  const customerIdsWithTreatments = new Set(
    treatments.map((t) => t.customer_external_id).filter((id) => id && id.trim())
  )
  console.log(`📊 Found ${customerIdsWithTreatments.size} unique customers with treatments`)
  console.log("")

  // Step 2: Separate clients into two groups: those with treatments (priority) and those without
  const clientsWithTreatments: ClientData[] = []
  const clientsWithoutTreatments: ClientData[] = []

  for (const client of clients) {
    if (customerIdsWithTreatments.has(client.external_id)) {
      clientsWithTreatments.push(client)
    } else {
      clientsWithoutTreatments.push(client)
    }
  }

  console.log(`👥 Processing clients in priority order:`)
  console.log(`   Priority clients (with treatments): ${clientsWithTreatments.length}`)
  console.log(`   Other clients (without treatments): ${clientsWithoutTreatments.length}`)
  console.log("")

  // Step 3: Process priority clients first (those with treatments)
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("STEP 1: Creating priority clients (those with treatments)...")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("")
  const priorityClientResults = await processClientBatch(supabase, clientsWithTreatments)

  console.log(
    `✅ Priority Clients: ${priorityClientResults.created} created, ${priorityClientResults.errors.length} errors`
  )
  if (priorityClientResults.errors.length > 0) {
    console.log(`   First 10 errors:`)
    priorityClientResults.errors.slice(0, 10).forEach((err) => {
      console.log(`      - ${err}`)
    })
    if (priorityClientResults.errors.length > 10) {
      console.log(`      ... and ${priorityClientResults.errors.length - 10} more errors`)
    }
  }
  console.log("")

  // Step 4: Process all treatments (appointments and payments)
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("STEP 2: Creating appointments and payments...")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("")
  const treatmentResults = await processTreatmentBatch(supabase, treatments, workerResults.workerMap)

  console.log(`✅ Appointments/Payments: ${treatmentResults.created} created, ${treatmentResults.errors.length} errors`)
  if (treatmentResults.errors.length > 0) {
    console.log(`   First 10 errors:`)
    treatmentResults.errors.slice(0, 10).forEach((err) => {
      console.log(`      - ${err}`)
    })
    if (treatmentResults.errors.length > 10) {
      console.log(`      ... and ${treatmentResults.errors.length - 10} more errors`)
    }
  }
  console.log("")

  // Step 5: Process remaining clients (those without treatments)
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("STEP 3: Creating remaining clients (without treatments)...")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("")
  const remainingClientResults = await processClientBatch(supabase, clientsWithoutTreatments)

  console.log(
    `✅ Remaining Clients: ${remainingClientResults.created} created, ${remainingClientResults.errors.length} errors`
  )
  if (remainingClientResults.errors.length > 0) {
    console.log(`   First 10 errors:`)
    remainingClientResults.errors.slice(0, 10).forEach((err) => {
      console.log(`      - ${err}`)
    })
    if (remainingClientResults.errors.length > 10) {
      console.log(`      ... and ${remainingClientResults.errors.length - 10} more errors`)
    }
  }
  console.log("")

  // Summary
  const totalClientsCreated = priorityClientResults.created + remainingClientResults.created
  const totalClientErrors = priorityClientResults.errors.length + remainingClientResults.errors.length

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("✅ Migration Complete!")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`Workers: ${workerResults.created} created, ${workerResults.errors.length} errors`)
  console.log(`Total Clients: ${totalClientsCreated} created, ${totalClientErrors} errors`)
  console.log(`  - Priority clients: ${priorityClientResults.created} created`)
  console.log(`  - Remaining clients: ${remainingClientResults.created} created`)
  console.log(`Appointments/Payments: ${treatmentResults.created} created, ${treatmentResults.errors.length} errors`)
  console.log("")
}

/**
 * Main function - runs everything in one go
 */
async function main() {
  const args = process.argv.slice(2)
  const excelPath = args[0] || "tmp/migrations/clients.xlsx"

  try {
    console.log("🚀 Starting complete migration process...")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("")

    // Load all data from Excel into memory
    const { clients, treatments, uniqueWorkerNames } = loadMigrationData(excelPath)
    console.log("")

    // Run migration - process all data
    await runMigration(clients, treatments, uniqueWorkerNames)
  } catch (error) {
    console.error("\n❌ Migration failed:")
    console.error(`   ${formatError(error)}`)
    console.error("\n   Full error details:")
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`)
      if (error.stack) {
        console.error(`   Stack: ${error.stack}`)
      }
    }
    try {
      console.error(`   JSON: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
    } catch {
      console.error(`   Raw: ${String(error)}`)
    }
    process.exit(1)
  }
}

// Run the migration
main().catch((error) => {
  console.error("❌ Unhandled error:", formatError(error))
  try {
    console.error("   Full details:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
  } catch {
    console.error("   Raw error:", String(error))
  }
  process.exit(1)
})
