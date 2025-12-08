import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface ImpersonationState {
  impersonatedCustomerId: string | null
  impersonatedCustomerName: string | null
}

const IMPERSONATION_STORAGE_KEY = "impersonation_customer_id"
const IMPERSONATION_NAME_STORAGE_KEY = "impersonation_customer_name"

// Load from localStorage on initialization
const getInitialState = (): ImpersonationState => {
  if (typeof window === "undefined") {
    return {
      impersonatedCustomerId: null,
      impersonatedCustomerName: null,
    }
  }

  const storedId = localStorage.getItem(IMPERSONATION_STORAGE_KEY)
  const storedName = localStorage.getItem(IMPERSONATION_NAME_STORAGE_KEY)

  return {
    impersonatedCustomerId: storedId || null,
    impersonatedCustomerName: storedName || null,
  }
}

const initialState: ImpersonationState = getInitialState()

const impersonationSlice = createSlice({
  name: "impersonation",
  initialState,
  reducers: {
    setImpersonatedCustomer: (
      state,
      action: PayloadAction<{ customerId: string; customerName: string } | null>
    ) => {
      if (action.payload) {
        state.impersonatedCustomerId = action.payload.customerId
        state.impersonatedCustomerName = action.payload.customerName
        if (typeof window !== "undefined") {
          localStorage.setItem(IMPERSONATION_STORAGE_KEY, action.payload.customerId)
          localStorage.setItem(IMPERSONATION_NAME_STORAGE_KEY, action.payload.customerName)
        }
      } else {
        state.impersonatedCustomerId = null
        state.impersonatedCustomerName = null
        if (typeof window !== "undefined") {
          localStorage.removeItem(IMPERSONATION_STORAGE_KEY)
          localStorage.removeItem(IMPERSONATION_NAME_STORAGE_KEY)
        }
      }
    },
    clearImpersonation: (state) => {
      state.impersonatedCustomerId = null
      state.impersonatedCustomerName = null
      if (typeof window !== "undefined") {
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY)
        localStorage.removeItem(IMPERSONATION_NAME_STORAGE_KEY)
      }
    },
  },
})

export const { setImpersonatedCustomer, clearImpersonation } = impersonationSlice.actions

export default impersonationSlice.reducer

