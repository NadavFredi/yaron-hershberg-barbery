import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface Breed {
  id: string
  name: string
  size: "small" | "medium" | "large"
  category: string
  description?: string
}

interface BreedsState {
  breeds: Breed[]
  selectedBreed: Breed | null
  isLoading: boolean
  error: string | null
}

const initialState: BreedsState = {
  breeds: [],
  selectedBreed: null,
  isLoading: false,
  error: null,
}

const breedsSlice = createSlice({
  name: "breeds",
  initialState,
  reducers: {
    setBreeds: (state, action: PayloadAction<Breed[]>) => {
      state.breeds = action.payload
      state.isLoading = false
      state.error = null
    },
    addBreed: (state, action: PayloadAction<Breed>) => {
      state.breeds.push(action.payload)
    },
    updateBreed: (state, action: PayloadAction<{ id: string; updates: Partial<Breed> }>) => {
      const index = state.breeds.findIndex((breed) => breed.id === action.payload.id)
      if (index !== -1) {
        state.breeds[index] = { ...state.breeds[index], ...action.payload.updates }
      }
    },
    removeBreed: (state, action: PayloadAction<string>) => {
      state.breeds = state.breeds.filter((breed) => breed.id !== action.payload)
    },
    setSelectedBreed: (state, action: PayloadAction<Breed | null>) => {
      state.selectedBreed = action.payload
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

export const { setBreeds, addBreed, updateBreed, removeBreed, setSelectedBreed, setLoading, setError, clearError } =
  breedsSlice.actions

export default breedsSlice.reducer
