import { configureStore } from "@reduxjs/toolkit"
import { setupListeners } from "@reduxjs/toolkit/query"
import { airtableApi } from "./services/airtableApi"
import { supabaseApi } from "./services/supabaseApi"
import authReducer from "./slices/authSlice"
import appointmentsReducer from "./slices/appointmentsSlice"
import dogsReducer from "./slices/dogsSlice"
import servicesReducer from "./slices/servicesSlice"
import breedsReducer from "./slices/breedsSlice"
import stationsReducer from "./slices/stationsSlice"

export const store = configureStore({
  reducer: {
    auth: authReducer,
    appointments: appointmentsReducer,
    dogs: dogsReducer,
    services: servicesReducer,
    breeds: breedsReducer,
    stations: stationsReducer,
    [airtableApi.reducerPath]: airtableApi.reducer,
    [supabaseApi.reducerPath]: supabaseApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(airtableApi.middleware, supabaseApi.middleware),
})

setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
