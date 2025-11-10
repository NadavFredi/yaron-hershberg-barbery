export type ManagerServiceFilter = "grooming" | "garden" | "both"

export interface ManagerStation {
  id: string
  name: string
  serviceType: "grooming" | "garden"
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
  gender?: string
  notes?: string
  medicalNotes?: string
  importantNotes?: string
  internalNotes?: string
  vetName?: string
  vetPhone?: string
  healthIssues?: string
  birthDate?: string
  tendsToBite?: string
  aggressiveWithOtherDogs?: string
  hasBeenToGarden?: boolean
  suitableForGardenFromQuestionnaire?: boolean
  notSuitableForGardenFromQuestionnaire?: boolean
  recordId?: string
  recordNumber?: string
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
  serviceType: "grooming" | "garden"
  stationId: string
  stationName: string
  startDateTime: string
  endDateTime: string
  status: string
  paymentStatus?: string
  notes: string
  internalNotes?: string
  hasCrossServiceAppointment?: boolean
  dogs: ManagerDog[]
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
  gardenTrimNails?: boolean
  gardenBrush?: boolean
  gardenBath?: boolean
  gardenAppointmentType?: "full-day" | "hourly"
  gardenIsTrial?: boolean
  appointmentType?: "private" | "business"
  recordId?: string
  recordNumber?: string
  isPersonalAppointment?: boolean
  personalAppointmentDescription?: string
  groupAppointmentId?: string
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
  proposedLinkedDogId?: string
  proposedOriginalStart?: string
  proposedOriginalEnd?: string
}

export interface ManagerScheduleData {
  date: string
  serviceFilter: ManagerServiceFilter
  stations: ManagerStation[]
  appointments: ManagerAppointment[]
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

export interface ManagerScheduleDogSearchResult {
  dog: ManagerDog
  owner?: ManagerScheduleSearchClient
}

export interface ManagerScheduleSearchResponse {
  appointments: ManagerAppointment[]
  dogs: ManagerScheduleDogSearchResult[]
  clients: ManagerScheduleSearchClient[]
}
