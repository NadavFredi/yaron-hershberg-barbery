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
  tagTypes: ["Appointment", "Dog", "Client", "Service", "Breed", "Station"],
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

    // Dogs
    getDogs: builder.query({
      query: (config: AirtableConfig) => ({
        url: "/dogs",
        method: "POST",
        body: config,
      }),
      providesTags: ["Dog"],
    }),

    createDog: builder.mutation({
      query: ({ config, dog }) => ({
        url: "/dogs",
        method: "POST",
        body: { config, dog },
      }),
      invalidatesTags: ["Dog"],
    }),

    updateDog: builder.mutation({
      query: ({ config, id, updates }) => ({
        url: `/dogs/${id}`,
        method: "PATCH",
        body: { config, updates },
      }),
      invalidatesTags: ["Dog"],
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

    // Breeds
    getBreeds: builder.query({
      query: (config: AirtableConfig) => ({
        url: "/breeds",
        method: "POST",
        body: config,
      }),
      providesTags: ["Breed"],
    }),

    createBreed: builder.mutation({
      query: ({ config, breed }) => ({
        url: "/breeds",
        method: "POST",
        body: { config, breed },
      }),
      invalidatesTags: ["Breed"],
    }),

    updateBreed: builder.mutation({
      query: ({ config, id, updates }) => ({
        url: `/breeds/${id}`,
        method: "PATCH",
        body: { config, updates },
      }),
      invalidatesTags: ["Breed"],
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

  // Dogs
  useGetDogsQuery,
  useCreateDogMutation,
  useUpdateDogMutation,

  // Clients
  useGetClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,

  // Services
  useGetServicesQuery,
  useCreateServiceMutation,
  useUpdateServiceMutation,

  // Breeds
  useGetBreedsQuery,
  useCreateBreedMutation,
  useUpdateBreedMutation,

  // Stations
  useGetStationsQuery,
  useCreateStationMutation,
  useUpdateStationMutation,
} = airtableApi
