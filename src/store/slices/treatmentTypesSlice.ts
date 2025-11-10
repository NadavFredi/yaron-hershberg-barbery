import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface TreatmentType {
  id: string
  name: string
  size: "small" | "medium" | "large"
  category: string
  description?: string
}

interface TreatmentTypesState {
  treatmentTypes: TreatmentType[]
  selectedTreatmentType: TreatmentType | null
  isLoading: boolean
  error: string | null
}

const initialState: TreatmentTypesState = {
  treatmentTypes: [],
  selectedTreatmentType: null,
  isLoading: false,
  error: null,
}

const treatmentTypesSlice = createSlice({
  name: "treatmentTypes",
  initialState,
  reducers: {
    setTreatmentTypes: (state, action: PayloadAction<TreatmentType[]>) => {
      state.treatmentTypes = action.payload
      state.isLoading = false
      state.error = null
    },
    addTreatmentType: (state, action: PayloadAction<TreatmentType>) => {
      state.treatmentTypes.push(action.payload)
    },
    updateTreatmentType: (state, action: PayloadAction<{ id: string; updates: Partial<TreatmentType> }>) => {
      const index = state.treatmentTypes.findIndex((treatmentType) => treatmentType.id === action.payload.id)
      if (index !== -1) {
        state.treatmentTypes[index] = { ...state.treatmentTypes[index], ...action.payload.updates }
      }
    },
    removeTreatmentType: (state, action: PayloadAction<string>) => {
      state.treatmentTypes = state.treatmentTypes.filter((treatmentType) => treatmentType.id !== action.payload)
    },
    setSelectedTreatmentType: (state, action: PayloadAction<TreatmentType | null>) => {
      state.selectedTreatmentType = action.payload
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

export const { setTreatmentTypes, addTreatmentType, updateTreatmentType, removeTreatmentType, setSelectedTreatmentType, setLoading, setError, clearError } =
  treatmentTypesSlice.actions

export default treatmentTypesSlice.reducer
