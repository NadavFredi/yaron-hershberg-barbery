import { Service, Station, ServiceStationMatrix, AdminAvailability, Appointment } from "@/types"

export const services: Service[] = [
  { id: "1", name: "תספורת מלאה", description: "תספורת כוללת עם רחצה וייבוש" },
  { id: "2", name: "רחצה וייבוש", description: "רחצה יסודית עם ייבוש מקצועי" },
  { id: "3", name: "גזיזת ציפורניים", description: "גזיזת ציפורניים מקצועית" },
  { id: "4", name: "תספורת חלקית", description: "עיצוב חלקי של אזורים ספציפיים" },
  { id: "5", name: "טיפוח מלא", description: "חבילת טיפוח מקיפה" },
]

export const stations: Station[] = [
  { id: "1", name: "עמדה 1 - יוסי", isActive: true, breakBetweenAppointments: 15 },
  { id: "2", name: "עמדה 2 - דנה", isActive: true, breakBetweenAppointments: 10 },
  { id: "3", name: "עמדה 3 - מיכל", isActive: false, breakBetweenAppointments: 20 },
]

export const serviceStationMatrix: ServiceStationMatrix[] = [
  // תספורת מלאה
  { id: "1", serviceId: "1", stationId: "1", baseTimeMinutes: 90, price: 120 },
  { id: "2", serviceId: "1", stationId: "2", baseTimeMinutes: 85, price: 115 },
  { id: "3", serviceId: "1", stationId: "3", baseTimeMinutes: 95, price: 130 },

  // רחצה וייבוש
  { id: "4", serviceId: "2", stationId: "1", baseTimeMinutes: 45, price: 60 },
  { id: "5", serviceId: "2", stationId: "2", baseTimeMinutes: 40, price: 55 },
  { id: "6", serviceId: "2", stationId: "3", baseTimeMinutes: 50, price: 65 },

  // גזיזת ציפורניים
  { id: "7", serviceId: "3", stationId: "1", baseTimeMinutes: 15, price: 25 },
  { id: "8", serviceId: "3", stationId: "2", baseTimeMinutes: 12, price: 20 },
  { id: "9", serviceId: "3", stationId: "3", baseTimeMinutes: 18, price: 30 },
]

export const adminAvailability: AdminAvailability[] = [
  { id: "1", dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isActive: true },
  { id: "2", dayOfWeek: 2, startTime: "09:00", endTime: "18:00", isActive: true },
  { id: "3", dayOfWeek: 3, startTime: "09:00", endTime: "18:00", isActive: true },
  { id: "4", dayOfWeek: 4, startTime: "09:00", endTime: "18:00", isActive: true },
  { id: "5", dayOfWeek: 5, startTime: "09:00", endTime: "16:00", isActive: true },
  { id: "6", dayOfWeek: 6, startTime: "09:00", endTime: "14:00", isActive: true },
]

export const appointments: Appointment[] = [
  {
    id: "1",
    customerId: "1",
    serviceId: "1",
    stationId: "1",
    startTime: new Date("2025-01-02T10:00:00"),
    endTime: new Date("2025-01-02T11:30:00"),
    status: "מאושר",
    customerName: "יוסי כהן",
    customerPhone: "052-1234567",
    serviceName: "תספורת מלאה",
    stationName: "עמדה 1 - יוסי",
    internalNotes: "הערות פנימיות",
  },
]

// Legacy exports for backward compatibility
export const timeMatrix = []
