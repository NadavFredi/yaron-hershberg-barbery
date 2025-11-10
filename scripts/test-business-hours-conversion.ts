// Test the business hours conversion logic
function testBusinessHoursConversion() {
  console.log("🧪 Testing business hours conversion logic...")

  // Test case: UTC time 06:00:00.000Z should become 09:00 Jerusalem time
  const utcTime = "2025-08-17T06:00:00.000Z"
  console.log(`\nInput UTC time: ${utcTime}`)

  const date = new Date(utcTime)
  console.log(`Parsed date: ${date.toISOString()}`)
  console.log(`UTC hours: ${date.getUTCHours()}`)
  console.log(`UTC minutes: ${date.getUTCMinutes()}`)

  // Add 3 hours for Jerusalem time
  const jerusalemHours = date.getUTCHours() + 3
  const jerusalemMinutes = date.getUTCMinutes()

  console.log(`Jerusalem hours (UTC + 3): ${jerusalemHours}`)
  console.log(`Jerusalem minutes: ${jerusalemMinutes}`)

  // Handle day overflow
  const finalHours = jerusalemHours >= 24 ? jerusalemHours - 24 : jerusalemHours

  console.log(`Final hours (after overflow check): ${finalHours}`)

  const result = `${finalHours.toString().padStart(2, "0")}:${jerusalemMinutes.toString().padStart(2, "0")}`
  console.log(`Final result: ${result}`)

  // Expected: 09:00
  console.log(`Expected: 09:00`)
  console.log(`Match: ${result === "09:00" ? "✅" : "❌"}`)
}

testBusinessHoursConversion()
