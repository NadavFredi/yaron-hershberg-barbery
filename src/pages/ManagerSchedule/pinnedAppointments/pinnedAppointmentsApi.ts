import { createApi } from "@reduxjs/toolkit/query/react"
import type { BaseQueryFn } from "@reduxjs/toolkit/query"
import type { PinnedAppointment, PinAppointmentInput, UpdatePinInput } from "./pinnedAppointmentsService"
import {
  getPinnedAppointments,
  pinAppointment,
  updatePinnedAppointment,
  unpinAppointment,
} from "./pinnedAppointmentsService"

type CustomError = {
  status: string | number
  data: string
}

// Custom base query that uses our service functions directly
const customBaseQuery: BaseQueryFn<void, unknown, CustomError> = async () => {
  // This is just a placeholder - we use queryFn in each endpoint
  return { data: null }
}

export const pinnedAppointmentsApi = createApi({
  reducerPath: "pinnedAppointmentsApi",
  baseQuery: customBaseQuery,
  refetchOnFocus: false,
  refetchOnReconnect: false,
  defaultOptions: {
    queries: {
      refetchOnMountOrArgChange: false,
    },
  },
  tagTypes: ["PinnedAppointment"],
  endpoints: (builder) => ({
    getPinnedAppointments: builder.query<PinnedAppointment[], void>({
      async queryFn() {
        try {
          const data = await getPinnedAppointments()
          return { data }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "CUSTOM_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["PinnedAppointment"],
    }),

    pinAppointment: builder.mutation<PinnedAppointment, PinAppointmentInput>({
      async queryFn(input) {
        try {
          const data = await pinAppointment(input)
          return { data }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "CUSTOM_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["PinnedAppointment"],
    }),

    updatePinnedAppointment: builder.mutation<PinnedAppointment, { pinId: string; updates: UpdatePinInput }>({
      async queryFn({ pinId, updates }) {
        try {
          const data = await updatePinnedAppointment(pinId, updates)
          return { data }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "CUSTOM_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["PinnedAppointment"],
    }),

    unpinAppointment: builder.mutation<
      void,
      { pinId?: string; appointmentId?: string; appointmentType?: "grooming" | "daycare" }
    >({
      async queryFn({ pinId, appointmentId, appointmentType }) {
        try {
          await unpinAppointment(pinId, appointmentId, appointmentType)
          return { data: undefined }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "CUSTOM_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["PinnedAppointment"],
    }),
  }),
})

export const {
  useGetPinnedAppointmentsQuery,
  usePinAppointmentMutation,
  useUpdatePinnedAppointmentMutation,
  useUnpinAppointmentMutation,
} = pinnedAppointmentsApi
