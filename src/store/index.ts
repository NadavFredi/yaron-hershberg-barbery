import { configureStore } from "@reduxjs/toolkit"
import { setupListeners } from "@reduxjs/toolkit/query"
import { supabaseApi } from "./services/supabaseApi"
import { pinnedAppointmentsApi } from "@/pages/ManagerSchedule/pinnedAppointments/pinnedAppointmentsApi"
import authReducer from "./slices/authSlice"
import appointmentsReducer from "./slices/appointmentsSlice"
import dogsReducer from "./slices/dogsSlice"
import servicesReducer from "./slices/servicesSlice"
import breedsReducer from "./slices/breedsSlice"
import stationsReducer from "./slices/stationsSlice"
import managerScheduleReducer from "./slices/managerScheduleSlice"
import matrixSectionReducer from "./slices/matrixSectionSlice"
import navbarReducer from "./slices/navbarSlice"
import impersonationReducer from "./slices/impersonationSlice"

export const store = configureStore({
  reducer: {
    auth: authReducer,
    appointments: appointmentsReducer,
    dogs: dogsReducer,
    services: servicesReducer,
    breeds: breedsReducer,
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
