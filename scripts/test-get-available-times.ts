#!/usr/bin/env -S deno run --allow-net --allow-env

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321"
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "your-anon-key"

async function testGetAvailableTimes() {
  console.log("🧪 Testing Updated Get Available Times Function...")
  console.log("==================================================")

  try {
    // Test data - you'll need to provide a valid dogId
    const testData = {
      dogId: "test-dog-id", // Replace with actual dog ID from your system
      daysAhead: 45, // Test with 45 days ahead
    }

    console.log("📝 Test data:", testData)

    // Call the get-available-times edge function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-available-times`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(testData),
    })

    const result = await response.json()
    console.log("📡 Response status:", response.status)
    console.log("📡 Response body:", JSON.stringify(result, null, 2))

    if (response.ok && result.success) {
      console.log("✅ Function call successful!")
      console.log("📅 Available dates count:", result.data.availableDates.length)

      if (result.data.availableDates.length > 0) {
        console.log("📅 First available date:", result.data.availableDates[0].date)
        console.log("📅 Last available date:", result.data.availableDates[result.data.availableDates.length - 1].date)

        // Check if we have dates spanning multiple months
        const dates = result.data.availableDates.map((d) => new Date(d.date))
        const uniqueMonths = new Set(dates.map((d) => `${d.getFullYear()}-${d.getMonth() + 1}`))
        console.log("📅 Months covered:", Array.from(uniqueMonths).sort())

        // Check the date range
        const firstDate = new Date(Math.min(...dates.map((d) => d.getTime())))
        const lastDate = new Date(Math.max(...dates.map((d) => d.getTime())))
        const daysSpan = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
        console.log("📅 Date span in days:", daysSpan)

        if (daysSpan >= 30) {
          console.log("✅ SUCCESS: Function returns dates spanning 30+ days!")
        } else {
          console.log("⚠️  WARNING: Function returns dates spanning less than 30 days")
        }
      } else {
        console.log("⚠️  No available dates returned")
      }
    } else {
      console.log("❌ Function call failed:", result.error)
    }
  } catch (error) {
    console.error("💥 Test error:", error)
  }
}

// Run the test
if (import.meta.main) {
  await testGetAvailableTimes()
}
