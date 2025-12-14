const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read the Excel file
const workbook = XLSX.readFile('tmp/migrations/clients.xlsx');

// Helper to convert Excel date serial number to ISO date string
// Excel date epoch is 1900-01-01 (but Excel incorrectly treats 1900 as leap year)
// Standard conversion: JS Date = (Excel Serial - 25569) * 86400000
function excelDateToISO(excelSerial) {
  if (!excelSerial || isNaN(excelSerial)) {
    return null;
  }

  try {
    // Excel epoch is 1900-01-01 = 25569 days since Unix epoch (1970-01-01)
    // Multiply by 86400000 milliseconds per day
    const jsDate = new Date((excelSerial - 25569) * 86400 * 1000);

    // Excel incorrectly treats 1900 as a leap year, so subtract 1 day for dates after Feb 28, 1900
    if (excelSerial > 59) {
      jsDate.setDate(jsDate.getDate() - 1);
    }

    // Return ISO date string (YYYY-MM-DD)
    const year = jsDate.getFullYear();
    const month = String(jsDate.getMonth() + 1).padStart(2, '0');
    const day = String(jsDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.warn(`Failed to convert Excel date ${excelSerial}:`, e);
    return null;
  }
}

// Helper to normalize gender
function normalizeGender(gender) {
  if (!gender) return null;
  const lower = String(gender).toLowerCase().trim();
  if (lower === 'זכר' || lower === 'male' || lower === 'm') return 'male';
  if (lower === 'נקבה' || lower === 'female' || lower === 'f') return 'female';
  return null;
}

// Helper to parse date of birth
function parseDateOfBirth(dob) {
  if (!dob) return null;

  // Try to parse as Excel date serial
  if (typeof dob === 'number') {
    const iso = excelDateToISO(dob);
    if (iso) return iso;
  }

  // Try to parse as string date
  if (typeof dob === 'string') {
    const parsed = new Date(dob);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }

  return null;
}

// Process clients sheet
const clientsSheet = workbook.Sheets['clients'];
const clientsData = XLSX.utils.sheet_to_json(clientsSheet, { defval: null });

const clients = clientsData.map(row => ({
  full_name: (row['שם ושם משפחה'] || '').trim(),
  phone: (row['טלפון נייד'] || row['טלפון'] || '').toString().trim(),
  email: row['דוא"ל'] ? String(row['דוא"ל']).trim() : null,
  customer_type: row['סיווג לקוח'] ? String(row['סיווג לקוח']).trim() : null,
  gender: normalizeGender(row['מין']),
  date_of_birth: parseDateOfBirth(row['תאריך לידה']),
  lead_source: row['מקור הגעה'] ? String(row['מקור הגעה']).trim() : null,
  external_id: row['CustomerID'] ? String(row['CustomerID']).trim() : null,
  is_banned: String(row['isBlockedMarketingMessages'] || 'False').toLowerCase() === 'true',
  city: row['עיר'] ? String(row['עיר']).trim() : null,
  notes: row['הערות כרטיס לקוח'] ? String(row['הערות כרטיס לקוח']).trim() : null,
}));

// Filter out invalid clients
const validClients = clients.filter(c => c.full_name && c.phone && c.external_id);

console.log(`Processed ${clients.length} clients, ${validClients.length} valid`);

// Process treatments sheet
const treatmentsSheet = workbook.Sheets['treatments'];
const treatmentsData = XLSX.utils.sheet_to_json(treatmentsSheet, { defval: null });

const treatments = treatmentsData
  .map(row => {
    const excelDate = row['ת. עריכת חשבון'];
    const treatmentDate = excelDateToISO(excelDate);

    if (!treatmentDate || !row['CustomerId']) {
      return null;
    }

    return {
      customer_external_id: String(row['CustomerId']).trim(),
      treatment_date: treatmentDate,
      treatment_name: row['טיפול'] ? String(row['טיפול']).trim() : null,
      worker_name: row['שם המטפל'] ? String(row['שם המטפל']).trim() : null,
      price: parseFloat(row['מ.מעודכן'] || 0) || 0,
    };
  })
  .filter(t => t !== null && t.price > 0);

console.log(`Processed ${treatmentsData.length} treatments, ${treatments.length} valid`);

// Save batches (100 clients per batch, 1000 treatments per batch)
const clientsBatches = [];
for (let i = 0; i < validClients.length; i += 100) {
  clientsBatches.push(validClients.slice(i, i + 100));
}

const treatmentsBatches = [];
for (let i = 0; i < treatments.length; i += 1000) {
  treatmentsBatches.push(treatments.slice(i, i + 1000));
}

// Create output directory
const outputDir = path.join(__dirname, 'batches');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Save client batches
clientsBatches.forEach((batch, index) => {
  const filename = path.join(outputDir, `clients-batch-${index + 1}.json`);
  fs.writeFileSync(filename, JSON.stringify(batch, null, 2));
  console.log(`Saved ${filename} with ${batch.length} clients`);
});

// Save treatment batches
treatmentsBatches.forEach((batch, index) => {
  const filename = path.join(outputDir, `treatments-batch-${index + 1}.json`);
  fs.writeFileSync(filename, JSON.stringify(batch, null, 2));
  console.log(`Saved ${filename} with ${batch.length} treatments`);
});

// Create a sample batch file for testing
const sampleBatch = {
  clients: validClients.slice(0, 5),
  treatments: treatments.filter(t =>
    validClients.slice(0, 5).some(c => c.external_id === t.customer_external_id)
  ).slice(0, 10),
};

fs.writeFileSync(
  path.join(outputDir, 'sample-batch.json'),
  JSON.stringify(sampleBatch, null, 2)
);

console.log(`\n✅ Migration data prepared!`);
console.log(`- ${clientsBatches.length} client batches`);
console.log(`- ${treatmentsBatches.length} treatment batches`);
console.log(`- Sample batch saved for testing`);
