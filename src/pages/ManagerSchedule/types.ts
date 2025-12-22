export type ManagerServiceFilter = "grooming"

export interface ManagerStation {
  id: string
  name: string
  serviceType: "grooming"
  color?: string
  isActive: boolean
  displayOrder?: number
}

export interface ManagerDog {
  id: string
  name: string
  breed?: string
  ownerId?: string
  clientClassification?: string
  clientName?: string
  minGroomingPrice?: number
  maxGroomingPrice?: number
}

export interface ProposedMeetingInvite {
  id: string
  customerId: string
  customerName?: string
  customerTypeId?: string | null
  customerTypeName?: string | null
  clientClassification?: string | null
  clientPhone?: string | null
  clientEmail?: string | null
  source: "manual" | "category"
  sourceCategoryId?: string | null
  lastNotifiedAt?: string | null
  notificationCount?: number
  lastWebhookStatus?: string | null
}

export interface ProposedMeetingCategory {
  id: string
  customerTypeId: string
  customerTypeName?: string | null
}

export interface ManagerAppointment {
  id: string
  serviceType: "grooming"
  stationId: string
  stationName: string
  startDateTime: string
  endDateTime: string
  status: string
  paymentStatus?: string
  notes: string
  internalNotes?: string
  groomingNotes?: string
  hasCrossServiceAppointment?: boolean
  dogs: []
  serviceName?: string
  subscriptionName?: string
  clientId?: string
  clientName?: string
  clientClassification?: string
  clientEmail?: string
  clientPhone?: string
  durationMinutes?: number
  latePickupRequested?: boolean
  latePickupNotes?: string
  appointmentType?: "private" | "business"
  recordId?: string
  recordNumber?: string
  isPersonalAppointment?: boolean
  personalAppointmentDescription?: string
  groupAppointmentId?: string
  seriesId?: string
  price?: number
  isProposedMeeting?: boolean
  proposedMeetingId?: string
  proposedMeetingCode?: string
  proposedStatus?: string
  proposedTitle?: string
  proposedSummary?: string
  proposedNotes?: string
  proposedCreatedAt?: string
  proposedInvites?: ProposedMeetingInvite[]
  proposedCategories?: ProposedMeetingCategory[]
  proposedLinkedAppointmentId?: string
  proposedLinkedCustomerId?: string
  proposedOriginalStart?: string
  proposedOriginalEnd?: string
  clientApprovedArrival?: string | null
  managerApprovedArrival?: string | null
  treatmentStartedAt?: string | null
  treatmentEndedAt?: string | null
  serviceCategoryVariant?: string | null
  workerId?: string
  workerName?: string
}

export interface ManagerScheduleData {
  date: string
  serviceFilter: ManagerServiceFilter
  stations: ManagerStation[]
  appointments: ManagerAppointment[]
  businessHours?: {
    openTime: string // HH:mm format
    closeTime: string // HH:mm format
  }
  calendarWindowHours?: {
    startTime: string // HH:mm format
    endTime: string // HH:mm format
  }
}

export interface ManagerScheduleSearchClient {
  id: string
  name: string
  classification?: string
  customerTypeName?: string
  phone?: string
  email?: string
  address?: string
}

export interface ManagerScheduleSearchResponse {
  appointments: ManagerAppointment[]
  dogs: []
  clients: ManagerScheduleSearchClient[]
}

// Types extracted from ManagerSchedule.tsx
export type DragToCreateState = {
  isDragging: boolean
  startTime: Date | null
  endTime: Date | null
  stationId: string | null
  startY: number | null
  cancelled: boolean
}

export type ResizeState = {
  appointment: ManagerAppointment
  startY: number
  startDate: Date
  initialEnd: Date
  currentEnd: Date
  pointerId: number
}

export type ConstraintResizeState = {
  constraint: {
    id: string
    station_id: string
    start_at: string
    end_at: string
    reason?: string | null
    notes?: string | null
  }
  startY: number
  startDate: Date
  initialEnd: Date
  currentEnd: Date
  pointerId: number
}

export type WaitlistServiceScope = "grooming"

export interface ManagerWaitlistEntry {
  id: string
  customerId: string
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  customerTypeId?: string | null
  customerTypeName?: string | null
  serviceScope: WaitlistServiceScope
  startDate: string
  endDate: string | null
  notes?: string | null
}

export type WaitlistBucketGroup = {
  id: string
  label: string
  entries: ManagerWaitlistEntry[]
}

export type ScheduleSearchResultType = "client" | "personal" | "appointment"

export type ScheduleSearchEntry = {
  id: string
  appointment?: ManagerAppointment
  ownerName?: string
  stationName?: string
  serviceType: ManagerAppointment["serviceType"]
  serviceLabel: string
  appointmentDate?: Date | null
  dateLabel: string
  timeLabel?: string
  entityType: ScheduleSearchResultType
  clientName?: string
  clientDetails?: ClientDetails
  searchText: string
}

export interface ClientDetails {
  name: string
  classification?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  preferences?: string
  recordId?: string
  recordNumber?: string
}
