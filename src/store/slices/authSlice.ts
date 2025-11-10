import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface AuthState {
  user: SupabaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  hasInitialized: boolean
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  hasInitialized: false,
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<SupabaseUser>) => {
      state.user = action.payload
      state.isAuthenticated = true
      state.error = null
      state.isLoading = false
      state.hasInitialized = true
    },
    clearUser: (state) => {
      state.user = null
      state.isAuthenticated = false
      state.error = null
      state.isLoading = false
      state.hasInitialized = true
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.isLoading = false
      state.hasInitialized = true
    },
    clearError: (state) => {
      state.error = null
    },
  },
})

export const { setUser, clearUser, setLoading, setError, clearError } = authSlice.actions
export default authSlice.reducer
