import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Loader2, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import * as XLSX from "xlsx"

interface DetailItem {
    id: string
    [key: string]: any
}

interface ChartDetailModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    data: DetailItem[]
    columns: Array<{
        key: string
        label: string
        render?: (value: any, item: DetailItem) => React.ReactNode
        isNumeric?: boolean // For columns that should be summed
    }>
    isLoading?: boolean
    onRowClick?: (item: DetailItem) => void
}

export function ChartDetailModal({
    open,
    onOpenChange,
    title,
    description,
    data,
    columns,
    isLoading = false,
    onRowClick,
}: ChartDetailModalProps) {
    // Calculate sums for numeric columns
    const sums = React.useMemo(() => {
        const result: Record<string, number> = {}
        if (!data || !Array.isArray(data) || !columns || !Array.isArray(columns)) {
            return result
        }
        columns.forEach((col) => {
            if (col.isNumeric) {
                result[col.key] = data.reduce((sum, item) => {
                    const rawValue = item[col.key]
                    // If there's a render function, we need to get the raw value
                    // Otherwise use the raw value directly
                    let value = rawValue
                    
                    // If value is already a number, use it
                    if (typeof value === "number") {
                        return sum + value
                    }
                    
                    // If value is a string, try to extract number
                    if (typeof value === "string") {
                        const numStr = value.replace(/[₪,\s]/g, "")
                        const num = parseFloat(numStr)
                        return isNaN(num) ? sum : sum + num
                    }
                    
                    return sum
                }, 0)
            }
        })
        return result
    }, [data, columns])

    const handleExportToExcel = () => {
        if (!data || !Array.isArray(data)) return
        // Prepare data for export
        const exportData = data.map((item) => {
            const row: Record<string, any> = {}
            columns.forEach((col) => {
                const value = item[col.key]
                if (col.render) {
                    // For rendered values, we need to get the raw value or a string representation
                    const rendered = col.render(value, item)
                    row[col.label] = typeof rendered === "string" ? rendered : String(rendered || value || "")
                } else {
                    row[col.label] = value ?? ""
                }
            })
            return row
        })

        // Create workbook and worksheet
        const ws = XLSX.utils.json_to_sheet(exportData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "נתונים")

        // Generate filename with current date
        const filename = `${title}_${format(new Date(), "yyyy-MM-dd")}.xlsx`

        // Write file
        XLSX.writeFile(wb, filename)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange} dir="rtl">
            <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col rtl" dir="rtl">
                <DialogHeader dir="rtl" className="rtl pr-10">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <DialogTitle className="text-right rtl">{title}</DialogTitle>
                            {description && <DialogDescription className="text-right rtl">{description}</DialogDescription>}
                        </div>
                        {data && Array.isArray(data) && data.length > 0 && (
                            <Button
                                onClick={handleExportToExcel}
                                variant="outline"
                                size="sm"
                                className="flex-shrink-0"
                            >
                                <Download className="h-4 w-4 ml-2" />
                                ייצא ל-Excel
                            </Button>
                        )}
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto overflow-x-auto rtl" dir="rtl" style={{ maxHeight: "calc(85vh - 120px)" }}>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : !data || !Array.isArray(data) || data.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">אין נתונים להצגה</div>
                    ) : (
                        <div className="overflow-x-auto rtl" dir="rtl">
                            <Table className="rtl" dir="rtl">
                                <TableHeader>
                                    <TableRow>
                                        {columns && Array.isArray(columns) && columns.map((col) => (
                                            <TableHead key={col.key} className="text-right font-semibold rtl">
                                                {col.label}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data && Array.isArray(data) && data.map((item) => (
                                        <TableRow
                                            key={item.id}
                                            className={cn(
                                                onRowClick && "cursor-pointer hover:bg-slate-50 transition-colors",
                                                "rtl"
                                            )}
                                            onClick={() => onRowClick?.(item)}
                                        >
                                            {columns && Array.isArray(columns) && columns.map((col) => (
                                                <TableCell key={col.key} className="text-right rtl">
                                                    {col.render
                                                        ? col.render(item[col.key], item)
                                                        : item[col.key] ?? "—"}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                    {/* Sum row */}
                                    {Object.keys(sums).length > 0 && columns && Array.isArray(columns) && (
                                        <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300 rtl">
                                            {columns.map((col) => {
                                                if (col.isNumeric && sums[col.key] !== undefined) {
                                                    return (
                                                        <TableCell key={col.key} className="text-right font-bold rtl">
                                                            {col.render
                                                                ? col.render(sums[col.key], {} as DetailItem)
                                                                : typeof sums[col.key] === "number"
                                                                ? sums[col.key].toLocaleString("he-IL")
                                                                : sums[col.key]}
                                                        </TableCell>
                                                    )
                                                }
                                                return (
                                                    <TableCell key={col.key} className="text-right font-bold rtl">
                                                        {col.key === columns[0].key ? "סה״כ" : "—"}
                                                    </TableCell>
                                                )
                                            })}
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

