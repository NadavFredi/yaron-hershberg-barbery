import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Pencil } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DatePickerInput } from "@/components/DatePickerInput"
import { TimePickerInput } from "@/components/TimePickerInput"

export interface AppointmentStation {
    id: string
    name: string
    serviceType?: 'grooming' | 'garden'
}

export interface AppointmentTimes {
    startTime: Date | null
    endTime: Date | null
    stationId: string | null
}

type ThemeKey = 'purple' | 'blue' | 'mint'

const themeClasses: Record<ThemeKey, {
    container: string
    title: string
    label: string
    viewText: string
    input: string
    editButton: string
    saveButton: string
    saveButtonText: string
    cancelButton: string
}> = {
    purple: {
        container: "bg-purple-50",
        title: "text-purple-800",
        label: "text-purple-700",
        viewText: "text-purple-700",
        input: "border border-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-500",
        editButton: "text-purple-600 hover:text-purple-800 hover:bg-purple-100",
        saveButton: "bg-purple-500 hover:bg-purple-600",
        saveButtonText: "text-white text-xs",
        cancelButton: "text-xs"
    },
    blue: {
        container: "bg-blue-50",
        title: "text-blue-800",
        label: "text-blue-700",
        viewText: "text-blue-700",
        input: "border border-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500",
        editButton: "text-blue-600 hover:text-blue-800 hover:bg-blue-100",
        saveButton: "bg-blue-600 hover:bg-blue-700",
        saveButtonText: "text-white text-xs",
        cancelButton: "text-xs"
    },
    mint: {
        container: "bg-lime-50 border border-lime-200",
        title: "text-lime-800",
        label: "text-lime-700",
        viewText: "text-lime-700",
        input: "border border-lime-200 focus:outline-none focus:ring-1 focus:ring-lime-500",
        editButton: "text-lime-700 hover:text-lime-900 hover:bg-lime-100",
        saveButton: "bg-lime-600 hover:bg-lime-700",
        saveButtonText: "text-white text-xs",
        cancelButton: "text-xs text-lime-700"
    }
}

const cloneTimes = (times: AppointmentTimes | null): AppointmentTimes | null => {
    if (!times) return null
    return {
        startTime: times.startTime ? new Date(times.startTime) : null,
        endTime: times.endTime ? new Date(times.endTime) : null,
        stationId: times.stationId ?? null
    }
}

interface AppointmentDetailsSectionProps {
    isOpen: boolean
    finalizedTimes: AppointmentTimes | null
    stations: AppointmentStation[]
    onTimesChange?: (times: AppointmentTimes) => void
    theme?: ThemeKey
    stationFilter?: (station: AppointmentStation) => boolean
    className?: string
    endTimeMode?: "editable" | "auto"
    autoDurationMinutes?: number | null
    onManualOverrideChange?: (isManualOverride: boolean) => void
    isManualOverride?: boolean
    hideStation?: boolean
}

export const AppointmentDetailsSection: React.FC<AppointmentDetailsSectionProps> = ({
    isOpen,
    finalizedTimes,
    stations,
    onTimesChange,
    theme = 'blue',
    stationFilter,
    className,
    endTimeMode = "editable",
    autoDurationMinutes = null,
    onManualOverrideChange,
    isManualOverride = false,
    hideStation = false
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const [editableTimes, setEditableTimes] = useState<AppointmentTimes | null>(cloneTimes(finalizedTimes))
    const datePickerRef = useRef<HTMLInputElement>(null)
    const isAutoEndTime = endTimeMode === "auto"

    useEffect(() => {
        setEditableTimes(cloneTimes(finalizedTimes))
    }, [finalizedTimes])

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                if (datePickerRef.current && document.activeElement === datePickerRef.current) {
                    datePickerRef.current.blur()
                }
            }, 0)
        }
    }, [isOpen])

    const filteredStations = useMemo(() => (
        stationFilter ? stations.filter(stationFilter) : stations
    ), [stations, stationFilter])

    const handleDateChange = (newDate: Date | null) => {
        if (!editableTimes || !newDate) return

        const startTime = editableTimes.startTime ? new Date(editableTimes.startTime) : null
        const endTime = editableTimes.endTime ? new Date(editableTimes.endTime) : null

        if (startTime) {
            startTime.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate())
        }
        if (endTime) {
            endTime.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate())
        }

        // Ensure both times are on the same date
        if (startTime && endTime) {
            const startDate = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate())
            const endDate = new Date(endTime.getFullYear(), endTime.getMonth(), endTime.getDate())

            // If dates don't match, adjust end time to be on the same date as start time
            if (startDate.getTime() !== endDate.getTime()) {
                endTime.setFullYear(startTime.getFullYear(), startTime.getMonth(), startTime.getDate())
            }
        }

        setEditableTimes(prev => prev ? {
            ...prev,
            startTime,
            endTime
        } : null)
    }

    const handleTimeChange = (field: 'startTime' | 'endTime', timeString: string) => {
        if (!editableTimes || !timeString) return

        const [hours, minutes] = timeString.split(':').map(Number)
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return

        const current = editableTimes[field] ? new Date(editableTimes[field]!) : new Date()
        current.setHours(hours, minutes, 0, 0)

        // Ensure the time is on the same date as the other time field
        if (field === 'startTime' && editableTimes.endTime) {
            // When changing start time, ensure it's on the same date as end time
            const endDate = new Date(editableTimes.endTime.getFullYear(), editableTimes.endTime.getMonth(), editableTimes.endTime.getDate())
            current.setFullYear(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
        } else if (field === 'endTime' && editableTimes.startTime) {
            // When changing end time, ensure it's on the same date as start time
            const startDate = new Date(editableTimes.startTime.getFullYear(), editableTimes.startTime.getMonth(), editableTimes.startTime.getDate())
            current.setFullYear(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
        }

        setEditableTimes(prev => prev ? { ...prev, [field]: current } : null)
    }

    const handleStationChange = (stationId: string) => {
        setEditableTimes(prev => prev ? { ...prev, stationId } : prev)
    }

    const handleSaveTimes = () => {
        if (editableTimes) {
            onTimesChange?.(cloneTimes(editableTimes)!)
        }
        setIsEditing(false)
    }

    const handleCancelEdit = () => {
        setEditableTimes(cloneTimes(finalizedTimes))
        setIsEditing(false)
    }

    if (!finalizedTimes) {
        return null
    }

    const themeCfg = themeClasses[theme]

    return (
        <div className={cn("rounded-lg p-3 mb-4", themeCfg.container, className)}>
            <div className="flex items-center gap-2 mb-2" dir="rtl">
                {!isEditing && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className={cn("h-6 w-6 p-0", themeCfg.editButton)}
                    >
                        <Pencil className="h-3 w-3" />
                    </Button>
                )}
                <h3 className={cn("text-sm font-medium", themeCfg.title)}>פרטי התור</h3>
            </div>

            {isEditing ? (
                <div className="space-y-3">
                    <div className={cn("grid gap-2", hideStation ? "grid-cols-1" : "grid-cols-2")}>
                        <div>
                            <label className={cn("block text-xs font-medium mb-1", themeCfg.label)}>תאריך</label>
                            <DatePickerInput
                                ref={datePickerRef}
                                value={editableTimes ? editableTimes.startTime : null}
                                onChange={handleDateChange}
                                displayFormat="dd/MM/yyyy"
                                className={cn("w-full px-2 py-1 text-xs rounded", themeCfg.input)}
                            />
                        </div>
                        {!hideStation && (
                            <div>
                                <label className={cn("block text-xs font-medium mb-1", themeCfg.label)}>עמדה</label>
                                <Select
                                    value={editableTimes?.stationId || ''}
                                    onValueChange={handleStationChange}
                                >
                                    <SelectTrigger className={cn("w-full px-2 py-1 text-xs rounded", themeCfg.input)}>
                                        <SelectValue placeholder="בחר עמדה" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredStations.map(station => (
                                            <SelectItem key={station.id} value={station.id}>
                                                {station.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className={cn("block text-xs font-medium mb-1", themeCfg.label)}>שעת התחלה</label>
                            <TimePickerInput
                                value={editableTimes && editableTimes.startTime ? format(editableTimes.startTime, 'HH:mm') : ''}
                                onChange={(timeString) => handleTimeChange('startTime', timeString)}
                                intervalMinutes={15}
                                className={cn("w-full px-2 py-1 text-xs rounded", themeCfg.input)}
                            />
                        </div>
                        <div>
                            <label className={cn("block text-xs font-medium mb-1", themeCfg.label)}>שעת סיום</label>
                            {isAutoEndTime && !isManualOverride ? (
                                <div
                                    className={cn(
                                        "w-full h-10 flex items-center justify-end rounded px-3 text-sm bg-white",
                                        themeCfg.input
                                    )}
                                >
                                    {editableTimes && editableTimes.endTime ? format(editableTimes.endTime, 'HH:mm') : '--:--'}
                                </div>
                            ) : (
                                <TimePickerInput
                                    value={editableTimes && editableTimes.endTime ? format(editableTimes.endTime, 'HH:mm') : ''}
                                    onChange={(timeString) => handleTimeChange('endTime', timeString)}
                                    intervalMinutes={15}
                                    className={cn("w-full px-2 py-1 text-xs rounded", themeCfg.input)}
                                />
                            )}
                        </div>
                    </div>
                    {isAutoEndTime && autoDurationMinutes != null && (
                        <div className={cn("text-xs text-right", themeCfg.viewText)}>
                            משך משוער: <span className="font-medium">{autoDurationMinutes} דקות</span>
                        </div>
                    )}
                    {isAutoEndTime && (
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                                id="manual-override"
                                checked={isManualOverride}
                                onCheckedChange={(checked) => onManualOverrideChange?.(checked === true)}
                            />
                            <label
                                htmlFor="manual-override"
                                className={cn("text-xs font-medium cursor-pointer", themeCfg.label)}
                            >
                                אני יודע שאני משנה את שעת הסיום ידנית וזה לא לפי הגדרות המערכת
                            </label>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            onClick={handleSaveTimes}
                            className={cn(themeCfg.saveButton, themeCfg.saveButtonText)}
                        >
                            שמור
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                            className={themeCfg.cancelButton}
                        >
                            ביטול
                        </Button>
                    </div>
                </div>
            ) : (
                <div className={cn("space-y-1 text-sm text-right", themeCfg.viewText)}>
                    <div>תאריך: <span className="font-medium">{finalizedTimes.startTime ? format(finalizedTimes.startTime, 'dd.MM.yyyy') : '-'}</span></div>
                    <div>זמן: <span className="font-medium">
                        {finalizedTimes.startTime ? format(finalizedTimes.startTime, 'HH:mm') : '--:--'}
                        {" - "}
                        {finalizedTimes.endTime ? format(finalizedTimes.endTime, 'HH:mm') : '--:--'}
                    </span></div>
                    {!hideStation && (
                        <div>עמדה: <span className="font-medium">
                            {filteredStations.find(station => station.id === finalizedTimes.stationId)?.name || 'לא נבחרה עמדה'}
                        </span></div>
                    )}
                    {isAutoEndTime && autoDurationMinutes != null && (
                        <div>משך: <span className="font-medium">{autoDurationMinutes} דקות</span></div>
                    )}
                </div>
            )}
        </div>
    )
}
