
export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'לקוח' | 'מנהל';
}

export interface Treatment {
  id: string;
  name: string;
  treatmentTypeId: string;
  ownerId: string;
  specialNotes?: string;
  groomingMinPrice?: number | null;
  groomingMaxPrice?: number | null;
}

export interface TreatmentType {
  id: string;
  name: string;
  created_at?: string;
  airtable_id?: string | null;
  size_class?: string | null;
  min_groom_price?: number | null;
  max_groom_price?: number | null;
}

export interface Station {
  id: string;
  name: string;
  isActive: boolean;
  breakBetweenAppointments: number; // דקות
  googleCalendarId?: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
}

export interface ServiceStationMatrix {
  id: string;
  serviceId: string;
  stationId: string;
  baseTimeMinutes: number;
  price: number;
}

export interface TreatmentTypeModifier {
  id: string;
  treatmentTypeId: string;
  serviceId: string;
  timeModifierMinutes: number; // יכול להיות חיובי או שלילי
}

export interface ClientProfile {
  id: string;
  userId: string;
  clientNotes: string;
  treatmentNotes: string;
}

export interface RecurringAppointment {
  id: string;
  customerId: string;
  treatmentId: string;
  serviceId: string;
  frequency: 'שבועי' | 'דו-שבועי' | 'חודשי';
  startDate: Date;
  numberOfAppointments: number;
}

export interface TimeMatrix {
  id: string;
  serviceId: string;
  treatmentTypeId: string;
  stationId: string;
  durationMinutes: number;
}

export interface Appointment {
  id: string;
  customerId: string;
  treatmentId: string;
  serviceId: string;
  stationId: string;
  startTime: Date;
  endTime: Date;
  actualDuration?: number;
  status: 'מאושר' | 'ממתין' | 'בוטל' | 'הושלם';
  customerName: string;
  customerPhone: string;
  treatmentName: string;
  serviceName: string;
  stationName: string;
  internalNotes?: string;
  recurringAppointmentId?: string;
}

export interface AdminAvailability {
  id: string;
  dayOfWeek: number; // 1=ראשון... 6=שישי
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface BookingStep {
  serviceId: string;
  treatmentTypeId: string;
  selectedDate?: Date;
  selectedTime?: string;
  customerName?: string;
  customerPhone?: string;
  treatmentName?: string;
}

export interface WaitingListEntry {
  id: string;
  treatmentId: string | null;
  treatmentName: string | null;
  serviceType: string | null;
  status: string | null;
  notes?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dateRanges: Array<{ startDate: string; endDate: string }>;
  createdAt: string;
  updatedAt?: string;
}
