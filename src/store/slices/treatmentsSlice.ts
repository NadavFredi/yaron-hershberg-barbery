import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface Treatment {
  id: string
  name: string
  treatmentType: string
  size: string
  ownerId: string
  notes?: string
  groomingMinPrice?: number | null
  groomingMaxPrice?: number | null
}

interface TreatmentsState {
  treatments: Treatment[]
  selectedTreatment: Treatment | null
  isLoading: boolean
  error: string | null
}

const initialState: TreatmentsState = {
  treatments: [],
  selectedTreatment: null,
  isLoading: false,
  error: null,
}

const treatmentsSlice = createSlice({
  name: "treatments",
  initialState,
  reducers: {
    setTreatments: (state, action: PayloadAction<Treatment[]>) => {
      state.treatments = action.payload
      state.isLoading = false
      state.error = null
    },
    addTreatment: (state, action: PayloadAction<Treatment>) => {
      state.treatments.push(action.payload)
    },
    updateTreatment: (state, action: PayloadAction<{ id: string; updates: Partial<Treatment> }>) => {
      const index = state.treatments.findIndex((treatment) => treatment.id === action.payload.id)
      if (index !== -1) {
        state.treatments[index] = { ...state.treatments[index], ...action.payload.updates }
      }
    },
    removeTreatment: (state, action: PayloadAction<string>) => {
      state.treatments = state.treatments.filter((treatment) => treatment.id !== action.payload)
    },
    setSelectedTreatment: (state, action: PayloadAction<Treatment | null>) => {
      state.selectedTreatment = action.payload
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

export const { setTreatments, addTreatment, updateTreatment, removeTreatment, setSelectedTreatment, setLoading, setError, clearError } =
  treatmentsSlice.actions

export default treatmentsSlice.reducer
