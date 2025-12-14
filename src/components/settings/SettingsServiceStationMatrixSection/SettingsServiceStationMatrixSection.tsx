import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Save, Search, X, ChevronLeft, ChevronRight, CheckSquare, Square, MoreVertical, Copy, Trash2, ChevronUp, ChevronDown, Globe, ShieldCheck, Info, Check, Settings, RefreshCw } from "lucide-react"
import { useSettingsServiceStationMatrixSection } from "./SettingsServiceStationMatrixSection.module"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { STATIONS_PER_VIEW, SERVICES_PER_PAGE } from "./SettingsServiceStationMatrixSection.consts"
import { AddServiceDialog } from "./components/AddServiceDialog"
import { AddStationDialog } from "./components/AddStationDialog"
import { StationSelectionDialog } from "./components/StationSelectionDialog"

export function SettingsServiceStationMatrixSection() {
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
        columnFilterNeedsApproval,
        columnFilterIsActive,
        columnFilterRemoteBooking,
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
        serviceToDuplicate,
        isDuplicateServiceDialogOpen,
        isDuplicatingService,
        serviceToDelete,
        isDeleteServiceDialogOpen,
        isDeletingService,
        isTypingDuration,
        durationInputValues,
        isTypingDefault,
        defaultDurationInputValues,
        expandedServiceId,
        savingServiceId,
        savingServiceRowId,
        sensors,
        setSearchTerm,
        setSelectedColumnFilter,
        setColumnFilterNeedsApproval,
        setColumnFilterIsActive,
        setColumnFilterRemoteBooking,
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
        setServiceToDuplicate,
        setIsDuplicateServiceDialogOpen,
        setServiceToDelete,
        setIsDeleteServiceDialogOpen,
        setIsTypingDuration,
        setDurationInputValues,
        setIsTypingDefault,
        setDefaultDurationInputValues,
        setExpandedServiceId,
        getDefaultTimeForService,
        serviceHasMatrixChanges,
        getServiceStatus,
        toggleServiceExpand,
        handleToggleSupport,
        handleDefaultTimeChange,
        handleStationTimeChange,
        handleApplyDefaultToAll,
        handleToggleStationSelection,
        handleDragEnd,
        handleTurnOnAllStations,
        handleTurnOffAllStations,
        handleMarkAllRemoteBooking,
        handleMarkAllNoRemoteBooking,
        handleMarkAllApprovalNeeded,
        handleMarkAllNoApprovalNeeded,
        handleAddService,
        handleAddStation,
        handleSave,
        handleSaveServiceRow,
        handleRevertServiceRow,
        handleToggleRemoteBooking,
        handleToggleApproval,
        handleNextStationPage,
        handlePreviousStationPage,
        handleNextServicePage,
        handlePreviousServicePage,
        handleDuplicateStation,
        handleDuplicateService,
        handleDeleteService,
        confirmDeleteService,
        confirmDuplicateService,
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
    } = useSettingsServiceStationMatrixSection()

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
                    <p className="text-gray-600 mt-1">נהל את כל הגדרות המערכת - שירותים, שעות עבודה, עמדות ומטריצות</p>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipContent side="bottom" className="max-w-xs" dir="rtl">
                                <div className="space-y-2 text-sm">
                                    <p className="font-medium">הסבר:</p>
                                    <ul className="list-disc list-inside space-y-1 mr-2">
                                        <li>סמן ✓ כדי לאפשר לעמדה לטפל בשירות מסוים</li>
                                        <li>זמן ברירת מחדל חל על כל העמדות התומכות בשירות זה</li>
                                        <li>ניתן להגדיר זמן ספציפי לכל עמדה (עוקף את ברירת המחדל)</li>
                                        <li>הזמן הכולל = זמן בסיסי של העמדה + זמן תיקון השירות</li>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ">
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border">
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
                        <Label className="text-sm text-right block">תור מרחוק</Label>
                        <Select
                            value={columnFilterRemoteBooking === null ? "all" : columnFilterRemoteBooking ? "true" : "false"}
                            onValueChange={(value) => setColumnFilterRemoteBooking(value === "all" ? null : value === "true")}
                        >
                            <SelectTrigger className="w-full" dir="rtl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all">הכל</SelectItem>
                                <SelectItem value="true">כן</SelectItem>
                                <SelectItem value="false">לא</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm text-right block">דרוש אישור</Label>
                        <Select
                            value={columnFilterNeedsApproval === null ? "all" : columnFilterNeedsApproval ? "true" : "false"}
                            onValueChange={(value) => setColumnFilterNeedsApproval(value === "all" ? null : value === "true")}
                        >
                            <SelectTrigger className="w-full" dir="rtl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all">הכל</SelectItem>
                                <SelectItem value="true">כן</SelectItem>
                                <SelectItem value="false">לא</SelectItem>
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
                                            שירות / זמן ברירת מחדל
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
                                            const defaultTime = getDefaultTimeForService(service.id)
                                            const serviceCells = matrix[service.id] || {}
                                            const serviceStatus = getServiceStatus(service.id)
                                            const isExpanded = expandedServiceId === service.id
                                            const hasMatrixChanges = serviceHasMatrixChanges(service.id)
                                            const isRowDirty = hasMatrixChanges
                                            const isRowSaving = savingServiceRowId === service.id

                                            // Get status color for filled circle (softer colors)
                                            const statusColor = serviceStatus === 'none' ? 'bg-gray-300' : serviceStatus === 'some' ? 'bg-blue-300' : 'bg-green-300'

                                            return [
                                                <tr
                                                    key={service.id}
                                                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                                >
                                                    <td className="sticky right-0 bg-white z-10 border-r-2 border-primary/20 px-4 align-middle [&:has([role=checkbox])]:pr-0" style={{ width: '380px', minWidth: '380px' }}>
                                                        <div className="flex items-center justify-between gap-2 w-full" dir="rtl">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => toggleServiceExpand(service.id)}
                                                                    className="h-6 w-6 p-0 flex-shrink-0"
                                                                    title={isExpanded ? "צמצם" : "הרחב"}
                                                                >
                                                                    {isExpanded ? (
                                                                        <ChevronUp className="h-4 w-4" />
                                                                    ) : (
                                                                        <ChevronDown className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                                <div className={`h-4 w-4 rounded-full ${statusColor} flex-shrink-0`} />
                                                                <div className="flex flex-col  min-w-0 max-w-[140px]">
                                                                    <span className="font-medium truncate whitespace-nowrap block w-full text-right">{service.name}</span>
                                                                    <span className="text-xs text-gray-500 text-right">
                                                                        {`ברירת מחדל: ${formatDurationFromMinutes(defaultTime ?? 60)}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                                                {isRowDirty && (
                                                                    <>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                                                            title="בטל שינויים"
                                                                            onClick={() => handleRevertServiceRow(service.id)}
                                                                            disabled={isRowSaving}
                                                                        >
                                                                            <X className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                                                                            title="שמור שינויים"
                                                                            onClick={() => handleSaveServiceRow(service.id)}
                                                                            disabled={isRowSaving}
                                                                        >
                                                                            {isRowSaving ? (
                                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            ) : (
                                                                                <Check className="h-3.5 w-3.5" />
                                                                            )}
                                                                        </Button>
                                                                        <div className="w-px h-5 bg-gray-300 mx-0.5" />
                                                                    </>
                                                                )}
                                                                <div className="flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-0.5">
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
                                                                            className="h-6 w-6 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                                                            title="תור מרחוק - כן (סמן את כל העמדות כתומכות בתור מרחוק)"
                                                                            onClick={() => handleMarkAllRemoteBooking(service.id)}
                                                                        >
                                                                            <Globe className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                                                                            title="אישור - כן (סמן את כל העמדות כנדרשות אישור)"
                                                                            onClick={() => handleMarkAllApprovalNeeded(service.id)}
                                                                        >
                                                                            <ShieldCheck className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                    <div className="flex items-center gap-0.5">
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
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                                                            title="תור מרחוק - לא (סמן את כל העמדות ללא תמיכה בתור מרחוק)"
                                                                            onClick={() => handleMarkAllNoRemoteBooking(service.id)}
                                                                        >
                                                                            <Globe className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                                                            title="אישור - לא (סמן את כל העמדות ללא דרישת אישור)"
                                                                            onClick={() => handleMarkAllNoApprovalNeeded(service.id)}
                                                                        >
                                                                            <ShieldCheck className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                <div className="w-px h-5 bg-gray-300 mx-0.5" />
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0"
                                                                            title="פעולות קבוצתיות"
                                                                        >
                                                                            <MoreVertical className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" dir="rtl" className="min-w-[180px]">
                                                                        <div className="px-2 py-1.5">
                                                                            <div className="flex items-center gap-1.5 mb-2">
                                                                                <Settings className="h-3.5 w-3.5 text-gray-500" />
                                                                                <span className="text-xs font-semibold text-gray-600">זמן ברירת מחדל</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <Input
                                                                                    id={`default-${service.id}`}
                                                                                    type="text"
                                                                                    value={
                                                                                        isTypingDefault[service.id]
                                                                                            ? (defaultDurationInputValues[service.id] ?? formatDurationFromMinutes(defaultTime ?? 60))
                                                                                            : (defaultTime !== undefined ? formatDurationFromMinutes(defaultTime) : "")
                                                                                    }
                                                                                    onChange={(e) => {
                                                                                        const value = e.target.value
                                                                                        const cleaned = value.replace(/[^\d:]/g, "")
                                                                                        setDefaultDurationInputValues((prev) => ({
                                                                                            ...prev,
                                                                                            [service.id]: cleaned,
                                                                                        }))
                                                                                        const minutes = parseDurationToMinutes(cleaned)
                                                                                        if (minutes !== null && minutes >= 0) {
                                                                                            handleDefaultTimeChange(service.id, minutes.toString())
                                                                                        }
                                                                                    }}
                                                                                    onFocus={(e) => {
                                                                                        setIsTypingDefault((prev) => ({
                                                                                            ...prev,
                                                                                            [service.id]: true,
                                                                                        }))
                                                                                        const currentValue = formatDurationFromMinutes(defaultTime ?? 60)
                                                                                        setDefaultDurationInputValues((prev) => ({
                                                                                            ...prev,
                                                                                            [service.id]: currentValue,
                                                                                        }))
                                                                                        setTimeout(() => {
                                                                                            e.target.select()
                                                                                        }, 0)
                                                                                    }}
                                                                                    onBlur={(e) => {
                                                                                        setIsTypingDefault((prev) => {
                                                                                            const newState = { ...prev }
                                                                                            delete newState[service.id]
                                                                                            return newState
                                                                                        })
                                                                                        const value = e.target.value
                                                                                        const minutes = parseDurationToMinutes(value)
                                                                                        const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (defaultTime ?? 60)
                                                                                        const formatted = formatDurationFromMinutes(finalMinutes)
                                                                                        setDefaultDurationInputValues((prev) => ({
                                                                                            ...prev,
                                                                                            [service.id]: formatted,
                                                                                        }))
                                                                                        if (finalMinutes !== defaultTime) {
                                                                                            handleDefaultTimeChange(service.id, finalMinutes.toString())
                                                                                        }
                                                                                    }}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === "Enter") {
                                                                                            e.preventDefault()
                                                                                            const value = e.target.value
                                                                                            const minutes = parseDurationToMinutes(value)
                                                                                            const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (defaultTime ?? 60)
                                                                                            handleDefaultTimeChange(service.id, finalMinutes.toString())
                                                                                            e.target.blur()
                                                                                        }
                                                                                    }}
                                                                                    className="h-7 w-14 text-xs text-right flex-1"
                                                                                    dir="rtl"
                                                                                    placeholder="1:00"
                                                                                />
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={() => handleApplyDefaultToAll(service.id)}
                                                                                    className="h-7 w-7 p-0"
                                                                                    title="החל על כל העמדות"
                                                                                >
                                                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="border-t my-1" />
                                                                        <DropdownMenuItem
                                                                            onClick={() => handleDuplicateService(service)}
                                                                            className="flex items-center gap-2"
                                                                        >
                                                                            <Copy className="h-4 w-4" />
                                                                            שכפל שירות
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem
                                                                            onClick={() => handleDeleteService(service)}
                                                                            className="flex items-center gap-2 text-red-600"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                            מחק שירות
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {visibleStations.map((station, stationIndex) => {
                                                        const cell = serviceCells[station.id] || { supported: false }
                                                        const displayTime = cell.stationTime || defaultTime || 60
                                                        const isTyping = isTypingDuration[service.id]?.[station.id] ?? false

                                                        const remoteBooking = cell?.remote_booking_allowed ?? false
                                                        const approvalNeeded = cell?.is_approval_needed ?? false

                                                        // Match column colors with headers - alternating subtle primary tint and white
                                                        const columnColor = stationIndex % 2 === 0
                                                            ? 'bg-primary/3 border-primary/10'  // Even: very subtle primary tint
                                                            : 'bg-white border-gray-100'  // Odd: white

                                                        // Add right border to the last (rightmost) station column
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
                                                                                ? (isTyping
                                                                                    ? (durationInputValues[service.id]?.[station.id] ?? formatDurationFromMinutes(displayTime))
                                                                                    : formatDurationFromMinutes(displayTime))
                                                                                : "-"
                                                                        }
                                                                        onChange={(e) => {
                                                                            if (!cell.supported) return // Prevent changes when disabled
                                                                            const value = e.target.value
                                                                            // Only allow numbers and colons
                                                                            const cleaned = value.replace(/[^\d:]/g, "")

                                                                            setDurationInputValues((prev) => ({
                                                                                ...prev,
                                                                                [service.id]: {
                                                                                    ...(prev[service.id] || {}),
                                                                                    [station.id]: cleaned,
                                                                                },
                                                                            }))

                                                                            // Try to parse and update if valid
                                                                            const minutes = parseDurationToMinutes(cleaned)
                                                                            if (minutes !== null && minutes >= 0) {
                                                                                handleStationTimeChange(service.id, station.id, minutes.toString())
                                                                            }
                                                                        }}
                                                                        onFocus={(e) => {
                                                                            if (!cell.supported) return // Prevent focus when disabled
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
                                                                            if (!cell.supported) return // Prevent blur handling when disabled
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
                                                                                handleStationTimeChange(service.id, station.id, finalMinutes.toString())
                                                                            }
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            if (!cell.supported) return // Prevent key handling when disabled
                                                                            if (e.key === "Enter") {
                                                                                e.preventDefault()
                                                                                const value = e.target.value
                                                                                const minutes = parseDurationToMinutes(value)
                                                                                const finalMinutes = minutes !== null && minutes >= 0 ? minutes : displayTime
                                                                                handleStationTimeChange(service.id, station.id, finalMinutes.toString())
                                                                                e.target.blur()
                                                                            }
                                                                        }}
                                                                        className="w-20 h-8 text-xs text-center"
                                                                        dir="rtl"
                                                                        placeholder={cell.supported ? "1:30" : "-"}
                                                                        title={cell.supported ? "זמן ספציפי לעמדה זו (עוקף ברירת מחדל)" : "עמדה לא פעילה"}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => cell.supported && handleToggleRemoteBooking(service.id, station.id)}
                                                                        disabled={!cell.supported}
                                                                        className={`flex items-center justify-center p-0.5 rounded transition-colors ${cell.supported
                                                                            ? (remoteBooking
                                                                                ? 'text-blue-500 hover:text-blue-600 hover:bg-blue-50'
                                                                                : 'text-gray-300 hover:text-gray-400 hover:bg-gray-50')
                                                                            : 'text-gray-200 cursor-not-allowed'
                                                                            } ${cell.supported ? 'cursor-pointer' : ''}`}
                                                                        title={
                                                                            !cell.supported
                                                                                ? "עמדה לא פעילה - הפעל עמדה כדי לאפשר תור מרחוק"
                                                                                : (remoteBooking ? "לחץ כדי לכבות תור מרחוק" : "לחץ כדי לאפשר תור מרחוק")
                                                                        }
                                                                    >
                                                                        <Globe className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => cell.supported && handleToggleApproval(service.id, station.id)}
                                                                        disabled={!cell.supported}
                                                                        className={`flex items-center justify-center p-0.5 rounded transition-colors ${cell.supported
                                                                            ? (approvalNeeded
                                                                                ? 'text-orange-500 hover:text-orange-600 hover:bg-orange-50'
                                                                                : 'text-gray-300 hover:text-gray-400 hover:bg-gray-50')
                                                                            : 'text-gray-200 cursor-not-allowed'
                                                                            } ${cell.supported ? 'cursor-pointer' : ''}`}
                                                                        title={
                                                                            !cell.supported
                                                                                ? "עמדה לא פעילה - הפעל עמדה כדי לדרוש אישור"
                                                                                : (approvalNeeded ? "לחץ כדי להסיר דרישת אישור" : "לחץ כדי לדרוש אישור צוות")
                                                                        }
                                                                    >
                                                                        <ShieldCheck className="h-4 w-4" strokeWidth={2.5} />
                                                                    </button>
                                                                    <Checkbox
                                                                        checked={cell.supported}
                                                                        onCheckedChange={() => handleToggleSupport(service.id, station.id)}
                                                                        className="scale-125"
                                                                    />
                                                                </div>
                                                            </td>
                                                        )
                                                    })}
                                                </tr>,
                                                <tr
                                                    key={`${service.id}-details`}
                                                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                                >
                                                    <td colSpan={visibleStations.length + 1} className="px-4 align-middle [&:has([role=checkbox])]:pr-0 bg-gray-50 p-0">
                                                        <Collapsible open={isExpanded}>
                                                            <CollapsibleContent>
                                                                <div className="p-4 border-t-2 border-primary/20" dir="rtl">
                                                                    <div className="flex items-center justify-between mb-4">
                                                                        <h3 className="text-sm font-semibold text-gray-900">פרטי שירות עבור {service.name}</h3>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-xs text-gray-600">מחיר בסיס: {service.base_price}₪</Label>
                                                                        {service.description && (
                                                                            <p className="text-xs text-gray-500">{service.description}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </CollapsibleContent>
                                                        </Collapsible>
                                                    </td>
                                                </tr>,
                                            ]
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
