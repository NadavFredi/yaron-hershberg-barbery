import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Save, Search, X, ChevronLeft, ChevronRight, CheckSquare, Square, MoreVertical, Copy, Trash2 } from "lucide-react"
import { useSettingsBreedStationMatrixSection } from "./SettingsBreedStationMatrixSection.module"
import { DuplicateStationDialog } from "../../dialogs/settings/stations/DuplicateStationDialog"
import { DeleteStationDialog } from "../../dialogs/settings/stations/DeleteStationDialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration-utils"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { STATIONS_PER_VIEW, SERVICES_PER_PAGE } from "./SettingsBreedStationMatrixSection.consts"
import { AddServiceDialog } from "./components/AddServiceDialog"
import { AddStationDialog } from "./components/AddStationDialog"
import { StationSelectionDialog } from "./components/StationSelectionDialog"

export function SettingsBreedStationMatrixSection() {
    const {
        services,
        filteredServices,
        visibleServices,
        allStations,
        allStationsIncludingInactive,
        visibleStations,
        selectedStationIds,
        stationPage,
        servicePage,
        searchTerm,
        selectedColumnFilter,
        columnFilterIsActive,
        columnFilterDurationMin,
        columnFilterDurationMax,
        matrix,
        initialMatrix,
        isLoading,
        isSaving,
        isStationDialogOpen,
        isAddStationDialogOpen,
        isAddServiceDialogOpen,
        newStationName,
        newServiceName,
        isAddingStation,
        isAddingService,
        stationToDelete,
        stationToDuplicate,
        isDeleteConfirmOpen,
        isDuplicateConfirmOpen,
        isTransferDialogOpen,
        isTypingDuration,
        durationInputValues,
        sensors,
        setSearchTerm,
        setSelectedColumnFilter,
        setColumnFilterIsActive,
        setColumnFilterDurationMin,
        setColumnFilterDurationMax,
        setIsStationDialogOpen,
        setIsAddStationDialogOpen,
        setIsAddServiceDialogOpen,
        setNewStationName,
        setNewServiceName,
        setStationToDelete,
        setStationToDuplicate,
        setIsDeleteConfirmOpen,
        setIsDuplicateConfirmOpen,
        setIsTransferDialogOpen,
        setIsTypingDuration,
        setDurationInputValues,
        handleToggleSupport,
        handleStationTimeChange,
        handleToggleStationSelection,
        handleDragEnd,
        handleTurnOnAllStations,
        handleTurnOffAllStations,
        handleAddService,
        handleAddStation,
        handleSave,
        handleNextStationPage,
        handlePreviousStationPage,
        handleNextServicePage,
        handlePreviousServicePage,
        handleDuplicateStation,
        confirmDuplicateStation,
        handleDeleteStation,
        confirmDeleteStation,
        handleTransferAndDelete,
        maxStationPage,
        canGoPreviousStation,
        canGoNextStation,
        maxServicePage,
        canGoPreviousService,
        canGoNextService,
    } = useSettingsBreedStationMatrixSection()

    // All logic is now in the module file
    // Only UI rendering remains here


    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mr-2">טוען מטריצת שירותים-עמדות...</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">מטריצת שירותים-עמדות</h2>
                    <p className="text-gray-600 mt-1">נהל את הקשר בין שירותים לעמדות - הגדר אילו שירותים זמינים בכל עמדה</p>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipContent side="bottom" className="max-w-xs" dir="rtl">
                                <div className="space-y-2 text-sm">
                                    <p className="font-medium">הסבר:</p>
                                    <ul className="list-disc list-inside space-y-1 mr-2">
                                        <li>סמן ✓ כדי לאפשר לעמדה לטפל בגזע מסוים</li>
                                        <li>זמן ברירת מחדל חל על כל העמדות התומכות בגזע זה</li>
                                        <li>ניתן להגדיר זמן ספציפי לכל עמדה (עוקף את ברירת המחדל)</li>
                                        <li>הזמן הכולל = זמן בסיסי של העמדה + זמן תיקון הגזע</li>
                                    </ul>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <AddServiceDialog
                        open={isAddServiceDialogOpen}
                        onOpenChange={setIsAddServiceDialogOpen}
                        serviceName={newServiceName}
                        onServiceNameChange={setNewServiceName}
                        onAdd={handleAddService}
                        isAdding={isAddingService}
                    />

                    <AddStationDialog
                        open={isAddStationDialogOpen}
                        onOpenChange={setIsAddStationDialogOpen}
                        stationName={newStationName}
                        onStationNameChange={setNewStationName}
                        onAdd={handleAddStation}
                        isAdding={isAddingStation}
                    />

                    <StationSelectionDialog
                        open={isStationDialogOpen}
                        onOpenChange={setIsStationDialogOpen}
                        allStations={allStationsIncludingInactive}
                        selectedStationIds={selectedStationIds}
                        onToggleStation={handleToggleStationSelection}
                        onDragEnd={handleDragEnd}
                        sensors={sensors}
                    />
                    <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        <Save className="h-4 w-4" />
                        שמור שינויים
                    </Button>
                </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ">
                {/* Search */}
                <div className="relative">
                    <Label className="text-sm text-right block mb-2">חפש שירות</Label>
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            placeholder="חפש שירות..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pr-10 h-10"
                            dir="rtl"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm("")}
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Column Filter */}
                <div className="space-y-2 min-w-0">
                    <Label className="text-sm text-right block">בחר עמודה לסינון</Label>
                    <Select
                        value={selectedColumnFilter || "all"}
                        onValueChange={(value) => {
                            setSelectedColumnFilter(value === "all" ? null : value)
                            // Reset column-specific filters when changing column
                            setColumnFilterNeedsApproval(null)
                            setColumnFilterIsActive(null)
                            setColumnFilterRemoteBooking(null)
                            setColumnFilterDurationMin("")
                            setColumnFilterDurationMax("")
                        }}
                    >
                        <SelectTrigger className="w-full h-10" dir="rtl">
                            <SelectValue placeholder="בחר עמודה..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">הצג את כל העמודות</SelectItem>
                            {allStations
                                .filter((s) => selectedStationIds.includes(s.id))
                                .map((station) => (
                                    <SelectItem key={station.id} value={station.id}>
                                        {station.name}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Column-Specific Filters (shown when column is selected) */}
            {selectedColumnFilter && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
                    <div className="space-y-2">
                        <Label className="text-sm text-right block">פעיל</Label>
                        <Select
                            value={columnFilterIsActive === null ? "all" : columnFilterIsActive ? "true" : "false"}
                            onValueChange={(value) => setColumnFilterIsActive(value === "all" ? null : value === "true")}
                        >
                            <SelectTrigger className="w-full" dir="rtl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all">הכל</SelectItem>
                                <SelectItem value="true">פעיל</SelectItem>
                                <SelectItem value="false">לא פעיל</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm text-right block">משך זמן</Label>
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                placeholder="מינימום"
                                value={columnFilterDurationMin}
                                onChange={(e) => {
                                    const cleaned = e.target.value.replace(/[^\d:]/g, "")
                                    setColumnFilterDurationMin(cleaned)
                                }}
                                className="w-full text-xs"
                                dir="rtl"
                            />
                            <Input
                                type="text"
                                placeholder="מקסימום"
                                value={columnFilterDurationMax}
                                onChange={(e) => {
                                    const cleaned = e.target.value.replace(/[^\d:]/g, "")
                                    setColumnFilterDurationMax(cleaned)
                                }}
                                className="w-full text-xs"
                                dir="rtl"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Pagination - Top */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {/* Service Pagination */}
                    {filteredServices.length > SERVICES_PER_PAGE && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                            <button
                                type="button"
                                onClick={handlePreviousServicePage}
                                disabled={!canGoPreviousService}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="שירות קודם"
                            >
                                <ChevronRight className="h-3 w-3" />
                            </button>
                            <span className="text-xs">
                                {servicePage * SERVICES_PER_PAGE + 1}-{Math.min((servicePage + 1) * SERVICES_PER_PAGE, filteredServices.length)} מתוך {filteredServices.length}
                            </span>
                            <button
                                type="button"
                                onClick={handleNextServicePage}
                                disabled={!canGoNextService}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="שירות הבא"
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                    {/* Station Pagination */}
                    {!selectedColumnFilter && selectedStationIds.length > STATIONS_PER_VIEW && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 mr-4">
                            <button
                                type="button"
                                onClick={handlePreviousStationPage}
                                disabled={!canGoPreviousStation}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="עמדה קודמת"
                            >
                                <ChevronRight className="h-3 w-3" />
                            </button>
                            <span className="text-xs">
                                עמדות {stationPage + 1}-{Math.min(stationPage + STATIONS_PER_VIEW, selectedStationIds.length)} מתוך {selectedStationIds.length}
                            </span>
                            <button
                                type="button"
                                onClick={handleNextStationPage}
                                disabled={!canGoNextStation}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="עמדה הבאה"
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="border rounded-lg">
                <div className="overflow-x-auto overflow-y-auto max-h-[800px] [direction:ltr] custom-scrollbar">
                    <div className="[direction:rtl]">
                        <div className="relative w-full">
                            <table className="w-full caption-bottom text-sm table-fixed">
                                <thead className="sticky top-0 z-20 [&_tr]:border-b bg-background">
                                    <tr className="border-b transition-colors bg-[hsl(228_36%_95%)]">
                                        <th className="text-right sticky pr-6 right-0 bg-[hsl(228_36%_95%)] text-primary font-semibold z-20 border-r-2 border-primary/20 align-middle" style={{ width: '380px', minWidth: '380px' }}>
                                            שירות
                                        </th>
                                        {visibleStations.map((station, stationIndex) => {
                                            const isLastStation = stationIndex === visibleStations.length - 1
                                            const headerBorderClasses = isLastStation
                                                ? 'border-l-2 border-r-2 border-primary/20'
                                                : 'border-l-2 border-r-2 border-primary/20'

                                            return (
                                                <th key={station.id} className={`text-center ${station.is_active ? 'bg-[hsl(228_36%_95%)]' : 'bg-gray-200 opacity-75'} text-primary font-semibold ${headerBorderClasses} h-12 px-3 align-middle`} style={{ width: '180px', minWidth: '180px' }}>
                                                    <div className="flex items-center justify-between gap-2 w-full">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 flex-shrink-0"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" dir="rtl">
                                                                <DropdownMenuItem
                                                                    onClick={() => handleDuplicateStation(station)}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <Copy className="h-4 w-4" />
                                                                    שכפל
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => handleDeleteStation(station)}
                                                                    className="flex items-center gap-2 text-red-600"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    מחק
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <div className="text-center flex-1 flex flex-col items-center gap-1">
                                                            <span className={!station.is_active ? 'text-gray-500' : ''}>{station.name}</span>
                                                            {!station.is_active && (
                                                                <span className="text-xs text-gray-400 bg-gray-300 px-2 py-0.5 rounded" title="עמדה לא פעילה">
                                                                    לא פעילה
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </th>
                                            )
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {filteredServices.length === 0 ? (
                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <td colSpan={visibleStations.length + 1} className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 text-center text-gray-500 py-8">
                                                {services.length === 0
                                                    ? "אין שירותים במערכת. הוסף שירות חדש כדי להתחיל."
                                                    : "לא נמצאו שירותים התואמים את החיפוש."}
                                            </td>
                                        </tr>
                                    ) : (
                                        visibleServices.map((service) => {
                                            const serviceCells = matrix[service.id] || {}
                                            const isTyping = isTypingDuration[service.id] || {}

                                            return (
                                                <tr
                                                    key={service.id}
                                                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                                >
                                                    <td className="sticky right-0 bg-white z-10 border-r-2 border-primary/20 px-4 align-middle [&:has([role=checkbox])]:pr-0" style={{ width: '380px', minWidth: '380px' }}>
                                                        <div className="flex items-center justify-between gap-2 w-full" dir="rtl">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="font-medium truncate whitespace-nowrap block w-full text-right">{service.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                    title="הפעל את כל העמדות"
                                                                    onClick={() => handleTurnOnAllStations(service.id)}
                                                                >
                                                                    <CheckSquare className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                                                    title="כבה את כל העמדות"
                                                                    onClick={() => handleTurnOffAllStations(service.id)}
                                                                >
                                                                    <Square className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {visibleStations.map((station, stationIndex) => {
                                                        const cell = serviceCells[station.id] || { supported: false }
                                                        const displayTime = cell.baseTimeMinutes ?? 60
                                                        const isTypingCell = isTyping[station.id] ?? false

                                                        const columnColor = stationIndex % 2 === 0
                                                            ? 'bg-primary/3 border-primary/10'
                                                            : 'bg-white border-gray-100'

                                                        const isLastStation = stationIndex === visibleStations.length - 1
                                                        const borderClasses = isLastStation
                                                            ? `${columnColor} border-l-2 border-r-2 border-primary/20`
                                                            : `${columnColor} border-l-2 border-r-2 border-primary/20`

                                                        return (
                                                            <td key={station.id} className={`text-center align-middle ${borderClasses} px-4 py-1`} style={{ width: '180px', minWidth: '180px' }}>
                                                                <div className="flex items-center gap-3 justify-center w-full max-w-full">
                                                                    <Input
                                                                        type="text"
                                                                        disabled={!cell.supported}
                                                                        value={
                                                                            cell.supported
                                                                                ? (isTypingCell
                                                                                    ? (durationInputValues[service.id]?.[station.id] ?? formatDurationFromMinutes(displayTime))
                                                                                    : formatDurationFromMinutes(displayTime))
                                                                                : "-"
                                                                        }
                                                                        onChange={(e) => {
                                                                            if (!cell.supported) return
                                                                            const value = e.target.value
                                                                            const cleaned = value.replace(/[^\d:]/g, "")

                                                                            setDurationInputValues((prev) => ({
                                                                                ...prev,
                                                                                [service.id]: {
                                                                                    ...(prev[service.id] || {}),
                                                                                    [station.id]: cleaned,
                                                                                },
                                                                            }))

                                                                            const minutes = parseDurationToMinutes(cleaned)
                                                                            if (minutes !== null && minutes >= 0) {
                                                                                handleStationTimeChange(service.id, station.id, cleaned)
                                                                            }
                                                                        }}
                                                                        onFocus={(e) => {
                                                                            if (!cell.supported) return
                                                                            setIsTypingDuration((prev) => ({
                                                                                ...prev,
                                                                                [service.id]: {
                                                                                    ...(prev[service.id] || {}),
                                                                                    [station.id]: true,
                                                                                },
                                                                            }))
                                                                            const currentValue = formatDurationFromMinutes(displayTime)
                                                                            setDurationInputValues((prev) => ({
                                                                                ...prev,
                                                                                [service.id]: {
                                                                                    ...(prev[service.id] || {}),
                                                                                    [station.id]: currentValue,
                                                                                },
                                                                            }))
                                                                            setTimeout(() => {
                                                                                e.target.select()
                                                                            }, 0)
                                                                        }}
                                                                        onBlur={(e) => {
                                                                            if (!cell.supported) return
                                                                            setIsTypingDuration((prev) => {
                                                                                const newState = { ...prev }
                                                                                if (newState[service.id]) {
                                                                                    newState[service.id] = { ...newState[service.id] }
                                                                                    delete newState[service.id][station.id]
                                                                                }
                                                                                return newState
                                                                            })
                                                                            const value = e.target.value
                                                                            const minutes = parseDurationToMinutes(value)
                                                                            const finalMinutes = minutes !== null && minutes >= 0 ? minutes : displayTime
                                                                            const formatted = formatDurationFromMinutes(finalMinutes)

                                                                            setDurationInputValues((prev) => ({
                                                                                ...prev,
                                                                                [service.id]: {
                                                                                    ...(prev[service.id] || {}),
                                                                                    [station.id]: formatted,
                                                                                },
                                                                            }))

                                                                            if (finalMinutes !== displayTime) {
                                                                                handleStationTimeChange(service.id, station.id, formatted)
                                                                            }
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            if (!cell.supported) return
                                                                            if (e.key === "Enter") {
                                                                                e.preventDefault()
                                                                                const value = e.target.value
                                                                                const minutes = parseDurationToMinutes(value)
                                                                                const finalMinutes = minutes !== null && minutes >= 0 ? minutes : displayTime
                                                                                handleStationTimeChange(service.id, station.id, formatDurationFromMinutes(finalMinutes))
                                                                                e.target.blur()
                                                                            }
                                                                        }}
                                                                        className="w-20 h-8 text-xs text-center"
                                                                        dir="rtl"
                                                                        placeholder={cell.supported ? "1:30" : "-"}
                                                                        title={cell.supported ? "משך זמן" : "עמדה לא פעילה"}
                                                                    />
                                                                    <Checkbox
                                                                        checked={cell.supported}
                                                                        onCheckedChange={() => handleToggleSupport(service.id, station.id)}
                                                                        className="scale-125"
                                                                    />
                                                                </div>
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                        )
                                    })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pagination - Bottom */}
            <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                    {/* Service Pagination */}
                    {filteredServices.length > SERVICES_PER_PAGE && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                            <button
                                type="button"
                                onClick={handlePreviousServicePage}
                                disabled={!canGoPreviousService}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="שירות קודם"
                            >
                                <ChevronRight className="h-3 w-3" />
                            </button>
                            <span className="text-xs">
                                {servicePage * SERVICES_PER_PAGE + 1}-{Math.min((servicePage + 1) * SERVICES_PER_PAGE, filteredServices.length)} מתוך {filteredServices.length}
                            </span>
                            <button
                                type="button"
                                onClick={handleNextServicePage}
                                disabled={!canGoNextService}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="שירות הבא"
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                    {/* Station Pagination */}
                    {!selectedColumnFilter && selectedStationIds.length > STATIONS_PER_VIEW && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 mr-4">
                            <button
                                type="button"
                                onClick={handlePreviousStationPage}
                                disabled={!canGoPreviousStation}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="עמדה קודמת"
                            >
                                <ChevronRight className="h-3 w-3" />
                            </button>
                            <span className="text-xs">
                                עמדות {stationPage + 1}-{Math.min(stationPage + STATIONS_PER_VIEW, selectedStationIds.length)} מתוך {selectedStationIds.length}
                            </span>
                            <button
                                type="button"
                                onClick={handleNextStationPage}
                                disabled={!canGoNextStation}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="עמדה הבאה"
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Dialogs */}
            <DuplicateStationDialog
                open={isDuplicateConfirmOpen}
                onOpenChange={setIsDuplicateConfirmOpen}
                station={stationToDuplicate}
                stations={allStations}
                onConfirm={confirmDuplicateStation}
                isDuplicating={isAddingStation}
            />


            <DeleteStationDialog
                deleteConfirmOpen={isDeleteConfirmOpen}
                onDeleteConfirmChange={setIsDeleteConfirmOpen}
                transferDialogOpen={isTransferDialogOpen}
                onTransferDialogChange={setIsTransferDialogOpen}
                station={stationToDelete}
                stations={allStations}
                onConfirmDelete={confirmDeleteStation}
                onTransferAndDelete={handleTransferAndDelete}
            />
        </div>
    )
}
