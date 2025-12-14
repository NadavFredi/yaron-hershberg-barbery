import React, { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, X, Star } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"

interface Reminder {
    id: string
    flow_id: string
    description: string | null
    is_active: boolean
    is_default: boolean
}

interface SelectReminderDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelect: (reminder: Reminder) => void
}

export const SelectReminderDialog: React.FC<SelectReminderDialogProps> = ({
    open,
    onOpenChange,
    onSelect
}) => {
    const [reminders, setReminders] = useState<Reminder[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const inputRef = React.useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (open) {
            loadReminders()
            // Focus input when dialog opens
            setTimeout(() => {
                inputRef.current?.focus()
            }, 100)
            // Prevent body interactions when dialog is open
            document.body.style.pointerEvents = 'none'
            document.body.style.userSelect = 'none'
        } else {
            // Reset search when dialog closes
            setSearchTerm("")
            // Restore body interactions when dialog closes
            document.body.style.pointerEvents = ''
            document.body.style.userSelect = ''
        }
        
        return () => {
            // Cleanup: restore body interactions on unmount
            document.body.style.pointerEvents = ''
            document.body.style.userSelect = ''
        }
    }, [open])

    const loadReminders = async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from("appointment_reminders")
                .select("id, flow_id, description, is_active, is_default")
                .eq("is_manual", true)
                .eq("is_active", true)
                .order("is_default", { ascending: false }) // Default reminders first
                .order("display_order", { ascending: true })

            if (error) throw error

            setReminders(data || [])
        } catch (error) {
            console.error("Error loading manual reminders:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const filteredReminders = useMemo(() => {
        if (!searchTerm.trim()) {
            return reminders
        }

        const term = searchTerm.toLowerCase()
        return reminders.filter(reminder => {
            const description = reminder.description?.toLowerCase() || ""
            const flowId = reminder.flow_id.toLowerCase()
            return description.includes(term) || flowId.includes(term)
        })
    }, [reminders, searchTerm])

    const handleSelect = (reminder: Reminder) => {
        onSelect(reminder)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange} modal={true} dir="rtl">
            <DialogContent 
                className="max-w-md pointer-events-auto !pointer-events-auto" 
                dir="rtl"
                style={{ pointerEvents: 'auto' }}
                onPointerDownOutside={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                }}
                onInteractOutside={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                }}
                onEscapeKeyDown={(e) => {
                    e.preventDefault()
                    onOpenChange(false)
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseEnter={(e) => e.stopPropagation()}
                onMouseLeave={(e) => e.stopPropagation()}
                onMouseMove={(e) => e.stopPropagation()}
                onMouseOver={(e) => e.stopPropagation()}
                onDragStart={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                }}
                onDrag={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                }}
                onDragEnd={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                }}
                onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                }}
            >
                <div 
                    onClick={(e) => e.stopPropagation()} 
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseEnter={(e) => e.stopPropagation()}
                    onMouseLeave={(e) => e.stopPropagation()}
                    onMouseMove={(e) => e.stopPropagation()}
                    onMouseOver={(e) => e.stopPropagation()}
                    onDragStart={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                    }}
                    onDrag={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                    }}
                    onDragEnd={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                    }}
                    onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                    }}
                >
                    <DialogHeader>
                        <DialogTitle className="text-right">בחר תזכורת לשליחה</DialogTitle>
                        <DialogDescription className="text-right">
                            בחר תזכורת ידנית מהרשימה או חפש לפי תיאור או מזהה זרימה
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            ref={inputRef}
                            type="text"
                            placeholder="חפש תזכורת..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="pr-10 text-right"
                            dir="rtl"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setSearchTerm("")
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span className="mr-2 text-gray-600">טוען...</span>
                        </div>
                    ) : filteredReminders.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            {searchTerm ? "לא נמצאו תזכורות התואמות לחיפוש" : "אין תזכורות ידניות זמינות"}
                        </div>
                    ) : (
                        <ScrollArea 
                            className="h-[300px]"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <div className="space-y-2">
                                {filteredReminders.map((reminder) => (
                                    <button
                                        key={reminder.id}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleSelect(reminder)
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        className={cn(
                                            "w-full text-right p-3 rounded-lg border transition-colors",
                                            "hover:bg-gray-50 hover:border-primary",
                                            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                            reminder.is_default && "border-yellow-300 bg-yellow-50"
                                        )}
                                    >
                                        <div className="font-medium text-sm flex items-center gap-2 justify-end">
                                            {reminder.is_default && (
                                                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                                            )}
                                            {reminder.description || "ללא תיאור"}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            Flow ID: {reminder.flow_id}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

