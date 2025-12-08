import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface MatrixSectionState {
    // Dialog states
    isStationDialogOpen: boolean
    isAddStationDialogOpen: boolean
    isAddBreedDialogOpen: boolean
    
    // Form inputs
    newStationName: string
    newBreedName: string
    
    // Loading states
    isAddingStation: boolean
    isAddingBreed: boolean
    
    // Search and filters
    searchTerm: string
    categoryFilterIds: string[]
    selectedColumnFilter: string | null
    columnFilterNeedsApproval: boolean | null
    columnFilterIsActive: boolean | null
    columnFilterRemoteBooking: boolean | null
    columnFilterDurationMin: string
    columnFilterDurationMax: string
}

const initialState: MatrixSectionState = {
    isStationDialogOpen: false,
    isAddStationDialogOpen: false,
    isAddBreedDialogOpen: false,
    newStationName: "",
    newBreedName: "",
    isAddingStation: false,
    isAddingBreed: false,
    searchTerm: "",
    categoryFilterIds: [],
    selectedColumnFilter: null,
    columnFilterNeedsApproval: null,
    columnFilterIsActive: null,
    columnFilterRemoteBooking: null,
    columnFilterDurationMin: "",
    columnFilterDurationMax: "",
}

const matrixSectionSlice = createSlice({
    name: "matrixSection",
    initialState,
    reducers: {
        setIsStationDialogOpen: (state, action: PayloadAction<boolean>) => {
            state.isStationDialogOpen = action.payload
        },
        setIsAddStationDialogOpen: (state, action: PayloadAction<boolean>) => {
            state.isAddStationDialogOpen = action.payload
        },
        setIsAddBreedDialogOpen: (state, action: PayloadAction<boolean>) => {
            state.isAddBreedDialogOpen = action.payload
        },
        setNewStationName: (state, action: PayloadAction<string>) => {
            state.newStationName = action.payload
        },
        setNewBreedName: (state, action: PayloadAction<string>) => {
            state.newBreedName = action.payload
        },
        setIsAddingStation: (state, action: PayloadAction<boolean>) => {
            state.isAddingStation = action.payload
        },
        setIsAddingBreed: (state, action: PayloadAction<boolean>) => {
            state.isAddingBreed = action.payload
        },
        setSearchTerm: (state, action: PayloadAction<string>) => {
            state.searchTerm = action.payload
        },
        setCategoryFilterIds: (state, action: PayloadAction<string[]>) => {
            state.categoryFilterIds = action.payload
        },
        setSelectedColumnFilter: (state, action: PayloadAction<string | null>) => {
            state.selectedColumnFilter = action.payload
        },
        setColumnFilterNeedsApproval: (state, action: PayloadAction<boolean | null>) => {
            state.columnFilterNeedsApproval = action.payload
        },
        setColumnFilterIsActive: (state, action: PayloadAction<boolean | null>) => {
            state.columnFilterIsActive = action.payload
        },
        setColumnFilterRemoteBooking: (state, action: PayloadAction<boolean | null>) => {
            state.columnFilterRemoteBooking = action.payload
        },
        setColumnFilterDurationMin: (state, action: PayloadAction<string>) => {
            state.columnFilterDurationMin = action.payload
        },
        setColumnFilterDurationMax: (state, action: PayloadAction<string>) => {
            state.columnFilterDurationMax = action.payload
        },
        resetColumnFilters: (state) => {
            state.columnFilterNeedsApproval = null
            state.columnFilterIsActive = null
            state.columnFilterRemoteBooking = null
            state.columnFilterDurationMin = ""
            state.columnFilterDurationMax = ""
        },
        resetFormInputs: (state) => {
            state.newStationName = ""
            state.newBreedName = ""
        },
    },
})

export const {
    setIsStationDialogOpen,
    setIsAddStationDialogOpen,
    setIsAddBreedDialogOpen,
    setNewStationName,
    setNewBreedName,
    setIsAddingStation,
    setIsAddingBreed,
    setSearchTerm,
    setCategoryFilterIds,
    setSelectedColumnFilter,
    setColumnFilterNeedsApproval,
    setColumnFilterIsActive,
    setColumnFilterRemoteBooking,
    setColumnFilterDurationMin,
    setColumnFilterDurationMax,
    resetColumnFilters,
    resetFormInputs,
} = matrixSectionSlice.actions

export default matrixSectionSlice.reducer

