import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface Dog {
  id: string
  name: string
  breed: string
  size: string
  ownerId: string
  notes?: string
  groomingMinPrice?: number | null
  groomingMaxPrice?: number | null
}

interface DogsState {
  dogs: Dog[]
  selectedDog: Dog | null
  isLoading: boolean
  error: string | null
}

const initialState: DogsState = {
  dogs: [],
  selectedDog: null,
  isLoading: false,
  error: null,
}

const dogsSlice = createSlice({
  name: "dogs",
  initialState,
  reducers: {
    setDogs: (state, action: PayloadAction<Dog[]>) => {
      state.dogs = action.payload
      state.isLoading = false
      state.error = null
    },
    addDog: (state, action: PayloadAction<Dog>) => {
      state.dogs.push(action.payload)
    },
    updateDog: (state, action: PayloadAction<{ id: string; updates: Partial<Dog> }>) => {
      const index = state.dogs.findIndex((dog) => dog.id === action.payload.id)
      if (index !== -1) {
        state.dogs[index] = { ...state.dogs[index], ...action.payload.updates }
      }
    },
    removeDog: (state, action: PayloadAction<string>) => {
      state.dogs = state.dogs.filter((dog) => dog.id !== action.payload)
    },
    setSelectedDog: (state, action: PayloadAction<Dog | null>) => {
      state.selectedDog = action.payload
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

export const { setDogs, addDog, updateDog, removeDog, setSelectedDog, setLoading, setError, clearError } =
  dogsSlice.actions

export default dogsSlice.reducer
