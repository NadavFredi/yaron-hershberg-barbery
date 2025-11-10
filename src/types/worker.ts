export type WorkerStatusAction = "activate" | "deactivate" | "remove"

export interface WorkerSummary {
  id: string
  fullName: string | null
  email: string | null
  phoneNumber: string | null
  isActive: boolean
  createdAt: string | null
  currentShift: WorkerShiftSummary | null
  totals: {
    rangeMinutes: number
    todayMinutes: number
    weekMinutes: number
  }
  recentShifts: WorkerShiftHistoryEntry[]
}

export interface WorkerShiftSummary {
  id: string
  clockIn: string
  durationMinutes: number
}

export interface WorkerShiftHistoryEntry {
  id: string
  clockIn: string
  clockOut: string | null
  durationMinutes: number
}

export interface GetWorkersResponse {
  success: true
  params: {
    includeInactive: boolean
    rangeStart: string
    rangeEnd: string
    recentLimit: number
  }
  workers: WorkerSummary[]
}

export interface RegisterWorkerPayload {
  fullName: string
  phoneNumber: string
  email?: string | null
  password?: string | null
  profileId?: string | null
  sendResetPasswordEmail?: boolean
}

export interface RegisterWorkerResponse {
  success: true
  worker: {
    id: string
    fullName: string | null
    email: string | null
    phoneNumber: string | null
    isActive: boolean
    createdAt: string | null
  }
  createdNewUser: boolean
}

export interface UpdateWorkerStatusPayload {
  workerId: string
  action: WorkerStatusAction
}

export interface UpdateWorkerStatusResponse {
  success: true
  action: WorkerStatusAction
  worker: {
    id: string
    fullName: string | null
    email: string | null
    phoneNumber: string | null
    isActive: boolean
    role: string | null
  }
  closedShiftIds: string[]
}

export interface WorkerStatusResponse {
  success: true
  isWorker: boolean
  isActive: boolean
  hasOpenShift: boolean
  currentShift: {
    id: string
    clockIn: string
    durationMinutes: number
  } | null
  totals: {
    todayMinutes: number
    weekMinutes: number
  }
  profile: {
    id: string
    fullName: string | null
    email: string | null
    phoneNumber: string | null
  } | null
  serverTimestamp: string
}

export interface WorkerClockShiftResponse {
  success: true
  shift:
    | {
        id: string
        clockIn: string
        hasOpenShift: true
      }
    | {
        id: string
        clockIn: string
        clockOut: string
        durationMinutes: number
      }
}

export interface WorkerAttendanceEntry {
  id: string
  clockIn: string
  clockOut: string | null
  durationMinutes: number
  clockInNote: string | null
  clockOutNote: string | null
  createdAt: string | null
  updatedAt: string | null
  createdBy: string | null
  closedBy: string | null
}

export interface GetWorkerAttendanceResponse {
  success: true
  workerId: string
  rangeStart: string
  rangeEnd: string
  page: number
  pageSize: number
  totalCount: number
  entries: WorkerAttendanceEntry[]
}



