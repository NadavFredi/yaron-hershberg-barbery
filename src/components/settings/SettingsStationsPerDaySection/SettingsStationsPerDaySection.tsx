import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Save, GripVertical, Copy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAppDispatch } from "@/store/hooks"
import { supabaseApi } from "@/store/services/supabaseApi"
import { setVisibleStationIds, setStationOrderIds } from "@/store/slices/managerScheduleSlice"
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent, closestCenter } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface Station {
    id: string
    name: string
    is_active: boolean
}

interface StationDailyConfig {
    weekday: string
    visible_station_ids: string[]
    station_order_ids: string[]
}

const WEEKDAYS = [
    { value: "sunday", label: "יום ראשון", order: 0 },
    { value: "monday", label: "יום שני", order: 1 },
    { value: "tuesday", label: "יום שלישי", order: 2 },
    { value: "wednesday", label: "יום רביעי", order: 3 },
    { value: "thursday", label: "יום חמישי", order: 4 },
    { value: "friday", label: "יום שישי", order: 5 },
    { value: "saturday", label: "יום שבת", order: 6 },
]


interface SortableStationItemProps {
    stationId: string
    stationName: string
    isSelected: boolean
    isActive: boolean
    onToggle: (stationId: string) => void
}

function SortableStationItem({ stationId, stationName, isSelected, isActive, onToggle }: SortableStationItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: stationId })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-2 rounded-lg border p-2 transition-colors",
                isDragging && "bg-primary/10 border-primary",
                isSelected && "bg-primary/5 border-primary/30",
                !isActive && "opacity-60 bg-muted/30"
            )}
        >
            <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:text-primary cursor-grab active:cursor-grabbing flex-shrink-0"
                aria-label="שנה סדר"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-3.5 w-3.5" />
            </button>
            <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(stationId)}
                className="scale-110 flex-shrink-0"
            />
            <Label className={cn("flex-1 cursor-pointer text-xs truncate", !isActive && "text-muted-foreground")} onClick={() => onToggle(stationId)} title={stationName}>
                {stationName}
                {!isActive && <span className="mr-1 text-[10px] text-muted-foreground">(לא פעיל)</span>}
            </Label>
        </div>
    )
}

export function SettingsStationsPerDaySection() {
    const { toast } = useToast()
    const dispatch = useAppDispatch()
    const [stations, setStations] = useState<Station[]>([])
    const [configs, setConfigs] = useState<Record<string, StationDailyConfig>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [copySourceDay, setCopySourceDay] = useState<string | null>(null)
    const [copyTargetDays, setCopyTargetDays] = useState<Set<string>>(new Set())

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        })
    )

    // Initialize configs for each weekday
    useEffect(() => {
        const initialConfigs: Record<string, StationDailyConfig> = {}
        WEEKDAYS.forEach((day) => {
            initialConfigs[day.value] = {
                weekday: day.value,
                visible_station_ids: [],
                station_order_ids: [],
            }
        })
        setConfigs(initialConfigs)
    }, [])

    // Fetch stations
    useEffect(() => {
        const fetchStations = async () => {
            try {
                const { data, error } = await supabase
                    .from("stations")
                    .select("id, name, is_active")
                    .order("display_order", { ascending: true })
                    .order("name")

                if (error) throw error
                setStations(data || [])
            } catch (error) {
                console.error("Error fetching stations:", error)
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לטעון את רשימת העמדות",
                    variant: "destructive",
                })
            }
        }

        fetchStations()
    }, [toast])

    // Fetch existing configs
    useEffect(() => {
        const fetchConfigs = async () => {
            try {
                const { data, error } = await supabase
                    .from("station_daily_configs")
                    .select("*")

                if (error) throw error

                const configsMap: Record<string, StationDailyConfig> = {}
                WEEKDAYS.forEach((day) => {
                    const existing = data?.find((c) => c.weekday === day.value)
                    configsMap[day.value] = existing ? {
                        weekday: day.value,
                        visible_station_ids: existing.visible_station_ids || [],
                        station_order_ids: existing.station_order_ids || [],
                    } : {
                        weekday: day.value,
                        visible_station_ids: [],
                        station_order_ids: [],
                    }
                })

                setConfigs(configsMap)
                setIsLoading(false)
            } catch (error) {
                console.error("Error fetching station daily configs:", error)
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לטעון את ההגדרות",
                    variant: "destructive",
                })
                setIsLoading(false)
            }
        }

        if (stations.length > 0) {
            fetchConfigs()
        }
    }, [stations, toast])

    // Get ordered stations for a day
    const getOrderedStationsForDay = (weekday: string): Station[] => {
        const config = configs[weekday]
        if (!config) return []

        const ordered: Station[] = []
        const unordered: Station[] = []

        // Add stations in order
        config.station_order_ids.forEach((stationId) => {
            const station = stations.find((s) => s.id === stationId)
            if (station) {
                ordered.push(station)
            }
        })

        // Add visible stations that aren't in order yet
        config.visible_station_ids.forEach((stationId) => {
            if (!config.station_order_ids.includes(stationId)) {
                const station = stations.find((s) => s.id === stationId)
                if (station) {
                    unordered.push(station)
                }
            }
        })

        return [...ordered, ...unordered]
    }

    // Toggle station visibility for a day
    const toggleStationVisibility = (weekday: string, stationId: string) => {
        setConfigs((prev) => {
            const config = prev[weekday]
            if (!config) return prev

            const isVisible = config.visible_station_ids.includes(stationId)
            const newVisibleIds = isVisible
                ? config.visible_station_ids.filter((id) => id !== stationId)
                : [...config.visible_station_ids, stationId]

            const newOrderIds = isVisible
                ? config.station_order_ids.filter((id) => id !== stationId)
                : config.station_order_ids.includes(stationId)
                    ? config.station_order_ids
                    : [...config.station_order_ids, stationId]

            return {
                ...prev,
                [weekday]: {
                    ...config,
                    visible_station_ids: newVisibleIds,
                    station_order_ids: newOrderIds,
                },
            }
        })
    }

    // Handle drag end for station reordering
    const handleDragEnd = (weekday: string) => (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const config = configs[weekday]
        if (!config) return

        // Handle stations reordering
        const orderedStations = getOrderedStationsForDay(weekday)
        const oldIndex = orderedStations.findIndex((s) => s.id === active.id)
        const newIndex = orderedStations.findIndex((s) => s.id === over.id)

        if (oldIndex === -1 || newIndex === -1) return

        const newOrdered = arrayMove(orderedStations, oldIndex, newIndex)
        const newOrderIds = newOrdered.map((s) => s.id).filter((id) => config.visible_station_ids.includes(id))

        setConfigs((prev) => ({
            ...prev,
            [weekday]: {
                ...prev[weekday],
                station_order_ids: newOrderIds,
            },
        }))
    }

    // Copy configuration from one day to others
    const handleCopyConfig = (sourceWeekday: string) => {
        setCopySourceDay(sourceWeekday)
        setCopyTargetDays(new Set())
    }

    const toggleCopyTarget = (weekday: string) => {
        if (weekday === copySourceDay) return // Can't copy to itself

        setCopyTargetDays((prev) => {
            const next = new Set(prev)
            if (next.has(weekday)) {
                next.delete(weekday)
            } else {
                next.add(weekday)
            }
            return next
        })
    }

    const applyCopy = () => {
        if (!copySourceDay) return

        const sourceConfig = configs[copySourceDay]
        if (!sourceConfig) return

        setConfigs((prev) => {
            const next = { ...prev }
            copyTargetDays.forEach((targetWeekday) => {
                next[targetWeekday] = {
                    weekday: targetWeekday,
                    visible_station_ids: [...sourceConfig.visible_station_ids],
                    station_order_ids: [...sourceConfig.station_order_ids],
                }
            })
            return next
        })

        toast({
            title: "הועתק בהצלחה",
            description: `הגדרות ${WEEKDAYS.find((d) => d.value === copySourceDay)?.label} הועתקו ל-${copyTargetDays.size} ימים`,
        })

        setCopySourceDay(null)
        setCopyTargetDays(new Set())
    }

    const cancelCopy = () => {
        setCopySourceDay(null)
        setCopyTargetDays(new Set())
    }

    // Save all configs
    const handleSave = async () => {
        setIsSaving(true)
        try {
            for (const weekday of WEEKDAYS.map((d) => d.value)) {
                const config = configs[weekday]
                if (!config) continue

                const { error } = await supabase
                    .from("station_daily_configs")
                    .upsert(
                        {
                            weekday: config.weekday,
                            visible_station_ids: config.visible_station_ids,
                            station_order_ids: config.station_order_ids,
                        },
                        { onConflict: "weekday" }
                    )

                if (error) throw error
            }

            toast({
                title: "נשמר בהצלחה",
                description: "הגדרות העמדות לפי יום נשמרו",
            })

            // Clear station state and invalidate cache so the board will reload with new station configs
            dispatch(setVisibleStationIds([]))
            dispatch(setStationOrderIds([]))
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule"]))
        } catch (error) {
            console.error("Error saving station daily configs:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את ההגדרות",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]" dir="rtl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="mr-4 text-gray-600">טוען...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6" dir="rtl">
            <div>
                <h2 className="text-2xl font-bold mb-2">עמדות לפי יום</h2>
                <p className="text-muted-foreground">
                    הגדר אילו עמדות יוצגו ובאיזה סדר כאשר פותחים את לוח המנהל בכל יום בשבוע.
                    ניתן לשנות את ההגדרות באופן זמני בלוח המנהל עצמו.
                </p>
            </div>


            <div className="grid grid-cols-7 gap-4">
                {WEEKDAYS.map((day) => {
                    const config = configs[day.value]
                    const orderedStations = getOrderedStationsForDay(day.value)

                    return (
                        <Card key={day.value} className="min-w-0">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <CardTitle className="text-base">{day.label}</CardTitle>
                                        <CardDescription className="text-xs">
                                            {config?.visible_station_ids.length || 0} עמדות
                                        </CardDescription>
                                    </div>
                                    <Popover open={copySourceDay === day.value} onOpenChange={(open) => !open && cancelCopy()}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 flex-shrink-0"
                                                onClick={() => handleCopyConfig(day.value)}
                                                title="העתק הגדרות לימים אחרים"
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" className="w-64 pr-4 pl-4" dir="rtl" onClick={(e) => e.stopPropagation()}>
                                            <div className="space-y-3">
                                                <div className="text-sm font-medium pr-1">
                                                    העתק מ-{day.label} ל:
                                                </div>
                                                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                                                    {WEEKDAYS.filter((d) => d.value !== day.value).map((targetDay) => (
                                                        <label
                                                            key={targetDay.value}
                                                            className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md p-2 -mr-1 transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                            }}
                                                        >
                                                            <Checkbox
                                                                checked={copyTargetDays.has(targetDay.value)}
                                                                onCheckedChange={() => {
                                                                    toggleCopyTarget(targetDay.value)
                                                                }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                }}
                                                                className="scale-110"
                                                            />
                                                            <span className="text-sm cursor-pointer flex-1 pr-1 select-none">
                                                                {targetDay.label}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2 pt-2 border-t">
                                                    <Button
                                                        size="sm"
                                                        className="flex-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            applyCopy()
                                                        }}
                                                        disabled={copyTargetDays.size === 0}
                                                    >
                                                        העתק
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="flex-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            cancelCopy()
                                                        }}
                                                    >
                                                        ביטול
                                                    </Button>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd(day.value)}
                                >
                                    <SortableContext
                                        items={orderedStations.map((s) => s.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                                            {orderedStations.length === 0 ? (
                                                <p className="text-xs text-muted-foreground text-center py-4">
                                                    אין עמדות נבחרות
                                                </p>
                                            ) : (
                                                orderedStations.map((station) => (
                                                    <SortableStationItem
                                                        key={station.id}
                                                        stationId={station.id}
                                                        stationName={station.name}
                                                        isSelected={config?.visible_station_ids.includes(station.id) || false}
                                                        isActive={station.is_active}
                                                        onToggle={(id) => toggleStationVisibility(day.value, id)}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    </SortableContext>
                                </DndContext>

                                {/* Show unselected stations */}
                                {stations.filter((s) => !config?.visible_station_ids.includes(s.id)).length > 0 && (
                                    <div className="mt-3 pt-3 border-t">
                                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                                            לא נבחרות:
                                        </Label>
                                        <div className="space-y-1.5">
                                            {stations
                                                .filter((s) => !config?.visible_station_ids.includes(s.id))
                                                .map((station) => (
                                                    <div
                                                        key={station.id}
                                                        className={cn(
                                                            "flex items-center gap-2 rounded-lg border p-1.5",
                                                            !station.is_active && "opacity-60 bg-muted/30"
                                                        )}
                                                    >
                                                        <Checkbox
                                                            checked={false}
                                                            onCheckedChange={() => toggleStationVisibility(day.value, station.id)}
                                                            className="scale-110"
                                                        />
                                                        <Label
                                                            className={cn(
                                                                "flex-1 cursor-pointer text-xs",
                                                                !station.is_active && "text-muted-foreground"
                                                            )}
                                                            onClick={() => toggleStationVisibility(day.value, station.id)}
                                                        >
                                                            {station.name}
                                                            {!station.is_active && <span className="mr-1 text-[10px] text-muted-foreground">(לא פעיל)</span>}
                                                        </Label>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <div className="flex">
                <Button onClick={handleSave} disabled={isSaving} size="lg">
                    {isSaving ? (
                        <>
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            שומר...
                        </>
                    ) : (
                        <>
                            <Save className="ml-2 h-4 w-4" />
                            שמור הגדרות
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}

