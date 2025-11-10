import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface Service {
  id: string
  name: string
  description?: string
  basePrice: number
  durationMinutes: number
}

interface ServicesState {
  services: Service[]
  selectedService: Service | null
  isLoading: boolean
  error: string | null
}

const initialState: ServicesState = {
  services: [],
  selectedService: null,
  isLoading: false,
  error: null,
}

const servicesSlice = createSlice({
  name: "services",
  initialState,
  reducers: {
    setServices: (state, action: PayloadAction<Service[]>) => {
      state.services = action.payload
      state.isLoading = false
      state.error = null
    },
    addService: (state, action: PayloadAction<Service>) => {
      state.services.push(action.payload)
    },
    updateService: (state, action: PayloadAction<{ id: string; updates: Partial<Service> }>) => {
      const index = state.services.findIndex((service) => service.id === action.payload.id)
      if (index !== -1) {
        state.services[index] = { ...state.services[index], ...action.payload.updates }
      }
    },
    removeService: (state, action: PayloadAction<string>) => {
      state.services = state.services.filter((service) => service.id !== action.payload)
    },
    setSelectedService: (state, action: PayloadAction<Service | null>) => {
      state.selectedService = action.payload
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
  },
})

export const {
  setServices,
  addService,
  updateService,
  removeService,
  setSelectedService,
  setLoading,
  setError,
  clearError,
} = servicesSlice.actions

export default servicesSlice.reducer
