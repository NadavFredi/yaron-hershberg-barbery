import { useMemo, useState, type ComponentProps } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Sparkles, Edit, Trash2, Loader2, HelpCircle } from "lucide-react"
import Mars from "lucide-react/dist/esm/icons/mars.js"
import Venus from "lucide-react/dist/esm/icons/venus.js"
import { skipToken } from "@reduxjs/toolkit/query"
import { useListOwnerTreatmentsQuery } from "@/store/services/supabaseApi"
import { extractErrorMessage } from "@/utils/api"
import { useSupabaseAuthWithClientId } from "@/hooks/useSupabaseAuthWithClientId"
import { useToast } from "@/components/ui/use-toast"
import { deleteTreatment } from "@/integrations/supabase/supabaseService"
import { AddTreatmentDialog } from "@/components/AddTreatmentDialog"
import { EditTreatmentDialog } from "@/components/EditTreatmentDialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface Treatment {
    id: string
    name: string
    treatmentType: string
    size: string
    isSmall: boolean
    ownerId: string
    gender?: "male" | "female" | null
    hasAppointmentHistory?: boolean
    groomingMinPrice?: number | null
    groomingMaxPrice?: number | null
}

type GenderIconProps = ComponentProps<typeof HelpCircle>
const MarsIcon = Mars as unknown as (props: GenderIconProps) => JSX.Element
const VenusIcon = Venus as unknown as (props: GenderIconProps) => JSX.Element

const getGenderMeta = (gender: Treatment["gender"]) => {
    if (gender === "male") {
        return {
            label: "זכר",
            Icon: MarsIcon,
            iconClass: "text-blue-500",
        }
    }

    if (gender === "female") {
        return {
            label: "נקבה",
            Icon: VenusIcon,
            iconClass: "text-pink-500",
        }
    }

    return {
        label: "לא ידוע",
        Icon: HelpCircle,
        iconClass: "text-gray-400",
    }
}

type ListOwnerTreatmentsResponse = { treatments: Treatment[] }

export default function MyTreatments() {
    const {
        user,
        clientId,
        clientIdError,
        isLoading: isAuthLoading,
        isFetchingClientId,
    } = useSupabaseAuthWithClientId()
    const { toast } = useToast()

    const ownerId = useMemo(() => {
        console.log("🔍 [MyTreatments] Computing ownerId:", { clientId, user, userMetadata: user?.user_metadata })
        if (clientId) {
            console.log("✅ [MyTreatments] Using clientId:", clientId)
            return clientId
        }

        if (!user) {
            console.log("⚠️ [MyTreatments] No user found")
            return null
        }

        const metadataClientId = user.user_metadata?.client_id || null
        console.log("🔍 [MyTreatments] Using user_metadata.client_id:", metadataClientId)
        return metadataClientId
    }, [clientId, user])

    const [treatmentPendingDeletion, setTreatmentPendingDeletion] = useState<Treatment | null>(null)
    const [isDeletingTreatment, setIsDeletingTreatment] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null)
    const [editingTreatmentHasAppointments, setEditingTreatmentHasAppointments] = useState(false)

    console.log("🔍 [MyTreatments] Query state:", {
        ownerId,
        willSkip: !ownerId,
        isAuthLoading,
        isFetchingClientId,
    })

    const {
        data: treatmentsQueryData,
        isFetching: isFetchingTreatments,
        isLoading: isLoadingTreatments,
        error: treatmentsQueryError,
        refetch: refetchTreatments,
    } = useListOwnerTreatmentsQuery(ownerId ?? skipToken, {
        skip: !ownerId,
    })

    console.log("🔍 [MyTreatments] Query result:", {
        hasData: !!treatmentsQueryData,
        treatmentsCount: (treatmentsQueryData as ListOwnerTreatmentsResponse | undefined)?.treatments?.length ?? 0,
        isFetchingTreatments,
        isLoadingTreatments,
        hasError: !!treatmentsQueryError,
        error: treatmentsQueryError,
    })

    const treatments = useMemo<Treatment[]>(() => {
        const response = treatmentsQueryData as ListOwnerTreatmentsResponse | undefined
        return response?.treatments ?? []
    }, [treatmentsQueryData])

    const treatmentsErrorMessage = useMemo(
        () => extractErrorMessage(treatmentsQueryError, "שגיאה בטעינת הכלבים"),
        [treatmentsQueryError]
    )

    const isInitialLoading =
        isAuthLoading ||
        isFetchingClientId ||
        (ownerId && (isLoadingTreatments || (isFetchingTreatments && !treatments.length)))

    console.log("🔍 [MyTreatments] Loading states:", {
        isAuthLoading,
        isFetchingClientId,
        isLoadingTreatments,
        isFetchingTreatments,
        ownerId,
        treatmentsCount: treatments.length,
        isInitialLoading,
    })

    const handleRetry = () => {
        if (!ownerId) {
            return
        }

        refetchTreatments()
    }

    const handleAddTreatment = () => {
        if (!ownerId) {
            console.warn("Cannot open add-treatment form without ownerId")
            toast({
                title: "שגיאה",
                description: "לא ניתן להוסיף כלב ללא זיהוי לקוח",
                variant: "destructive",
            })
            return
        }
        setIsAddDialogOpen(true)
    }

    const handleAddTreatmentSuccess = async (_treatmentId: string) => {
        await refetchTreatments()
    }

    const handleEditTreatment = (treatmentId: string) => {
        if (!treatmentId) {
            console.warn("Cannot open edit form without treatmentId")
            return
        }
        const targetTreatment = treatments.find((treatment) => treatment.id === treatmentId)
        setEditingTreatmentHasAppointments(Boolean(targetTreatment?.hasAppointmentHistory))
        setEditingTreatmentId(treatmentId)
        setIsEditDialogOpen(true)
    }

    const handleDeleteTreatment = (treatment: Treatment) => {
        setTreatmentPendingDeletion(treatment)
    }

    const closeDeleteDialog = () => {
        if (isDeletingTreatment) {
            return
        }
        setTreatmentPendingDeletion(null)
    }

    const confirmDeleteTreatment = async () => {
        if (!treatmentPendingDeletion) {
            return
        }

        setIsDeletingTreatment(true)

        try {
            const response = await deleteTreatment(treatmentPendingDeletion.id, {
                ownerId: treatmentPendingDeletion.ownerId,
                treatmentName: treatmentPendingDeletion.name,
            })

            if (!response?.success) {
                throw new Error(response?.error || "שגיאה במחיקת הכלב")
            }

            toast({
                title: "הכלב הוסר",
                description: "כל התורים והנתונים המשויכים לכלב הוסרו בהצלחה.",
            })

            setTreatmentPendingDeletion(null)
            await refetchTreatments()
        } catch (error) {
            console.error("Failed to delete treatment:", error)
            toast({
                title: "שגיאה במחיקה",
                description: error instanceof Error ? error.message : "לא ניתן למחוק את הכלב כעת",
                variant: "destructive",
            })
        } finally {
            setIsDeletingTreatment(false)
        }
    }

    if (isAuthLoading || isFetchingClientId) {
        return (
            <div className="min-h-screen flex items-center justify-center" dir="rtl">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">
                        {isFetchingClientId ? "מאמת פרטי חשבון..." : "טוען נתוני משתמש..."}
                    </p>
                </div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center" dir="rtl">
                <Card className="w-full max-w-md">
                    <CardContent className="p-6 text-center">
                        <p className="text-gray-600">אנא התחבר כדי לצפות בכלבים שלך</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!ownerId) {
        return (
            <div className="min-h-screen flex items-center justify-center" dir="rtl">
                <Card className="w-full max-w-md">
                    <CardContent className="p-6 text-center">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">חשבון לא מוגדר</h2>
                        <p className="text-gray-600 mb-4">
                            {clientIdError
                                ? `שגיאה בזיהוי חשבון: ${clientIdError.message}`
                                : "החשבון שלך לא מוגדר כראוי. אנא פנה לתמיכה."}
                        </p>
                        <Button asChild className="w-full">
                            <a href="/profile-settings">הגדר חשבון</a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen py-8" dir="rtl">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">הכלבים שלי</h1>
                    <p className="text-gray-600">נהל את הכלבים שלך ואת המידע שלהם</p>
                </div>

                {/* Add Treatment Button */}
                <div className="mb-6">
                    <Button onClick={handleAddTreatment} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="mr-2 h-4 w-4" />
                        הוסף כלב חדש
                    </Button>
                </div>

                {/* Treatments Grid */}
                {isInitialLoading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">טוען את הכלבים שלך...</p>
                    </div>
                ) : treatmentsErrorMessage ? (
                    <Card className="bg-red-50 border-red-200">
                        <CardContent className="p-6 text-center">
                            <p className="text-red-600 mb-4">{treatmentsErrorMessage}</p>
                            <Button onClick={handleRetry} variant="outline">
                                נסה שוב
                            </Button>
                        </CardContent>
                    </Card>
                ) : treatments.length === 0 ? (
                    <Card className="bg-yellow-50 border-yellow-200">
                        <CardContent className="p-12 text-center">
                            <Sparkles className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">לא נמצאו כלבים</h3>
                            <p className="text-gray-600 mb-6">עדיין לא הוספת כלבים.</p>
                            <Button onClick={handleAddTreatment} className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="mr-2 h-4 w-4" />
                                הוסף את הכלב הראשון שלך
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {treatments.map((treatment) => {
                            const { label: genderLabel, Icon: GenderIcon, iconClass } = getGenderMeta(treatment.gender)

                            console.log("🐶 [MyTreatments] Rendering treatment card:", {
                                id: treatment.id,
                                name: treatment.name,
                                treatmentType: treatment.treatmentType,
                                gender: treatment.gender,
                                genderLabel,
                            })

                            return (
                                <Card key={treatment.id} className="hover:shadow-lg transition-shadow">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <Sparkles className="h-6 w-6 text-blue-600" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-xl text-gray-900">{treatment.name}</CardTitle>
                                                    <p className="mt-1 text-sm text-gray-500">{treatment.treatmentType}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 text-sm text-gray-600">
                                                <GenderIcon className={`h-4 w-4 ${iconClass}`} />
                                                <span>{genderLabel}</span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex gap-2 pt-0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEditTreatment(treatment.id)}
                                            className="flex-1 inline-flex items-center justify-center gap-2"
                                            title={
                                                treatment.hasAppointmentHistory
                                                    ? "לא ניתן לשנות גזע לכלב שכבר הוזמנו לו תורים"
                                                    : undefined
                                            }
                                        >
                                            <Edit className="h-4 w-4" />
                                            <span>ערוך</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDeleteTreatment(treatment)}
                                            disabled={treatment.hasAppointmentHistory}
                                            title={
                                                treatment.hasAppointmentHistory
                                                    ? "לא ניתן למחוק כלב שכבר הוזמנו לו תורים"
                                                    : undefined
                                            }
                                            className="inline-flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-red-600"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            <span>מחק</span>
                                        </Button>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>
            <Dialog open={Boolean(treatmentPendingDeletion)} onOpenChange={(open) => (open ? null : closeDeleteDialog())}>
                <DialogContent dir="rtl" className="text-right">
                    <DialogHeader className="items-start text-right sm:text-right">
                        <DialogTitle>מחיקת כלב</DialogTitle>
                        <DialogDescription>
                            האם אתה בטוח שברצונך למחוק את {treatmentPendingDeletion?.name}? כל התורים והנתונים המשויכים לכלב הזה יימחקו לצמיתות.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteTreatment}
                            disabled={isDeletingTreatment}
                            className="inline-flex items-center gap-2"
                        >
                            {isDeletingTreatment && <Loader2 className="h-4 w-4 animate-spin" />}
                            מחק כלב
                        </Button>
                        <Button variant="outline" onClick={closeDeleteDialog} disabled={isDeletingTreatment}>
                            בטל
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Treatment Dialog */}
            <AddTreatmentDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                customerId={ownerId}
                onSuccess={handleAddTreatmentSuccess}
            />

            {/* Edit Treatment Dialog */}
            <EditTreatmentDialog
                open={isEditDialogOpen}
                onOpenChange={(open) => {
                    setIsEditDialogOpen(open)
                    if (!open) {
                        setEditingTreatmentId(null)
                        setEditingTreatmentHasAppointments(false)
                    }
                }}
                treatmentId={editingTreatmentId}
                lockTreatmentTypeSelection={editingTreatmentHasAppointments}
                onSuccess={async () => {
                    await refetchTreatments()
                }}
            />
        </div>
    )
}
