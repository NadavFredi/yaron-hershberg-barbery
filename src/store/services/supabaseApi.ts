import type { BaseQueryFn } from "@reduxjs/toolkit/query"
import { createApi } from "@reduxjs/toolkit/query/react"
import { supabase } from "@/integrations/supabase/client"
import {
  checkUserExists as checkCustomerExists,
  getClientProfile as fetchClientProfile,
  updateClientProfile as saveClientProfile,
  getManagerSchedule as fetchManagerSchedule,
  searchManagerSchedule as executeManagerScheduleSearch,
  moveAppointment as moveAppointmentRecord,
  createManagerAppointment as createManagerAppointmentRecord,
  type MergedAppointment,
  createProposedMeeting as createProposedMeetingRecord,
  updateProposedMeeting as updateProposedMeetingRecord,
  deleteProposedMeeting as deleteProposedMeetingRecord,
  sendProposedMeetingWebhook as sendProposedMeetingWebhookRecord,
  sendManualProposedMeetingWebhook as sendManualProposedMeetingWebhookRecord,
  getProposedMeetingPublic as fetchProposedMeetingPublic,
  bookProposedMeeting as finalizeProposedMeeting,
  type ProposedMeetingInput,
  type ProposedMeetingUpdateInput,
} from "@/integrations/supabase/supabaseService"
import type {
  ManagerScheduleData,
  ManagerAppointment,
  ManagerScheduleSearchResponse,
} from "@/pages/ManagerSchedule/types"
import type { ProposedMeetingPublicDetails } from "@/types/proposedMeeting"
import type {
  GetAllWorkerShiftsParams,
  GetAllWorkerShiftsResponse,
  GetWorkerAttendanceResponse,
  GetWorkersResponse,
  RegisterWorkerPayload,
  RegisterWorkerResponse,
  ResetWorkerPasswordPayload,
  ResetWorkerPasswordResponse,
  UpdateWorkerStatusPayload,
  UpdateWorkerStatusResponse,
  WorkerClockShiftResponse,
  WorkerStatusResponse,
} from "@/types/worker"

export type PendingAppointmentRequest = {
  id: string
  serviceType: "grooming"
  createdAt: string
  startAt: string | null
  endAt: string | null
  customerId: string | null
  customerName: string | null
  customerPhone: string | null
  stationName: string | null
  serviceLabel: string | null
  notes: string | null
  appointmentKind?: "business" | "personal"
  questionnaireResult?: "not_required" | "pending" | "approved" | "rejected" | null
}

type PendingAppointmentResponse = {
  requests: PendingAppointmentRequest[]
  meta?: {
    totalFetched: number
    returned: number
    requestedLimit: number
  }
}

const unwrapResponse = <T>(response: unknown): T => {
  if (typeof response === "object" && response !== null && "data" in (response as Record<string, unknown>)) {
    const data = (response as Record<string, unknown>).data
    if (data != null) {
      return data as T
    }
  }

  return response as T
}

type SupabaseBaseQueryArg = {
  functionName: string
  body?: Record<string, unknown>
}

type SupabaseBaseQueryError = {
  status: number | string
  data: unknown
}

const supabaseFunctionBaseQuery: BaseQueryFn<SupabaseBaseQueryArg, unknown, SupabaseBaseQueryError> = async ({
  functionName,
  body,
}) => {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    })

    if (error) {
      // Check if this is an auth error - ONLY redirect on explicit 401/403 status codes
      const { handleInvalidToken } = await import("@/utils/auth")

      const errorObj = error as Record<string, unknown>
      const errorMessage = (errorObj.message as string) || ""

      // Extract status code from error
      let statusCode: number | null =
        typeof errorObj.status === "number"
          ? errorObj.status
          : typeof (errorObj.context as Record<string, unknown>)?.statusCode === "number"
          ? ((errorObj.context as Record<string, unknown>).statusCode as number)
          : typeof (errorObj.response as Record<string, unknown>)?.status === "number"
          ? ((errorObj.response as Record<string, unknown>).status as number)
          : null

      // ONLY redirect on explicit 401 or 403 status codes - never on 500 or other errors
      // Check for explicit status codes first, don't try to infer from error messages
      if (statusCode === 401 || statusCode === 403) {
        console.warn("🔒 [supabaseApi] Auth error detected (401/403), logging out...", { statusCode, error })
        // Handle invalid token (logout and redirect) - non-blocking
        handleInvalidToken()

        // Return Hebrew error message
        return {
          error: {
            status: statusCode,
            data:
              statusCode === 403
                ? "אין לך הרשאות לבצע פעולה זו. אם אתה חושב שזו טעות, אנא פנה למנהל המערכת."
                : "ההתחברות שלך פגה או לא תקינה. אנא התחבר מחדש כדי להמשיך.",
          },
        }
      }

      // For other errors, use Hebrew message if English generic message
      if (statusCode && errorMessage.includes("Edge Function returned")) {
        const { getErrorMessage } = await import("@/utils/errorMessages")
        const hebrewMessage = getErrorMessage({ status: statusCode }, "אירעה שגיאה בתקשורת עם השרת")
        return {
          error: {
            status: statusCode,
            data: hebrewMessage,
          },
        }
      }

      return {
        error: {
          status: statusCode || (error.name ?? "SUPABASE_ERROR"),
          data: errorMessage || error,
        },
      }
    }

    // Ensure data exists and is valid before returning success
    // If data is null/undefined, treat as error (might happen if function returns success but no data)
    if (data === null || data === undefined) {
      console.warn("⚠️ [supabaseApi] Function returned null/undefined data:", functionName)
      return {
        error: {
          status: "INVALID_RESPONSE",
          data: "Invalid response from server. Please try again.",
        },
      }
    }

    // Check if data contains an error field (some functions return { error: ... } in data)
    if (typeof data === "object" && data !== null && "error" in data) {
      const errorMessage = (data as { error?: string }).error || "An error occurred"
      console.error("❌ [supabaseApi] Function returned error in data:", errorMessage)

      // Only redirect on auth errors (401/403), not on validation errors (400)
      // Check if it's an auth error by checking for specific auth-related keywords
      const { handleInvalidToken } = await import("@/utils/auth")
      const errorLower = typeof errorMessage === "string" ? errorMessage.toLowerCase() : ""
      const isAuthErrorInMessage =
        errorLower.includes("unauthorized") ||
        (errorLower.includes("invalid") && (errorLower.includes("session") || errorLower.includes("token"))) ||
        (errorLower.includes("expired") && (errorLower.includes("session") || errorLower.includes("token"))) ||
        errorLower.includes("authentication failed")

      if (isAuthErrorInMessage) {
        console.warn("🔒 [supabaseApi] Auth error in response data, logging out...", errorMessage)
        handleInvalidToken()

        return {
          error: {
            status: 401,
            data: "ההתחברות שלך פגה או לא תקינה. אנא התחבר מחדש כדי להמשיך.",
          },
        }
      }

      return {
        error: {
          status: "FUNCTION_ERROR",
          data: errorMessage,
        },
      }
    }

    return { data }
  } catch (err) {
    const message = err instanceof Error ? err.message : err

    // Check if it's an HttpError with status code
    const { HttpError: HttpErrorClass, getErrorStatus } = await import("@/utils/errorMessages")
    const status = getErrorStatus(err)

    // Preserve HTTP status code if available
    if (err instanceof HttpErrorClass && status !== null) {
      const { isAuthError, handleInvalidToken } = await import("@/utils/auth")
      if (status === 401 || status === 403) {
        console.warn("🔒 [supabaseApi] Auth error in catch block, logging out...", err)
        handleInvalidToken()
        return {
          error: {
            status: status,
            data: message,
          },
        }
      }
      return {
        error: {
          status: status,
          data: message,
        },
      }
    }

    // Fallback: Check if catch block error is also an auth error by string matching
    const errorString = String(err).toLowerCase()
    if (
      errorString.includes("401") ||
      errorString.includes("403") ||
      errorString.includes("unauthorized") ||
      errorString.includes("forbidden")
    ) {
      const { handleInvalidToken } = await import("@/utils/auth")
      console.warn("🔒 [supabaseApi] Auth error in catch block, logging out...", err)
      // Handle invalid token (don't await - redirect happens in background)
      handleInvalidToken().catch((handleErr) => console.error("Error in handleInvalidToken:", handleErr))

      return {
        error: {
          status: 401, // Default to 401 for auth errors
          data: "Session expired. Please log in again.",
        },
      }
    }

    return {
      error: {
        status: "FETCH_ERROR",
        data: message,
      },
    }
  }
}

export const supabaseApi = createApi({
  reducerPath: "supabaseApi",
  baseQuery: supabaseFunctionBaseQuery,
  refetchOnFocus: false,
  refetchOnReconnect: false,
  tagTypes: [
    "User",
    "Appointment",
    "Availability",
    "WaitingList",
    "ManagerSchedule",
    "Customer",
    "Worker",
    "WorkerAttendance",
    "Constraints",
    "StationWorkingHours",
    "ShiftRestrictions",
  ],
  endpoints: (builder) => ({
    // User authentication
    checkUserExists: builder.query({
      async queryFn(email: string) {
        try {
          const data = await checkCustomerExists(email)
          return { data }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["User"],
    }),

    getClientProfile: builder.query({
      async queryFn(clientId: string) {
        try {
          const data = await fetchClientProfile(clientId)
          return { data }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["User"],
    }),

    updateClientProfile: builder.mutation({
      async queryFn({
        clientId,
        ...body
      }: {
        clientId: string
        fullName?: string
        phone?: string
        email?: string
        address?: string
      }) {
        try {
          const data = await saveClientProfile(clientId, body)
          return { data }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["User"],
    }),

    getManyChatUser: builder.query({
      query: (phoneRequests: Array<{ phone: string; fullName: string }>) => ({
        functionName: "get-manychat-user",
        body: phoneRequests,
      }),
      transformResponse: (response: unknown) => {
        console.log("🔍 [getManyChatUser] Raw response from Supabase:", response)
        // Response is a dictionary: { "phone": subscriber_data, ... }
        const result = unwrapResponse<Record<string, unknown>>(response)
        console.log("🔍 [getManyChatUser] Transformed response:", result)
        return result
      },
      providesTags: ["User"],
    }),

    getClientSubscriptions: builder.query({
      query: (clientId: string) => ({
        functionName: "get-client-subscriptions",
        body: { clientId },
      }),
      transformResponse: (response) => unwrapResponse(response),
      providesTags: ["User"],
    }),

    getCardUsage: builder.query({
      query: (cardId: string) => ({
        functionName: "get-card-usage",
        body: { cardId },
      }),
      transformResponse: (response) => unwrapResponse(response),
      providesTags: ["User"],
    }),

    getSubscriptionTypes: builder.query({
      query: (_arg: void) => ({
        functionName: "get-subscription-types",
        body: {},
      }),
      transformResponse: (response) => unwrapResponse(response),
      providesTags: ["User"],
    }),

    // Appointments

    getAppointmentOrders: builder.query<
      { orders: Array<{ id: string; status: string | null; total: number | null }> },
      { appointmentId: string; serviceType: "grooming" }
    >({
      async queryFn({ appointmentId, serviceType }) {
        try {
          const column = "grooming_appointment_id"
          const { data, error } = await supabase.from("orders").select("id, status, total").eq(column, appointmentId)

          if (error) {
            throw new Error(error.message)
          }

          return { data: { orders: data || [] } }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: "Appointment", id: `orders-${arg.serviceType}-${arg.appointmentId}` },
      ],
      keepUnusedDataFor: 300,
    }),

    getClientAppointmentHistory: builder.query<
      {
        appointments: Array<{
          id: string
          startAt: string
          status: string | null
          serviceType: "grooming"
        }>
      },
      { clientId: string }
    >({
      async queryFn({ clientId }) {
        try {
          // Return empty result if clientId is undefined or invalid
          if (!clientId || clientId === "undefined") {
            return { data: { appointments: [] } }
          }

          const groomingResult = await supabase
            .from("grooming_appointments")
            .select("id, start_at, status")
            .eq("customer_id", clientId)
            .order("start_at", { ascending: true })

          if (groomingResult.error) {
            throw new Error(groomingResult.error.message)
          }

          const appointments = (groomingResult.data || []).map((apt) => ({
            id: apt.id as string,
            startAt: apt.start_at as string,
            status: (apt as { status?: string }).status ?? null,
            serviceType: "grooming" as const,
          }))

          return { data: { appointments } }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: (_result, _error, arg) => [{ type: "Appointment", id: `client-${arg.clientId}` }],
      keepUnusedDataFor: 300,
    }),

    getAvailableDates: builder.query({
      query: (params) => ({
        functionName: "get-available-times",
        body: { ...params, mode: "date" },
      }),
      transformResponse: (response) => unwrapResponse(response),
      providesTags: ["Availability"],
    }),

    getAvailableTimes: builder.query({
      query: (params) => ({
        functionName: "get-available-times",
        body: { ...params, mode: "time" },
      }),
      transformResponse: (response) => unwrapResponse(response),
      providesTags: ["Availability"],
    }),

    getWaitingListEntries: builder.query({
      async queryFn(params: { dogIds: string[] }) {
        try {
          const { getWaitingListEntries } = await import("@/pages/Appointments/Appointments.module")
          const entries = await getWaitingListEntries(params.dogIds)
          return { data: entries }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["WaitingList"],
    }),

    getPendingAppointmentRequests: builder.query<PendingAppointmentResponse, { limit?: number } | void>({
      query: (params) => {
        const limit = params?.limit ?? 5
        return {
          functionName: "get-pending-appointment-requests",
          body: { limit },
        }
      },
      transformResponse: (response) => unwrapResponse<PendingAppointmentResponse>(response),
      providesTags: ["Appointment"],
    }),

    deleteWaitingListEntry: builder.mutation({
      async queryFn(entryId: string) {
        try {
          const { deleteWaitingListEntry } = await import("@/pages/Appointments/Appointments.module")
          const result = await deleteWaitingListEntry(entryId)
          if (!result.success) {
            throw new Error(result.error || "Failed to delete waiting list entry")
          }
          return { data: result }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["WaitingList"],
    }),

    moveAppointment: builder.mutation({
      async queryFn(params: {
        appointmentId: string
        newStationId: string
        newStartTime: string
        newEndTime: string
        oldStationId: string
        oldStartTime: string
        oldEndTime: string
        appointmentType: "grooming"
        latePickupRequested?: boolean
        latePickupNotes?: string
        internalNotes?: string
        customerNotes?: string
        groomingNotes?: string
      }) {
        try {
          // Fetch dogId before moving appointment to invalidate cache later
          let dogId: string | undefined
          try {
            const { getSingleManagerAppointment } = await import("@/integrations/supabase/supabaseService")
          } catch (error) {
            console.warn("Error during cache invalidation:", error)
          }

          const result = await moveAppointmentRecord(params)

          return { data: { ...result, dogId } }
        } catch (error) {
          console.error(`❌ [supabaseApi] moveAppointment error:`, error)
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      async onQueryStarted(params, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          const dogId = data?.dogId

          // Invalidate general tags
          dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment"]))

          // Invalidate specific dog's appointments cache if dogId is available
          if (dogId) {
            // Invalidate the specific query by its cache key
            dispatch(
              supabaseApi.util.invalidateTags([
                { type: "Appointment", id: dogId },
                { type: "Appointment", id: `getMergedAppointments-${dogId}` },
              ])
            )
            // Also invalidate the query directly using the query cache key
            dispatch(
              supabaseApi.util.invalidateTags([{ type: "Appointment", id: `getMergedAppointments("${dogId}")` }])
            )
          }
        } catch (error) {
          console.warn("Failed to invalidate cache after moveAppointment:", error)
        }
      },
      invalidatesTags: ["ManagerSchedule", "Appointment"],
    }),

    updateAppointmentStatus: builder.mutation<
      { success: boolean; message?: string; error?: string; appointment?: { id: string; status: string } },
      {
        appointmentId: string
        status: string
        appointmentType: "grooming"
        date?: string
        serviceType?: "grooming"
      }
    >({
      async queryFn({ appointmentId, status, appointmentType }) {
        try {
          const { approveAppointmentByManager } = await import("@/integrations/supabase/supabaseService")
          const result = await approveAppointmentByManager(
            appointmentId,
            appointmentType,
            status as "scheduled" | "cancelled"
          )
          return { data: result }
        } catch (error) {
          console.error(`❌ [supabaseApi] updateAppointmentStatus error:`, error)
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      async onQueryStarted({ appointmentId, status, date, serviceType }, { dispatch, queryFulfilled }) {
        // Import extract functions
        const { extractGroomingAppointmentId } = await import("@/lib/utils")
        const { format } = await import("date-fns")

        // Optimistically update the cache
        const patchResults: Array<{ undo: () => void }> = []

        // Helper to find appointment index (synchronous)
        const findAppointmentIndex = (appointments: any[]) => {
          return appointments.findIndex((apt) => {
            return extractGroomingAppointmentId(apt.id) === appointmentId
          })
        }

        // If specific date/serviceType provided, update that query directly
        if (date && serviceType) {
          const patchResult = dispatch(
            supabaseApi.util.updateQueryData("getManagerSchedule", { date, serviceType }, (draft) => {
              if (draft && draft.appointments) {
                const appointmentIndex = findAppointmentIndex(draft.appointments)
                if (appointmentIndex !== -1) {
                  draft.appointments[appointmentIndex].status = status
                  draft.appointments[appointmentIndex].updated_at = new Date().toISOString()
                }
              }
            })
          )
          patchResults.push(patchResult)
        } else {
          // Update the most common query (both service types) for the current date
          const currentDate = date || format(new Date(), "yyyy-MM-dd")
          const patchResult = dispatch(
            supabaseApi.util.updateQueryData(
              "getManagerSchedule",
              { date: currentDate, serviceType: serviceType || "grooming" },
              (draft) => {
                if (draft && draft.appointments) {
                  const appointmentIndex = findAppointmentIndex(draft.appointments)
                  if (appointmentIndex !== -1) {
                    draft.appointments[appointmentIndex].status = status
                    draft.appointments[appointmentIndex].updated_at = new Date().toISOString()
                  }
                }
              }
            )
          )
          patchResults.push(patchResult)
        }

        try {
          await queryFulfilled
          // Invalidate tags to ensure data consistency
          dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment"]))
        } catch (error) {
          // Revert optimistic updates on error
          patchResults.forEach((patchResult) => patchResult.undo())
        }
      },
      invalidatesTags: ["ManagerSchedule", "Appointment"],
    }),

    createManagerAppointment: builder.mutation({
      async queryFn(params: {
        name: string
        stationId: string
        selectedStations: string[]
        startTime: string
        endTime: string
        appointmentType: "private" | "business"
        groupId?: string
        customerId?: string
        dogId?: string
        isManualOverride?: boolean
        latePickupRequested?: boolean
        latePickupNotes?: string
        notes?: string
        internalNotes?: string
      }) {
        try {
          const result = await createManagerAppointmentRecord(params)
          return { data: { ...result, dogId: params.dogId } }
        } catch (error) {
          console.error(`❌ [supabaseApi] createManagerAppointment error:`, error)

          // Check if it's an HttpError with status code
          const { HttpError: HttpErrorClass, getErrorStatus } = await import("@/utils/errorMessages")
          const status = getErrorStatus(error)

          const message = error instanceof Error ? error.message : String(error)

          // Preserve HTTP status code if available
          if (error instanceof HttpErrorClass && status !== null) {
            return {
              error: {
                status: status, // Use numeric status code
                data: message,
              },
            }
          }

          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      async onQueryStarted(params, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          const dogId = data?.dogId || params.dogId

          // Invalidate general tags for manager schedule and appointments
          dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment"]))

          // Invalidate specific dog's appointments cache if dogId is available
          if (dogId) {
            dispatch(
              supabaseApi.util.invalidateTags([
                { type: "Appointment", id: dogId },
                { type: "Appointment", id: `getMergedAppointments-${dogId}` },
              ])
            )
          }
        } catch (error) {
          console.warn("Failed to invalidate cache after createManagerAppointment:", error)
        }
      },
      invalidatesTags: ["ManagerSchedule", "Appointment"],
    }),

    createProposedMeeting: builder.mutation({
      async queryFn(params: ProposedMeetingInput) {
        try {
          const result = await createProposedMeetingRecord(params)
          return { data: result }
        } catch (error) {
          console.error("❌ [supabaseApi] createProposedMeeting error:", error)
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["ManagerSchedule"],
    }),

    updateProposedMeeting: builder.mutation({
      async queryFn(params: ProposedMeetingUpdateInput) {
        try {
          const result = await updateProposedMeetingRecord(params)
          return { data: result }
        } catch (error) {
          console.error("❌ [supabaseApi] updateProposedMeeting error:", error)
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["ManagerSchedule"],
    }),

    deleteProposedMeeting: builder.mutation({
      async queryFn(meetingId: string) {
        try {
          const result = await deleteProposedMeetingRecord(meetingId)
          return { data: result }
        } catch (error) {
          console.error("❌ [supabaseApi] deleteProposedMeeting error:", error)
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["ManagerSchedule"],
    }),

    sendProposedMeetingWebhook: builder.mutation({
      async queryFn(params: {
        inviteId: string
        customerId: string
        proposedMeetingId: string
        notificationCount?: number
      }) {
        try {
          const result = await sendProposedMeetingWebhookRecord(params)
          return { data: result }
        } catch (error) {
          console.error("❌ [supabaseApi] sendProposedMeetingWebhook error:", error)
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: [],
    }),

    sendManualProposedMeetingWebhook: builder.mutation({
      async queryFn(params: {
        proposedMeetingId: string
        code: string
        meetingLink: string
        contact: { name?: string; phone?: string; email?: string }
      }) {
        try {
          const result = await sendManualProposedMeetingWebhookRecord(params)
          return { data: result }
        } catch (error) {
          console.error("❌ [supabaseApi] sendManualProposedMeetingWebhook error:", error)
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: [],
    }),

    getProposedMeetingPublic: builder.query<ProposedMeetingPublicDetails, string>({
      async queryFn(meetingId: string) {
        try {
          const data = await fetchProposedMeetingPublic(meetingId)
          return { data }
        } catch (error) {
          console.error("❌ [supabaseApi] getProposedMeetingPublic error:", error)
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
    }),

    bookProposedMeeting: builder.mutation<
      { success: boolean; appointmentId?: string },
      { meetingId: string; code?: string }
    >({
      async queryFn(params) {
        try {
          const data = await finalizeProposedMeeting(params)
          return { data }
        } catch (error) {
          console.error("❌ [supabaseApi] bookProposedMeeting error:", error)
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["ManagerSchedule"],
    }),

    getManagerAppointment: builder.query<ManagerAppointment, { appointmentId: string; serviceType: "grooming" }>({
      async queryFn({ appointmentId, serviceType }) {
        try {
          const { getSingleManagerAppointment } = await import("@/integrations/supabase/supabaseService")
          const result = await getSingleManagerAppointment(appointmentId, serviceType)

          if (!result.success || !result.appointment) {
            const errorMessage = result.error || "Appointment not found"
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: errorMessage,
              },
            }
          }

          return { data: result.appointment }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: (_result, _error, arg) => [
        {
          type: "Appointment",
          id: `${arg.appointmentId}-${arg.serviceType}`,
        },
      ],
      keepUnusedDataFor: 300,
    }),

    getManagerSchedule: builder.query<ManagerScheduleData, { date: string; serviceType?: "grooming" }>({
      async queryFn({ date, serviceType = "grooming" }) {
        try {
          const result = await fetchManagerSchedule(date, serviceType)
          return { data: result }
        } catch (error) {
          console.error(`❌ [supabaseApi] getManagerSchedule error:`, error)
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["ManagerSchedule"],
    }),

    searchManagerSchedule: builder.query<ManagerScheduleSearchResponse, { term: string; limit?: number }>({
      async queryFn({ term, limit = 12 }) {
        try {
          const result = await executeManagerScheduleSearch({ term, limit })
          return { data: result }
        } catch (error) {
          console.error("❌ [supabaseApi] searchManagerSchedule error", error)
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
    }),

    getGroupAppointments: builder.query<
      { appointments: ManagerAppointment[]; groupId: string; count: number },
      { groupId: string }
    >({
      query: ({ groupId }) => ({
        functionName: "get-group-appointments",
        body: { groupId },
      }),
      transformResponse: (response) => unwrapResponse(response),
      providesTags: ["Appointment"],
    }),

    getSeriesAppointments: builder.query<
      { appointments: ManagerAppointment[]; seriesId: string; count: number },
      { seriesId: string }
    >({
      async queryFn({ seriesId }) {
        try {
          if (!seriesId) {
            return {
              error: {
                status: "CUSTOM_ERROR",
                data: "seriesId is required",
              },
            }
          }

          const groomingResult = await supabase
            .from("grooming_appointments")
            .select(
              `
                id,
                status,
                station_id,
                start_at,
                end_at,
                customer_notes,
                internal_notes,
                payment_status,
                appointment_kind,
                amount_due,
                series_id,
                customer_id,
                stations(id, name),
                customers(id, full_name, phone, email, classification)
              `
            )
            .eq("series_id", seriesId)
            .order("start_at", { ascending: true })

          if (groomingResult.error) {
            throw new Error(`Failed to fetch grooming appointments: ${groomingResult.error.message}`)
          }

          const { getManagerSchedule } = await import("@/integrations/supabase/supabaseService")

          // Transform to ManagerAppointment format (similar to getManagerSchedule)
          const appointments: ManagerAppointment[] = []

          // Process grooming appointments
          for (const apt of groomingResult.data || []) {
            const station = Array.isArray(apt.stations) ? apt.stations[0] : apt.stations
            const customer = Array.isArray(apt.customers) ? apt.customers[0] : apt.customers

            appointments.push({
              id: apt.id,
              serviceType: "grooming",
              stationId: apt.station_id || station?.id || "",
              stationName: station?.name || "לא ידוע",
              startDateTime: apt.start_at,
              endDateTime: apt.end_at,
              status: apt.status || "pending",
              paymentStatus: apt.payment_status || undefined,
              notes: apt.customer_notes || "",
              internalNotes: apt.internal_notes || undefined,
              groomingNotes: apt.grooming_notes || undefined,
              hasCrossServiceAppointment: false,
              dogs: [],
              clientId: apt.customer_id,
              clientName: customer?.full_name || undefined,
              clientClassification: customer?.classification || undefined,
              clientEmail: customer?.email || undefined,
              clientPhone: customer?.phone || undefined,
              appointmentType: apt.appointment_kind === "personal" ? "private" : "business",
              isPersonalAppointment: apt.appointment_kind === "personal",
              personalAppointmentDescription: apt.appointment_name || undefined,
              price: apt.amount_due ? Number(apt.amount_due) : undefined,
              seriesId: apt.series_id || undefined,
              durationMinutes: Math.round((new Date(apt.end_at).getTime() - new Date(apt.start_at).getTime()) / 60000),
            } as ManagerAppointment)
          }

          // Sort by start time
          appointments.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))

          return {
            data: {
              appointments,
              seriesId,
              count: appointments.length,
            },
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["Appointment"],
    }),

    // Worker management
    getWorkers: builder.query<
      GetWorkersResponse,
      {
        includeInactive?: boolean
        rangeStart?: string
        rangeEnd?: string
        recentLimit?: number
      } | void
    >({
      async queryFn(params) {
        try {
          const includeInactive = params?.includeInactive ?? false
          const recentLimit = params?.recentLimit ?? 5
          const now = new Date()
          const nowIso = now.toISOString()

          const defaultRangeStart = new Date(now)
          defaultRangeStart.setDate(defaultRangeStart.getDate() - 7)
          defaultRangeStart.setHours(0, 0, 0, 0)

          const rangeStartIso = params?.rangeStart ?? defaultRangeStart.toISOString()
          const rangeEndIso = params?.rangeEnd ?? nowIso

          const { data: workerRows, error: workerError } = await supabase
            .from("profiles")
            .select("id, full_name, email, phone_number, worker_is_active, created_at, role")
            .eq("role", "worker")
            .order("full_name", { ascending: true })

          if (workerError) {
            console.error("❌ [supabaseApi.getWorkers] Failed to load worker profiles", workerError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: workerError.message,
              },
            }
          }

          const startOfToday = new Date(now)
          startOfToday.setHours(0, 0, 0, 0)

          const startOfWeek = new Date(now)
          const diffToSunday = startOfWeek.getDay()
          startOfWeek.setDate(startOfWeek.getDate() - diffToSunday)
          startOfWeek.setHours(0, 0, 0, 0)

          const differenceInMinutes = (startIso: string, endIso: string) => {
            const start = Date.parse(startIso)
            const end = Date.parse(endIso)
            if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
              return 0
            }
            return Math.round((end - start) / 60000)
          }

          const serializeRecentShift = (row: { id: string; clock_in: string; clock_out: string | null }) => {
            const endIso = row.clock_out ?? nowIso
            return {
              id: row.id,
              clockIn: row.clock_in,
              clockOut: row.clock_out,
              durationMinutes: differenceInMinutes(row.clock_in, endIso),
            }
          }

          const workers = (workerRows ?? []).filter((row) => includeInactive || row.worker_is_active !== false)

          const summaries: WorkerSummary[] = []

          for (const worker of workers) {
            const [{ data: openShiftRows, error: openShiftError }, { data: rangeRows, error: rangeError }] =
              await Promise.all([
                supabase
                  .from("worker_attendance_logs")
                  .select("id, clock_in")
                  .eq("worker_id", worker.id)
                  .is("clock_out", null)
                  .order("clock_in", { ascending: false })
                  .limit(1),
                supabase
                  .from("worker_attendance_logs")
                  .select("id, clock_in, clock_out")
                  .eq("worker_id", worker.id)
                  .gte("clock_in", rangeStartIso)
                  .lte("clock_in", rangeEndIso)
                  .order("clock_in", { ascending: false }),
              ])

            if (openShiftError) {
              console.error("❌ [supabaseApi.getWorkers] Failed to fetch open shift", openShiftError)
              return {
                error: {
                  status: "SUPABASE_ERROR",
                  data: openShiftError.message,
                },
              }
            }

            if (rangeError) {
              console.error("❌ [supabaseApi.getWorkers] Failed to fetch attendance history", rangeError)
              return {
                error: {
                  status: "SUPABASE_ERROR",
                  data: rangeError.message,
                },
              }
            }

            const openShift = (openShiftRows ?? [])[0] as { id: string; clock_in: string } | undefined
            const attendanceRows = rangeRows ?? []

            let rangeMinutes = 0
            let todayMinutes = 0
            let weekMinutes = 0

            const recentShifts: WorkerSummary["recentShifts"] = []

            for (const row of attendanceRows) {
              const endIso = row.clock_out ?? nowIso
              const minutes = differenceInMinutes(row.clock_in, endIso)
              rangeMinutes += minutes

              if (Date.parse(row.clock_in) >= startOfToday.getTime()) {
                todayMinutes += minutes
              }

              if (Date.parse(row.clock_in) >= startOfWeek.getTime()) {
                weekMinutes += minutes
              }

              if (recentShifts.length < recentLimit) {
                recentShifts.push(serializeRecentShift(row))
              }
            }

            if (openShift) {
              const minutes = differenceInMinutes(openShift.clock_in, nowIso)
              if (Date.parse(openShift.clock_in) >= Date.parse(rangeStartIso)) {
                rangeMinutes += minutes
              }
              if (Date.parse(openShift.clock_in) >= startOfToday.getTime()) {
                todayMinutes += minutes
              }
              if (Date.parse(openShift.clock_in) >= startOfWeek.getTime()) {
                weekMinutes += minutes
              }
            }

            const summary: WorkerSummary = {
              id: worker.id,
              fullName: worker.full_name,
              email: worker.email,
              phoneNumber: worker.phone_number,
              isActive: worker.worker_is_active !== false,
              createdAt: worker.created_at,
              currentShift: openShift
                ? {
                    id: openShift.id,
                    clockIn: openShift.clock_in,
                    durationMinutes: differenceInMinutes(openShift.clock_in, nowIso),
                  }
                : null,
              totals: {
                rangeMinutes,
                todayMinutes,
                weekMinutes,
              },
              recentShifts,
            }

            summaries.push(summary)
          }

          const response: GetWorkersResponse = {
            success: true,
            params: {
              includeInactive,
              rangeStart: rangeStartIso,
              rangeEnd: rangeEndIso,
              recentLimit,
            },
            workers: summaries,
          }

          return { data: response }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [supabaseApi.getWorkers] Unexpected error", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["Worker", "WorkerAttendance"],
    }),

    getWorkerAttendance: builder.query<
      GetWorkerAttendanceResponse,
      {
        workerId: string
        rangeStart?: string
        rangeEnd?: string
        page?: number
        pageSize?: number
      }
    >({
      async queryFn(params) {
        try {
          const now = new Date()
          const nowIso = now.toISOString()
          const rangeStartIso =
            params.rangeStart ??
            (() => {
              const startOfYear = new Date(now)
              startOfYear.setMonth(0, 1)
              startOfYear.setHours(0, 0, 0, 0)
              return startOfYear.toISOString()
            })()
          const rangeEndIso = params.rangeEnd ?? nowIso
          const pageSize = Number.isFinite(params.pageSize) ? Math.min(Math.max(params.pageSize ?? 50, 1), 200) : 50
          const page = Number.isFinite(params.page) ? Math.max(params.page ?? 0, 0) : 0
          const from = page * pageSize
          const to = from + pageSize - 1

          const differenceInMinutes = (startIso: string, endIso: string) => {
            const start = Date.parse(startIso)
            const end = Date.parse(endIso)
            if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
              return 0
            }
            return Math.round((end - start) / 60000)
          }

          const { data, error, count } = await supabase
            .from("worker_attendance_logs")
            .select(
              "id, clock_in, clock_out, clock_in_note, clock_out_note, created_at, updated_at, created_by, closed_by",
              { count: "exact" }
            )
            .eq("worker_id", params.workerId)
            .gte("clock_in", rangeStartIso)
            .lte("clock_in", rangeEndIso)
            .order("clock_in", { ascending: false })
            .range(from, to)

          if (error) {
            console.error("❌ [supabaseApi.getWorkerAttendance] Failed to fetch attendance", error)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: error.message,
              },
            }
          }

          const entries: WorkerAttendanceEntry[] = (data ?? []).map((row) => ({
            id: row.id,
            clockIn: row.clock_in,
            clockOut: row.clock_out,
            durationMinutes: row.clock_out
              ? differenceInMinutes(row.clock_in, row.clock_out)
              : differenceInMinutes(row.clock_in, nowIso),
            clockInNote: row.clock_in_note ?? null,
            clockOutNote: row.clock_out_note ?? null,
            createdAt: row.created_at ?? null,
            updatedAt: row.updated_at ?? null,
            createdBy: row.created_by ?? null,
            closedBy: row.closed_by ?? null,
          }))

          const response: GetWorkerAttendanceResponse = {
            success: true,
            workerId: params.workerId,
            rangeStart: rangeStartIso,
            rangeEnd: rangeEndIso,
            page,
            pageSize,
            totalCount: count ?? entries.length,
            entries,
          }

          return { data: response }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [supabaseApi.getWorkerAttendance] Unexpected error", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["WorkerAttendance"],
    }),

    getAllWorkerShifts: builder.query<GetAllWorkerShiftsResponse, GetAllWorkerShiftsParams>({
      async queryFn(params) {
        try {
          const now = new Date()
          const nowIso = now.toISOString()
          const rangeStartIso =
            params.rangeStart ??
            (() => {
              const startOfMonth = new Date(now)
              startOfMonth.setDate(1)
              startOfMonth.setHours(0, 0, 0, 0)
              return startOfMonth.toISOString()
            })()
          const rangeEndIso = params.rangeEnd ?? nowIso
          const pageSize = Number.isFinite(params.pageSize) ? Math.min(Math.max(params.pageSize ?? 50, 1), 200) : 50
          const page = Number.isFinite(params.page) ? Math.max(params.page ?? 0, 0) : 0
          const from = page * pageSize
          const to = from + pageSize - 1

          const differenceInMinutes = (startIso: string, endIso: string) => {
            const start = Date.parse(startIso)
            const end = Date.parse(endIso)
            if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
              return 0
            }
            return Math.round((end - start) / 60000)
          }

          // Build query for worker profiles to filter by status
          let workerQuery = supabase.from("profiles").select("id, full_name, worker_is_active").eq("role", "worker")

          if (params.workerStatus === "active") {
            workerQuery = workerQuery.eq("worker_is_active", true)
          } else if (params.workerStatus === "inactive") {
            workerQuery = workerQuery.eq("worker_is_active", false)
          }

          const { data: workers, error: workersError } = await workerQuery

          if (workersError) {
            console.error("❌ [supabaseApi.getAllWorkerShifts] Failed to fetch workers", workersError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: workersError.message,
              },
            }
          }

          const workerIds = workers?.map((w) => w.id) ?? []
          if (workerIds.length === 0) {
            return {
              data: {
                success: true,
                rangeStart: rangeStartIso,
                rangeEnd: rangeEndIso,
                page,
                pageSize,
                totalCount: 0,
                entries: [],
              },
            }
          }

          // Filter by specific worker IDs if provided
          let filteredWorkerIds = params.workerIds
            ? workerIds.filter((id) => params.workerIds!.includes(id))
            : workerIds

          // Filter by includeInactive - if false, only show shifts from active workers
          if (params.includeInactive === false) {
            const activeWorkerIds = workers?.filter((w) => w.worker_is_active === true).map((w) => w.id) ?? []
            filteredWorkerIds = filteredWorkerIds.filter((id) => activeWorkerIds.includes(id))
          }

          if (filteredWorkerIds.length === 0) {
            return {
              data: {
                success: true,
                rangeStart: rangeStartIso,
                rangeEnd: rangeEndIso,
                page,
                pageSize,
                totalCount: 0,
                entries: [],
              },
            }
          }

          // Build query for attendance logs
          const attendanceQuery = supabase
            .from("worker_attendance_logs")
            .select(
              "id, worker_id, clock_in, clock_out, clock_in_note, clock_out_note, created_at, updated_at, created_by, closed_by",
              { count: "exact" }
            )
            .in("worker_id", filteredWorkerIds)
            .gte("clock_in", rangeStartIso)
            .lte("clock_in", rangeEndIso)
            .order("clock_in", { ascending: false })
            .range(from, to)

          const { data, error, count } = await attendanceQuery

          if (error) {
            console.error("❌ [supabaseApi.getAllWorkerShifts] Failed to fetch shifts", error)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: error.message,
              },
            }
          }

          // Create a map of worker info
          const workerMap = new Map(
            workers?.map((w) => [w.id, { name: w.full_name, isActive: w.worker_is_active !== false }]) ?? []
          )

          const entries: WorkerShiftWithWorker[] = (data ?? []).map((row) => {
            const workerInfo = workerMap.get(row.worker_id) ?? { name: null, isActive: false }
            return {
              id: row.id,
              workerId: row.worker_id,
              workerName: workerInfo.name,
              workerIsActive: workerInfo.isActive,
              clockIn: row.clock_in,
              clockOut: row.clock_out,
              durationMinutes: row.clock_out
                ? differenceInMinutes(row.clock_in, row.clock_out)
                : differenceInMinutes(row.clock_in, nowIso),
              clockInNote: row.clock_in_note ?? null,
              clockOutNote: row.clock_out_note ?? null,
              createdAt: row.created_at ?? null,
              updatedAt: row.updated_at ?? null,
              createdBy: row.created_by ?? null,
              closedBy: row.closed_by ?? null,
            }
          })

          const response: GetAllWorkerShiftsResponse = {
            success: true,
            rangeStart: rangeStartIso,
            rangeEnd: rangeEndIso,
            page,
            pageSize,
            totalCount: count ?? entries.length,
            entries,
          }

          return { data: response }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [supabaseApi.getAllWorkerShifts] Unexpected error", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["WorkerAttendance"],
    }),

    getWorkerStatus: builder.query<WorkerStatusResponse, void>({
      async queryFn() {
        try {
          const now = new Date()
          const nowIso = now.toISOString()

          const differenceInMinutes = (startIso: string, endIso: string) => {
            const start = Date.parse(startIso)
            const end = Date.parse(endIso)
            if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
              return 0
            }
            return Math.round((end - start) / 60000)
          }

          const startOfToday = new Date(now)
          startOfToday.setHours(0, 0, 0, 0)

          const startOfWeek = new Date(now)
          const diffToSunday = startOfWeek.getDay()
          startOfWeek.setDate(startOfWeek.getDate() - diffToSunday)
          startOfWeek.setHours(0, 0, 0, 0)

          const { data: userProfile, error: profileError } = await supabase
            .from("profiles")
            .select("id, role, worker_is_active, full_name, email, phone_number")
            .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
            .maybeSingle()

          if (profileError) {
            console.error("❌ [supabaseApi.getWorkerStatus] Failed to load profile", profileError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: profileError.message,
              },
            }
          }

          if (!userProfile || userProfile.role !== "worker") {
            const response: WorkerStatusResponse = {
              success: true,
              isWorker: false,
              isActive: false,
              hasOpenShift: false,
              currentShift: null,
              totals: {
                todayMinutes: 0,
                weekMinutes: 0,
              },
              profile: userProfile
                ? {
                    id: userProfile.id,
                    fullName: userProfile.full_name ?? null,
                    email: userProfile.email ?? null,
                    phoneNumber: userProfile.phone_number ?? null,
                  }
                : null,
              serverTimestamp: nowIso,
            }
            return { data: response }
          }

          if (userProfile.worker_is_active === false) {
            const response: WorkerStatusResponse = {
              success: true,
              isWorker: true,
              isActive: false,
              hasOpenShift: false,
              currentShift: null,
              totals: {
                todayMinutes: 0,
                weekMinutes: 0,
              },
              profile: {
                id: userProfile.id,
                fullName: userProfile.full_name ?? null,
                email: userProfile.email ?? null,
                phoneNumber: userProfile.phone_number ?? null,
              },
              serverTimestamp: nowIso,
            }
            return { data: response }
          }

          const [{ data: openShiftRows, error: openShiftError }, { data: recentRows, error: recentError }] =
            await Promise.all([
              supabase
                .from("worker_attendance_logs")
                .select("id, clock_in")
                .eq("worker_id", userProfile.id)
                .is("clock_out", null)
                .order("clock_in", { ascending: false })
                .limit(1),
              supabase
                .from("worker_attendance_logs")
                .select("clock_in, clock_out")
                .eq("worker_id", userProfile.id)
                .gte("clock_in", startOfWeek.toISOString())
                .order("clock_in", { ascending: false }),
            ])

          if (openShiftError) {
            console.error("❌ [supabaseApi.getWorkerStatus] Failed to fetch open shift", openShiftError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: openShiftError.message,
              },
            }
          }

          if (recentError) {
            console.error("❌ [supabaseApi.getWorkerStatus] Failed to fetch attendance history", recentError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: recentError.message,
              },
            }
          }

          const openShift = (openShiftRows ?? [])[0] as { id: string; clock_in: string } | undefined
          let todayMinutes = 0
          let weekMinutes = 0

          for (const row of recentRows ?? []) {
            const endIso = row.clock_out ?? nowIso
            const minutes = differenceInMinutes(row.clock_in, endIso)
            if (Date.parse(row.clock_in) >= startOfToday.getTime()) {
              todayMinutes += minutes
            }
            weekMinutes += minutes
          }

          if (openShift) {
            const minutes = differenceInMinutes(openShift.clock_in, nowIso)
            if (Date.parse(openShift.clock_in) >= startOfToday.getTime()) {
              todayMinutes += minutes
            }
            weekMinutes += minutes
          }

          const response: WorkerStatusResponse = {
            success: true,
            isWorker: true,
            isActive: true,
            hasOpenShift: Boolean(openShift),
            currentShift: openShift
              ? {
                  id: openShift.id,
                  clockIn: openShift.clock_in,
                  durationMinutes: differenceInMinutes(openShift.clock_in, nowIso),
                }
              : null,
            totals: {
              todayMinutes,
              weekMinutes,
            },
            profile: {
              id: userProfile.id,
              fullName: userProfile.full_name ?? null,
              email: userProfile.email ?? null,
              phoneNumber: userProfile.phone_number ?? null,
            },
            serverTimestamp: nowIso,
          }

          return { data: response }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [supabaseApi.getWorkerStatus] Unexpected error", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["Worker"],
    }),

    registerWorker: builder.mutation<RegisterWorkerResponse, RegisterWorkerPayload>({
      query: (body) => ({
        functionName: "register-worker",
        body,
      }),
      transformResponse: (response) => unwrapResponse<RegisterWorkerResponse>(response),
      invalidatesTags: ["Worker", "WorkerAttendance"],
    }),

    updateWorkerStatus: builder.mutation<UpdateWorkerStatusResponse, UpdateWorkerStatusPayload>({
      async queryFn({ workerId, action }) {
        try {
          const nowIso = new Date().toISOString()

          const { data: workerProfile, error: workerError } = await supabase
            .from("profiles")
            .select("id, full_name, email, phone_number, role, worker_is_active")
            .eq("id", workerId)
            .maybeSingle()

          if (workerError) {
            console.error("❌ [supabaseApi.updateWorkerStatus] Failed to load worker profile", workerError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: workerError.message,
              },
            }
          }

          if (!workerProfile) {
            return {
              error: {
                status: "NOT_FOUND",
                data: "העובד לא נמצא במערכת.",
              },
            }
          }

          const closedShiftIds: string[] = []

          if (action !== "activate") {
            const { data: openShifts, error: openShiftError } = await supabase
              .from("worker_attendance_logs")
              .select("id")
              .eq("worker_id", workerId)
              .is("clock_out", null)

            if (openShiftError) {
              console.error("❌ [supabaseApi.updateWorkerStatus] Failed to fetch open shifts", openShiftError)
              return {
                error: {
                  status: "SUPABASE_ERROR",
                  data: openShiftError.message,
                },
              }
            }

            if (openShifts && openShifts.length > 0) {
              const { error: closeError } = await supabase
                .from("worker_attendance_logs")
                .update({
                  clock_out: nowIso,
                  closed_by: (await supabase.auth.getUser()).data.user?.id ?? null,
                  clock_out_note: "נסגר אוטומטית בעקבות שינוי סטטוס העובד על ידי המנהל.",
                })
                .in(
                  "id",
                  openShifts.map((row) => row.id)
                )
                .is("clock_out", null)

              if (closeError) {
                console.error("❌ [supabaseApi.updateWorkerStatus] Failed to close open shifts", closeError)
                return {
                  error: {
                    status: "SUPABASE_ERROR",
                    data: closeError.message,
                  },
                }
              }

              closedShiftIds.push(...openShifts.map((row) => row.id as string))
            }
          }

          let nextRole = workerProfile.role
          let nextActive = workerProfile.worker_is_active !== false

          if (action === "activate") {
            nextRole = "worker"
            nextActive = true
          } else if (action === "deactivate") {
            nextRole = "worker"
            nextActive = false
          } else if (action === "remove") {
            nextRole = "customer"
            nextActive = false
          }

          const { data: updatedRows, error: updateError } = await supabase
            .from("profiles")
            .update({
              role: nextRole,
              worker_is_active: nextActive,
            })
            .eq("id", workerId)
            .select("id, full_name, email, phone_number, role, worker_is_active")

          if (updateError || !updatedRows || updatedRows.length === 0) {
            console.error("❌ [supabaseApi.updateWorkerStatus] Failed to update worker profile", updateError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: updateError?.message ?? "עדכון העובד נכשל.",
              },
            }
          }

          const updatedProfile = updatedRows[0]

          const response: UpdateWorkerStatusResponse = {
            success: true,
            action,
            worker: {
              id: updatedProfile.id,
              fullName: updatedProfile.full_name ?? null,
              email: updatedProfile.email ?? null,
              phoneNumber: updatedProfile.phone_number ?? null,
              isActive: updatedProfile.worker_is_active !== false,
              role: updatedProfile.role ?? null,
            },
            closedShiftIds,
          }

          return { data: response }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [supabaseApi.updateWorkerStatus] Unexpected error", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["Worker", "WorkerAttendance"],
    }),

    resetWorkerPassword: builder.mutation<ResetWorkerPasswordResponse, ResetWorkerPasswordPayload>({
      query: ({ workerId }) => ({
        functionName: "reset-worker-password",
        body: { workerId },
      }),
      transformResponse: (response) => unwrapResponse<ResetWorkerPasswordResponse>(response),
    }),

    workerClockIn: builder.mutation<WorkerClockShiftResponse, { note?: string } | void>({
      async queryFn(body) {
        try {
          const note =
            typeof body?.note === "string" && body.note.trim().length > 0 ? body.note.trim().slice(0, 500) : null
          const { data: user } = await supabase.auth.getUser()
          const workerId = user.user?.id

          if (!workerId) {
            return {
              error: {
                status: "UNAUTHORIZED",
                data: "המשתמש אינו מחובר.",
              },
            }
          }

          const { data: openShiftRows, error: openShiftError } = await supabase
            .from("worker_attendance_logs")
            .select("id, clock_in")
            .eq("worker_id", workerId)
            .is("clock_out", null)
            .order("clock_in", { ascending: false })
            .limit(1)

          if (openShiftError) {
            console.error("❌ [supabaseApi.workerClockIn] Failed to query existing shift", openShiftError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: openShiftError.message,
              },
            }
          }

          if (openShiftRows && openShiftRows.length > 0) {
            return {
              error: {
                status: "CONFLICT",
                data: "כבר קיימת משמרת פתוחה. סיים אותה לפני פתיחת משמרת חדשה.",
              },
            }
          }

          const { data: insertRows, error: insertError } = await supabase
            .from("worker_attendance_logs")
            .insert({
              worker_id: workerId,
              clock_in_note: note,
              created_by: workerId,
            })
            .select("id, clock_in")
            .order("clock_in", { ascending: false })
            .limit(1)

          if (insertError || !insertRows || insertRows.length === 0) {
            console.error("❌ [supabaseApi.workerClockIn] Failed to insert attendance log", insertError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: insertError?.message ?? "המשמרת לא נפתחה. נסה שוב.",
              },
            }
          }

          const shift = insertRows[0]
          const response: WorkerClockShiftResponse = {
            success: true,
            shift: {
              id: shift.id,
              clockIn: shift.clock_in,
              hasOpenShift: true,
            },
          }

          return { data: response }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [supabaseApi.workerClockIn] Unexpected error", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["Worker", "WorkerAttendance"],
    }),

    workerClockOut: builder.mutation<WorkerClockShiftResponse, { note?: string } | void>({
      async queryFn(body) {
        try {
          const note =
            typeof body?.note === "string" && body.note.trim().length > 0 ? body.note.trim().slice(0, 500) : null
          const { data: user } = await supabase.auth.getUser()
          const workerId = user.user?.id

          if (!workerId) {
            return {
              error: {
                status: "UNAUTHORIZED",
                data: "המשתמש אינו מחובר.",
              },
            }
          }

          const nowIso = new Date().toISOString()

          const { data: openShiftRows, error: openShiftError } = await supabase
            .from("worker_attendance_logs")
            .select("id, clock_in, clock_out")
            .eq("worker_id", workerId)
            .is("clock_out", null)
            .order("clock_in", { ascending: false })
            .limit(1)

          if (openShiftError) {
            console.error("❌ [supabaseApi.workerClockOut] Failed to query open shift", openShiftError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: openShiftError.message,
              },
            }
          }

          if (!openShiftRows || openShiftRows.length === 0) {
            return {
              error: {
                status: "CONFLICT",
                data: "לא נמצאה משמרת פתוחה לסיום.",
              },
            }
          }

          const openShift = openShiftRows[0]

          const { data: updatedRows, error: updateError } = await supabase
            .from("worker_attendance_logs")
            .update({
              clock_out: nowIso,
              clock_out_note: note,
              closed_by: workerId,
            })
            .eq("id", openShift.id)
            .eq("worker_id", workerId)
            .is("clock_out", null)
            .select("id, clock_in, clock_out")

          if (updateError || !updatedRows || updatedRows.length === 0) {
            console.error("❌ [supabaseApi.workerClockOut] Failed to update attendance log", updateError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: updateError?.message ?? "המשמרת לא נסגרה. נסה שוב.",
              },
            }
          }

          const updated = updatedRows[0]
          const response: WorkerClockShiftResponse = {
            success: true,
            shift: {
              id: updated.id,
              clockIn: updated.clock_in,
              clockOut: updated.clock_out ?? nowIso,
              durationMinutes: (() => {
                const start = Date.parse(updated.clock_in)
                const end = Date.parse(updated.clock_out ?? nowIso)
                if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
                  return 0
                }
                return Math.round((end - start) / 60000)
              })(),
            },
          }

          return { data: response }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [supabaseApi.workerClockOut] Unexpected error", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["Worker", "WorkerAttendance"],
    }),

    managerClockInWorker: builder.mutation<WorkerClockShiftResponse, { workerId: string; note?: string }>({
      async queryFn({ workerId, note }) {
        try {
          console.log("🕐 [supabaseApi.managerClockInWorker] Manager clocking in worker", { workerId, note })
          const { data: manager } = await supabase.auth.getUser()
          const managerId = manager.user?.id

          if (!managerId) {
            return {
              error: {
                status: "UNAUTHORIZED",
                data: "המנהל אינו מחובר.",
              },
            }
          }

          const clockInNote = typeof note === "string" && note.trim().length > 0 ? note.trim().slice(0, 500) : null

          // Check if worker already has an open shift
          const { data: openShiftRows, error: openShiftError } = await supabase
            .from("worker_attendance_logs")
            .select("id, clock_in")
            .eq("worker_id", workerId)
            .is("clock_out", null)
            .order("clock_in", { ascending: false })
            .limit(1)

          if (openShiftError) {
            console.error("❌ [supabaseApi.managerClockInWorker] Failed to query existing shift", openShiftError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: openShiftError.message,
              },
            }
          }

          if (openShiftRows && openShiftRows.length > 0) {
            return {
              error: {
                status: "CONFLICT",
                data: "כבר קיימת משמרת פתוחה עבור עובד זה. סיים אותה לפני פתיחת משמרת חדשה.",
              },
            }
          }

          // Insert new shift
          const { data: insertRows, error: insertError } = await supabase
            .from("worker_attendance_logs")
            .insert({
              worker_id: workerId,
              clock_in_note: clockInNote,
              created_by: managerId,
            })
            .select("id, clock_in")
            .order("clock_in", { ascending: false })
            .limit(1)

          if (insertError || !insertRows || insertRows.length === 0) {
            console.error("❌ [supabaseApi.managerClockInWorker] Failed to insert attendance log", insertError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: insertError?.message ?? "המשמרת לא נפתחה. נסה שוב.",
              },
            }
          }

          const shift = insertRows[0]
          const response: WorkerClockShiftResponse = {
            success: true,
            shift: {
              id: shift.id,
              clockIn: shift.clock_in,
              hasOpenShift: true,
            },
          }

          console.log("✅ [supabaseApi.managerClockInWorker] Successfully clocked in worker", response)
          return { data: response }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [supabaseApi.managerClockInWorker] Unexpected error", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["Worker", "WorkerAttendance"],
    }),

    managerClockOutWorker: builder.mutation<WorkerClockShiftResponse, { workerId: string; note?: string }>({
      async queryFn({ workerId, note }) {
        try {
          console.log("🕐 [supabaseApi.managerClockOutWorker] Manager clocking out worker", { workerId, note })
          const { data: manager } = await supabase.auth.getUser()
          const managerId = manager.user?.id

          if (!managerId) {
            return {
              error: {
                status: "UNAUTHORIZED",
                data: "המנהל אינו מחובר.",
              },
            }
          }

          const clockOutNote = typeof note === "string" && note.trim().length > 0 ? note.trim().slice(0, 500) : null

          const nowIso = new Date().toISOString()

          // Find open shift
          const { data: openShiftRows, error: openShiftError } = await supabase
            .from("worker_attendance_logs")
            .select("id, clock_in, clock_out")
            .eq("worker_id", workerId)
            .is("clock_out", null)
            .order("clock_in", { ascending: false })
            .limit(1)

          if (openShiftError) {
            console.error("❌ [supabaseApi.managerClockOutWorker] Failed to query open shift", openShiftError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: openShiftError.message,
              },
            }
          }

          if (!openShiftRows || openShiftRows.length === 0) {
            return {
              error: {
                status: "CONFLICT",
                data: "לא נמצאה משמרת פתוחה עבור עובד זה.",
              },
            }
          }

          const openShift = openShiftRows[0]

          // Update shift to close it
          const { data: updatedRows, error: updateError } = await supabase
            .from("worker_attendance_logs")
            .update({
              clock_out: nowIso,
              clock_out_note: clockOutNote,
              closed_by: managerId,
            })
            .eq("id", openShift.id)
            .eq("worker_id", workerId)
            .is("clock_out", null)
            .select("id, clock_in, clock_out")

          if (updateError || !updatedRows || updatedRows.length === 0) {
            console.error("❌ [supabaseApi.managerClockOutWorker] Failed to update attendance log", updateError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: updateError?.message ?? "המשמרת לא נסגרה. נסה שוב.",
              },
            }
          }

          const updated = updatedRows[0]
          const response: WorkerClockShiftResponse = {
            success: true,
            shift: {
              id: updated.id,
              clockIn: updated.clock_in,
              clockOut: updated.clock_out ?? nowIso,
              durationMinutes: (() => {
                const start = Date.parse(updated.clock_in)
                const end = Date.parse(updated.clock_out ?? nowIso)
                if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
                  return 0
                }
                return Math.round((end - start) / 60000)
              })(),
            },
          }

          console.log("✅ [supabaseApi.managerClockOutWorker] Successfully clocked out worker", response)
          return { data: response }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [supabaseApi.managerClockOutWorker] Unexpected error", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["Worker", "WorkerAttendance"],
    }),

    managerCreateShift: builder.mutation<
      WorkerClockShiftResponse,
      {
        workerId: string
        clockIn: string
        clockOut?: string | null
        clockInNote?: string | null
        clockOutNote?: string | null
      }
    >({
      async queryFn({ workerId, clockIn, clockOut, clockInNote, clockOutNote }) {
        try {
          console.log("🕐 [supabaseApi.managerCreateShift] Manager creating shift", {
            workerId,
            clockIn,
            clockOut,
            clockInNote,
            clockOutNote,
          })
          const { data: manager } = await supabase.auth.getUser()
          const managerId = manager.user?.id

          if (!managerId) {
            return {
              error: {
                status: "UNAUTHORIZED",
                data: "המנהל אינו מחובר.",
              },
            }
          }

          // Validate clock_in
          const clockInDate = new Date(clockIn)
          if (Number.isNaN(clockInDate.getTime())) {
            return {
              error: {
                status: "VALIDATION_ERROR",
                data: "תאריך/שעת התחלה לא תקין.",
              },
            }
          }

          // Validate clock_out if provided
          if (clockOut) {
            const clockOutDate = new Date(clockOut)
            if (Number.isNaN(clockOutDate.getTime())) {
              return {
                error: {
                  status: "VALIDATION_ERROR",
                  data: "תאריך/שעת סיום לא תקין.",
                },
              }
            }
            if (clockOutDate <= clockInDate) {
              return {
                error: {
                  status: "VALIDATION_ERROR",
                  data: "שעת סיום חייבת להיות מאוחרת משעת התחלה.",
                },
              }
            }
          }

          const trimmedClockInNote =
            typeof clockInNote === "string" && clockInNote.trim().length > 0 ? clockInNote.trim().slice(0, 500) : null
          const trimmedClockOutNote =
            typeof clockOutNote === "string" && clockOutNote.trim().length > 0
              ? clockOutNote.trim().slice(0, 500)
              : null

          // Insert new shift
          const { data: insertRows, error: insertError } = await supabase
            .from("worker_attendance_logs")
            .insert({
              worker_id: workerId,
              clock_in: clockIn,
              clock_out: clockOut || null,
              clock_in_note: trimmedClockInNote,
              clock_out_note: trimmedClockOutNote,
              created_by: managerId,
              closed_by: clockOut ? managerId : null,
            })
            .select("id, clock_in, clock_out")
            .order("clock_in", { ascending: false })
            .limit(1)

          if (insertError || !insertRows || insertRows.length === 0) {
            console.error("❌ [supabaseApi.managerCreateShift] Failed to insert attendance log", insertError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: insertError?.message ?? "המשמרת לא נוצרה. נסה שוב.",
              },
            }
          }

          const shift = insertRows[0]
          const nowIso = new Date().toISOString()
          const response: WorkerClockShiftResponse = {
            success: true,
            shift: shift.clock_out
              ? {
                  id: shift.id,
                  clockIn: shift.clock_in,
                  clockOut: shift.clock_out,
                  durationMinutes: (() => {
                    const start = Date.parse(shift.clock_in)
                    const end = Date.parse(shift.clock_out)
                    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
                      return 0
                    }
                    return Math.round((end - start) / 60000)
                  })(),
                }
              : {
                  id: shift.id,
                  clockIn: shift.clock_in,
                  hasOpenShift: true,
                },
          }

          console.log("✅ [supabaseApi.managerCreateShift] Successfully created shift", response)
          return { data: response }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [supabaseApi.managerCreateShift] Unexpected error", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["Worker", "WorkerAttendance"],
    }),

    managerUpdateShift: builder.mutation<
      WorkerClockShiftResponse,
      {
        shiftId: string
        clockIn?: string
        clockOut?: string | null
        clockInNote?: string | null
        clockOutNote?: string | null
      }
    >({
      async queryFn({ shiftId, clockIn, clockOut, clockInNote, clockOutNote }) {
        try {
          console.log("🕐 [supabaseApi.managerUpdateShift] Manager updating shift", {
            shiftId,
            clockIn,
            clockOut,
            clockInNote,
            clockOutNote,
          })
          const { data: manager } = await supabase.auth.getUser()
          const managerId = manager.user?.id

          if (!managerId) {
            return {
              error: {
                status: "UNAUTHORIZED",
                data: "המנהל אינו מחובר.",
              },
            }
          }

          // Get existing shift to validate
          const { data: existingShift, error: fetchError } = await supabase
            .from("worker_attendance_logs")
            .select("id, clock_in, clock_out, worker_id")
            .eq("id", shiftId)
            .single()

          if (fetchError || !existingShift) {
            console.error("❌ [supabaseApi.managerUpdateShift] Failed to fetch shift", fetchError)
            return {
              error: {
                status: "NOT_FOUND",
                data: "המשמרת לא נמצאה.",
              },
            }
          }

          // Validate clock_in if provided
          let finalClockIn = existingShift.clock_in
          if (clockIn) {
            const clockInDate = new Date(clockIn)
            if (Number.isNaN(clockInDate.getTime())) {
              return {
                error: {
                  status: "VALIDATION_ERROR",
                  data: "תאריך/שעת התחלה לא תקין.",
                },
              }
            }
            finalClockIn = clockIn
          }

          // Validate clock_out if provided
          let finalClockOut = existingShift.clock_out
          if (clockOut !== undefined) {
            if (clockOut === null) {
              finalClockOut = null
            } else {
              const clockOutDate = new Date(clockOut)
              if (Number.isNaN(clockOutDate.getTime())) {
                return {
                  error: {
                    status: "VALIDATION_ERROR",
                    data: "תאריך/שעת סיום לא תקין.",
                  },
                }
              }
              const clockInDate = new Date(finalClockIn)
              if (clockOutDate <= clockInDate) {
                return {
                  error: {
                    status: "VALIDATION_ERROR",
                    data: "שעת סיום חייבת להיות מאוחרת משעת התחלה.",
                  },
                }
              }
              finalClockOut = clockOut
            }
          }

          const trimmedClockInNote =
            clockInNote !== undefined
              ? typeof clockInNote === "string" && clockInNote.trim().length > 0
                ? clockInNote.trim().slice(0, 500)
                : null
              : undefined
          const trimmedClockOutNote =
            clockOutNote !== undefined
              ? typeof clockOutNote === "string" && clockOutNote.trim().length > 0
                ? clockOutNote.trim().slice(0, 500)
                : null
              : undefined

          // Build update object
          const updateData: {
            clock_in?: string
            clock_out?: string | null
            clock_in_note?: string | null
            clock_out_note?: string | null
            closed_by?: string | null
          } = {}

          if (clockIn !== undefined) {
            updateData.clock_in = finalClockIn
          }
          if (clockOut !== undefined) {
            updateData.clock_out = finalClockOut
            updateData.closed_by = finalClockOut ? managerId : null
          }
          if (clockInNote !== undefined) {
            updateData.clock_in_note = trimmedClockInNote
          }
          if (clockOutNote !== undefined) {
            updateData.clock_out_note = trimmedClockOutNote
          }

          // Update shift
          const { data: updatedRows, error: updateError } = await supabase
            .from("worker_attendance_logs")
            .update(updateData)
            .eq("id", shiftId)
            .select("id, clock_in, clock_out")
            .single()

          if (updateError || !updatedRows) {
            console.error("❌ [supabaseApi.managerUpdateShift] Failed to update attendance log", updateError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: updateError?.message ?? "המשמרת לא עודכנה. נסה שוב.",
              },
            }
          }

          const updated = updatedRows
          const nowIso = new Date().toISOString()
          const response: WorkerClockShiftResponse = {
            success: true,
            shift: updated.clock_out
              ? {
                  id: updated.id,
                  clockIn: updated.clock_in,
                  clockOut: updated.clock_out,
                  durationMinutes: (() => {
                    const start = Date.parse(updated.clock_in)
                    const end = Date.parse(updated.clock_out)
                    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
                      return 0
                    }
                    return Math.round((end - start) / 60000)
                  })(),
                }
              : {
                  id: updated.id,
                  clockIn: updated.clock_in,
                  hasOpenShift: true,
                },
          }

          console.log("✅ [supabaseApi.managerUpdateShift] Successfully updated shift", response)
          return { data: response }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [supabaseApi.managerUpdateShift] Unexpected error", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["Worker", "WorkerAttendance"],
    }),

    managerDeleteShift: builder.mutation<{ success: true; shiftId: string }, { shiftId: string }>({
      async queryFn({ shiftId }) {
        try {
          console.log("🗑️ [supabaseApi.managerDeleteShift] Manager deleting shift", { shiftId })
          const { data: manager } = await supabase.auth.getUser()
          const managerId = manager.user?.id

          if (!managerId) {
            return {
              error: {
                status: "UNAUTHORIZED",
                data: "המנהל אינו מחובר.",
              },
            }
          }

          // Delete shift
          const { error: deleteError } = await supabase.from("worker_attendance_logs").delete().eq("id", shiftId)

          if (deleteError) {
            console.error("❌ [supabaseApi.managerDeleteShift] Failed to delete attendance log", deleteError)
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: deleteError.message ?? "המשמרת לא נמחקה. נסה שוב.",
              },
            }
          }

          console.log("✅ [supabaseApi.managerDeleteShift] Successfully deleted shift", { shiftId })
          return { data: { success: true, shiftId } }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [supabaseApi.managerDeleteShift] Unexpected error", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["Worker", "WorkerAttendance"],
    }),

    // Customer Search - using edge function with service_role to bypass RLS
    // This allows managers to see all customers while regular customers remain restricted to their own
    searchCustomers: builder.query<
      {
        customers: Array<{
          id: string
          fullName?: string
          phone?: string
          email?: string
          dogNames?: string
          recordId?: string
        }>
        count: number
        searchTerm: string
      },
      { searchTerm: string }
    >({
      async queryFn({ searchTerm }) {
        try {
          const { searchCustomers } = await import("@/lib/customers.module")
          const result = await searchCustomers(searchTerm)
          return { data: result }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["Customer"],
    }),

    createCustomer: builder.mutation<
      {
        success: boolean
        customerId: string
        customerTypeId?: string | null
        customer?: {
          id: string
          fullName: string
          phone: string
          email?: string | null
          customerTypeId?: string | null
        }
        error?: string
        message?: string
      },
      {
        full_name: string
        phone_number: string
        email?: string
        customer_type_id?: string | null
      }
    >({
      query: ({ full_name, phone_number, email, customer_type_id }) => ({
        functionName: "create-customer",
        body: { full_name, phone_number, email, customer_type_id },
      }),
      transformResponse: (response) => unwrapResponse(response),
      // Note: We don't use invalidatesTags here to avoid RTK Query error #38
      // (Cannot refetch a query that has not been started yet)
      // Components that need to refetch customer data should do so manually
      // after a successful customer creation
    }),

    updateCustomer: builder.mutation<
      {
        success: boolean
        message?: string
        customer?: {
          id: string
          fullName: string
          phone: string
          email?: string | null
          address?: string | null
        }
        error?: string
      },
      {
        customerId: string
        full_name?: string
        phone_number?: string
        email?: string
        address?: string
        customer_type_id?: string | null
      }
    >({
      async queryFn({ customerId, full_name, phone_number, email, address, customer_type_id }) {
        try {
          const { updateCustomer } = await import("@/lib/customers.module")
          const result = await updateCustomer({
            customerId,
            full_name,
            phone_number,
            email,
            address,
            customer_type_id,
          })
          if (!result.success) {
            throw new Error(result.error || "Failed to update customer")
          }
          // Fetch updated customer data
          const { data: customerData } = await supabase
            .from("customers")
            .select("id, full_name, phone, email, address, customer_type_id")
            .eq("id", customerId)
            .single()

          return {
            data: {
              success: true,
              customer: customerData
                ? {
                    id: customerData.id,
                    fullName: customerData.full_name,
                    phone: customerData.phone,
                    email: customerData.email || null,
                    address: customerData.address || null,
                    customerTypeId: customerData.customer_type_id || null,
                  }
                : undefined,
            },
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      // Note: We don't use invalidatesTags here to avoid RTK Query error #38
      // (Cannot refetch a query that has not been started yet)
      // Components that need to refetch customer/user data should do so manually
      // after a successful customer update
    }),

    // Manager Schedule - Constraints (Station Unavailability)
    getStationConstraints: builder.query<
      Array<{
        id: string
        station_id: string
        reason: string
        notes: { text?: string }
        start_time: string
        end_time: string
        is_active: boolean
      }>,
      { date: string }
    >({
      async queryFn({ date }) {
        try {
          const dayStart = new Date(date)
          dayStart.setHours(0, 0, 0, 0)
          const dayEnd = new Date(dayStart)
          dayEnd.setHours(24, 0, 0, 0)

          const { data: constraintsData, error: constraintsError } = await supabase
            .from("station_unavailability")
            .select(
              `
              id,
              station_id,
              reason,
              notes,
              start_time,
              end_time,
              is_active
            `
            )
            .lt("start_time", dayEnd.toISOString())
            .gt("end_time", dayStart.toISOString())

          if (constraintsError) {
            throw constraintsError
          }

          // Transform to match expected format
          const transformed = (constraintsData || []).map((constraint) => ({
            id: constraint.id,
            station_id: constraint.station_id,
            reason: constraint.reason || "",
            notes: typeof constraint.notes === "object" ? constraint.notes : { text: constraint.notes as string },
            start_time: constraint.start_time,
            end_time: constraint.end_time,
            is_active: constraint.is_active ?? true,
          }))

          return { data: transformed }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["Constraints"],
    }),

    // Manager Schedule - Station Working Hours
    getStationWorkingHours: builder.query<
      Record<
        string,
        Array<{
          id: string
          weekday: string
          open_time: string
          close_time: string
          shift_order: number
        }>
      >,
      { stationIds: string[] }
    >({
      async queryFn({ stationIds }) {
        try {
          if (stationIds.length === 0) {
            return { data: {} }
          }

          const { data: workingHoursData, error } = await supabase
            .from("station_working_hours")
            .select("id, station_id, weekday, open_time, close_time, shift_order")
            .in("station_id", stationIds)

          if (error) {
            throw error
          }

          // Group by station_id
          const hoursMap: Record<
            string,
            Array<{
              id: string
              weekday: string
              open_time: string
              close_time: string
              shift_order: number
            }>
          > = {}

          stationIds.forEach((stationId) => {
            hoursMap[stationId] = []
          })

          if (workingHoursData) {
            workingHoursData.forEach((hour) => {
              if (!hoursMap[hour.station_id]) {
                hoursMap[hour.station_id] = []
              }
              hoursMap[hour.station_id].push({
                id: hour.id,
                weekday: hour.weekday,
                open_time: hour.open_time,
                close_time: hour.close_time,
                shift_order: hour.shift_order,
              })
            })
          }

          return { data: hoursMap }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["StationWorkingHours"],
    }),

    // Manager Schedule - Shift Restrictions
    getShiftRestrictions: builder.query<
      Record<
        string,
        {
          allowedCustomerTypes?: string[]
          blockedCustomerTypes?: string[]
        }
      >,
      { shiftIds: string[] }
    >({
      async queryFn({ shiftIds }) {
        try {
          if (shiftIds.length === 0) {
            return { data: {} }
          }

          const dogCategoriesData: never[] = []

          // Fetch allowed customer types for shifts
          const { data: customerTypesData, error: customerTypesError } = await supabase
            .from("shift_allowed_customer_types")
            .select("shift_id, customer_type_id")
            .in("shift_id", shiftIds)

          if (customerTypesError) {
            console.error("Error fetching shift allowed customer types:", customerTypesError)
          }

          // Fetch blocked customer types for shifts
          const { data: blockedCustomerTypesData, error: blockedCustomerTypesError } = await supabase
            .from("shift_blocked_customer_types")
            .select("shift_id, customer_type_id")
            .in("shift_id", shiftIds)

          if (blockedCustomerTypesError) {
            console.error("Error fetching shift blocked customer types:", blockedCustomerTypesError)
          }

          // Group restrictions by shift_id
          const restrictionsMap: Record<
            string,
            {
              allowedCustomerTypes: string[]
              blockedCustomerTypes: string[]
            }
          > = {}

          shiftIds.forEach((shiftId) => {
            restrictionsMap[shiftId] = {
              allowedCustomerTypes: [],
              blockedCustomerTypes: [],
            }
          })

          if (customerTypesData) {
            customerTypesData.forEach((item) => {
              if (!restrictionsMap[item.shift_id]) {
                restrictionsMap[item.shift_id] = {
                  allowedCustomerTypes: [],
                  blockedCustomerTypes: [],
                }
              }
              restrictionsMap[item.shift_id].allowedCustomerTypes.push(item.customer_type_id)
            })
          }

          if (blockedCustomerTypesData) {
            blockedCustomerTypesData.forEach((item) => {
              if (!restrictionsMap[item.shift_id]) {
                restrictionsMap[item.shift_id] = {
                  allowedCustomerTypes: [],
                  blockedCustomerTypes: [],
                }
              }
              restrictionsMap[item.shift_id].blockedCustomerTypes.push(item.customer_type_id)
            })
          }

          return { data: restrictionsMap }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["ShiftRestrictions"],
    }),
  }),
})

export const {
  // User
  useCheckUserExistsQuery,
  useGetClientProfileQuery,
  useUpdateClientProfileMutation,
  useGetManyChatUserQuery,
  useGetClientSubscriptionsQuery,
  useGetCardUsageQuery,
  useGetSubscriptionTypesQuery,

  // Appointments
  useGetMergedAppointmentsQuery,
  useGetAvailableDatesQuery,
  useGetAvailableTimesQuery,
  useGetWaitingListEntriesQuery,
  useGetPendingAppointmentRequestsQuery,
  useGetAppointmentOrdersQuery,
  useLazyGetAppointmentOrdersQuery,
  useGetClientAppointmentHistoryQuery,
  useLazyGetClientAppointmentHistoryQuery,
  useGetManagerAppointmentQuery,
  useLazyGetManagerAppointmentQuery,
  useGetManagerScheduleQuery,
  useSearchManagerScheduleQuery,
  useLazySearchManagerScheduleQuery,
  useGetGroupAppointmentsQuery,
  useGetSeriesAppointmentsQuery,
  useDeleteWaitingListEntryMutation,
  useMoveAppointmentMutation,
  useCreateManagerAppointmentMutation,
  useUpdateAppointmentStatusMutation,
  useCreateProposedMeetingMutation,
  useUpdateProposedMeetingMutation,
  useDeleteProposedMeetingMutation,
  useSendProposedMeetingWebhookMutation,
  useSendManualProposedMeetingWebhookMutation,
  useGetProposedMeetingPublicQuery,
  useBookProposedMeetingMutation,

  // Workers
  useGetWorkersQuery,
  useGetWorkerAttendanceQuery,
  useGetAllWorkerShiftsQuery,
  useGetWorkerStatusQuery,
  useRegisterWorkerMutation,
  useResetWorkerPasswordMutation,
  useUpdateWorkerStatusMutation,
  useWorkerClockInMutation,
  useWorkerClockOutMutation,
  useManagerClockInWorkerMutation,
  useManagerClockOutWorkerMutation,
  useManagerCreateShiftMutation,
  useManagerUpdateShiftMutation,
  useManagerDeleteShiftMutation,

  // Customer Search
  useSearchCustomersQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,

  // Manager Schedule - Constraints & Working Hours
  useGetStationConstraintsQuery,
  useGetStationWorkingHoursQuery,
  useGetShiftRestrictionsQuery,
} = supabaseApi
