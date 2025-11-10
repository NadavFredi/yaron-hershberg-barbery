import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import { AirtableConfig } from "@/integrations/airtable/types"

export const airtableApi = createApi({
  reducerPath: "airtableApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/airtable",
    prepareHeaders: (headers) => {
      headers.set("Content-Type", "application/json")
      return headers
    },
  }),
  tagTypes: ["Appointment", "Treatment", "Client", "Service", "TreatmentType", "Station"],
  endpoints: (builder) => ({
    // Appointments
    getAppointments: builder.query({
      query: (config: AirtableConfig) => ({
        url: "/appointments",
        method: "POST",
        body: config,
      }),
      providesTags: ["Appointment"],
    }),

    createAppointment: builder.mutation({
      query: ({ config, appointment }) => ({
        url: "/appointments",
        method: "POST",
        body: { config, appointment },
      }),
      invalidatesTags: ["Appointment"],
    }),

    updateAppointment: builder.mutation({
      query: ({ config, id, updates }) => ({
        url: `/appointments/${id}`,
        method: "PATCH",
        body: { config, updates },
      }),
      invalidatesTags: ["Appointment"],
    }),

    deleteAppointment: builder.mutation({
      query: ({ config, id }) => ({
        url: `/appointments/${id}`,
        method: "DELETE",
        body: { config },
      }),
      invalidatesTags: ["Appointment"],
    }),

    // Treatments
    getTreatments: builder.query({
      query: (config: AirtableConfig) => ({
        url: "/treatments",
        method: "POST",
        body: config,
      }),
      providesTags: ["Treatment"],
    }),

    createTreatment: builder.mutation({
      query: ({ config, treatment }) => ({
        url: "/treatments",
        method: "POST",
        body: { config, treatment },
      }),
      invalidatesTags: ["Treatment"],
    }),

    updateTreatment: builder.mutation({
      query: ({ config, id, updates }) => ({
        url: `/treatments/${id}`,
        method: "PATCH",
        body: { config, updates },
      }),
      invalidatesTags: ["Treatment"],
    }),

    // Clients
    getClients: builder.query({
      query: (config: AirtableConfig) => ({
        url: "/clients",
        method: "POST",
        body: config,
      }),
      providesTags: ["Client"],
    }),

    createClient: builder.mutation({
      query: ({ config, client }) => ({
        url: "/clients",
        method: "POST",
        body: { config, client },
      }),
      invalidatesTags: ["Client"],
    }),

    updateClient: builder.mutation({
      query: ({ config, id, updates }) => ({
        url: `/clients/${id}`,
        method: "PATCH",
        body: { config, updates },
      }),
      invalidatesTags: ["Client"],
    }),

    // Services
    getServices: builder.query({
      query: (config: AirtableConfig) => ({
        url: "/services",
        method: "POST",
        body: config,
      }),
      providesTags: ["Service"],
    }),

    createService: builder.mutation({
      query: ({ config, service }) => ({
        url: "/services",
        method: "POST",
        body: { config, service },
      }),
      invalidatesTags: ["Service"],
    }),

    updateService: builder.mutation({
      query: ({ config, id, updates }) => ({
        url: `/services/${id}`,
        method: "PATCH",
        body: { config, updates },
      }),
      invalidatesTags: ["Service"],
    }),

    // TreatmentTypes
    getTreatmentTypes: builder.query({
      query: (config: AirtableConfig) => ({
        url: "/treatmentTypes",
        method: "POST",
        body: config,
      }),
      providesTags: ["TreatmentType"],
    }),

    createTreatmentType: builder.mutation({
      query: ({ config, treatmentType }) => ({
        url: "/treatmentTypes",
        method: "POST",
        body: { config, treatmentType },
      }),
      invalidatesTags: ["TreatmentType"],
    }),

    updateTreatmentType: builder.mutation({
      query: ({ config, id, updates }) => ({
        url: `/treatmentTypes/${id}`,
        method: "PATCH",
        body: { config, updates },
      }),
      invalidatesTags: ["TreatmentType"],
    }),

    // Stations
    getStations: builder.query({
      query: (config: AirtableConfig) => ({
        url: "/stations",
        method: "POST",
        body: config,
      }),
      providesTags: ["Station"],
    }),

    createStation: builder.mutation({
      query: ({ config, station }) => ({
        url: "/stations",
        method: "POST",
        body: { config, station },
      }),
      invalidatesTags: ["Station"],
    }),

    updateStation: builder.mutation({
      query: ({ config, id, updates }) => ({
        url: `/stations/${id}`,
        method: "PATCH",
        body: { config, updates },
      }),
      invalidatesTags: ["Station"],
    }),
  }),
})

export const {
  // Appointments
  useGetAppointmentsQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
  useDeleteAppointmentMutation,

  // Treatments
  useGetTreatmentsQuery,
  useCreateTreatmentMutation,
  useUpdateTreatmentMutation,

  // Clients
  useGetClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,

  // Services
  useGetServicesQuery,
  useCreateServiceMutation,
  useUpdateServiceMutation,

  // TreatmentTypes
  useGetTreatmentTypesQuery,
  useCreateTreatmentTypeMutation,
  useUpdateTreatmentTypeMutation,

  // Stations
  useGetStationsQuery,
  useCreateStationMutation,
  useUpdateStationMutation,
} = airtableApi
