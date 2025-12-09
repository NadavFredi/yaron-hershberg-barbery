import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import type { ManagerAppointment, ManagerServiceFilter, ManagerStation } from "@/pages/ManagerSchedule/types"

export interface DogDetails {
  id: string
  name: string
  clientClassification?: string
  owner?: {
    name: string
    classification?: string
    phone?: string
    email?: string
    clientId?: string
    recordId?: string
  }
  breed?: string
  notes?: string
  customer_id?: string
}

export interface ClientDetails {
  name: string
  classification?: string
  customerTypeName?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  preferences?: string
  recordId?: string
  recordNumber?: string
  clientId?: string
  staffNotes?: string
}

interface ManagerScheduleState {
  // Date navigation state (stored as ISO strings for Redux serialization)
  selectedDate: string // ISO string format
  calendarMonth: string // ISO string format

  // Selected entities
  selectedAppointment: ManagerAppointment | null
  selectedDog: DogDetails | null
  selectedClient: ClientDetails | null
  selectedDogForAppointments: { id: string; name: string } | null

  // Modal states
  isDetailsOpen: boolean
  isDogDetailsOpen: boolean
  isClientDetailsOpen: boolean
  showAllPastAppointments: boolean

  // Drag and drop states
  draggedAppointment: {
    appointment: ManagerAppointment | null
    cancelled: boolean
  }
  draggedConstraint: {
    constraint: {
      id: string
      station_id: string
      reason: string | null
      notes: { text?: string } | null
      start_time: string
      end_time: string
      is_active: boolean
    } | null
    cancelled: boolean
  }
  draggedWaitlistEntry: {
    entry: {
      id: string
      dogId: string
      dogName: string
      customerId: string
      customerName?: string | null
      customerTypeName?: string | null
      customerPhone?: string | null
      customerEmail?: string | null
      breedName?: string | null
      notes?: string | null
    } | null
    cancelled: boolean
  }
  draggedPinnedAppointment: {
    pin: {
      id: string
      appointment_id: string
      appointment_type: "grooming" | "daycare"
      reason: string
    } | null
    appointment: ManagerAppointment | null
    cancelled: boolean
  }

  // Business appointment modal state
  showBusinessAppointmentModal: boolean
  // Private appointment modal state
  showPrivateAppointmentModal: boolean
  privateAppointmentForm: {
    name: string
    selectedStations: string[]
    notes: string
  }
  prefillBusinessCustomer: {
    id: string
    fullName?: string
    phone?: string
    email?: string
  } | null
  prefillBusinessDog: {
    id: string
    name: string
    breed: string
    size: string
    isSmall: boolean
    ownerId: string
  } | null
  pendingWaitlistEntryId: string | null
  shouldRemoveFromWaitlist: boolean
  finalizedDragTimes: {
    startTime: string // ISO string
    endTime: string // ISO string
    stationId: string
  } | null
  pendingWaitlistPlacement: {
    entry: {
      id: string
      customerId: string
      customerName?: string | null
      customerPhone?: string | null
      customerEmail?: string | null
      dogId: string
      dogName: string
      breedName?: string | null
    }
    stationId: string
    startTime: string // ISO string
    endTime: string // ISO string
  } | null
  showWaitlistDropDialog: boolean

  // Filter/View states
  serviceFilter: ManagerServiceFilter
  visibleStationIds: string[]
  stationOrderIds: string[]
  stationWindowStart: number
  intervalMinutes: number
  pixelsPerMinuteScale: number

  // Constraint states
  selectedConstraint: {
    id: string
    station_id: string
    reason: string
    notes: { text?: string }
    start_time: string
    end_time: string
    is_active: boolean
  } | null
  isConstraintDetailsOpen: boolean
  constraintToDelete: string | null
  constraintToDeleteDetails: {
    constraint: {
      id: string
      station_id: string
      reason: string
      notes: { text?: string }
      start_time: string
      end_time: string
      is_active: boolean
    }
    relatedConstraints: Array<{
      id: string
      station_id: string
      reason: string
      notes: { text?: string }
      start_time: string
      end_time: string
      is_active: boolean
    }>
    stationIds: string[]
    stationNames: string[]
  } | null
  showDeleteConstraintDialog: boolean
  deleteFromAllStations: boolean
  editingConstraint: {
    id: string
    station_id: string
    reason: string
    notes: { text?: string }
    start_time: string
    end_time: string
    is_active: boolean
  } | null
  editingConstraintStationIds: string[]
  editingStation: ManagerStation | null
  isStationEditDialogOpen: boolean
  stationToDuplicate: ManagerStation | null
  isDuplicateStationDialogOpen: boolean
  isDuplicatingStation: boolean
  editingConstraintDefaultTimes: {
    startDate: string // ISO string
    endDate: string // ISO string
    startTime: string
    endTime: string
    isActive?: boolean
  } | null
  isConstraintDialogOpen: boolean
  stationConstraintsContext: {
    stationId: string
    stationName: string
    date: string // ISO string
  } | null
  isStationConstraintsModalOpen: boolean
  constraintResizingPreview: {
    constraintId: string
    endDate: string // ISO string
  } | null
  expandedConstraints: string[] // Array of constraint IDs that are expanded
  expandedAppointmentCards: string[] // Array of appointment IDs that are expanded
  resizingPreview: {
    appointmentId: string
    endDate: string // ISO string
  } | null

  // Appointment action states
  moveConfirmationOpen: boolean
  moveLoading: boolean
  deleteConfirmationOpen: boolean
  appointmentToDelete: ManagerAppointment | null
  updateCustomer: boolean
  cancelConfirmationOpen: boolean
  appointmentToCancel: ManagerAppointment | null
  updateCustomerCancel: boolean
  approveWithModifyDialogOpen: boolean
  appointmentToApproveWithModify: ManagerAppointment | null
  isDeleting: boolean
  isCancelling: boolean
  moveDetails: {
    appointment: ManagerAppointment
    oldStation: ManagerStation
    newStation: ManagerStation
    oldStartTime: string // ISO string
    oldEndTime: string // ISO string
    newStartTime: string // ISO string
    newEndTime: string // ISO string
    selectedHours?: { start: string; end: string }
  } | null

  // Duplicate series states
  duplicateSeriesOpen: boolean
  appointmentToDuplicate: ManagerAppointment | null
  duplicateLoading: boolean
  duplicateSuccessOpen: boolean

  // Loading states
  isStationOrderSaving: boolean
  isLoadingAppointment: boolean

  // Modal states
  showAppointmentTypeSelection: boolean
  showServiceTypeSelectionModal: boolean
  showDogAppointmentsModal: boolean
  showPaymentModal: boolean
  selectedAppointmentForPayment: ManagerAppointment | null
  paymentCartId: string | null
  showProposedMeetingModal: boolean
  proposedMeetingMode: "create" | "edit"
  proposedMeetingTimes: {
    startTime: string | null // ISO string or null
    endTime: string | null // ISO string or null
    stationId: string | null
  } | null
  editingProposedMeeting: ManagerAppointment | null
  showRescheduleProposalModal: boolean
  rescheduleTargetAppointment: ManagerAppointment | null
  rescheduleTimes: {
    startTime: string | null // ISO string or null
    endTime: string | null // ISO string or null
    stationId: string | null
  } | null
  rescheduleSubmitting: boolean
  showCustomerCommunicationModal: boolean
  customerCommunicationAppointment: ManagerAppointment | null
  showInvoiceModal: boolean
  invoiceModalAppointment: ManagerAppointment | null
  showDogReadyModal: boolean
  dogReadyModalAppointment: ManagerAppointment | null

  // Pinned appointment drop dialog state
  showPinnedAppointmentDropDialog: boolean
  pinnedAppointmentDropDetails: {
    pin: {
      id: string
      appointment_id: string
      appointment_type: "grooming" | "daycare"
      reason: string
    }
    appointment: ManagerAppointment
    targetStationId: string
    targetStartTime: string // ISO string
    targetEndTime: string // ISO string
  } | null
  pinnedAppointmentDropAction: "proposal" | "move" | "new" | null
  pinnedAppointmentDropRemoveFromPinned: boolean

  // Grooming edit modal states
  groomingEditOpen: boolean
  editingGroomingAppointment: ManagerAppointment | null
  groomingEditLoading: boolean
  updateCustomerGrooming: boolean

  // Personal appointment edit modal states
  personalAppointmentEditOpen: boolean
  editingPersonalAppointment: ManagerAppointment | null
  personalAppointmentEditLoading: boolean

  pendingResizeState: {
    appointment: ManagerAppointment
    originalEndTime: string // ISO string
    newEndTime: string // ISO string
    originalDuration: number
    newDuration: number
  } | null

  // Proposed meeting invite states
  sendingInviteId: string | null
  sendingAllInvites: boolean
  isDeletingProposed: boolean
  sendingCategoryId: string | null
  sendingCategoriesBatch: boolean

  // Delete proposed meeting dialog state
  showDeleteProposedDialog: boolean
  proposedMeetingToDelete: ManagerAppointment | null

  // Created appointments
  createdAppointments: Array<{
    startTime: string
    endTime: string
    recordID: string
    serviceType: string
    appointmentId: string
    appointmentType: string
  }>

  // Time selection states
  hourlyTimeSelection: { start: string; end: string } | null
  highlightedSlots: {
    stationId: string
    startTimeSlot: number
    endTimeSlot: number
    allTimeSlots: number[]
  } | null

  // Search states
  scheduleSearchTerm: string
  isScheduleSearchOpen: boolean
  isScheduleSearchExpanded: boolean

  // Column visibility states
  showPinnedAppointmentsColumn: boolean
  showWaitingListColumn: boolean
}

const initialState: ManagerScheduleState = {
  selectedDate: new Date().toISOString(),
  calendarMonth: (() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  })(),
  selectedAppointment: null,
  selectedDog: null,
  selectedClient: null,
  selectedDogForAppointments: null,
  isDetailsOpen: false,
  isDogDetailsOpen: false,
  isClientDetailsOpen: false,
  showAllPastAppointments: false,
  draggedAppointment: {
    appointment: null,
    cancelled: false,
  },
  draggedConstraint: {
    constraint: null,
    cancelled: false,
  },
  draggedWaitlistEntry: {
    entry: null,
    cancelled: false,
  },
  draggedPinnedAppointment: {
    pin: null,
    appointment: null,
    cancelled: false,
  },
  showBusinessAppointmentModal: false,
  showPrivateAppointmentModal: false,
  privateAppointmentForm: {
    name: "",
    selectedStations: [],
    notes: "",
  },
  prefillBusinessCustomer: null,
  prefillBusinessDog: null,
  pendingWaitlistEntryId: null,
  shouldRemoveFromWaitlist: true,
  finalizedDragTimes: null,
  pendingWaitlistPlacement: null,
  showWaitlistDropDialog: false,

  // Filter/View states - initialized from URL params or defaults
  serviceFilter: "both" as ManagerServiceFilter,
  visibleStationIds: [],
  stationOrderIds: [],
  stationWindowStart: 0,
  intervalMinutes: 15,
  pixelsPerMinuteScale: 5, // Default to very large (גדול מאוד)

  // Constraint states
  selectedConstraint: null,
  isConstraintDetailsOpen: false,
  constraintToDelete: null,
  constraintToDeleteDetails: null,
  showDeleteConstraintDialog: false,
  deleteFromAllStations: true,
  editingConstraint: null,
  editingConstraintStationIds: [],
  editingStation: null,
  isStationEditDialogOpen: false,
  stationToDuplicate: null,
  isDuplicateStationDialogOpen: false,
  isDuplicatingStation: false,
  editingConstraintDefaultTimes: null,
  isConstraintDialogOpen: false,
  stationConstraintsContext: null,
  isStationConstraintsModalOpen: false,
  constraintResizingPreview: null,
  expandedConstraints: [],
  expandedAppointmentCards: [],
  resizingPreview: null,

  // Appointment action states
  moveConfirmationOpen: false,
  moveLoading: false,
  deleteConfirmationOpen: false,
  appointmentToDelete: null,
  updateCustomer: false,
  cancelConfirmationOpen: false,
  appointmentToCancel: null,
  updateCustomerCancel: false,
  approveWithModifyDialogOpen: false,
  appointmentToApproveWithModify: null,
  isDeleting: false,
  isCancelling: false,
  moveDetails: null,

  // Duplicate series states
  duplicateSeriesOpen: false,
  appointmentToDuplicate: null,
  duplicateLoading: false,
  duplicateSuccessOpen: false,

  // Loading states
  isStationOrderSaving: false,
  isLoadingAppointment: false,

  // Modal states
  showAppointmentTypeSelection: false,
  showServiceTypeSelectionModal: false,
  showDogAppointmentsModal: false,
  showPaymentModal: false,
  selectedAppointmentForPayment: null,
  paymentCartId: null,
  showProposedMeetingModal: false,
  proposedMeetingMode: "create" as "create" | "edit",
  proposedMeetingTimes: null,
  editingProposedMeeting: null,
  showRescheduleProposalModal: false,
  rescheduleTargetAppointment: null,
  rescheduleTimes: null,
  rescheduleSubmitting: false,
  showCustomerCommunicationModal: false,
  customerCommunicationAppointment: null,
  showInvoiceModal: false,
  invoiceModalAppointment: null,
  showDogReadyModal: false,
  dogReadyModalAppointment: null,

  // Pinned appointment drop dialog state
  showPinnedAppointmentDropDialog: false,
  pinnedAppointmentDropDetails: null,
  pinnedAppointmentDropAction: null,
  pinnedAppointmentDropRemoveFromPinned: false,

  // Grooming edit modal states
  groomingEditOpen: false,
  editingGroomingAppointment: null,
  groomingEditLoading: false,
  updateCustomerGrooming: false,

  // Personal appointment edit modal states
  personalAppointmentEditOpen: false,
  editingPersonalAppointment: null,
  personalAppointmentEditLoading: false,

  pendingResizeState: null,

  // Proposed meeting invite states
  sendingInviteId: null,
  sendingAllInvites: false,
  isDeletingProposed: false,
  sendingCategoryId: null,
  sendingCategoriesBatch: false,

  // Delete proposed meeting dialog state
  showDeleteProposedDialog: false,
  proposedMeetingToDelete: null,

  // Created appointments
  createdAppointments: [],

  // Time selection states
  hourlyTimeSelection: null,
  highlightedSlots: null,

  // Search states
  scheduleSearchTerm: "",
  isScheduleSearchOpen: false,
  isScheduleSearchExpanded: false,

  // Column visibility states
  showPinnedAppointmentsColumn: false,
  showWaitingListColumn: false,
}

const managerScheduleSlice = createSlice({
  name: "managerSchedule",
  initialState,
  reducers: {
    // Date navigation
    setSelectedDate: {
      reducer: (state, action: PayloadAction<string>) => {
        state.selectedDate = action.payload
        // Update calendar month when date changes
        const dateObj = new Date(action.payload)
        const newMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1)
        state.calendarMonth = newMonth.toISOString()
      },
      prepare: (payload: Date | string) => {
        // Convert Date objects to ISO strings BEFORE creating the action (for Redux serialization)
        const dateStr = payload instanceof Date ? payload.toISOString() : payload
        return { payload: dateStr }
      },
    },
    setCalendarMonth: {
      reducer: (state, action: PayloadAction<string>) => {
        state.calendarMonth = action.payload
      },
      prepare: (payload: Date | string) => {
        // Convert Date objects to ISO strings BEFORE creating the action (for Redux serialization)
        const dateStr = payload instanceof Date ? payload.toISOString() : payload
        return { payload: dateStr }
      },
    },
    // Appointment selection
    setSelectedAppointment: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.selectedAppointment = action.payload
    },
    setIsDetailsOpen: (state, action: PayloadAction<boolean>) => {
      state.isDetailsOpen = action.payload
    },

    // Dog selection
    setSelectedDog: (state, action: PayloadAction<DogDetails | null>) => {
      state.selectedDog = action.payload
    },
    setIsDogDetailsOpen: (state, action: PayloadAction<boolean>) => {
      state.isDogDetailsOpen = action.payload
    },
    setSelectedDogForAppointments: (state, action: PayloadAction<{ id: string; name: string } | null>) => {
      state.selectedDogForAppointments = action.payload
    },

    // Client selection
    setSelectedClient: (state, action: PayloadAction<ClientDetails | null>) => {
      state.selectedClient = action.payload
    },
    setIsClientDetailsOpen: (state, action: PayloadAction<boolean>) => {
      state.isClientDetailsOpen = action.payload
    },

    // Other UI state
    setShowAllPastAppointments: (state, action: PayloadAction<boolean>) => {
      state.showAllPastAppointments = action.payload
    },

    // Drag and drop
    setDraggedAppointment: (
      state,
      action: PayloadAction<{
        appointment: ManagerAppointment | null
        cancelled: boolean
      }>
    ) => {
      state.draggedAppointment = action.payload
    },
    setDraggedConstraint: (
      state,
      action: PayloadAction<{
        constraint: ManagerScheduleState["draggedConstraint"]["constraint"]
        cancelled: boolean
      }>
    ) => {
      state.draggedConstraint = action.payload
    },
    setDraggedWaitlistEntry: (
      state,
      action: PayloadAction<{
        entry: ManagerScheduleState["draggedWaitlistEntry"]["entry"]
        cancelled: boolean
      }>
    ) => {
      state.draggedWaitlistEntry = action.payload
    },
    setDraggedPinnedAppointment: (
      state,
      action: PayloadAction<{
        pin: ManagerScheduleState["draggedPinnedAppointment"]["pin"]
        appointment: ManagerAppointment | null
        cancelled: boolean
      }>
    ) => {
      state.draggedPinnedAppointment = action.payload
    },

    // Business appointment modal
    setShowBusinessAppointmentModal: (state, action: PayloadAction<boolean>) => {
      state.showBusinessAppointmentModal = action.payload
    },
    // Private appointment modal
    setShowPrivateAppointmentModal: (state, action: PayloadAction<boolean>) => {
      state.showPrivateAppointmentModal = action.payload
      if (!action.payload) {
        // Reset form when modal closes
        state.privateAppointmentForm = {
          name: "",
          selectedStations: [],
          notes: "",
        }
      }
    },
    setPrivateAppointmentForm: (
      state,
      action: PayloadAction<
        | { name: string; selectedStations: string[]; notes: string }
        | ((prev: { name: string; selectedStations: string[]; notes: string }) => {
            name: string
            selectedStations: string[]
            notes: string
          })
      >
    ) => {
      if (typeof action.payload === "function") {
        state.privateAppointmentForm = action.payload(state.privateAppointmentForm)
      } else {
        state.privateAppointmentForm = action.payload
      }
    },
    setPrefillBusinessCustomer: (
      state,
      action: PayloadAction<{
        id: string
        fullName?: string
        phone?: string
        email?: string
      } | null>
    ) => {
      state.prefillBusinessCustomer = action.payload
    },
    setPrefillBusinessDog: (
      state,
      action: PayloadAction<{
        id: string
        name: string
        breed: string
        size: string
        isSmall: boolean
        ownerId: string
      } | null>
    ) => {
      state.prefillBusinessDog = action.payload
    },
    setPendingWaitlistEntryId: (state, action: PayloadAction<string | null>) => {
      state.pendingWaitlistEntryId = action.payload
    },
    setShouldRemoveFromWaitlist: (state, action: PayloadAction<boolean>) => {
      state.shouldRemoveFromWaitlist = action.payload
    },
    setFinalizedDragTimes: {
      reducer: (
        state,
        action: PayloadAction<{
          startTime: string
          endTime: string
          stationId: string
        } | null>
      ) => {
        state.finalizedDragTimes = action.payload
      },
      prepare: (
        payload: {
          startTime: Date | string
          endTime: Date | string
          stationId: string
        } | null
      ) => {
        if (!payload) return { payload: null }
        return {
          payload: {
            startTime: payload.startTime instanceof Date ? payload.startTime.toISOString() : payload.startTime,
            endTime: payload.endTime instanceof Date ? payload.endTime.toISOString() : payload.endTime,
            stationId: payload.stationId,
          },
        }
      },
    },
    setPendingWaitlistPlacement: {
      reducer: (
        state,
        action: PayloadAction<{
          entry: {
            id: string
            customerId: string
            customerName?: string | null
            customerPhone?: string | null
            customerEmail?: string | null
            dogId: string
            dogName: string
            breedName?: string | null
          }
          stationId: string
          startTime: string
          endTime: string
        } | null>
      ) => {
        state.pendingWaitlistPlacement = action.payload
      },
      prepare: (
        payload: {
          entry: {
            id: string
            customerId: string
            customerName?: string | null
            customerPhone?: string | null
            customerEmail?: string | null
            dogId: string
            dogName: string
            breedName?: string | null
          }
          stationId: string
          startTime: Date | string
          endTime: Date | string
        } | null
      ) => {
        if (!payload) return { payload: null }
        return {
          payload: {
            ...payload,
            startTime: payload.startTime instanceof Date ? payload.startTime.toISOString() : payload.startTime,
            endTime: payload.endTime instanceof Date ? payload.endTime.toISOString() : payload.endTime,
          },
        }
      },
    },
    setShowWaitlistDropDialog: (state, action: PayloadAction<boolean>) => {
      state.showWaitlistDropDialog = action.payload
    },

    // Filter/View actions
    setServiceFilter: (state, action: PayloadAction<ManagerServiceFilter>) => {
      state.serviceFilter = action.payload
    },
    setVisibleStationIds: (state, action: PayloadAction<string[]>) => {
      state.visibleStationIds = action.payload
    },
    setStationOrderIds: (state, action: PayloadAction<string[]>) => {
      state.stationOrderIds = action.payload
    },
    setStationWindowStart: (state, action: PayloadAction<number>) => {
      state.stationWindowStart = action.payload
    },
    setIntervalMinutes: (state, action: PayloadAction<number>) => {
      state.intervalMinutes = action.payload
    },
    setPixelsPerMinuteScale: (state, action: PayloadAction<number>) => {
      state.pixelsPerMinuteScale = action.payload
    },

    // Constraint actions
    setSelectedConstraint: (state, action: PayloadAction<ManagerScheduleState["selectedConstraint"]>) => {
      state.selectedConstraint = action.payload
    },
    setIsConstraintDetailsOpen: (state, action: PayloadAction<boolean>) => {
      state.isConstraintDetailsOpen = action.payload
    },
    setConstraintToDelete: (state, action: PayloadAction<string | null>) => {
      state.constraintToDelete = action.payload
    },
    setConstraintToDeleteDetails: (state, action: PayloadAction<ManagerScheduleState["constraintToDeleteDetails"]>) => {
      state.constraintToDeleteDetails = action.payload
    },
    setShowDeleteConstraintDialog: (state, action: PayloadAction<boolean>) => {
      state.showDeleteConstraintDialog = action.payload
    },
    setDeleteFromAllStations: (state, action: PayloadAction<boolean>) => {
      state.deleteFromAllStations = action.payload
    },
    setEditingConstraint: (state, action: PayloadAction<ManagerScheduleState["editingConstraint"]>) => {
      state.editingConstraint = action.payload
    },
    setEditingConstraintStationIds: (state, action: PayloadAction<string[]>) => {
      state.editingConstraintStationIds = action.payload
    },
    setEditingStation: (state, action: PayloadAction<ManagerStation | null>) => {
      state.editingStation = action.payload
    },
    setIsStationEditDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.isStationEditDialogOpen = action.payload
    },
    setStationToDuplicate: (state, action: PayloadAction<ManagerStation | null>) => {
      state.stationToDuplicate = action.payload
    },
    setIsDuplicateStationDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.isDuplicateStationDialogOpen = action.payload
    },
    setIsDuplicatingStation: (state, action: PayloadAction<boolean>) => {
      state.isDuplicatingStation = action.payload
    },
    setEditingConstraintDefaultTimes: (
      state,
      action: PayloadAction<ManagerScheduleState["editingConstraintDefaultTimes"]>
    ) => {
      state.editingConstraintDefaultTimes = action.payload
    },
    setIsConstraintDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.isConstraintDialogOpen = action.payload
    },
    setStationConstraintsContext: (state, action: PayloadAction<ManagerScheduleState["stationConstraintsContext"]>) => {
      state.stationConstraintsContext = action.payload
    },
    setIsStationConstraintsModalOpen: (state, action: PayloadAction<boolean>) => {
      state.isStationConstraintsModalOpen = action.payload
    },
    setConstraintResizingPreview: {
      reducer: (state, action: PayloadAction<{ constraintId: string; endDate: string } | null>) => {
        state.constraintResizingPreview = action.payload
      },
      prepare: (payload: { constraintId: string; endDate: Date } | null) => {
        if (!payload) return { payload: null }
        return {
          payload: {
            constraintId: payload.constraintId,
            endDate: payload.endDate instanceof Date ? payload.endDate.toISOString() : payload.endDate,
          },
        }
      },
    },
    setExpandedConstraints: (state, action: PayloadAction<string[]>) => {
      state.expandedConstraints = action.payload
    },
    addExpandedConstraint: (state, action: PayloadAction<string>) => {
      if (!state.expandedConstraints.includes(action.payload)) {
        state.expandedConstraints.push(action.payload)
      }
    },
    removeExpandedConstraint: (state, action: PayloadAction<string>) => {
      state.expandedConstraints = state.expandedConstraints.filter((id) => id !== action.payload)
    },
    setExpandedAppointmentCards: (state, action: PayloadAction<string[]>) => {
      state.expandedAppointmentCards = action.payload
    },
    addExpandedAppointmentCard: (state, action: PayloadAction<string>) => {
      if (!state.expandedAppointmentCards.includes(action.payload)) {
        state.expandedAppointmentCards.push(action.payload)
      }
    },
    removeExpandedAppointmentCard: (state, action: PayloadAction<string>) => {
      state.expandedAppointmentCards = state.expandedAppointmentCards.filter((id) => id !== action.payload)
    },
    setResizingPreview: {
      reducer: (state, action: PayloadAction<{ appointmentId: string; endDate: string } | null>) => {
        state.resizingPreview = action.payload
      },
      prepare: (payload: { appointmentId: string; endDate: Date } | null) => {
        if (!payload) return { payload: null }
        return {
          payload: {
            appointmentId: payload.appointmentId,
            endDate: payload.endDate.toISOString(),
          },
        }
      },
    },

    // Appointment action actions
    setMoveConfirmationOpen: (state, action: PayloadAction<boolean>) => {
      state.moveConfirmationOpen = action.payload
    },
    setMoveLoading: (state, action: PayloadAction<boolean>) => {
      state.moveLoading = action.payload
    },
    setDeleteConfirmationOpen: (state, action: PayloadAction<boolean>) => {
      state.deleteConfirmationOpen = action.payload
    },
    setAppointmentToDelete: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.appointmentToDelete = action.payload
    },
    setUpdateCustomer: (state, action: PayloadAction<boolean>) => {
      state.updateCustomer = action.payload
    },
    setCancelConfirmationOpen: (state, action: PayloadAction<boolean>) => {
      state.cancelConfirmationOpen = action.payload
    },
    setAppointmentToCancel: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.appointmentToCancel = action.payload
    },
    setUpdateCustomerCancel: (state, action: PayloadAction<boolean>) => {
      state.updateCustomerCancel = action.payload
    },
    setApproveWithModifyDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.approveWithModifyDialogOpen = action.payload
    },
    setAppointmentToApproveWithModify: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.appointmentToApproveWithModify = action.payload
    },
    setIsDeleting: (state, action: PayloadAction<boolean>) => {
      state.isDeleting = action.payload
    },
    setIsCancelling: (state, action: PayloadAction<boolean>) => {
      state.isCancelling = action.payload
    },
    setMoveDetails: {
      reducer: (state, action: PayloadAction<ManagerScheduleState["moveDetails"]>) => {
        state.moveDetails = action.payload
      },
      prepare: (
        payload: {
          appointment: ManagerAppointment
          oldStation: ManagerStation
          newStation: ManagerStation
          oldStartTime: Date | string
          oldEndTime: Date | string
          newStartTime: Date | string
          newEndTime: Date | string
          selectedHours?: { start: string; end: string }
        } | null
      ) => {
        if (!payload) return { payload: null }
        return {
          payload: {
            ...payload,
            oldStartTime:
              payload.oldStartTime instanceof Date ? payload.oldStartTime.toISOString() : payload.oldStartTime,
            oldEndTime: payload.oldEndTime instanceof Date ? payload.oldEndTime.toISOString() : payload.oldEndTime,
            newStartTime:
              payload.newStartTime instanceof Date ? payload.newStartTime.toISOString() : payload.newStartTime,
            newEndTime: payload.newEndTime instanceof Date ? payload.newEndTime.toISOString() : payload.newEndTime,
          },
        }
      },
    },

    // Duplicate series actions
    setDuplicateSeriesOpen: (state, action: PayloadAction<boolean>) => {
      state.duplicateSeriesOpen = action.payload
    },
    setAppointmentToDuplicate: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.appointmentToDuplicate = action.payload
    },
    setDuplicateLoading: (state, action: PayloadAction<boolean>) => {
      state.duplicateLoading = action.payload
    },
    setDuplicateSuccessOpen: (state, action: PayloadAction<boolean>) => {
      state.duplicateSuccessOpen = action.payload
    },

    // Loading actions
    setIsStationOrderSaving: (state, action: PayloadAction<boolean>) => {
      state.isStationOrderSaving = action.payload
    },
    setIsLoadingAppointment: (state, action: PayloadAction<boolean>) => {
      state.isLoadingAppointment = action.payload
    },

    // Modal actions
    setShowAppointmentTypeSelection: (state, action: PayloadAction<boolean>) => {
      state.showAppointmentTypeSelection = action.payload
    },
    setShowServiceTypeSelectionModal: (state, action: PayloadAction<boolean>) => {
      state.showServiceTypeSelectionModal = action.payload
    },
    setShowDogAppointmentsModal: (state, action: PayloadAction<boolean>) => {
      state.showDogAppointmentsModal = action.payload
    },
    setShowPaymentModal: (state, action: PayloadAction<boolean>) => {
      state.showPaymentModal = action.payload
    },
    setSelectedAppointmentForPayment: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.selectedAppointmentForPayment = action.payload
    },
    setPaymentCartId: (state, action: PayloadAction<string | null>) => {
      state.paymentCartId = action.payload
    },
    setShowProposedMeetingModal: (state, action: PayloadAction<boolean>) => {
      state.showProposedMeetingModal = action.payload
    },
    setProposedMeetingMode: (state, action: PayloadAction<"create" | "edit">) => {
      state.proposedMeetingMode = action.payload
    },
    setProposedMeetingTimes: {
      reducer: (state, action: PayloadAction<ManagerScheduleState["proposedMeetingTimes"]>) => {
        state.proposedMeetingTimes = action.payload
      },
      prepare: (
        payload: {
          startTime: Date | string | null
          endTime: Date | string | null
          stationId: string | null
        } | null
      ) => {
        if (!payload) return { payload: null }
        return {
          payload: {
            startTime: payload.startTime instanceof Date ? payload.startTime.toISOString() : payload.startTime,
            endTime: payload.endTime instanceof Date ? payload.endTime.toISOString() : payload.endTime,
            stationId: payload.stationId,
          },
        }
      },
    },
    setEditingProposedMeeting: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.editingProposedMeeting = action.payload
    },
    setShowRescheduleProposalModal: (state, action: PayloadAction<boolean>) => {
      state.showRescheduleProposalModal = action.payload
    },
    setRescheduleTargetAppointment: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.rescheduleTargetAppointment = action.payload
    },
    setShowCustomerCommunicationModal: (state, action: PayloadAction<boolean>) => {
      state.showCustomerCommunicationModal = action.payload
    },
    setCustomerCommunicationAppointment: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.customerCommunicationAppointment = action.payload
    },
    setShowInvoiceModal: (state, action: PayloadAction<boolean>) => {
      state.showInvoiceModal = action.payload
    },
    setInvoiceModalAppointment: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.invoiceModalAppointment = action.payload
    },
    setShowDogReadyModal: (state, action: PayloadAction<boolean>) => {
      state.showDogReadyModal = action.payload
    },
    setDogReadyModalAppointment: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.dogReadyModalAppointment = action.payload
    },
    setRescheduleTimes: {
      reducer: (state, action: PayloadAction<ManagerScheduleState["rescheduleTimes"]>) => {
        state.rescheduleTimes = action.payload
      },
      prepare: (
        payload: {
          startTime: Date | string | null
          endTime: Date | string | null
          stationId: string | null
        } | null
      ) => {
        if (!payload) return { payload: null }
        return {
          payload: {
            startTime: payload.startTime instanceof Date ? payload.startTime.toISOString() : payload.startTime,
            endTime: payload.endTime instanceof Date ? payload.endTime.toISOString() : payload.endTime,
            stationId: payload.stationId,
          },
        }
      },
    },
    setRescheduleSubmitting: (state, action: PayloadAction<boolean>) => {
      state.rescheduleSubmitting = action.payload
    },
    setShowPinnedAppointmentDropDialog: (state, action: PayloadAction<boolean>) => {
      state.showPinnedAppointmentDropDialog = action.payload
    },
    setPinnedAppointmentDropDetails: (
      state,
      action: PayloadAction<ManagerScheduleState["pinnedAppointmentDropDetails"]>
    ) => {
      state.pinnedAppointmentDropDetails = action.payload
    },
    setPinnedAppointmentDropAction: (state, action: PayloadAction<"proposal" | "move" | "new" | null>) => {
      state.pinnedAppointmentDropAction = action.payload
    },
    setPinnedAppointmentDropRemoveFromPinned: (state, action: PayloadAction<boolean>) => {
      state.pinnedAppointmentDropRemoveFromPinned = action.payload
    },
    setGroomingEditOpen: (state, action: PayloadAction<boolean>) => {
      state.groomingEditOpen = action.payload
    },
    setEditingGroomingAppointment: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.editingGroomingAppointment = action.payload
    },
    setGroomingEditLoading: (state, action: PayloadAction<boolean>) => {
      state.groomingEditLoading = action.payload
    },
    setUpdateCustomerGrooming: (state, action: PayloadAction<boolean>) => {
      state.updateCustomerGrooming = action.payload
    },
    setPersonalAppointmentEditOpen: (state, action: PayloadAction<boolean>) => {
      state.personalAppointmentEditOpen = action.payload
    },
    setEditingPersonalAppointment: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.editingPersonalAppointment = action.payload
    },
    setPersonalAppointmentEditLoading: (state, action: PayloadAction<boolean>) => {
      state.personalAppointmentEditLoading = action.payload
    },
    setPendingResizeState: (state, action: PayloadAction<ManagerScheduleState["pendingResizeState"]>) => {
      state.pendingResizeState = action.payload
    },

    // Proposed meeting invite actions
    setSendingInviteId: (state, action: PayloadAction<string | null>) => {
      state.sendingInviteId = action.payload
    },
    setSendingAllInvites: (state, action: PayloadAction<boolean>) => {
      state.sendingAllInvites = action.payload
    },
    setIsDeletingProposed: (state, action: PayloadAction<boolean>) => {
      state.isDeletingProposed = action.payload
    },
    setShowDeleteProposedDialog: (state, action: PayloadAction<boolean>) => {
      state.showDeleteProposedDialog = action.payload
    },
    setProposedMeetingToDelete: (state, action: PayloadAction<ManagerAppointment | null>) => {
      state.proposedMeetingToDelete = action.payload
    },
    setSendingCategoryId: (state, action: PayloadAction<string | null>) => {
      state.sendingCategoryId = action.payload
    },
    setSendingCategoriesBatch: (state, action: PayloadAction<boolean>) => {
      state.sendingCategoriesBatch = action.payload
    },

    // Created appointments actions
    setCreatedAppointments: (state, action: PayloadAction<ManagerScheduleState["createdAppointments"]>) => {
      state.createdAppointments = action.payload
    },
    addCreatedAppointment: (state, action: PayloadAction<ManagerScheduleState["createdAppointments"][0]>) => {
      state.createdAppointments.push(action.payload)
    },
    clearCreatedAppointments: (state) => {
      state.createdAppointments = []
    },

    // Time selection actions
    setHourlyTimeSelection: (state, action: PayloadAction<{ start: string; end: string } | null>) => {
      state.hourlyTimeSelection = action.payload
    },
    setHighlightedSlots: (state, action: PayloadAction<ManagerScheduleState["highlightedSlots"]>) => {
      state.highlightedSlots = action.payload
    },

    // Search actions
    setScheduleSearchTerm: (state, action: PayloadAction<string>) => {
      state.scheduleSearchTerm = action.payload
    },
    setIsScheduleSearchOpen: (state, action: PayloadAction<boolean>) => {
      state.isScheduleSearchOpen = action.payload
    },
    setIsScheduleSearchExpanded: (state, action: PayloadAction<boolean>) => {
      state.isScheduleSearchExpanded = action.payload
    },

    // Column visibility
    setShowPinnedAppointmentsColumn: (state, action: PayloadAction<boolean>) => {
      state.showPinnedAppointmentsColumn = action.payload
    },
    setShowWaitingListColumn: (state, action: PayloadAction<boolean>) => {
      state.showWaitingListColumn = action.payload
    },

    // Reset all modals
    closeAllModals: (state) => {
      state.isDetailsOpen = false
      state.isDogDetailsOpen = false
      state.isClientDetailsOpen = false
      state.isConstraintDetailsOpen = false
      state.showBusinessAppointmentModal = false
      state.showWaitlistDropDialog = false
      state.showServiceTypeSelectionModal = false
      state.showDogAppointmentsModal = false
      state.showPaymentModal = false
      state.showProposedMeetingModal = false
      state.showRescheduleProposalModal = false
      state.showCustomerCommunicationModal = false
      state.showInvoiceModal = false
      state.showDogReadyModal = false
      state.duplicateSeriesOpen = false
      state.deleteConfirmationOpen = false
      state.cancelConfirmationOpen = false
      state.approveWithModifyDialogOpen = false
      state.moveConfirmationOpen = false
      state.showDeleteConstraintDialog = false
      state.isConstraintDialogOpen = false
      state.isStationConstraintsModalOpen = false
      state.isStationEditDialogOpen = false
      state.isDuplicateStationDialogOpen = false
      // Reset selected entities
      state.selectedAppointment = null
      state.selectedDog = null
      state.selectedClient = null
      state.selectedConstraint = null
      state.selectedDogForAppointments = null
      state.appointmentToDelete = null
      state.appointmentToCancel = null
      state.appointmentToApproveWithModify = null
      state.appointmentToDuplicate = null
      state.selectedAppointmentForPayment = null
      state.paymentCartId = null
      state.editingProposedMeeting = null
      state.rescheduleTargetAppointment = null
      state.prefillBusinessCustomer = null
      state.prefillBusinessDog = null
      state.pendingWaitlistEntryId = null
      state.finalizedDragTimes = null
      state.pendingWaitlistPlacement = null
    },
  },
})

export const {
  setSelectedDate,
  setCalendarMonth,
  setSelectedAppointment,
  setIsDetailsOpen,
  setSelectedDog,
  setIsDogDetailsOpen,
  setSelectedDogForAppointments,
  setSelectedClient,
  setIsClientDetailsOpen,
  setShowAllPastAppointments,
  setDraggedAppointment,
  setDraggedConstraint,
  setDraggedWaitlistEntry,
  setDraggedPinnedAppointment,
  setShowBusinessAppointmentModal,
  setShowPrivateAppointmentModal,
  setPrivateAppointmentForm,
  setPrefillBusinessCustomer,
  setPrefillBusinessDog,
  setPendingWaitlistEntryId,
  setShouldRemoveFromWaitlist,
  setFinalizedDragTimes,
  setPendingWaitlistPlacement,
  setShowWaitlistDropDialog,
  // Filter/View
  setServiceFilter,
  setVisibleStationIds,
  setStationOrderIds,
  setStationWindowStart,
  setIntervalMinutes,
  setPixelsPerMinuteScale,
  // Constraints
  setSelectedConstraint,
  setIsConstraintDetailsOpen,
  setConstraintToDelete,
  setConstraintToDeleteDetails,
  setShowDeleteConstraintDialog,
  setDeleteFromAllStations,
  setEditingConstraint,
  setEditingConstraintStationIds,
  setEditingStation,
  setIsStationEditDialogOpen,
  setStationToDuplicate,
  setIsDuplicateStationDialogOpen,
  setIsDuplicatingStation,
  setEditingConstraintDefaultTimes,
  setIsConstraintDialogOpen,
  setStationConstraintsContext,
  setIsStationConstraintsModalOpen,
  setConstraintResizingPreview,
  setExpandedConstraints,
  addExpandedConstraint,
  removeExpandedConstraint,
  setExpandedAppointmentCards,
  addExpandedAppointmentCard,
  removeExpandedAppointmentCard,
  setResizingPreview,
  // Appointment actions
  setMoveConfirmationOpen,
  setMoveLoading,
  setDeleteConfirmationOpen,
  setAppointmentToDelete,
  setUpdateCustomer,
  setCancelConfirmationOpen,
  setAppointmentToCancel,
  setUpdateCustomerCancel,
  setApproveWithModifyDialogOpen,
  setAppointmentToApproveWithModify,
  setIsDeleting,
  setIsCancelling,
  setMoveDetails,
  // Duplicate series
  setDuplicateSeriesOpen,
  setAppointmentToDuplicate,
  setDuplicateLoading,
  setDuplicateSuccessOpen,
  // Loading
  setIsStationOrderSaving,
  setIsLoadingAppointment,
  // Modals
  setShowAppointmentTypeSelection,
  setShowServiceTypeSelectionModal,
  setShowDogAppointmentsModal,
  setShowPaymentModal,
  setSelectedAppointmentForPayment,
  setPaymentCartId,
  setShowProposedMeetingModal,
  setProposedMeetingMode,
  setProposedMeetingTimes,
  setEditingProposedMeeting,
  setShowRescheduleProposalModal,
  setRescheduleTargetAppointment,
  setRescheduleTimes,
  setRescheduleSubmitting,
  setShowCustomerCommunicationModal,
  setCustomerCommunicationAppointment,
  setShowInvoiceModal,
  setInvoiceModalAppointment,
  setShowDogReadyModal,
  setDogReadyModalAppointment,
  setShowPinnedAppointmentDropDialog,
  setPinnedAppointmentDropDetails,
  setPinnedAppointmentDropAction,
  setPinnedAppointmentDropRemoveFromPinned,
  // Grooming edit modal actions
  setGroomingEditOpen,
  setEditingGroomingAppointment,
  setGroomingEditLoading,
  setUpdateCustomerGrooming,
  // Personal appointment edit modal actions
  setPersonalAppointmentEditOpen,
  setEditingPersonalAppointment,
  setPersonalAppointmentEditLoading,
  setPendingResizeState,
  // Proposed meeting invites
  setSendingInviteId,
  setSendingAllInvites,
  setIsDeletingProposed,
  setShowDeleteProposedDialog,
  setProposedMeetingToDelete,
  setSendingCategoryId,
  setSendingCategoriesBatch,
  // Created appointments
  setCreatedAppointments,
  addCreatedAppointment,
  clearCreatedAppointments,
  // Time selection
  setHourlyTimeSelection,
  setHighlightedSlots,
  // Search
  setScheduleSearchTerm,
  setIsScheduleSearchOpen,
  setIsScheduleSearchExpanded,
  // Column visibility
  setShowPinnedAppointmentsColumn,
  setShowWaitingListColumn,
  // Reset
  closeAllModals,
} = managerScheduleSlice.actions

export default managerScheduleSlice.reducer
