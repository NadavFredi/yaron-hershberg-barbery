import { CalendarIcon } from "lucide-react"
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
import type { CSSProperties, FocusEvent, InputHTMLAttributes } from "react"
import { createPortal } from "react-dom"
import { format, isValid, parse } from "date-fns"
import { he } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"

interface DatePickerInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: Date | null
  onChange: (value: Date | null) => void
  displayFormat?: string
  wrapperClassName?: string
  disabled?: boolean
  autoOpenOnFocus?: boolean
  usePortal?: boolean
  portalContainer?: HTMLElement | null
}

const DEFAULT_DISPLAY_FORMAT = "dd/MM/yyyy"
const INPUT_FORMATS = [
  "dd/MM/yyyy",
  "d/M/yyyy",
  "dd-MM-yyyy",
  "d-M-yyyy",
  "dd.MM.yyyy",
  "d.M.yyyy",
  "yyyy-MM-dd",
]

const normalizeDigits = (value: string) => {
  const digitsOnly = value.replace(/\D/g, "")
  if (digitsOnly.length === 8) {
    return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`
  }
  return value
}

const parseInputDate = (value: string): Date | null => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  for (const pattern of INPUT_FORMATS) {
    const parsed = parse(trimmed, pattern, new Date())
    if (isValid(parsed)) {
      return parsed
    }
  }

  const normalized = normalizeDigits(trimmed)
  if (normalized !== trimmed) {
    for (const pattern of INPUT_FORMATS) {
      const parsed = parse(normalized, pattern, new Date())
      if (isValid(parsed)) {
        return parsed
      }
    }
  }

  return null
}

type CalendarView = "day" | "month" | "year"

export const DatePickerInput = forwardRef<HTMLInputElement, DatePickerInputProps>(
  (
    {
      value,
      onChange,
      displayFormat = DEFAULT_DISPLAY_FORMAT,
      className,
      wrapperClassName,
      onFocus,
      onBlur,
      disabled = false,
      autoOpenOnFocus = true,
      usePortal = true,
      portalContainer,
      ...rest
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const inputRef = useRef<HTMLInputElement | null>(null)
    const calendarContainerRef = useRef<HTMLDivElement | null>(null)
    const suppressNextFocusRef = useRef(false)
    const isTypingRef = useRef(false)
    const lastPointerDownInsideRef = useRef(false)
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState(() => (value ? format(value, displayFormat) : ""))
    const [calendarView, setCalendarView] = useState<CalendarView>("day")
    const [isTypingMode, setIsTypingMode] = useState(false)
    const [draftValue, setDraftValue] = useState(value ? format(value, displayFormat) : "")
    const [isYearInputMode, setIsYearInputMode] = useState(false)
    const [yearInputValue, setYearInputValue] = useState("")
    const [portalStyles, setPortalStyles] = useState<CSSProperties>()
    const [maxHeight, setMaxHeight] = useState<number>(400) // Default max height for calendar

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    useEffect(() => {
      setInputValue(value ? format(value, displayFormat) : "")
    }, [value, displayFormat])

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (!open) return
        const target = event.target as Node
        if (
          containerRef.current &&
          !containerRef.current.contains(target) &&
          calendarContainerRef.current &&
          !calendarContainerRef.current.contains(target)
        ) {
          setOpen(false)
          setInputValue(value ? format(value, displayFormat) : "")
          setCalendarView("day")
          setIsTypingMode(false)
        }
      }

      const handlePointerDown = (event: MouseEvent) => {
        const target = event.target as Node
        const inside =
          (containerRef.current && containerRef.current.contains(target)) ||
          (calendarContainerRef.current && calendarContainerRef.current.contains(target))
        lastPointerDownInsideRef.current = inside
      }

      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("mousedown", handlePointerDown, { capture: true })
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
        document.removeEventListener("mousedown", handlePointerDown, true)
      }
    }, [open, value, displayFormat])

    // Reset view when opening
    useEffect(() => {
      if (open) {
        setCalendarView("day")
        lastPointerDownInsideRef.current = false
      }
    }, [open])

    const updatePortalPosition = useCallback(() => {
      if (!usePortal || !open) return
      const anchor = containerRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      const calendarWidth = calendarContainerRef.current?.offsetWidth || 288 // default ~18rem
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const gutter = 8
      const defaultMaxHeight = 330

      // Calculate available space
      const spaceBelow = viewportHeight - rect.bottom - gutter
      const spaceAbove = rect.top - gutter

      // Calculate dynamic max-height based on available space
      // Use the larger of the two spaces, but cap at default max-height
      const availableSpace = Math.max(spaceBelow, spaceAbove)
      const calculatedMaxHeight = Math.min(availableSpace - 20, defaultMaxHeight) // 20px buffer
      setMaxHeight(Math.max(calculatedMaxHeight, 400)) // Minimum 400px height

      // Calculate horizontal position
      let left = rect.right - calendarWidth
      left = Math.max(gutter, Math.min(left, viewportWidth - calendarWidth - gutter))

      // Calculate vertical position - check if calendar fits below, otherwise show above
      let top = rect.bottom + gutter
      const estimatedCalendarHeight = Math.min(calculatedMaxHeight, defaultMaxHeight)

      // If not enough space below but more space above, show above
      // Use a smaller gap when positioning above to keep it closer to the input
      if (spaceBelow < estimatedCalendarHeight && spaceAbove > spaceBelow) {
        const gapAbove = 0 // Smaller gap when showing above to keep it closer to input
        top = rect.top - estimatedCalendarHeight - gapAbove
      }

      // Ensure calendar doesn't go off-screen vertically
      top = Math.max(gutter, Math.min(top, viewportHeight - estimatedCalendarHeight - gutter))

      setPortalStyles({
        position: "fixed",
        top,
        left,
        zIndex: 10000,
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

    const handleSelectDate = useCallback(
      (date: Date | undefined) => {
        if (!date) return
        onChange(date)
        setInputValue(format(date, displayFormat))
        setOpen(false)
        setCalendarView("day")
        setIsTypingMode(false)
        lastPointerDownInsideRef.current = false
        suppressNextFocusRef.current = true
        requestAnimationFrame(() => {
          inputRef.current?.focus()
        })
      },
      [displayFormat, onChange],
    )

    const handleSelectMonth = useCallback(
      (month: number, year: number) => {
        const newDate = new Date(year, month, value?.getDate() || 1)
        // If the selected day doesn't exist in the new month (e.g., Feb 30), use last day of month
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
        if (value && value.getDate() > lastDayOfMonth) {
          newDate.setDate(lastDayOfMonth)
        }
        onChange(newDate)
        setInputValue(format(newDate, displayFormat))
        setCalendarView("day")
      },
      [onChange, displayFormat, value],
    )

    const handleSelectYear = useCallback(
      (year: number) => {
        // Validate year range
        if (year < 1000 || year > 9999) {
          return
        }
        const currentMonth = value?.getMonth() ?? new Date().getMonth()
        const newDate = new Date(year, currentMonth, value?.getDate() || 1)
        // Handle leap year and month length issues
        const lastDayOfMonth = new Date(year, currentMonth + 1, 0).getDate()
        if (value && value.getDate() > lastDayOfMonth) {
          newDate.setDate(lastDayOfMonth)
        }
        onChange(newDate)
        setInputValue(format(newDate, displayFormat))
        setCalendarView("month")
        setIsYearInputMode(false)
        setYearInputValue("")
      },
      [onChange, displayFormat, value],
    )

    const handleInputBlur = useCallback(
      (event: FocusEvent<HTMLInputElement>) => {
        const related = event.relatedTarget as HTMLElement | null
        if (
          related &&
          (containerRef.current?.contains(related) || calendarContainerRef.current?.contains(related))
        ) {
          return
        }

        if (open && lastPointerDownInsideRef.current) {
          // If blur was caused by clicking inside the calendar/input wrapper, keep it open
          lastPointerDownInsideRef.current = false
          return
        }

        // Reset typing ref
        isTypingRef.current = false
        setIsTypingMode(false)
        
        // Parse the draft value (what user typed) or the current input value
        const valueToParse = isTypingMode ? draftValue : inputValue
        const parsed = parseInputDate(valueToParse)
        
        if (parsed && isValid(parsed)) {
          onChange(parsed)
          setInputValue(format(parsed, displayFormat))
          setDraftValue(format(parsed, displayFormat))
        } else {
          // Invalid date - restore to last valid value
          setInputValue(value ? format(value, displayFormat) : "")
          setDraftValue(value ? format(value, displayFormat) : "")
        }

        setOpen(false)
        setCalendarView("day")
      },
      [displayFormat, inputValue, onChange, value, isTypingMode, draftValue],
    )

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
      // Enter typing mode on any printable key press (except special navigation keys)
      const isPrintableKey = event.key.length === 1 || ['Backspace', 'Delete'].includes(event.key)
      const isNavigationKey = ['Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(event.key)
      
      if (!isTypingMode && isPrintableKey && !isNavigationKey) {
        isTypingRef.current = true
        setIsTypingMode(true)
        setOpen(false) // Close calendar when user starts typing
        // Select all text when entering typing mode
        requestAnimationFrame(() => {
          inputRef.current?.select()
        })
      }
    }, [isTypingMode])

    // Sync draft value when external value changes (but not during typing)
    useEffect(() => {
      if (!isTypingMode) {
        setDraftValue(value ? format(value, displayFormat) : "")
      }
    }, [value, displayFormat, isTypingMode])

    const calendarMonth = useMemo(() => {
      const parsed = parseInputDate(isTypingMode ? draftValue : inputValue)
      if (parsed) return parsed
      return value ?? new Date()
    }, [inputValue, value, isTypingMode, draftValue])

    // Generate month options (0-11)
    const monthOptions = useMemo(() => {
      return Array.from({ length: 12 }, (_, i) => i)
    }, [])

    // Generate year options (current year ± 50 years for better scrolling)
    const yearOptions = useMemo(() => {
      const currentYear = new Date().getFullYear()
      const years: number[] = []
      for (let i = currentYear - 15; i <= currentYear + 5; i++) {
        years.push(i)
      }
      return years
    }, [])

    const currentYear = value?.getFullYear() ?? new Date().getFullYear()
    const currentMonth = value?.getMonth() ?? new Date().getMonth()

    return (
      <div ref={containerRef} className={cn("relative", wrapperClassName)}>
        <div className="flex items-center space-x-2 rtl:space-x-reverse">


          {/* Date Input */}
          <div className="relative flex items-center flex-1">
            <Input
              ref={inputRef}
              value={isTypingMode ? draftValue : inputValue}
              onChange={(event) => {
                // Mark that user is actively typing
                isTypingRef.current = true
                
                // If not in typing mode, enter it
                if (!isTypingMode) {
                  setIsTypingMode(true)
                  // Close calendar when user starts typing
                  setOpen(false)
                }
                
                const raw = event.target.value
                // Allow user to type freely - only sanitize to allow digits and separators
                const sanitized = raw.replace(/[^\d./-]/g, "")
                
                // Store the raw sanitized value as draft (don't auto-format while typing)
                setDraftValue(sanitized)
                
                // Try to parse as user types (for better UX) but don't force format
                if (sanitized.length >= 6) {
                  const parsed = parseInputDate(sanitized)
                  if (parsed && isValid(parsed)) {
                    // Valid date parsed - update parent if significantly different
                    if (!value || Math.abs(parsed.getTime() - value.getTime()) > 1000) {
                      onChange(parsed)
                    }
                  }
                }
              }}
              onKeyDown={handleKeyDown}
              onFocus={(event) => {
                if (suppressNextFocusRef.current) {
                  suppressNextFocusRef.current = false
                  return
                }
                // Don't open calendar if user is actively typing
                if (!isTypingRef.current && !disabled && autoOpenOnFocus) {
                  setOpen(true)
                }
                // Reset typing mode only if not already typing
                if (!isTypingRef.current) {
                  setIsTypingMode(false)
                  setDraftValue(value ? format(value, displayFormat) : "")
                }
                // Reset typing ref on focus (user might click to position cursor)
                isTypingRef.current = false
                onFocus?.(event)
              }}
              onBlur={(event) => {
                handleInputBlur(event)
                onBlur?.(event)
              }}
              onClick={() => {
                if (!disabled && !isTypingMode) {
                  setOpen(true)
                }
              }}
              placeholder={displayFormat.toLowerCase()}
              disabled={disabled}
              className={cn("text-right", className, "pr-12 pl-3")}
              {...rest}
            />

            {/* Calendar Button */}
            <button
              type="button"
              className="absolute right-3 text-gray-500 hover:text-gray-700"
              onClick={() => {
                if (!disabled) {
                  setOpen((prev) => !prev)
                  inputRef.current?.focus()
                }
              }}
              disabled={disabled}
              tabIndex={-1}
              aria-label="פתח לוח שנה"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </div>


        </div>

        {open && (() => {
          const calendarNode = (
            <div
              ref={calendarContainerRef}
              data-date-picker-portal
              className={cn(
                "w-[18rem] rounded-md border border-gray-200 bg-white shadow-lg overflow-y-auto overflow-x-hidden",
                !usePortal && "absolute right-0 mt-2 z-[100]"
              )}
              style={usePortal ? { ...portalStyles, pointerEvents: 'auto', maxHeight: `${maxHeight}px` } : { maxHeight: `${maxHeight}px` }}
            >
              {calendarView === "day" && (
                <div>
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between gap-2 z-10">
                    <button
                      type="button"
                      className="text-sm font-semibold text-gray-700 hover:text-gray-900 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setCalendarView("month")}
                    >
                      {format(calendarMonth, "MMMM yyyy", { locale: he })}
                    </button>
                    <button
                      type="button"
                      className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-all duration-200 hover:shadow-md"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        const today = new Date()
                        onChange(today)
                        setInputValue(format(today, displayFormat))
                      }}
                    >
                      היום
                    </button>
                  </div>
                  <Calendar
                    key={calendarMonth.toISOString()}
                    mode="single"
                    selected={value ?? undefined}
                    onSelect={handleSelectDate}
                    defaultMonth={calendarMonth}
                    initialFocus
                    classNames={{
                      caption: "hidden",
                    }}
                    components={{
                      Caption: () => null,
                    }}
                  />
                </div>
              )}

            {calendarView === "month" && (
              <div>
                <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between z-10">
                  <button
                    type="button"
                    className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setCalendarView("year")}
                  >
                    {currentYear}
                  </button>
                  <button
                    type="button"
                    className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setCalendarView("day")}
                  >
                    ← חזור
                  </button>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-3 gap-2">
                    {monthOptions.map((month) => {
                      const monthDate = new Date(currentYear, month, 1)
                      const monthName = format(monthDate, "MMM", { locale: he })
                      const isSelected = currentMonth === month
                      const isCurrentMonth = new Date().getMonth() === month && new Date().getFullYear() === currentYear
                      return (
                        <button
                          key={month}
                          type="button"
                          className={cn(
                            "px-3 py-2 text-sm rounded hover:bg-gray-100 text-right",
                            isSelected && "bg-primary/20 font-medium text-primary",
                            isCurrentMonth && !isSelected && "bg-gray-50"
                          )}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSelectMonth(month, currentYear)}
                        >
                          {monthName}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {calendarView === "year" && (
              <div>
                <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between z-10">
                  {isYearInputMode ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={yearInputValue}
                        onChange={(e) => {
                          const val = e.target.value
                          // Allow any numeric input (draft state) - only restrict non-numeric characters
                          if (val === "" || /^\d+$/.test(val)) {
                            setYearInputValue(val)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            const year = parseInt(yearInputValue)
                            if (!isNaN(year) && year >= 1000 && year <= 9999) {
                              handleSelectYear(year)
                            } else {
                              // Invalid year - reset to current year
                              setIsYearInputMode(false)
                              setYearInputValue("")
                            }
                          } else if (e.key === "Escape") {
                            setIsYearInputMode(false)
                            setYearInputValue("")
                          }
                        }}
                        onBlur={(e) => {
                          const year = parseInt(yearInputValue)
                          if (!isNaN(year) && year >= 1000 && year <= 9999) {
                            handleSelectYear(year)
                          } else {
                            // Invalid year - reset to current year and close input mode
                            setIsYearInputMode(false)
                            setYearInputValue("")
                          }
                        }}
                        placeholder="הכנס שנה"
                        className="text-right text-sm h-8"
                        autoFocus
                      />
                      <button
                        type="button"
                        className="text-xs text-gray-600 hover:text-gray-900"
                        onClick={() => {
                          setIsYearInputMode(false)
                          setYearInputValue("")
                        }}
                      >
                        ביטול
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="text-sm font-medium text-gray-900 hover:text-primary cursor-pointer"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setIsYearInputMode(true)
                          setYearInputValue(currentYear.toString())
                          requestAnimationFrame(() => {
                            const input = calendarContainerRef.current?.querySelector('input[type="number"]') as HTMLInputElement
                            input?.select()
                          })
                        }}
                      >
                        {yearOptions[0]} - {yearOptions[yearOptions.length - 1]}
                      </button>
                      <button
                        type="button"
                        className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setCalendarView("month")}
                      >
                        ← חזור
                      </button>
                    </>
                  )}
                </div>
                <div className="p-3 max-h-[300px] overflow-y-auto">
                  <div className="grid grid-cols-4 gap-2">
                    {yearOptions.map((year) => {
                      const isSelected = currentYear === year
                      const isCurrentYear = new Date().getFullYear() === year
                      return (
                        <button
                          key={year}
                          type="button"
                          className={cn(
                            "px-3 py-2 text-sm rounded hover:bg-gray-100 text-right",
                            isSelected && "bg-primary/20 font-medium text-primary",
                            isCurrentYear && !isSelected && "bg-gray-50"
                          )}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSelectYear(year)}
                        >
                          {year}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            </div>
          )

          return usePortal ? createPortal(calendarNode, portalContainer ?? document.body) : calendarNode
        })()}
      </div>
    )
  },
)

DatePickerInput.displayName = "DatePickerInput"
