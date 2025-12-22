import { Clock } from "lucide-react"
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { CSSProperties, InputHTMLAttributes } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface TimePickerInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string
  onChange: (value: string) => void
  intervalMinutes?: number
  wrapperClassName?: string
  usePortal?: boolean
  portalContainer?: HTMLElement | null
}

const formatTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

const parseTimeToMinutes = (time: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

export const TimePickerInput = forwardRef<HTMLInputElement, TimePickerInputProps>(
  (
    {
      value,
      onChange,
      intervalMinutes = 15,
      className,
      wrapperClassName,
      onFocus,
      onBlur,
      usePortal = true,
      portalContainer,
      ...rest
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false)
    const [selectionMode, setSelectionMode] = useState<'hour' | 'minute'>('hour')
    const [selectedHour, setSelectedHour] = useState<number | null>(null)
    const [isTypingMode, setIsTypingMode] = useState(false)
    const [draftValue, setDraftValue] = useState(value)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const inputRef = useRef<HTMLInputElement | null>(null)
    const listRef = useRef<HTMLDivElement | null>(null)
    const wasOpenRef = useRef(false)
    const isManualModeChangeRef = useRef(false)
    const [portalStyles, setPortalStyles] = useState<CSSProperties>()
    const [maxHeight, setMaxHeight] = useState<number>(288) // 18rem = 288px

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    // Generate hour options (0-23)
    const hourOptions = useMemo(() => {
      return Array.from({ length: 24 }, (_, i) => i)
    }, [])

    // Generate minute options for selected hour (always use 5-minute intervals for minutes view)
    const minuteOptions = useMemo(() => {
      if (selectedHour === null) return []
      const options: string[] = []
      const step = 5 // Always use 5-minute intervals for minutes selection
      for (let minutes = 0; minutes < 60; minutes += step) {
        options.push(formatTime(selectedHour * 60 + minutes))
      }
      return options
    }, [selectedHour])

    // Reset selection mode when opening/closing - always start with hours
    useEffect(() => {
      // Skip if we're manually changing the mode
      if (isManualModeChangeRef.current) {
        isManualModeChangeRef.current = false
        return
      }

      if (open) {
        const justOpened = !wasOpenRef.current
        wasOpenRef.current = true

        // Always start with hour selection mode
        if (justOpened) {
          setSelectionMode('hour')
          // Extract hour from current value if exists to highlight it
          const parsed = parseTimeToMinutes(value)
          if (parsed !== null) {
            const hour = Math.floor(parsed / 60)
            setSelectedHour(hour)
          } else {
            setSelectedHour(null)
          }
        }
      } else {
        wasOpenRef.current = false
        setSelectionMode('hour')
        setSelectedHour(null)
      }
    }, [open, value])

    // Close the dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node
        if (
          containerRef.current?.contains(target) ||
          listRef.current?.contains(target)
        ) {
          return
        }
        setOpen(false)
      }

      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleHourSelect = useCallback(
      (hour: number) => {
        setSelectedHour(hour)
        setSelectionMode('minute')
      },
      [],
    )

    const handleMinuteSelect = useCallback(
      (time: string) => {
        onChange(time)
        setOpen(false)
        requestAnimationFrame(() => {
          inputRef.current?.focus()
        })
      },
      [onChange],
    )

    const normalizeTime = useCallback((time: string) => {
      if (!time) return ""

      // Already in HH:mm format
      if (/^\d{2}:\d{2}$/.test(time)) {
        return time
      }

      // Handle HH: or HH:H
      if (/^\d{1,2}:$/.test(time)) {
        return `${time.slice(0, -1).padStart(2, "0")}:00`
      }

      if (/^\d{1,2}:\d$/.test(time)) {
        const [hours, minutes] = time.split(":")
        return `${hours.padStart(2, "0")}:${minutes.padEnd(2, "0")}`
      }

      // Handle HH or single digit hour
      if (/^\d{1,2}$/.test(time)) {
        return `${time.padStart(2, "0")}:00`
      }

      // Handle 3 or 4 digit entries interpreted as HHmm
      if (/^\d{3,4}$/.test(time)) {
        const padded = time.padStart(4, "0")
        const hours = padded.slice(0, -2)
        const minutes = padded.slice(-2)
        return `${hours.padStart(2, "0")}:${minutes}`
      }

      return time
    }, [])

    // Sync draft value when external value changes (but not during typing)
    useEffect(() => {
      if (!isTypingMode) {
        setDraftValue(value)
      }
    }, [value, isTypingMode])

    // Filter input to only allow numbers and colons
    const filterInput = useCallback((input: string): string => {
      return input.replace(/[^\d:]/g, '')
    }, [])

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
      // Enter typing mode on any printable key press (except special navigation keys)
      const isPrintableKey = event.key.length === 1 || ['Backspace', 'Delete'].includes(event.key)
      const isNavigationKey = ['Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(event.key)

      if (!isTypingMode && isPrintableKey && !isNavigationKey) {
        setIsTypingMode(true)
        // Select all text when entering typing mode
        requestAnimationFrame(() => {
          inputRef.current?.select()
        })
      }
    }, [isTypingMode])

    const updatePortalPosition = useCallback(() => {
      if (!usePortal || !open) return
      const anchor = containerRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      const dropdownWidth = listRef.current?.offsetWidth || 280
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const gutter = 8
      const defaultMaxHeight = 288 // 18rem = 288px

      // Calculate available space
      const spaceBelow = viewportHeight - rect.bottom - gutter
      const spaceAbove = rect.top - gutter
      
      // Calculate dynamic max-height based on available space
      // Use the larger of the two spaces, but cap at default max-height
      const availableSpace = Math.max(spaceBelow, spaceAbove)
      const calculatedMaxHeight = Math.min(availableSpace - 20, defaultMaxHeight) // 20px buffer
      setMaxHeight(Math.max(calculatedMaxHeight, 200)) // Minimum 200px height

      // Calculate horizontal position
      let left = rect.right - dropdownWidth
      left = Math.max(gutter, Math.min(left, viewportWidth - dropdownWidth - gutter))

      // Calculate vertical position - check if dropdown fits below, otherwise show above
      let top = rect.bottom + gutter
      const estimatedDropdownHeight = Math.min(calculatedMaxHeight, defaultMaxHeight)
      
      // If not enough space below but more space above, show above
      if (spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow) {
        top = rect.top - estimatedDropdownHeight - gutter
      }
      
      // Ensure dropdown doesn't go off-screen vertically
      top = Math.max(gutter, Math.min(top, viewportHeight - estimatedDropdownHeight - gutter))

      setPortalStyles({
        position: "fixed",
        top,
        left,
        zIndex: 10000, // Higher than dialog z-50 (which is 50)
      })
    }, [open, usePortal])

    useLayoutEffect(() => {
      if (!usePortal || !open) return

      updatePortalPosition()
      const handleReposition = () => updatePortalPosition()

      window.addEventListener("resize", handleReposition)
      window.addEventListener("scroll", handleReposition, true)

      return () => {
        window.removeEventListener("resize", handleReposition)
        window.removeEventListener("scroll", handleReposition, true)
      }
    }, [open, usePortal, updatePortalPosition])

    useEffect(() => {
      if (open && usePortal) {
        requestAnimationFrame(() => updatePortalPosition())
      }
    }, [open, usePortal, updatePortalPosition])

    const dropdownNode = (
      <div
        ref={listRef}
        data-time-picker-portal
        className={cn(
          "w-64 sm:w-72 min-w-[240px] max-w-[320px] overflow-y-auto overflow-x-hidden rounded-md border border-gray-200 bg-white shadow-lg",
          usePortal ? "" : "absolute mt-2 z-50"
        )}
        style={usePortal ? { ...portalStyles, pointerEvents: 'auto', maxHeight: `${maxHeight}px` } : { maxHeight: `${maxHeight}px` }}
      >
        {selectionMode === 'hour' ? (
          <div className="p-2">
            <div className="grid grid-cols-3 lg:grid-cols-4 gap-1">
              {hourOptions.map((hour) => {
                const hourStr = hour.toString().padStart(2, "0")
                const isSelected = selectedHour === hour
                return (
                  <button
                    key={hour}
                    type="button"
                    className={cn(
                      "px-2 py-2 text-sm rounded hover:bg-gray-100 text-right",
                      isSelected && "bg-gray-100 font-medium text-gray-900"
                    )}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      handleHourSelect(hour)
                    }}
                  >
                    {hourStr}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between z-10">
              <button
                type="button"
                className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
                onMouseDown={(event) => {
                  event.preventDefault()
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  isManualModeChangeRef.current = true
                  setSelectionMode('hour')
                  // Keep the selected hour so it's highlighted when going back
                  const parsed = parseTimeToMinutes(value)
                  if (parsed !== null) {
                    const hour = Math.floor(parsed / 60)
                    setSelectedHour(hour)
                  } else {
                    setSelectedHour(null)
                  }
                }}
              >
                ← חזור
              </button>
              <span className="text-sm font-medium text-gray-900">
                {selectedHour !== null ? `${selectedHour.toString().padStart(2, "0")}:XX` : ''}
              </span>
            </div>
            <div className="p-2">
              <div className="grid grid-cols-3 lg:grid-cols-4 gap-1">
                {minuteOptions.map((time) => {
                  const isSelected = time === value
                  return (
                    <button
                      key={time}
                      type="button"
                      className={cn(
                        "px-2 py-2 text-sm rounded hover:bg-gray-100 text-right",
                        isSelected && "bg-gray-100 font-medium text-gray-900"
                      )}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handleMinuteSelect(time)
                      }}
                    >
                      {time}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )

    return (
      <div ref={containerRef} className={cn("relative", wrapperClassName)}>
        <div className="relative flex items-center">
          <Input
            ref={inputRef}
            value={isTypingMode ? draftValue : value}
            onChange={(event) => {
              // If not in typing mode, enter it
              if (!isTypingMode) {
                setIsTypingMode(true)
                requestAnimationFrame(() => {
                  inputRef.current?.select()
                })
              }

              // Filter to only allow numbers and colons
              const filtered = filterInput(event.target.value)
              setDraftValue(filtered)
            }}
            onKeyDown={handleKeyDown}
            onFocus={(event) => {
              setOpen(true)
              setIsTypingMode(false) // Reset typing mode on focus
              setDraftValue(value) // Reset draft to current value
              onFocus?.(event)
            }}
            onBlur={(event) => {
              // Exit typing mode and validate/normalize
              setIsTypingMode(false)

              // Normalize the draft value
              const normalized = normalizeTime(draftValue)

              // Update the actual value
              onChange(normalized)

              // Update selected hour based on normalized value
              const parsed = parseTimeToMinutes(normalized)
              if (parsed !== null) {
                const hour = Math.floor(parsed / 60)
                setSelectedHour(hour)
              }

              setOpen(false)
              onBlur?.(event)
            }}
            onClick={() => {
              setOpen(true)
              // Select all text on click if not in typing mode
              if (!isTypingMode) {
                requestAnimationFrame(() => {
                  inputRef.current?.select()
                })
              }
            }}
            placeholder="hh:mm"
            inputMode="numeric"
            className={cn("text-right", className, "pr-10 pl-3")}
            {...rest}
          />
          <button
            type="button"
            className="absolute right-2.5 text-gray-500 hover:text-gray-700"
            onClick={() => {
              if (open) {
                inputRef.current?.focus()
              }
              setOpen((prev) => !prev)
            }}
            tabIndex={-1}
            aria-label="בחר שעה"
          >
            <Clock className="h-4 w-4" />
          </button>
        </div>

        {open && (usePortal ? createPortal(dropdownNode, portalContainer ?? document.body) : dropdownNode)}
      </div>
    )
  },
)

TimePickerInput.displayName = "TimePickerInput"
