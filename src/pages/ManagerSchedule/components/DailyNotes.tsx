import { useState, useEffect, useCallback, useMemo } from "react"
import { useAppSelector } from "@/store/hooks"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { FileText, Loader2, Save, Circle } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

export function DailyNotes() {
  const { toast } = useToast()
  const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
  const selectedDate = useMemo(() => new Date(selectedDateStr), [selectedDateStr])
  const formattedDate = format(selectedDate, "yyyy-MM-dd")

  const [notes, setNotes] = useState<string>("")
  const [originalNotes, setOriginalNotes] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Track if notes are dirty (changed from original)
  const isDirty = useMemo(() => {
    return notes.trim() !== originalNotes.trim()
  }, [notes, originalNotes])

  // Fetch notes when date changes
  useEffect(() => {
    const fetchNotes = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from("daily_notes")
          .select("notes")
          .eq("date", formattedDate)
          .maybeSingle()

        if (error) {
          throw error
        }

        const fetchedNotes = data?.notes || ""
        setNotes(fetchedNotes)
        setOriginalNotes(fetchedNotes)
      } catch (error) {
        console.error("Error fetching daily notes:", error)
        toast({
          title: "שגיאה",
          description: "לא ניתן לטעון הערות יומיות",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchNotes()
  }, [formattedDate, toast])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const notesToSave = notes.trim() || null

      const { error } = await supabase
        .from("daily_notes")
        .upsert(
          {
            date: formattedDate,
            notes: notesToSave,
            updated_by: (await supabase.auth.getUser()).data.user?.id || null,
          },
          { onConflict: "date" }
        )

      if (error) throw error

      // Update original notes after successful save
      setOriginalNotes(notes.trim())

      toast({
        title: "הצלחה",
        description: "הערות היום נשמרו בהצלחה",
      })
    } catch (error) {
      console.error("Error saving daily notes:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לשמור הערות יומיות",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }, [notes, formattedDate, toast])

  const hasNotes = originalNotes.trim().length > 0

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="daily-notes" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center justify-between w-full mr-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-900">הערות יומיות</span>
                {hasNotes && (
                  <Circle className="h-2 w-2 fill-primary text-primary" />
                )}
              </div>
              {hasNotes && (
                <span className="text-xs text-gray-500">יש לך הערות</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="הערות כלליות ליום זה..."
                  className="text-right min-h-[100px] resize-none text-sm mt-1"
                  dir="rtl"
                  disabled={isSaving}
                />
                {isDirty && (
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-1.5"
                    size="sm"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        שומר...
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        שמור
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

