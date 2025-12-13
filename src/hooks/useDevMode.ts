import { useEffect } from "react"
import { useAppDispatch } from "@/store/hooks"
import { setShowDevId } from "@/store/slices/managerScheduleSlice"

/**
 * Global keyboard listener hook that detects when "dev" is typed
 * and updates Redux state to show dev IDs across all components.
 * Typing "off" will turn dev mode off.
 */
export const useDevMode = () => {
  const dispatch = useAppDispatch()

  useEffect(() => {
    let typedSequence = ""

    const handleKeyPress = (e: KeyboardEvent) => {
      // Only track letters
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        typedSequence += e.key.toLowerCase()
        // Keep only last 3 characters
        if (typedSequence.length > 3) {
          typedSequence = typedSequence.slice(-3)
        }
        // Check if "dev" was typed
        if (typedSequence === "dev") {
          dispatch(setShowDevId(true))
          typedSequence = "" // Reset to allow toggling
        }
        // Check if "off" was typed
        if (typedSequence === "off") {
          dispatch(setShowDevId(false))
          typedSequence = "" // Reset to allow toggling
        }
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => {
      window.removeEventListener("keydown", handleKeyPress)
    }
  }, [dispatch])
}
