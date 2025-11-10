import Airtable from "airtable"

// Airtable configuration - will be loaded when functions are called
function getAirtableConfig() {
  // Use direct environment variable access for browser compatibility
  const AIRTABLE_PAT = typeof window !== "undefined" ? import.meta.env.VITE_AIRTABLE_PAT : process.env.VITE_AIRTABLE_PAT
  const AIRTABLE_BASE_ID =
    typeof window !== "undefined" ? import.meta.env.VITE_AIRTABLE_BASE_ID : process.env.VITE_AIRTABLE_BASE_ID

  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    throw new Error(
      "Missing Airtable configuration. Please set VITE_AIRTABLE_PAT and VITE_AIRTABLE_BASE_ID environment variables."
    )
  }

  return { AIRTABLE_PAT, AIRTABLE_BASE_ID }
}

// Initialize Airtable with Personal Access Token
function getAirtableClient() {
  const { AIRTABLE_PAT } = getAirtableConfig()
  return new Airtable({
    apiKey: AIRTABLE_PAT,
  })
}

/**
 * Lists all tables in the specified Airtable base
 * @returns Promise<void> - Logs table information to console
 */
export async function listAllTables(): Promise<void> {
  try {
    const { AIRTABLE_PAT, AIRTABLE_BASE_ID } = getAirtableConfig()
    const airtable = getAirtableClient()

    console.log("🔍 Fetching tables from Airtable base:", AIRTABLE_BASE_ID)

    // Get the base
    const base = airtable.base(AIRTABLE_BASE_ID)

    // Use the Airtable Metadata API to get table information
    console.log("📊 Fetching table metadata from Airtable API...")

    try {
      // Check if fetch is available (for browser compatibility)
      if (typeof fetch === "undefined") {
        console.log("⚠️ Fetch API not available, using fallback method...")
        await tryCommonTableNames(base)
        return
      }

      const response = await fetch(`https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`📊 Found ${data.tables?.length || 0} tables in your Airtable base:`)
        console.log("=".repeat(50))

        if (data.tables && data.tables.length > 0) {
          data.tables.forEach((table: any, index: number) => {
            console.log(`${index + 1}. Table Name: ${table.name}`)
            console.log(`   Table ID: ${table.id}`)
            console.log(`   Description: ${table.description || "No description"}`)
            console.log(`   Primary Field: ${table.primaryField?.name || "Unknown"}`)
            console.log(`   Fields Count: ${table.fields?.length || 0}`)

            if (table.fields && table.fields.length > 0) {
              console.log("   Fields:")
              table.fields.forEach((field: any) => {
                console.log(`     - ${field.name} (${field.type})`)
              })
            }

            console.log("---")
          })
        } else {
          console.log("ℹ️ No tables found or accessible with current permissions")
        }

        console.log("✅ Table listing completed successfully!")
      } else {
        console.log(`⚠️ Metadata API returned status: ${response.status}`)
        console.log("ℹ️ This might be due to permissions or the table structure")

        // Fallback: try to access some common table names
        console.log("🔄 Trying fallback method with common table names...")
        await tryCommonTableNames(base)
      }
    } catch (apiError) {
      console.log("⚠️ Metadata API call failed, trying fallback method...")
      await tryCommonTableNames(base)
    }
  } catch (error) {
    console.error("❌ Error fetching tables from Airtable:", error)

    if (error instanceof Error) {
      console.error("Error details:", error.message)

      // Handle specific Airtable errors
      if (error.message.includes("401")) {
        console.error("Authentication failed. Please check your AIRTABLE_PAT.")
      } else if (error.message.includes("404")) {
        console.error("Base not found. Please check your AIRTABLE_BASE_ID.")
      } else if (error.message.includes("403")) {
        console.error("Access denied. Please check your permissions for this base.")
      }
    }
  }
}

async function tryCommonTableNames(base: any): Promise<void> {
  const commonNames = [
    "Clients",
    "Appointments",
    "Services",
    "Staff",
    "Stations",
    "Availability",
    "Bookings",
    "Customers",
    "Schedule",
    "Calendar",
  ]

  console.log("🔍 Testing common table names...")

  for (const tableName of commonNames) {
    try {
      const table = base.table(tableName)
      await table.select({ maxRecords: 1 }).firstPage()
      console.log(`✅ Successfully connected to '${tableName}' table`)
    } catch (tableError) {
      console.log(`ℹ️ '${tableName}' table not found or not accessible`)
    }
  }

  console.log("✅ Fallback table testing completed!")
}

/**
 * Gets a specific table by name
 * @param tableName - The name of the table to retrieve
 * @returns Promise<Airtable.Table | null>
 */
export async function getTable(tableName: string): Promise<Airtable.Table<any> | null> {
  try {
    const { AIRTABLE_BASE_ID } = getAirtableConfig()
    const airtable = getAirtableClient()

    const base = airtable.base(AIRTABLE_BASE_ID)
    const table = base.table(tableName)

    // Verify the table exists by trying to access it
    await table.select({ maxRecords: 1 }).firstPage()

    return table
  } catch (error) {
    console.error(`Error getting table "${tableName}":`, error)
    return null
  }
}

/**
 * Lists records from a specific table
 * @param tableName - The name of the table
 * @param limit - Maximum number of records to fetch (default: 10)
 * @returns Promise<void> - Logs record information to console
 */
export async function listTableRecords(tableName: string, limit: number = 10): Promise<void> {
  try {
    const table = await getTable(tableName)

    if (!table) {
      console.error(`Table "${tableName}" not found or not accessible.`)
      return
    }

    console.log(`📋 Fetching records from table: ${tableName}`)

    const records = await table
      .select({
        maxRecords: limit,
        view: "Grid view",
      })
      .all()

    console.log(`📊 Found ${records.length} records in table "${tableName}":`)
    console.log("=".repeat(50))

    records.forEach((record, index) => {
      console.log(`Record ${index + 1}:`)
      console.log(`  ID: ${record.id}`)
      console.log(`  Created: ${record._rawJson.createdTime}`)

      // Log all fields and their values
      Object.entries(record.fields).forEach(([fieldName, value]) => {
        console.log(`  ${fieldName}: ${JSON.stringify(value)}`)
      })

      console.log("---")
    })
  } catch (error) {
    console.error(`Error fetching records from table "${tableName}":`, error)
  }
}

export { getAirtableClient, getAirtableConfig }
