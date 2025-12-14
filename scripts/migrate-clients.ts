#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"
import XLSX from "xlsx"
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs"
import { randomUUID } from "crypto"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://localhost:54321"
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

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
      jsDate.setDate(jsDate.getDate() - 1)
    }

    // Return ISO date string (YYYY-MM-DD)
    const year = jsDate.getFullYear()
    const month = String(jsDate.getMonth() + 1).padStart(2, "0")
    const day = String(jsDate.getDate()).padStart(2, "0")
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
  full_name: string
  phone: string
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
  price: number
}

interface MigrationBatch {
  clients?: ClientData[]
  treatments?: TreatmentData[]
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
      // Check if customer already exists by external_id
      if (client.external_id) {
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("external_id", client.external_id)
          .maybeSingle()

        if (existingCustomer) {
          console.log(`⏭️  Customer with external_id ${client.external_id} already exists, skipping`)
          continue
        }
      }

      // Normalize phone
      const normalizedPhone = normalizePhone(client.phone)
      if (!normalizedPhone || normalizedPhone.length < 9 || normalizedPhone.length > 15) {
        results.errors.push(`Client ${client.full_name}: Invalid phone number ${client.phone}`)
        continue
      }

      // Check if customer exists by phone
      const { data: existingByPhone } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", normalizedPhone)
        .maybeSingle()

      if (existingByPhone) {
        console.log(`⏭️  Customer with phone ${normalizedPhone} already exists, skipping`)
        continue
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

      // Create auth user
      const phoneForAuth = `+${normalizedPhone}`
      const password = randomUUID() // Random password, user will need to reset

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
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
        console.error(`❌ Error creating auth user for ${client.full_name}:`, formatError(authError))
        results.errors.push(`Client ${client.full_name}: Failed to create auth user - ${formatError(authError)}`)
        continue
      }

      // Create customer record
      const phoneSearch = normalizedPhone
      const customerPayload: Record<string, unknown> = {
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
        console.error(`❌ Error creating customer for ${client.full_name}:`, formatError(customerError))
        // Try to clean up auth user
        await supabase.auth.admin.deleteUser(authData.user.id)
        results.errors.push(`Client ${client.full_name}: Failed to create customer - ${formatError(customerError)}`)
        continue
      }

      // Create profile
      const profilePayload: Record<string, unknown> = {
        id: authData.user.id,
        full_name: client.full_name.trim(),
        phone_number: normalizedPhone,
        client_id: customerData.id,
        role: "client",
      }

      if (client.email) {
        profilePayload.email = client.email.trim()
      }

      const { error: profileError } = await supabase.from("profiles").insert(profilePayload)

      if (profileError) {
        console.error(`❌ Error creating profile for ${client.full_name}:`, formatError(profileError))
        // Don't fail the whole operation, but log it
      }

      results.created++
      console.log(`✅ Created client: ${client.full_name} (${customerData.id})`)
    } catch (error) {
      const errorMsg = formatError(error)
      console.error(`❌ Error processing client ${client.full_name}:`, errorMsg)
      results.errors.push(`Client ${client.full_name}: ${errorMsg}`)
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
  treatments: TreatmentData[]
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

      // Find worker by name
      let workerId: string | null = null
      if (treatment.worker_name && treatment.worker_name.trim()) {
        const { data: worker } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "worker")
          .ilike("full_name", treatment.worker_name.trim())
          .maybeSingle()

        if (worker) {
          workerId = worker.id
        } else {
          console.warn(`⚠️  Worker not found: ${treatment.worker_name}`)
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
        results.errors.push(
          `Treatment for customer ${treatment.customer_external_id}: Invalid date ${treatment.treatment_date}`
        )
        continue
      }

      // Create payment record
      const paymentPayload: Record<string, unknown> = {
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

      const { error: paymentError } = await supabase.from("payments").insert(paymentPayload)

      if (paymentError) {
        console.error(
          `❌ Error creating payment for customer ${treatment.customer_external_id}:`,
          formatError(paymentError)
        )
        results.errors.push(`Treatment for customer ${treatment.customer_external_id}: ${formatError(paymentError)}`)
        continue
      }

      results.created++
      console.log(`✅ Created payment: ${treatment.price} for customer ${treatment.customer_external_id}`)
    } catch (error) {
      const errorMsg = formatError(error)
      console.error(`❌ Error processing treatment for customer ${treatment.customer_external_id}:`, errorMsg)
      results.errors.push(`Treatment for customer ${treatment.customer_external_id}: ${errorMsg}`)
    }
  }

  return results
}

/**
 * Prepare migration data from Excel file
 */
function prepareMigrationData(excelPath: string, outputDir: string): void {
  console.log("📊 Preparing migration data...")
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

  const clients: ClientData[] = clientsData
    .map((row: Record<string, unknown>) => ({
      full_name: String(row["שם ושם משפחה"] || "").trim(),
      phone: String(row["טלפון נייד"] || row["טלפון"] || "").trim(),
      email: row['דוא"ל'] ? String(row['דוא"ל']).trim() : undefined,
      customer_type: row["סיווג לקוח"] ? String(row["סיווג לקוח"]).trim() : undefined,
      gender: normalizeGender(row["מין"] as string | null | undefined) || undefined,
      date_of_birth: parseDateOfBirth(row["תאריך לידה"]) || undefined,
      lead_source: row["מקור הגעה"] ? String(row["מקור הגעה"]).trim() : undefined,
      external_id: row["CustomerID"] ? String(row["CustomerID"]).trim() : "",
      is_banned: String(row["isBlockedMarketingMessages"] || "False").toLowerCase() === "true",
      city: row["עיר"] ? String(row["עיר"]).trim() : undefined,
      notes: row["הערות כרטיס לקוח"] ? String(row["הערות כרטיס לקוח"]).trim() : undefined,
    }))
    .filter((c) => c.full_name && c.phone && c.external_id)

  console.log(`   Processed ${clients.length} valid clients`)

  // Process treatments sheet
  const treatmentsSheet = workbook.Sheets["treatments"]
  if (!treatmentsSheet) {
    throw new Error("'treatments' sheet not found in Excel file")
  }
  const treatmentsData = XLSX.utils.sheet_to_json(treatmentsSheet, { defval: null })

  const treatments: TreatmentData[] = treatmentsData
    .map((row: Record<string, unknown>) => {
      const excelDate = row["ת. עריכת חשבון"]
      const treatmentDate = excelDateToISO(excelDate)

      if (!treatmentDate || !row["CustomerId"]) {
        return null
      }

      return {
        customer_external_id: String(row["CustomerId"]).trim(),
        treatment_date: treatmentDate,
        treatment_name: row["טיפול"] ? String(row["טיפול"]).trim() : "",
        worker_name: row["שם המטפל"] ? String(row["שם המטפל"]).trim() : "",
        price: parseFloat(String(row["מ.מעודכן"] || 0)) || 0,
      }
    })
    .filter((t): t is TreatmentData => t !== null && t.price > 0)

  console.log(`   Processed ${treatments.length} valid treatments`)

  // Create output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  // Save batches (100 clients per batch, 1000 treatments per batch)
  const clientsBatches: ClientData[][] = []
  for (let i = 0; i < clients.length; i += 100) {
    clientsBatches.push(clients.slice(i, i + 100))
  }

  const treatmentsBatches: TreatmentData[][] = []
  for (let i = 0; i < treatments.length; i += 1000) {
    treatmentsBatches.push(treatments.slice(i, i + 1000))
  }

  // Save client batches
  clientsBatches.forEach((batch, index) => {
    const filename = `${outputDir}/clients-batch-${index + 1}.json`
    writeFileSync(filename, JSON.stringify(batch, null, 2))
    console.log(`   Saved: ${filename} (${batch.length} clients)`)
  })

  // Save treatment batches
  treatmentsBatches.forEach((batch, index) => {
    const filename = `${outputDir}/treatments-batch-${index + 1}.json`
    writeFileSync(filename, JSON.stringify(batch, null, 2))
    console.log(`   Saved: ${filename} (${batch.length} treatments)`)
  })

  // Create sample batch for testing
  const sampleBatch: MigrationBatch = {
    clients: clients.slice(0, 5),
    treatments: treatments
      .filter((t) => clients.slice(0, 5).some((c) => c.external_id === t.customer_external_id))
      .slice(0, 10),
  }

  writeFileSync(`${outputDir}/sample-batch.json`, JSON.stringify(sampleBatch, null, 2))
  console.log(`   Saved: ${outputDir}/sample-batch.json`)

  console.log(`✅ Preparation complete!`)
  console.log(`   ${clientsBatches.length} client batches`)
  console.log(`   ${treatmentsBatches.length} treatment batches`)
}

/**
 * Run migration from batch files
 */
async function runMigration(batchDir: string): Promise<void> {
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

  let totalClientsCreated = 0
  let totalClientsErrors = 0
  let totalTreatmentsCreated = 0
  let totalTreatmentsErrors = 0

  // Process client batches
  const clientBatchFiles = readdirSync(batchDir)
    .filter((f) => f.startsWith("clients-batch-") && f.endsWith(".json"))
    .sort()

  if (clientBatchFiles.length > 0) {
    console.log(`👥 Processing ${clientBatchFiles.length} client batches...`)
    console.log("")

    for (let i = 0; i < clientBatchFiles.length; i++) {
      const batchFile = clientBatchFiles[i]
      console.log(`[${i + 1}/${clientBatchFiles.length}] Processing ${batchFile}...`)

      const batchContent = readFileSync(`${batchDir}/${batchFile}`, "utf-8")
      const clients: ClientData[] = JSON.parse(batchContent)

      const results = await processClientBatch(supabase, clients)
      totalClientsCreated += results.created
      totalClientsErrors += results.errors.length

      if (results.errors.length > 0) {
        console.log(`   ⚠️  ${results.errors.length} errors in this batch`)
        results.errors.slice(0, 5).forEach((err) => {
          console.log(`      - ${err}`)
        })
        if (results.errors.length > 5) {
          console.log(`      ... and ${results.errors.length - 5} more`)
        }
      }

      console.log(`   ✅ Created ${results.created} clients`)
      console.log("")
    }
  }

  // Process treatment batches
  const treatmentBatchFiles = readdirSync(batchDir)
    .filter((f) => f.startsWith("treatments-batch-") && f.endsWith(".json"))
    .sort()

  if (treatmentBatchFiles.length > 0) {
    console.log(`💊 Processing ${treatmentBatchFiles.length} treatment batches...`)
    console.log("")

    for (let i = 0; i < treatmentBatchFiles.length; i++) {
      const batchFile = treatmentBatchFiles[i]
      console.log(`[${i + 1}/${treatmentBatchFiles.length}] Processing ${batchFile}...`)

      const batchContent = readFileSync(`${batchDir}/${batchFile}`, "utf-8")
      const treatments: TreatmentData[] = JSON.parse(batchContent)

      const results = await processTreatmentBatch(supabase, treatments)
      totalTreatmentsCreated += results.created
      totalTreatmentsErrors += results.errors.length

      if (results.errors.length > 0) {
        console.log(`   ⚠️  ${results.errors.length} errors in this batch`)
        results.errors.slice(0, 5).forEach((err) => {
          console.log(`      - ${err}`)
        })
        if (results.errors.length > 5) {
          console.log(`      ... and ${results.errors.length - 5} more`)
        }
      }

      console.log(`   ✅ Created ${results.created} payments`)
      console.log("")
    }
  }

  // Summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("✅ Migration Complete!")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`Clients: ${totalClientsCreated} created, ${totalClientsErrors} errors`)
  console.log(`Treatments: ${totalTreatmentsCreated} created, ${totalTreatmentsErrors} errors`)
  console.log("")
}

/**
 * Main function - runs everything in one go
 */
async function main() {
  const args = process.argv.slice(2)
  const excelPath = args[0] || "tmp/migrations/clients.xlsx"
  const batchDir = args[1] || "tmp/migrations/batches"

  try {
    console.log("🚀 Starting complete migration process...")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("")

    // Step 1: Prepare migration data
    console.log("📊 Step 1: Preparing migration data from Excel...")
    prepareMigrationData(excelPath, batchDir)
    console.log("")

    // Step 2: Run migration
    console.log("💾 Step 2: Running migration...")
    await runMigration(batchDir)
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
