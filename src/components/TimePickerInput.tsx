import { Clock } from "lucide-react"
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import type { InputHTMLAttributes } from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface TimePickerInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string
  onChange: (value: string) => void
  intervalMinutes?: number
  wrapperClassName?: string
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
      ...rest
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const inputRef = useRef<HTMLInputElement | null>(null)
    const listRef = useRef<HTMLDivElement | null>(null)

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const timeOptions = useMemo(() => {
      const options: string[] = []
      const step = Math.max(1, intervalMinutes)
      for (let minutes = 0; minutes < 24 * 60; minutes += step) {
        options.push(formatTime(minutes))
      }
      return options
    }, [intervalMinutes])

    // Close the dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setOpen(false)
        }
      }

      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleOptionSelect = useCallback(
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

    const isValidTimeFormat = (time: string) =>
      time === "" || /^\d{0,2}:?\d{0,2}$/.test(time) || /^\d{3,4}$/.test(time) || /^\d{2}:\d{2}$/.test(time)

    useEffect(() => {
      if (!open || !listRef.current) {
        return
      }

      const listEl = listRef.current

      const scrollToOption = (targetTime: string) => {
        const optionEl = listEl.querySelector<HTMLButtonElement>(`[data-time="${targetTime}"]`)
        if (optionEl) {
          const offsetTop = optionEl.offsetTop
          const optionHeight = optionEl.offsetHeight || 32
          const containerHeight = listEl.clientHeight
          listEl.scrollTop = Math.max(0, offsetTop - containerHeight / 2 + optionHeight / 2)
        }
      }

      const normalizedValue = normalizeTime(value)
      if (normalizedValue) {
        const match = timeOptions.find((time) => time === normalizedValue)
        if (match) {
          scrollToOption(match)
          return
        }

        const minutes = parseTimeToMinutes(normalizedValue)
        if (minutes != null) {
          const step = Math.max(1, intervalMinutes)
          const nearestIndex = Math.round(minutes / step)
          const clampedIndex = Math.min(timeOptions.length - 1, Math.max(0, nearestIndex))
          scrollToOption(timeOptions[clampedIndex])
          return
        }
      }

      const now = new Date()
      const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
      const step = Math.max(1, intervalMinutes)
      const nearestIndex = Math.round(minutesSinceMidnight / step)
      const targetIndex = Math.min(timeOptions.length - 1, Math.max(0, nearestIndex))
      scrollToOption(timeOptions[targetIndex])
    }, [open, normalizeTime, value, timeOptions, intervalMinutes])

    return (
      <div ref={containerRef} className={cn("relative", wrapperClassName)}>
        <div className="relative flex items-center">
          <Input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value
              if (nextValue === "" || isValidTimeFormat(nextValue)) {
                onChange(nextValue)
              }
            }}
            onFocus={(event) => {
              setOpen(true)
              onFocus?.(event)
            }}
            onBlur={(event) => {
              const normalized = normalizeTime(value)
              if (normalized !== value) {
                onChange(normalized)
              }
              setOpen(false)
              onBlur?.(event)
            }}
            onClick={() => setOpen(true)}
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

        {open && (
          <div
            ref={listRef}
            className="absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
          >
            <ul className="py-1 text-right text-sm text-gray-700">
              {timeOptions.map((time) => (
                <li key={time}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full  items-center  gap-2 px-3 py-2 text-right hover:bg-gray-100",
                      value === time && "bg-gray-100 font-medium text-gray-900",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleOptionSelect(time)}
                    data-time={time}
                  >
                    <span className="text-right">{time}</span>
                    {value === time && <Clock className="h-4 w-4 text-gray-500" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  },
)

TimePickerInput.displayName = "TimePickerInput"
