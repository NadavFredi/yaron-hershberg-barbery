import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
    hideSaveCancelButtons?: boolean
    disableEndTime?: boolean
    children?: React.ReactNode
    sendWhatsApp?: boolean
    onSendWhatsAppChange?: (sendWhatsApp: boolean) => void
    syncTime?: boolean
    onSyncTimeChange?: (syncTime: boolean) => void
    selectedServiceId?: string | null
    serviceStationConfigs?: Array<{ station_id: string; base_time_minutes: number }>
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
    hideStation = false,
    hideSaveCancelButtons = false,
    disableEndTime = false,
    children,
    sendWhatsApp: controlledSendWhatsApp,
    onSendWhatsAppChange,
    syncTime: controlledSyncTime,
    onSyncTimeChange,
    selectedServiceId,
    serviceStationConfigs = []
}) => {
    const [isEditing, setIsEditing] = useState(true)
    const [editableTimes, setEditableTimes] = useState<AppointmentTimes | null>(cloneTimes(finalizedTimes))
    const [sendWhatsApp, setSendWhatsApp] = useState(true) // Default to checked
    const [syncTime, setSyncTime] = useState<boolean>(controlledSyncTime ?? false)
    const datePickerRef = useRef<HTMLInputElement>(null)
    const isAutoEndTime = endTimeMode === "auto"

    // Use controlled value if provided, otherwise use internal state
    const actualSendWhatsApp = controlledSendWhatsApp !== undefined ? controlledSendWhatsApp : sendWhatsApp
    const actualSyncTime = controlledSyncTime !== undefined ? controlledSyncTime : syncTime

    useEffect(() => {
        setEditableTimes(cloneTimes(finalizedTimes))
        // Always start in edit mode when modal opens
        if (isOpen) {
            setIsEditing(true)
        }
    }, [finalizedTimes, isOpen])

    // Update end time when syncTime is enabled and service is selected
    useEffect(() => {
        if (!actualSyncTime || !selectedServiceId || !editableTimes?.startTime || !editableTimes?.stationId) {
            return
        }

        // Find the service-station configuration
        const config = serviceStationConfigs.find(
            (config) => config.station_id === editableTimes.stationId
        )

        if (config && config.base_time_minutes > 0) {
            const durationMs = config.base_time_minutes * 60 * 1000
            const newEndTime = new Date(editableTimes.startTime.getTime() + durationMs)

            // Only update if the end time would be different
            if (!editableTimes.endTime || editableTimes.endTime.getTime() !== newEndTime.getTime()) {
                setEditableTimes((prev) => {
                    if (!prev) return null
                    return {
                        ...prev,
                        endTime: newEndTime
                    }
                })

                // Notify parent of the change
                if (onTimesChange) {
                    onTimesChange({
                        startTime: editableTimes.startTime,
                        endTime: newEndTime,
                        stationId: editableTimes.stationId
                    })
                }
            }
        }
    }, [actualSyncTime, selectedServiceId, editableTimes?.startTime, editableTimes?.stationId, editableTimes?.endTime, serviceStationConfigs, onTimesChange])

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                if (datePickerRef.current && document.activeElement === datePickerRef.current) {
                    datePickerRef.current.blur()
                }
            }, 0)
        }
    }, [isOpen])

    // Call onTimesChange immediately when times change (for real-time updates)
    useEffect(() => {
        if (editableTimes && onTimesChange) {
            onTimesChange(cloneTimes(editableTimes)!)
        }
    }, [editableTimes?.startTime, editableTimes?.endTime, editableTimes?.stationId])

    const filteredStations = useMemo(() => {
        // Always show all stations - don't filter them out
        // The stationFilter is only used for display/hinting purposes, but all stations should be selectable
        const allStations = stations
        // Ensure current station is always in the list if it exists
        if (editableTimes?.stationId) {
            const currentStation = allStations.find(s => s.id === editableTimes.stationId)
            if (currentStation) {
                // If current station is not in the list, add it at the beginning
                const hasCurrent = allStations.some(s => s.id === currentStation.id)
                if (!hasCurrent) {
                    return [currentStation, ...allStations]
                }
            }
        }
        return allStations
    }, [stations, editableTimes?.stationId])

    const currentStation = useMemo(() => {
        if (!editableTimes?.stationId) return null
        return stations.find(s => s.id === editableTimes.stationId) || null
    }, [stations, editableTimes?.stationId])

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

        // If start time changed and end time is disabled, update end time accordingly
        if (field === 'startTime' && disableEndTime && editableTimes.startTime && editableTimes.endTime) {
            const prevStartTime = editableTimes.startTime
            // Calculate the delta (how much the start time changed)
            const delta = current.getTime() - prevStartTime.getTime()
            // Move end time by the same delta
            let newEndTime = new Date(editableTimes.endTime.getTime() + delta)

            // Ensure end time is always after start time
            // If we have autoDurationMinutes, use it to ensure minimum duration
            if (autoDurationMinutes != null) {
                const minEndTime = new Date(current.getTime() + autoDurationMinutes * 60 * 1000)
                if (newEndTime.getTime() < minEndTime.getTime()) {
                    newEndTime = minEndTime
                }
            } else {
                // Otherwise, ensure at least 15 minutes duration
                const minEndTime = new Date(current.getTime() + 15 * 60 * 1000)
                if (newEndTime.getTime() < minEndTime.getTime()) {
                    newEndTime = minEndTime
                }
            }

            const updated: AppointmentTimes = {
                ...editableTimes,
                startTime: current,
                endTime: newEndTime,
                stationId: editableTimes.stationId
            }

            setEditableTimes(updated)
            // Call onTimesChange immediately with updated values
            if (onTimesChange) {
                onTimesChange(cloneTimes(updated)!)
            }
        } else {
            const updated: AppointmentTimes | null = editableTimes ? { ...editableTimes, [field]: current } : null
            setEditableTimes(updated)
            // Call onTimesChange immediately with updated values
            if (updated && onTimesChange) {
                onTimesChange(cloneTimes(updated)!)
            }
        }
    }

    const handleStationChange = (stationId: string) => {
        setEditableTimes(prev => prev ? { ...prev, stationId } : prev)
    }

    const handleSendWhatsAppChange = (checked: boolean) => {
        if (onSendWhatsAppChange) {
            onSendWhatsAppChange(checked)
        } else {
            setSendWhatsApp(checked)
        }
    }

    const handleSaveTimes = () => {
        if (editableTimes) {
            onTimesChange?.(cloneTimes(editableTimes)!)
        }
        // Keep editing mode active - don't exit edit mode
    }

    const handleCancelEdit = () => {
        setEditableTimes(cloneTimes(finalizedTimes))
        // Keep editing mode active - don't exit edit mode
    }

    if (!finalizedTimes) {
        return null
    }

    const themeCfg = themeClasses[theme]

    return (
        <div className={cn("rounded-lg p-3 mb-4", themeCfg.container, className)}>
            <div className="flex items-center gap-2 mb-2" dir="rtl">
                <h3 className={cn("text-sm font-medium", themeCfg.title)}>פרטי התור</h3>
            </div>

            {isEditing && (
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
                                autoOpenOnFocus={false}
                            />
                        </div>
                        {!hideStation && (
                            <div>
                                <label className={cn("block text-xs font-medium mb-1", themeCfg.label)}>עמדה</label>
                                <Select
                                    value={editableTimes?.stationId || undefined}
                                    onValueChange={handleStationChange}
                                >
                                    <SelectTrigger className={cn("w-full px-2 py-1 text-xs rounded text-right [&>span]:text-right", themeCfg.input)} dir="rtl">
                                        <SelectValue placeholder="בחר עמדה" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
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
                                    disabled={disableEndTime}
                                />
                            )}
                        </div>
                    </div>
                    {isAutoEndTime && autoDurationMinutes != null && (
                        <div className={cn("text-xs text-right", themeCfg.viewText)}>
                            משך משוער: <span className="font-medium">{autoDurationMinutes} דקות</span>
                        </div>
                    )}

                    {/* Sync Time Checkbox - Always visible */}
                    {onSyncTimeChange !== undefined && (
                        <div className="flex items-center space-x-2 space-x-reverse pt-1">
                            <Checkbox
                                id="sync-time"
                                checked={actualSyncTime}
                                onCheckedChange={(checked) => {
                                    const newValue = checked === true
                                    if (onSyncTimeChange) {
                                        onSyncTimeChange(newValue)
                                    } else {
                                        setSyncTime(newValue)
                                    }
                                }}
                            />
                            <Label
                                htmlFor="sync-time"
                                className={cn("text-xs font-medium leading-none cursor-pointer", themeCfg.label)}
                            >
                                סנכרן זמן לפי השירות
                            </Label>
                        </div>
                    )}

                    {children && (
                        <div className="mt-3">
                            {children}
                        </div>
                    )}

                </div>
            )}
        </div>
    )
}
