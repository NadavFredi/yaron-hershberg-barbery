import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface NavbarState {
  isNavbarPinned: boolean
  isNavbarVisible: boolean
  isOnManagerBoard: boolean
  isSubnavHovered: boolean
  isNavbarHovered: boolean
}

const initialState: NavbarState = {
  isNavbarPinned: true,
  isNavbarVisible: true,
  isOnManagerBoard: false,
  isSubnavHovered: false,
  isNavbarHovered: false,
}

const navbarSlice = createSlice({
  name: "navbar",
  initialState,
  reducers: {
    setIsNavbarPinned: (state, action: PayloadAction<boolean>) => {
      state.isNavbarPinned = action.payload
    },
    setIsNavbarVisible: (state, action: PayloadAction<boolean>) => {
      state.isNavbarVisible = action.payload
    },
    setIsOnManagerBoard: (state, action: PayloadAction<boolean>) => {
      state.isOnManagerBoard = action.payload
    },
    setIsSubnavHovered: (state, action: PayloadAction<boolean>) => {
      state.isSubnavHovered = action.payload
    },
    setIsNavbarHovered: (state, action: PayloadAction<boolean>) => {
      state.isNavbarHovered = action.payload
    },
  },
})

export const { setIsNavbarPinned, setIsNavbarVisible, setIsOnManagerBoard, setIsSubnavHovered, setIsNavbarHovered } = navbarSlice.actions

export default navbarSlice.reducer
