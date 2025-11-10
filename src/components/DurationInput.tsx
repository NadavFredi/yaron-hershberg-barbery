import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration-utils"

interface DurationInputProps {
    value: number // value in minutes
    onChange: (minutes: number) => void
    className?: string
    disabled?: boolean
}

// Generate duration options from 0 to 8 hours in 15-minute increments
const generateDurationOptions = (): string[] => {
    const options: string[] = []
    // Add 0:00
    options.push("0:00")
    
    // Add options from 15 minutes to 8 hours in 15-minute increments
    for (let hours = 0; hours <= 8; hours++) {
        for (let minutes = 0; minutes < 60; minutes += 15) {
            if (hours === 0 && minutes === 0) continue // Skip 0:00 (already added)
            const totalMinutes = hours * 60 + minutes
            options.push(formatDurationFromMinutes(totalMinutes))
        }
    }
    
    return options
}

const DURATION_OPTIONS = generateDurationOptions()

export function DurationInput({ value, onChange, className, disabled }: DurationInputProps) {
    const displayValue = formatDurationFromMinutes(value)

    const handleChange = (selectedValue: string) => {
        const minutes = parseDurationToMinutes(selectedValue)
        if (minutes !== null && minutes >= 0) {
            onChange(minutes)
        }
    }

    return (
        <Select value={displayValue} onValueChange={handleChange} disabled={disabled}>
            <SelectTrigger className={className} dir="rtl">
                <SelectValue placeholder="0:00" />
            </SelectTrigger>
            <SelectContent dir="rtl" className="max-h-[300px]">
                {DURATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="text-right">
                        {option}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

