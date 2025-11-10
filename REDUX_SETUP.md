# Redux Toolkit & RTK Query Setup

This document explains how Redux Toolkit and RTK Query have been implemented in the WagTime Appointment Scheduler application to improve performance and avoid redundant API calls.

## 🚀 What's Been Implemented

### 1. Redux Store Structure

- **Centralized State Management**: All application state is now managed through Redux
- **RTK Query Integration**: Automatic caching, deduplication, and background updates
- **TypeScript Support**: Full type safety throughout the Redux ecosystem

### 2. Store Configuration

```
src/store/
├── index.ts              # Main store configuration
├── hooks.ts              # Custom Redux hooks
├── services/             # RTK Query API services
│   ├── airtableApi.ts    # Airtable operations
│   └── supabaseApi.ts    # Supabase operations
└── slices/               # Redux slices for different domains
    ├── authSlice.ts      # Authentication state
    ├── appointmentsSlice.ts # Appointments state
    ├── treatmentsSlice.ts      # Treatments state
    ├── servicesSlice.ts  # Services state
    ├── treatmentTypesSlice.ts    # TreatmentTypes state
    └── stationsSlice.ts  # Stations state
```

## 🔧 Key Features

### RTK Query Benefits

- **Automatic Caching**: API responses are cached and reused
- **Deduplication**: Multiple components requesting the same data won't trigger duplicate API calls
- **Background Updates**: Data can be refreshed in the background
- **Optimistic Updates**: UI updates immediately while API calls are in progress
- **Error Handling**: Built-in error handling and retry logic

### State Management

- **Normalized State**: Efficient data storage and retrieval
- **Immutable Updates**: All state changes are handled immutably
- **DevTools Integration**: Full Redux DevTools support for debugging

## 📱 Usage Examples

### Using RTK Query Hooks

```typescript
import { useGetTreatmentAppointmentsQuery } from "@/store/services/supabaseApi"

function MyComponent() {
  const { data: appointments, isLoading, error } = useGetTreatmentAppointmentsQuery(userId)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      {appointments.map((apt) => (
        <AppointmentCard key={apt.id} appointment={apt} />
      ))}
    </div>
  )
}
```

### Using Redux State

```typescript
import { useAppSelector, useAppDispatch } from "@/store/hooks"
import { setAppointments } from "@/store/slices/appointmentsSlice"

function MyComponent() {
  const dispatch = useAppDispatch()
  const { appointments } = useAppSelector((state) => state.appointments)

  const handleUpdate = (id: string, updates: any) => {
    dispatch(updateAppointment({ id, updates }))
  }

  return <div>{/* Your component JSX */}</div>
}
```

### Mutations (Creating/Updating Data)

```typescript
import { useCreateAppointmentMutation } from "@/store/services/airtableApi"

function AppointmentForm() {
  const [createAppointment, { isLoading }] = useCreateAppointmentMutation()

  const handleSubmit = async (data: any) => {
    try {
      await createAppointment({ config: airtableConfig, appointment: data }).unwrap()
      // Success handling
    } catch (error) {
      // Error handling
    }
  }

  return <form onSubmit={handleSubmit}>{/* Form fields */}</form>
}
```

## 🎯 Performance Improvements

### Before (Local State)

- ❌ Each component managed its own API calls
- ❌ Duplicate API requests for the same data
- ❌ No caching between component unmounts/remounts
- ❌ Manual loading and error state management

### After (Redux + RTK Query)

- ✅ Centralized data fetching with automatic deduplication
- ✅ Intelligent caching with background updates
- ✅ Shared state between components
- ✅ Automatic loading and error state management
- ✅ Optimistic updates for better UX

## 🔄 Data Flow

1. **Component Mounts** → RTK Query hook is called
2. **Cache Check** → If data exists and is fresh, return immediately
3. **API Call** → If no cache or stale data, make API request
4. **State Update** → Update Redux store with new data
5. **Component Re-render** → All components using the same data update automatically

## 🛠️ Development Tools

### Redux DevTools

- Install the Redux DevTools browser extension
- View all state changes in real-time
- Time-travel debugging
- Action replay and state inspection

### RTK Query DevTools

- Monitor API calls and cache status
- View request/response data
- Track cache invalidation

## 📚 Available Hooks

### Airtable API

- `useGetAppointmentsQuery` - Fetch appointments
- `useCreateAppointmentMutation` - Create new appointment
- `useUpdateAppointmentMutation` - Update existing appointment
- `useDeleteAppointmentMutation` - Delete appointment
- `useGetTreatmentsQuery` - Fetch treatments
- `useGetServicesQuery` - Fetch services
- `useGetTreatmentTypesQuery` - Fetch treatmentTypes
- `useGetStationsQuery` - Fetch stations

### Supabase API

- `useCheckUserExistsQuery` - Check if user exists
- `useGetTreatmentAppointmentsQuery` - Get treatment appointments
- `useGetAvailableDatesQuery` - Get available dates
- `useGetAvailableTimesQuery` - Get available times
- `useListOwnerTreatmentsQuery` - List owner's treatments

## 🚨 Best Practices

1. **Use RTK Query hooks** for all API operations
2. **Access Redux state** through `useAppSelector`
3. **Dispatch actions** through `useAppDispatch`
4. **Handle loading states** from RTK Query hooks
5. **Use cache tags** for automatic invalidation
6. **Implement optimistic updates** for better UX

## 🔮 Future Enhancements

- **Offline Support**: Implement offline-first architecture
- **Real-time Updates**: WebSocket integration for live data
- **Advanced Caching**: Custom cache policies and TTL
- **Background Sync**: Automatic data synchronization
- **Performance Monitoring**: Track API performance metrics

## 📖 Additional Resources

- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [RTK Query Documentation](https://redux-toolkit.js.org/rtk-query/overview)
- [Redux Style Guide](https://redux.js.org/style-guide/)
- [React Redux Hooks](https://react-redux.js.org/api/hooks)
