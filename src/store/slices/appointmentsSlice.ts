import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface Appointment {
  id: string
  treatmentId: string
  treatmentName: string
  date: string
  time: string
  service: string
  status: "upcoming" | "completed" | "cancelled"
  notes?: string
  customerId?: string
  serviceId?: string
  stationId?: string
  startTime?: Date
  endTime?: Date
}

interface AppointmentsState {
  appointments: Appointment[]
  selectedAppointment: Appointment | null
  isLoading: boolean
  error: string | null
  filters: {
    status: string[]
    dateRange: { start: string; end: string } | null
    service: string[]
  }
}

const initialState: AppointmentsState = {
  appointments: [],
  selectedAppointment: null,
  isLoading: false,
  error: null,
  filters: {
    status: [],
    dateRange: null,
    service: [],
  },
}

const appointmentsSlice = createSlice({
  name: "appointments",
  initialState,
  reducers: {
    setAppointments: (state, action: PayloadAction<Appointment[]>) => {
      state.appointments = action.payload
      state.isLoading = false
      state.error = null
    },
    addAppointment: (state, action: PayloadAction<Appointment>) => {
      state.appointments.push(action.payload)
    },
    updateAppointment: (state, action: PayloadAction<{ id: string; updates: Partial<Appointment> }>) => {
      const index = state.appointments.findIndex((apt) => apt.id === action.payload.id)
      if (index !== -1) {
        state.appointments[index] = { ...state.appointments[index], ...action.payload.updates }
      }
    },
    removeAppointment: (state, action: PayloadAction<string>) => {
      state.appointments = state.appointments.filter((apt) => apt.id !== action.payload)
    },
    setSelectedAppointment: (state, action: PayloadAction<Appointment | null>) => {
      state.selectedAppointment = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.isLoading = false
    },
    clearError: (state) => {
      state.error = null
    },
    setFilters: (state, action: PayloadAction<Partial<AppointmentsState["filters"]>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    clearFilters: (state) => {
      state.filters = initialState.filters
    },
  },
})

export const {
  setAppointments,
  addAppointment,
  updateAppointment,
  removeAppointment,
  setSelectedAppointment,
  setLoading,
  setError,
  clearError,
  setFilters,
  clearFilters,
} = appointmentsSlice.actions

export default appointmentsSlice.reducer
