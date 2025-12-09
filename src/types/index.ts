export interface User {
  id: string
  email: string
  fullName: string
  phone: string
  role: "לקוח" | "מנהל"
}

export interface Station {
  id: string
  name: string
  isActive: boolean
  breakBetweenAppointments: number // דקות
  googleCalendarId?: string
}

export interface Service {
  id: string
  name: string
  description?: string
}

export interface ServiceStationMatrix {
  id: string
  serviceId: string
  stationId: string
  baseTimeMinutes: number
  price: number
}

export interface ClientProfile {
  id: string
  userId: string
  clientNotes: string
}

export interface RecurringAppointment {
  id: string
  customerId: string
  serviceId: string
  frequency: "שבועי" | "דו-שבועי" | "חודשי"
  startDate: Date
  numberOfAppointments: number
}

export interface Appointment {
  id: string
  customerId: string
  serviceId: string
  stationId: string
  startTime: Date
  endTime: Date
  actualDuration?: number
  status: "מאושר" | "ממתין" | "בוטל" | "הושלם"
  customerName: string
  customerPhone: string
  serviceName: string
  stationName: string
  internalNotes?: string
  recurringAppointmentId?: string
}

export interface AdminAvailability {
  id: string
  dayOfWeek: number // 1=ראשון... 6=שישי
  startTime: string
  endTime: string
  isActive: boolean
}

export interface BookingStep {
  serviceId: string
  selectedDate?: Date
  selectedTime?: string
  customerName?: string
  customerPhone?: string
}
