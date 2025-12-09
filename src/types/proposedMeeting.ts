export interface ProposedMeetingPublicInvite {
  id: string
  customerId?: string | null
  customerName?: string | null
  source: "manual" | "category"
  sourceCategoryId?: string | null
}

export interface ProposedMeetingPublicCategory {
  id: string
  customerTypeId: string
  customerTypeName?: string | null
}

export interface ProposedMeetingPublicDetails {
  id: string
  title?: string | null
  summary?: string | null
  notes?: string | null
  status: string
  serviceType: "grooming"
  startAt: string
  endAt: string
  stationId?: string | null
  stationName?: string | null
  invites: ProposedMeetingPublicInvite[]
  categories: ProposedMeetingPublicCategory[]
  rescheduleAppointmentId?: string | null
  rescheduleCustomerId?: string | null
  rescheduleOriginalStartAt?: string | null
  rescheduleOriginalEndAt?: string | null
}
