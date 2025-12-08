import { configureStore } from "@reduxjs/toolkit"
import { setupListeners } from "@reduxjs/toolkit/query"
import { supabaseApi } from "./services/supabaseApi"
import { pinnedAppointmentsApi } from "@/pages/ManagerSchedule/pinnedAppointments/pinnedAppointmentsApi"
import authReducer from "./slices/authSlice"
import appointmentsReducer from "./slices/appointmentsSlice"
// Removed dogsReducer and breedsReducer - barbery system doesn't use dogs/breeds
import servicesReducer from "./slices/servicesSlice"
import stationsReducer from "./slices/stationsSlice"
import managerScheduleReducer from "./slices/managerScheduleSlice"
import matrixSectionReducer from "./slices/matrixSectionSlice"
import navbarReducer from "./slices/navbarSlice"
import impersonationReducer from "./slices/impersonationSlice"

export const store = configureStore({
  reducer: {
    auth: authReducer,
    appointments: appointmentsReducer,
    // Removed dogs and breeds reducers - barbery system doesn't use dogs/breeds
    services: servicesReducer,
    stations: stationsReducer,
    managerSchedule: managerScheduleReducer,
    matrixSection: matrixSectionReducer,
    navbar: navbarReducer,
    impersonation: impersonationReducer,
    [supabaseApi.reducerPath]: supabaseApi.reducer,
    [pinnedAppointmentsApi.reducerPath]: pinnedAppointmentsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      supabaseApi.middleware,
      pinnedAppointmentsApi.middleware
    ),
})

setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
