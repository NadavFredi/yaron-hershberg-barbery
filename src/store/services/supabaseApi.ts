import type { BaseQueryFn } from "@reduxjs/toolkit/query"
import { createApi } from "@reduxjs/toolkit/query/react"
import { supabase } from "@/integrations/supabase/client"
import {
  checkUserExists as checkCustomerExists,
  getClientProfile as fetchClientProfile,
  updateClientProfile as saveClientProfile,
  createDog as createDogRecord,
  updateDog as updateDogRecord,
  getMergedAppointments as fetchMergedAppointments,
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
import type { ManagerScheduleData, ManagerAppointment, ManagerScheduleSearchResponse } from "@/types/managerSchedule"
import type { ProposedMeetingPublicDetails } from "@/types/proposedMeeting"
import type {
  GetWorkerAttendanceResponse,
  GetWorkersResponse,
  RegisterWorkerPayload,
  RegisterWorkerResponse,
  UpdateWorkerStatusPayload,
  UpdateWorkerStatusResponse,
  WorkerClockShiftResponse,
  WorkerStatusResponse,
} from "@/types/worker"

export type PendingAppointmentRequest = {
  id: string
  serviceType: "grooming" | "garden"
  createdAt: string
  startAt: string | null
  endAt: string | null
  customerId: string | null
  customerName: string | null
  customerPhone: string | null
  dogId: string | null
  dogName: string | null
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
  tagTypes: [
    "User",
    "Appointment",
    "Dog",
    "Availability",
    "WaitingList",
    "GardenAppointment",
    "ManagerSchedule",
    "Customer",
    "Worker",
    "WorkerAttendance",
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
    getDogAppointments: builder.query({
      query: (dogId: string) => ({
        functionName: "get-dog-appointments",
        body: { dogId },
      }),
      transformResponse: (response) => unwrapResponse(response),
      providesTags: ["Appointment"],
    }),

    getDogGardenAppointments: builder.query({
      async queryFn(dogId: string) {
        try {
          // Query daycare_appointments directly from Supabase
          const { data, error } = await supabase
            .from("daycare_appointments")
            .select(
              "id, start_at, end_at, status, late_pickup_requested, late_pickup_notes, garden_trim_nails, garden_brush, garden_bath, customer_notes, internal_notes"
            )
            .eq("dog_id", dogId)
            .neq("status", "cancelled")

          if (error) {
            return { error: { status: "SUPABASE_ERROR", data: error.message } }
          }

          // Transform to expected format
          const appointments = (data || []).map((apt) => ({
            id: apt.id,
            dogId,
            dogName: "", // Will be filled by getMergedAppointments
            date: apt.start_at ? apt.start_at.split("T")[0] : "",
            time: apt.start_at ? apt.start_at.split("T")[1]?.slice(0, 5) : "",
            service: "garden" as const,
            status: apt.status || "confirmed",
            stationId: "",
            notes: apt.customer_notes || "",
            gardenNotes: apt.internal_notes || "",
            startDateTime: apt.start_at,
            endDateTime: apt.end_at,
            latePickupRequested: apt.late_pickup_requested || false,
            latePickupNotes: apt.late_pickup_notes || "",
            gardenTrimNails: apt.garden_trim_nails || false,
            gardenBrush: apt.garden_brush || false,
            gardenBath: apt.garden_bath || false,
          }))

          return { data: { appointments } }
        } catch (error) {
          console.error("Failed to fetch garden appointments:", error)
          return { error: { status: "SUPABASE_ERROR", data: error instanceof Error ? error.message : String(error) } }
        }
      },
      providesTags: ["GardenAppointment"],
    }),

    getMergedAppointments: builder.query<MergedAppointment[], string>({
      async queryFn(dogId: string) {
        try {
          const result = await fetchMergedAppointments(dogId)
          // Return the appointments array directly for backward compatibility
          return { data: result.appointments || [] }
        } catch (error) {
          console.error(`❌ [supabaseApi] getMergedAppointments error:`, error)
          const message = error instanceof Error ? error.message : String(error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      providesTags: ["Appointment", "GardenAppointment"],
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

    getBreedStationDuration: builder.query({
      async queryFn({
        dogId,
        stationId,
        serviceType = "grooming",
      }: {
        dogId: string
        stationId: string
        serviceType?: "grooming" | "garden" | "both"
      }) {
        try {
          // Get the dog's breed_id
          const { data: dogData, error: dogError } = await supabase
            .from("dogs")
            .select("breed_id")
            .eq("id", dogId)
            .single()

          if (dogError || !dogData) {
            throw new Error(`Dog with ID ${dogId} not found: ${dogError?.message || "Unknown error"}`)
          }

          if (!dogData.breed_id) {
            console.warn("⚠️ [supabaseApi] Dog has no breed_id, returning unsupported duration", {
              dogId,
              stationId,
            })
            return {
              data: {
                supported: false,
                dogId,
                breedId: null,
                stationId,
                message: "לכלב לא מוגדר גזע. אנא הגדר גזע לכלב לפני קביעת התור.",
              },
            }
          }

          const breedId = dogData.breed_id

          if (serviceType === "grooming") {
            // Fetch station-breed rule (single source of truth for grooming durations)
            const { data: ruleData, error: ruleError } = await supabase
              .from("station_breed_rules")
              .select("duration_modifier_minutes, is_active")
              .eq("station_id", stationId)
              .eq("breed_id", breedId)
              .maybeSingle()

            if (ruleError) {
              throw new Error(`Failed to fetch station-breed configuration: ${ruleError.message}`)
            }

            if (!ruleData || !ruleData.is_active) {
              console.warn("⚠️ [supabaseApi] No active station_breed_rules entry found", {
                dogId,
                breedId,
                stationId,
              })
              return {
                data: {
                  supported: false,
                  dogId,
                  breedId,
                  stationId,
                  message: "העמדה שנבחרה אינה תומכת בשירות זה.",
                },
              }
            }

            const durationMinutes = ruleData.duration_modifier_minutes ?? null

            if (durationMinutes === null || durationMinutes <= 0) {
              console.warn("⚠️ [supabaseApi] station_breed_rules returned invalid duration", {
                dogId,
                breedId,
                stationId,
                durationMinutes,
              })
              return {
                data: {
                  supported: false,
                  dogId,
                  breedId,
                  stationId,
                  message: "לא הוגדר משך תספורת עבור הגזע בעמדה זו.",
                },
              }
            }

            const durationSeconds = durationMinutes * 60

            return {
              data: {
                supported: true,
                dogId,
                breedId,
                stationId,
                durationSeconds,
                durationMinutes,
              },
            }
          } else {
            // For garden service, return default duration
            const defaultGardenMinutes = 60
            const durationSeconds = defaultGardenMinutes * 60

            return {
              data: {
                supported: true,
                dogId,
                breedId,
                stationId,
                durationSeconds,
                durationMinutes: defaultGardenMinutes,
              },
            }
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
        appointmentType: "grooming" | "garden"
        newGardenAppointmentType?: "full-day" | "hourly"
        newGardenIsTrial?: boolean
        selectedHours?: { start: string; end: string }
        gardenTrimNails?: boolean
        gardenBrush?: boolean
        gardenBath?: boolean
        latePickupRequested?: boolean
        latePickupNotes?: string
        internalNotes?: string
      }) {
        try {
          const result = await moveAppointmentRecord(params)
          return { data: result }
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
      invalidatesTags: ["ManagerSchedule", "Appointment", "GardenAppointment"],
    }),

    createManagerAppointment: builder.mutation({
      async queryFn(params: {
        name: string
        stationId: string
        selectedStations: string[]
        startTime: string
        endTime: string
        appointmentType: "private" | "business" | "garden"
        groupId?: string
        customerId?: string
        dogId?: string
        isManualOverride?: boolean
        gardenAppointmentType?: "full-day" | "hourly" | "trial"
        services?: {
          gardenTrimNails?: boolean
          gardenBrush?: boolean
          gardenBath?: boolean
        }
        latePickupRequested?: boolean
        latePickupNotes?: string
        notes?: string
        internalNotes?: string
      }) {
        try {
          const result = await createManagerAppointmentRecord(params)
          return { data: result }
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
      invalidatesTags: ["ManagerSchedule", "Appointment", "GardenAppointment"],
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
      async queryFn(params: { inviteId: string; customerId: string; proposedMeetingId: string; notificationCount?: number }) {
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
      { meetingId: string; dogId: string; code?: string }
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

    getManagerSchedule: builder.query<
      ManagerScheduleData,
      { date: string; serviceType?: "grooming" | "garden" | "both" }
    >({
      async queryFn({ date, serviceType = "both" }) {
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

    searchManagerSchedule: builder.query<
      ManagerScheduleSearchResponse,
      { term: string; limit?: number }
    >({
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
              { count: "exact" },
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
            durationMinutes: row.clock_out ? differenceInMinutes(row.clock_in, row.clock_out) : differenceInMinutes(row.clock_in, nowIso),
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

          const [{ data: openShiftRows, error: openShiftError }, { data: recentRows, error: recentError }] = await Promise.all([
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
                  openShifts.map((row) => row.id),
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

    // Dogs
    listOwnerDogs: builder.query({
      async queryFn(ownerId: string) {
        try {
          if (!ownerId) {
            console.warn("⚠️ [listOwnerDogs RTK Query] No ownerId provided, returning empty array")
            return { data: { dogs: [] } }
          }

          // First get the customer_id from profiles or customers table
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, email")
            .eq("id", ownerId)
            .maybeSingle()

          if (profileError) {
            console.error("❌ [listOwnerDogs] Profile error:", profileError)
          }

          let customerId = ownerId

          // If this is a customer, try to get their customer_id from the customers table
          if (profile?.email) {
            const { data: customer } = await supabase
              .from("customers")
              .select("id")
              .eq("auth_user_id", ownerId)
              .maybeSingle()

            if (customer?.id) {
              customerId = customer.id
            }
          }

          // Query dogs with breed information
          const { data: dogsData, error: dogsError } = await supabase
            .from("dogs")
            .select(
              `
              id,
              name,
              gender,
              is_small,
              customer_id,
              breeds:breed_id (
                id,
                name,
                size_class,
                min_groom_price,
                max_groom_price
              )
            `
            )
            .eq("customer_id", customerId)

          if (dogsError) {
            console.error("❌ [listOwnerDogs] Dogs error:", dogsError)
            return { error: { status: "SUPABASE_ERROR", data: dogsError.message } }
          }

          // Transform dogs to match expected structure
          interface DogWithBreed {
            id: string
            name: string | null
            gender: "male" | "female" | null
            is_small: boolean | null
            customer_id: string
            breeds: {
              id: string
              name: string
              size_class: string | null
              min_groom_price: number | null
              max_groom_price: number | null
            } | null
          }

          const dogIds = (dogsData || []).map((dog: DogWithBreed) => dog.id).filter(Boolean)
          let appointmentHistoryByDog: Record<string, boolean> = {}

          if (dogIds.length > 0) {
            const [{ data: daycareRows, error: daycareError }, { data: groomingRows, error: groomingError }] =
              await Promise.all([
                supabase.from("daycare_appointments").select("dog_id").in("dog_id", dogIds),
                supabase.from("grooming_appointments").select("dog_id").in("dog_id", dogIds),
              ])

            if (daycareError) {
              console.error("❌ [listOwnerDogs] Daycare history query failed:", daycareError)
              return { error: { status: "SUPABASE_ERROR", data: daycareError.message } }
            }

            if (groomingError) {
              console.error("❌ [listOwnerDogs] Grooming history query failed:", groomingError)
              return { error: { status: "SUPABASE_ERROR", data: groomingError.message } }
            }

            ;(daycareRows ?? []).forEach((row) => {
              if (row?.dog_id) {
                appointmentHistoryByDog[row.dog_id] = true
              }
            })

            ;(groomingRows ?? []).forEach((row) => {
              if (row?.dog_id) {
                appointmentHistoryByDog[row.dog_id] = true
              }
            })
          }

          // Get all unique breed IDs from the dogs
          const breedIds = [...new Set((dogsData || []).map((dog: DogWithBreed) => dog.breeds?.id).filter(Boolean) as string[])]
          
          // Fetch station_breed_rules for all breeds to calculate requires_staff_approval
          let breedRequiresApproval: Record<string, boolean> = {}
          if (breedIds.length > 0) {
            const { data: stationBreedRules, error: rulesError } = await supabase
              .from("station_breed_rules")
              .select("breed_id, is_active, requires_staff_approval")
              .in("breed_id", breedIds)
              .eq("is_active", true)
              .eq("requires_staff_approval", true)

            if (!rulesError && stationBreedRules) {
              // If any active station requires approval for a breed, mark that breed as requiring approval
              const breedsWithApproval = new Set(
                stationBreedRules.map((rule) => rule.breed_id).filter(Boolean) as string[]
              )
              breedIds.forEach((breedId) => {
                breedRequiresApproval[breedId] = breedsWithApproval.has(breedId)
              })
            }
          }

          const dogs = (dogsData || []).map((dog: DogWithBreed) => {
            const breed = dog.breeds || null

            return {
              id: dog.id,
              name: dog.name || "",
              gender: dog.gender,
              breed: breed?.name || "",
              size: breed?.size_class || "",
              isSmall: breed?.size_class === "small" || dog.is_small === true,
              ownerId: dog.customer_id,
              hasAppointmentHistory: Boolean(appointmentHistoryByDog[dog.id]),
              requiresSpecialApproval: Boolean(breed?.id && breedRequiresApproval[breed.id]),
              groomingMinPrice: breed?.min_groom_price ? Number(breed.min_groom_price) : null,
              groomingMaxPrice: breed?.max_groom_price ? Number(breed.max_groom_price) : null,
              hasBeenToGarden: undefined,
              questionnaireSuitableForGarden: undefined,
              staffApprovedForGarden: undefined,
              hasRegisteredToGardenBefore: undefined,
            }
          })

          return { data: { dogs } }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [listOwnerDogs RTK Query] Error fetching dogs:", error)
          return { error: { status: "SUPABASE_ERROR", data: message } }
        }
      },
      providesTags: ["Dog"],
    }),

    checkDogRegistration: builder.query({
      query: (dogId: string) => ({
        functionName: "check-dog-registration",
        body: { dogId },
      }),
      transformResponse: (response) => unwrapResponse(response),
      providesTags: ["Dog"],
    }),

    createDog: builder.mutation({
      async queryFn({
        customerId,
        ...dogData
      }: {
        customerId: string
        name: string
        breed_id?: string | null
        gender?: "male" | "female"
        birth_date?: string | null
        is_small?: boolean | null
        health_notes?: string | null
        vet_name?: string | null
        vet_phone?: string | null
        aggression_risk?: boolean | null
        people_anxious?: boolean | null
      }) {
        try {
          const result = await createDogRecord(customerId, dogData)
          if (!result.success) {
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: result.error || "Failed to create dog",
              },
            }
          }
          return { data: result }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [createDog RTK Query] Error:", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["Dog"],
    }),

    updateDog: builder.mutation({
      async queryFn({
        dogId,
        ...dogData
      }: {
        dogId: string
        name?: string
        breed_id?: string | null
        gender?: "male" | "female"
        birth_date?: string | null
        is_small?: boolean | null
        health_notes?: string | null
        vet_name?: string | null
        vet_phone?: string | null
        aggression_risk?: boolean | null
        people_anxious?: boolean | null
      }) {
        try {
          const result = await updateDogRecord(dogId, dogData)
          if (!result.success) {
            return {
              error: {
                status: "SUPABASE_ERROR",
                data: result.error || "Failed to update dog",
              },
            }
          }
          return { data: result }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("❌ [updateDog RTK Query] Error:", error)
          return {
            error: {
              status: "SUPABASE_ERROR",
              data: message,
            },
          }
        }
      },
      invalidatesTags: ["Dog"],
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
      invalidatesTags: ["Customer"],
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
      invalidatesTags: ["Customer", "User"],
    }),
  }),
})

export const {
  // User
  useCheckUserExistsQuery,
  useGetClientProfileQuery,
  useUpdateClientProfileMutation,
  useGetClientSubscriptionsQuery,
  useGetCardUsageQuery,
  useGetSubscriptionTypesQuery,

  // Appointments
  useGetDogAppointmentsQuery,
  useGetDogGardenAppointmentsQuery,
  useGetMergedAppointmentsQuery,
  useGetAvailableDatesQuery,
  useGetAvailableTimesQuery,
  useGetWaitingListEntriesQuery,
  useGetPendingAppointmentRequestsQuery,
  useGetManagerScheduleQuery,
  useSearchManagerScheduleQuery,
  useLazySearchManagerScheduleQuery,
  useGetGroupAppointmentsQuery,
  useGetBreedStationDurationQuery,
  useLazyGetBreedStationDurationQuery,
  useDeleteWaitingListEntryMutation,
  useMoveAppointmentMutation,
  useCreateManagerAppointmentMutation,
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
  useGetWorkerStatusQuery,
  useRegisterWorkerMutation,
  useUpdateWorkerStatusMutation,
  useWorkerClockInMutation,
  useWorkerClockOutMutation,

  // Dogs
  useListOwnerDogsQuery,
  useCheckDogRegistrationQuery,
  useCreateDogMutation,
  useUpdateDogMutation,

  // Customer Search
  useSearchCustomersQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
} = supabaseApi
