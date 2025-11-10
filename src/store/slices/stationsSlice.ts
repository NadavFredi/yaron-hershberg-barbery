import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface Station {
  id: string
  name: string
  description?: string
  isActive: boolean
}

interface StationsState {
  stations: Station[]
  selectedStation: Station | null
  isLoading: boolean
  error: string | null
}

const initialState: StationsState = {
  stations: [],
  selectedStation: null,
  isLoading: false,
  error: null,
}

const stationsSlice = createSlice({
  name: "stations",
  initialState,
  reducers: {
    setStations: (state, action: PayloadAction<Station[]>) => {
      state.stations = action.payload
      state.isLoading = false
      state.error = null
    },
    addStation: (state, action: PayloadAction<Station>) => {
      state.stations.push(action.payload)
    },
    updateStation: (state, action: PayloadAction<{ id: string; updates: Partial<Station> }>) => {
      const index = state.stations.findIndex((station) => station.id === action.payload.id)
      if (index !== -1) {
        state.stations[index] = { ...state.stations[index], ...action.payload.updates }
      }
    },
    removeStation: (state, action: PayloadAction<string>) => {
      state.stations = state.stations.filter((station) => station.id !== action.payload)
    },
    setSelectedStation: (state, action: PayloadAction<Station | null>) => {
      state.selectedStation = action.payload
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
  setStations,
  addStation,
  updateStation,
  removeStation,
  setSelectedStation,
  setLoading,
  setError,
  clearError,
} = stationsSlice.actions

export default stationsSlice.reducer
