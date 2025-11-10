// supabase/functions/get-available-times/types.ts

/** Generic Airtable Record Structure */
export interface AirtableRecord<T> {
  id: string
  createdTime: string
  fields: T
}

/** Fields for 'כלבים' table */
export interface TreatmentFields {
  שם: string
  גזע: string[] // Array of record IDs from 'גזעים'
  "האם מילא שאלון התאמה לגן"?: boolean
  "האם הכלב היה בגן"?: boolean
}

/** Fields for 'עמדות מול גזעים' table */
export interface TreatmentTypeDurationRuleFields {
  גזע: string[] // Array of record IDs from 'גזעים'
  עמדה: string[] // Array of record IDs from 'עמדות עבודה'
  'סה"כ משך תספורת בשניות'?: number
  'סה"כ משך גן בשניות'?: number
  'סה"כ משך משולב בשניות'?: number
}

/** Fields for 'שעות פעילות' table */
export interface OperatingHoursFields {
  "יום בשבוע": "א" | "ב" | "ג" | "ד" | "ה" | "ו" | "ש"
  "שעת פתיחה": string // ISO DateTime string
  "שעת סגירה": string // ISO DateTime string
}

/** Fields for 'תורים למספרה' table */
export interface AppointmentFields {
  "מועד התור": string // ISO DateTime string
  "מועד סיום התור": string // ISO DateTime string
  עמדה: string[] // Array of record IDs from 'עמדות עבודה'
}

/** Fields for 'אילוצים בעמדות עבודה' table */
export interface ConstraintFields {
  "מועד תחילת ההיעדרות": string // ISO DateTime string
  "מועד סיום ההיעדרות": string // ISO DateTime string
  "עמדת עבודה": string[] // Array of record IDs from 'עמדות עבודה'
}

/** Fields for 'תקרת שיבוצים בגן' table */
export interface GardenCapacityFields {
  "הגבלת שיבוץ לניסיון"?: number
  "הגבלה לשיבוץ רגיל"?: number
}

/** Fields for 'תורים לגן' table */
export interface GardenAppointmentFields {
  "מועד התור": string
  "מועד סיום התור"?: string
  סטטוס?: string
  "סוג פעילות"?: string
  "האם ניסיון"?: boolean
}

/** Simplified internal representation of data for calculation */
export interface Appointment {
  id: string
  stationId: string
  start: Date
  end: Date
}

export interface Constraint {
  id: string
  stationId: string
  start: Date
  end: Date
  /**
   * If true, the constraint represents an availability window (positive constraint).
   * If false or undefined, the constraint blocks availability (negative constraint).
   */
  isPositive?: boolean
}

export interface TimeInterval {
  startMinute: number
  endMinute: number
}

export interface StationWorkingHoursEntry {
  stationId: string
  weekday: number
  intervals: TimeInterval[]
}

export interface StationAvailabilityProfile {
  stationId: string
  name: string
  durationMinutes: number
  breakBetweenAppointments: number
  /**
   * Optional array of customer type IDs that are allowed to book this station.
   * If undefined or empty, the station is available to all customer types.
   */
  allowedCustomerTypeIds?: string[]
  /**
   * When false, remote/self-service booking is not allowed for this station and treatmentType combination.
   */
  remoteBookingAllowed?: boolean
}

export interface GardenCapacityState {
  trialLimit: number
  regularLimit: number
  trialBooked: number
  regularBooked: number
}

export interface Workstation {
  id: string
  name: string
}

export interface TreatmentTypeDurationRule {
  id: string
  treatmentTypeId: string
  stationId: string
  durationInMinutes: number
}

export interface DayOpeningHours {
  open: {
    hour: number // Hour of the day (0-23)
    minute: number // Minute of the hour (0-59)
  }
  close: {
    hour: number // Hour of the day (0-23)
    minute: number // Minute of the hour (0-59)
  }
}

/** Input for the main calculation logic */
export interface CalculationInput {
  year: number
  month: number
  workstations: Workstation[]
  durationRules: TreatmentTypeDurationRule[]
  operatingHours: Record<number, DayOpeningHours> // Map from weekday (0-6) to hours
  appointments: Appointment[]
  constraints: Constraint[]
}

/** Final output structure */
export interface AvailableTime {
  time: string
  available: boolean
  duration: number
  stationId: string
  requiresStaffApproval?: boolean
}

export interface AvailableDate {
  date: string
  available: boolean
  slots: number
  stationId: string // The ID of a station available on this date
  availableTimes: AvailableTime[]
}

export interface GardenQuestionnaireStatus {
  required: boolean
  completed: boolean
  formUrl?: string
  message?: string
}

export interface AvailabilityResponse {
  success: boolean
  mode: "date"
  data: {
    month: number
    year: number
    availableDates: AvailableDate[]
    gardenQuestionnaire?: GardenQuestionnaireStatus
  }
}
