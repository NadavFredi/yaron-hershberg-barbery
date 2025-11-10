import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Copy, Loader2, Send, Trash2, Pencil, Users, Sparkles, ChevronDown } from "lucide-react"
import type { ManagerAppointment, ProposedMeetingInvite } from "@/types/managerSchedule"
import { cn } from "@/lib/utils"
import { useSendManualProposedMeetingWebhookMutation } from "@/store/services/supabaseApi"
import { useToast } from "@/components/ui/use-toast"

interface ProposedMeetingSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  meeting: ManagerAppointment
  onEdit: (meeting: ManagerAppointment) => void
  onDelete: (meeting: ManagerAppointment) => void
  onSendInvite: (invite: ProposedMeetingInvite) => void
  onSendAll: (meeting: ManagerAppointment) => void
  onSendCategory?: (categoryId: string) => void
  onSendAllCategories?: () => void
  sendingInviteId?: string | null
  sendingAll?: boolean
  sendingCategoryId?: string | null
  sendingCategoriesBatch?: boolean
  deleting?: boolean
}

export const ProposedMeetingSheet = ({
  open,
  onOpenChange,
  meeting,
  onEdit,
  onDelete,
  onSendInvite,
  onSendAll,
  onSendCategory,
  onSendAllCategories,
  sendingInviteId = null,
  sendingAll = false,
  sendingCategoryId = null,
  sendingCategoriesBatch = false,
  deleting = false,
}: ProposedMeetingSheetProps) => {
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [showClients, setShowClients] = useState(false)
  const [manualName, setManualName] = useState("")
  const [manualPhone, setManualPhone] = useState("")
  const { toast } = useToast()
  const [sendManualProposedMeetingWebhook, { isLoading: sendingManualInvite }] = useSendManualProposedMeetingWebhookMutation()

  const start = useMemo(() => new Date(meeting.startDateTime), [meeting.startDateTime])
  const end = useMemo(() => new Date(meeting.endDateTime), [meeting.endDateTime])
  const originalStart = useMemo(() => (meeting.proposedOriginalStart ? new Date(meeting.proposedOriginalStart) : null), [meeting.proposedOriginalStart])
  const originalEnd = useMemo(() => (meeting.proposedOriginalEnd ? new Date(meeting.proposedOriginalEnd) : null), [meeting.proposedOriginalEnd])
  const originalRangeLabel = useMemo(() => {
    if (!originalStart || !originalEnd) {
      return null
    }
    try {
      const dateLabel = format(originalStart, "dd MMMM yyyy", { locale: he })
      return `${dateLabel} · ${format(originalStart, "HH:mm")} - ${format(originalEnd, "HH:mm")}`
    } catch {
      return null
    }
  }, [originalStart, originalEnd])
  const invites = meeting.proposedInvites ?? []
  const categories = meeting.proposedCategories ?? []
  const categoryInviteCounts = useMemo(() => {
    const counts = new Map<string, number>()
    invites.forEach((invite) => {
      if (invite.source === "category" && invite.sourceCategoryId) {
        counts.set(invite.sourceCategoryId, (counts.get(invite.sourceCategoryId) ?? 0) + 1)
      }
    })
    return counts
  }, [invites])
  const totalCategoryInvites = useMemo(() => {
    let total = 0
    categoryInviteCounts.forEach((value) => {
      total += value
    })
    return total
  }, [categoryInviteCounts])

  useEffect(() => {
    setManualName("")
    setManualPhone("")
  }, [meeting.proposedMeetingId])

  const meetingOrigin =
    typeof globalThis !== "undefined" &&
      typeof globalThis.location === "object" &&
      typeof globalThis.location?.origin === "string"
      ? globalThis.location.origin
      : null
  const meetingLink = meeting.proposedMeetingId && meetingOrigin ? `${meetingOrigin}/proposed/${meeting.proposedMeetingId}` : null
  const trimmedManualName = manualName.trim()
  const trimmedManualPhone = manualPhone.trim()
  const canSendManualInvite =
    Boolean(meeting.proposedMeetingId) &&
    Boolean(meeting.proposedMeetingCode) &&
    Boolean(meetingLink) &&
    Boolean(trimmedManualPhone)

  const handleManualInviteSubmit = async () => {
    if (!meeting.proposedMeetingId || !meeting.proposedMeetingCode || !trimmedManualPhone || !meetingLink) {
      toast({
        title: "לא ניתן לשלוח",
        description: "שמירת המפגש נדרשת כדי לשלוח הזמנה ידנית.",
        variant: "destructive",
      })
      return
    }

    try {
      await sendManualProposedMeetingWebhook({
        proposedMeetingId: meeting.proposedMeetingId,
        code: meeting.proposedMeetingCode,
        meetingLink,
        contact: {
          name: trimmedManualName || undefined,
          phone: trimmedManualPhone,
        },
      }).unwrap()

      toast({
        title: "ההודעה נשלחה",
        description: `שלחנו קישור וקוד ל-${trimmedManualPhone}.`,
      })
      setManualName("")
      setManualPhone("")
    } catch (error) {
      const message =
        typeof error === "object" && error !== null && "data" in error && typeof (error as { data?: unknown }).data === "string"
          ? (error as { data: string }).data
          : error instanceof Error
            ? error.message
            : "שליחת ההודעה נכשלה"
      toast({
        title: "שליחה נכשלה",
        description: message,
        variant: "destructive",
      })
    }
  }

  const handleCopyCode = async () => {
    if (!meeting.proposedMeetingCode) {
      return
    }
    try {
      await navigator.clipboard.writeText(meeting.proposedMeetingCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (error) {
      console.error("Failed to copy code:", error)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-lg flex flex-col" dir="rtl">
        <SheetHeader>
          <SheetTitle className="text-right flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-lime-600" />
            מפגש מוצע
          </SheetTitle>
          <SheetDescription className="text-right">
            ניהול לקוחות, קודי גישה וסטטוס הזמנות למפגש זה.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-6 pr-2 h-[calc(100vh-8rem)]">
          <div className="space-y-5 pb-4">
            <div className="rounded-lg border border-lime-200 bg-lime-50/80 p-4">
              <div className="flex flex-col gap-2 text-right">
                <div className="text-xs text-lime-700 font-semibold">קוד כניסה</div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-lg font-mono tracking-wide text-lime-800">
                    {meeting.proposedMeetingCode ?? "—"}
                  </span>
                  <Button variant="outline" size="sm" onClick={handleCopyCode}>
                    <Copy className="h-4 w-4 ml-2" />
                    {copied ? "הועתק!" : "העתק"}
                  </Button>
                </div>
                <div className="text-sm text-lime-800 font-medium">
                  {meeting.proposedTitle || "חלון שמור ללקוחות מוזמנים"}
                </div>
                <div className="text-xs text-lime-700">
                  {meeting.proposedStatus ? `סטטוס: ${meeting.proposedStatus}` : "סטטוס: ממתין לאישור"}
                </div>
                {meetingLink && (
                  <div className="flex flex-col gap-2 border-t border-lime-100 pt-2">
                    <div className="text-xs text-gray-500">קישור להזמנה</div>
                    <div className="flex flex-wrap items-center gap-2" dir="rtl">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(meetingLink)
                            setCopiedLink(true)
                            setTimeout(() => setCopiedLink(false), 2500)
                          } catch (error) {
                            console.error("Failed to copy link:", error)
                          }
                        }}
                      >
                        <Copy className="h-4 w-4 ml-2" />
                        {copiedLink ? "הועתק!" : "העתק"}
                      </Button>
                      <Button variant="secondary" size="sm" className="bg-lime-600 hover:bg-lime-700 text-white" asChild>
                        <a href={meetingLink} target="_blank" rel="noreferrer">
                          פתח קישור
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 space-y-2 text-right text-sm text-gray-700" dir="rtl">
              <div className="flex items-center gap-3">
                <span>תאריך:</span>
                <span className="font-medium">{format(start, "dd MMMM yyyy", { locale: he })}</span>
              </div>
              <div className="flex items-center gap-3">
                <span>שעה:</span>
                <span className="font-medium">
                  {format(start, "HH:mm")} - {format(end, "HH:mm")}
                </span>
              </div>
            </div>

            {meeting.proposedLinkedAppointmentId && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 space-y-1 text-right">
                <div className="text-xs font-semibold text-blue-700">מקושר לתור קיים</div>
                {originalRangeLabel && (
                  <div className="text-sm font-medium text-blue-900">{originalRangeLabel}</div>
                )}
                <div className="text-xs text-blue-700">
                  כאשר הלקוח יאשר, התור המקורי יועבר לשעה החדשה וההצעה תימחק אוטומטית.
                </div>
              </div>
            )}

            {(meeting.proposedSummary || meeting.proposedNotes) && (
              <div className="space-y-3 text-right text-sm">
                {meeting.proposedSummary && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">תיאור כללי</div>
                    <div className="rounded-md border border-slate-200 bg-white p-3 text-gray-800">
                      {meeting.proposedSummary}
                    </div>
                  </div>
                )}
                {meeting.proposedNotes && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">הערות צוות</div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-gray-700">
                      {meeting.proposedNotes}
                    </div>
                  </div>
                )}
              </div>
            )}

            {categories.length > 0 && (
              <div className="space-y-2" dir="rtl">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm font-semibold text-gray-800"
                    onClick={() => setShowCategories((prev) => !prev)}
                  >
                    <Users className="h-4 w-4 text-lime-600" />
                    קטגוריות ({categories.length})
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", showCategories ? "rotate-0" : "-rotate-90")}
                    />
                  </button>
                  {onSendAllCategories && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onSendAllCategories}
                      disabled={sendingCategoriesBatch || totalCategoryInvites === 0}
                    >
                      {sendingCategoriesBatch ? (
                        <>
                          <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                          נשלח...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 ml-2" />
                          שלח לכולם                      </>
                      )}
                    </Button>
                  )}
                </div>
                {showCategories && (
                  <div className="space-y-2">
                    {categories.map((category) => {
                      const count = category.customerTypeId ? categoryInviteCounts.get(category.customerTypeId) ?? 0 : 0
                      const canSend = Boolean(category.customerTypeId && count > 0 && onSendCategory)
                      return (
                        <div
                          key={category.id}
                          className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2"
                        >
                          <div>
                            <div className="font-medium text-gray-900">
                              {category.customerTypeName || "ללא שם"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {count} לקוחות בקטגוריה
                            </div>
                          </div>
                          {onSendCategory && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="bg-lime-600 hover:bg-lime-700 text-white"
                              disabled={!canSend || sendingCategoryId === category.customerTypeId}
                              onClick={() => category.customerTypeId && onSendCategory(category.customerTypeId)}
                            >
                              {sendingCategoryId === category.customerTypeId ? (
                                <>
                                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                  נשלח...
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4 ml-2" />
                                  שלח
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between" dir="rtl">
                <button
                  type="button"
                  className="text-sm font-semibold text-gray-900 flex items-center gap-2"
                  onClick={() => setShowClients((prev) => !prev)}
                >
                  לקוחות מוזמנים ({invites.length})
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", showClients ? "rotate-0" : "-rotate-90")}
                  />
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSendAll(meeting)}
                  disabled={invites.length === 0 || sendingAll}
                >
                  {sendingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                      נשלח...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 ml-2" />
                      שלח לכולם
                    </>
                  )}
                </Button>
              </div>
              {showClients && (
                <div className="rounded-lg border border-slate-200">
                  <ScrollArea className="max-h-72">
                    {invites.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-500">
                        עדיין לא הוגדרו לקוחות ספציפיים למפגש זה.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {invites.map((invite) => (
                          <div key={invite.id} className="flex flex-col gap-1 px-3 py-3">
                            <div className="flex items-center justify-between" dir="rtl">
                              <div>
                                <div className="font-medium text-gray-900">{invite.customerName || "לקוח לא מזוהה"}</div>
                                <div className="text-xs text-gray-500">
                                  {invite.clientPhone || invite.clientEmail || "ללא פרטי קשר"}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="bg-lime-600 hover:bg-lime-700 text-white"
                                onClick={() => onSendInvite(invite)}
                                disabled={sendingInviteId === invite.id || sendingAll}
                              >
                                {sendingInviteId === invite.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                    נשלח...
                                  </>
                                ) : (
                                  <>
                                    <Send className="h-4 w-4 ml-2" />
                                    שלח
                                  </>
                                )}
                              </Button>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>
                                הוזמן {invite.notificationCount ?? 0} פעמים
                                {invite.lastNotifiedAt ? ` · ${format(new Date(invite.lastNotifiedAt), "dd.MM HH:mm")}` : ""}
                              </span>
                              {invite.lastWebhookStatus && (
                                <span className={cn("font-medium", invite.lastWebhookStatus.startsWith("OK") ? "text-emerald-600" : "text-amber-600")}>
                                  {invite.lastWebhookStatus}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>

            {meeting.proposedMeetingId && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3" dir="rtl">
                <div className="text-sm font-semibold text-gray-900">שליחת הודעה ידנית</div>
                {!meeting.proposedMeetingCode && (
                  <p className="text-xs text-amber-600 text-right">
                    שמרו את המפגש כדי לקבל קוד ולשלוח הודעות ידניות.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div>
                    <Label htmlFor="manual-send-name" className="text-xs text-gray-600 block text-right">
                      שם (לא חובה)
                    </Label>
                    <Input
                      id="manual-send-name"
                      value={manualName}
                      onChange={(event) => setManualName(event.target.value)}
                      placeholder="לדוגמה: עדי לקוח"
                      className="text-right"
                      dir="rtl"
                      disabled={sendingManualInvite}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual-send-phone" className="text-xs text-gray-600 block text-right">
                      טלפון לשליחה *
                    </Label>
                    <Input
                      id="manual-send-phone"
                      value={manualPhone}
                      onChange={(event) => setManualPhone(event.target.value)}
                      placeholder="0501234567"
                      className="text-right"
                      dir="rtl"
                      disabled={sendingManualInvite || !meeting.proposedMeetingCode}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    className="bg-lime-600 hover:bg-lime-700 text-white"
                    onClick={handleManualInviteSubmit}
                    disabled={!canSendManualInvite || sendingManualInvite}
                  >
                    {sendingManualInvite ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                        שולח...
                      </>
                    ) : (
                      "שלחו הודעה ידנית"
                    )}
                  </Button>
                  <p className="text-xs text-gray-600 text-right">
                    נשלחת הודעה עם קישור וקוד גישה – אפשר גם למספרים שלא קיימים כלקוחות במערכת.
                  </p>
                </div>
              </div>
            )}

            <Separator />

            <div className="flex flex-col gap-3">
              <Button
                className="bg-lime-600 hover:bg-lime-700 text-white"
                onClick={() => onEdit(meeting)}
              >
                <Pencil className="h-4 w-4 ml-2" />
                עריכת מפגש
              </Button>
              <Button
                variant="destructive"
                onClick={() => onDelete(meeting)}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    מוחק...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 ml-2" />
                    מחק מפגש
                  </>
                )}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
