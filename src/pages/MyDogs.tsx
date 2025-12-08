import { useMemo, useState, type ComponentProps } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Dog, Edit, Trash2, Loader2, HelpCircle } from "lucide-react"
import Mars from "lucide-react/dist/esm/icons/mars.js"
import Venus from "lucide-react/dist/esm/icons/venus.js"
import { skipToken } from "@reduxjs/toolkit/query"
import { useListOwnerDogsQuery } from "@/store/services/supabaseApi"
import { extractErrorMessage } from "@/utils/api"
import { useSupabaseAuthWithClientId } from "@/hooks/useSupabaseAuthWithClientId"
import { useToast } from "@/components/ui/use-toast"
import { deleteDog } from "@/integrations/supabase/supabaseService"
import { AddDogDialog } from "@/components/AddDogDialog"
import { EditDogDialog } from "@/components/EditDogDialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface Dog {
    id: string
    name: string
    breed: string
    size: string
    isSmall: boolean
    ownerId: string
    gender?: "male" | "female" | null
    image_url?: string | null
    hasAppointmentHistory?: boolean
    groomingMinPrice?: number | null
    groomingMaxPrice?: number | null
}

type GenderIconProps = ComponentProps<typeof HelpCircle>
const MarsIcon = Mars as unknown as (props: GenderIconProps) => JSX.Element
const VenusIcon = Venus as unknown as (props: GenderIconProps) => JSX.Element

const getGenderMeta = (gender: Dog["gender"]) => {
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

type ListOwnerDogsResponse = { dogs: Dog[] }

export default function MyDogs() {
    const {
        user,
        clientId,
        clientIdError,
        isLoading: isAuthLoading,
        isFetchingClientId,
    } = useSupabaseAuthWithClientId()
    const { toast } = useToast()

    const ownerId = useMemo(() => {
        console.log("🔍 [MyDogs] Computing ownerId:", { clientId, user, userMetadata: user?.user_metadata })
        if (clientId) {
            console.log("✅ [MyDogs] Using clientId:", clientId)
            return clientId
        }

        if (!user) {
            console.log("⚠️ [MyDogs] No user found")
            return null
        }

        const metadataClientId = user.user_metadata?.client_id || null
        console.log("🔍 [MyDogs] Using user_metadata.client_id:", metadataClientId)
        return metadataClientId
    }, [clientId, user])

    const [dogPendingDeletion, setDogPendingDeletion] = useState<Dog | null>(null)
    const [isDeletingDog, setIsDeletingDog] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingDogId, setEditingDogId] = useState<string | null>(null)
    const [editingDogHasAppointments, setEditingDogHasAppointments] = useState(false)

    console.log("🔍 [MyDogs] Query state:", {
        ownerId,
        willSkip: !ownerId,
        isAuthLoading,
        isFetchingClientId,
    })

    const {
        data: dogsQueryData,
        isFetching: isFetchingDogs,
        isLoading: isLoadingDogs,
        error: dogsQueryError,
        refetch: refetchDogs,
    } = useListOwnerDogsQuery(ownerId ?? skipToken, {
        skip: !ownerId,
    })

    console.log("🔍 [MyDogs] Query result:", {
        hasData: !!dogsQueryData,
        dogsCount: (dogsQueryData as ListOwnerDogsResponse | undefined)?.dogs?.length ?? 0,
        isFetchingDogs,
        isLoadingDogs,
        hasError: !!dogsQueryError,
        error: dogsQueryError,
    })

    const dogs = useMemo<Dog[]>(() => {
        const response = dogsQueryData as ListOwnerDogsResponse | undefined
        return response?.dogs ?? []
    }, [dogsQueryData])

    const dogsErrorMessage = useMemo(
        () => extractErrorMessage(dogsQueryError, "שגיאה בטעינת הכלבים"),
        [dogsQueryError]
    )

    const isInitialLoading =
        isAuthLoading ||
        isFetchingClientId ||
        (ownerId && (isLoadingDogs || (isFetchingDogs && !dogs.length)))

    console.log("🔍 [MyDogs] Loading states:", {
        isAuthLoading,
        isFetchingClientId,
        isLoadingDogs,
        isFetchingDogs,
        ownerId,
        dogsCount: dogs.length,
        isInitialLoading,
    })

    const handleRetry = () => {
        if (!ownerId) {
            return
        }

        refetchDogs()
    }

    const handleAddDog = () => {
        if (!ownerId) {
            console.warn("Cannot open add-dog form without ownerId")
            toast({
                title: "שגיאה",
                description: "לא ניתן להוסיף כלב ללא זיהוי לקוח",
                variant: "destructive",
            })
            return
        }
        setIsAddDialogOpen(true)
    }

    const handleAddDogSuccess = async (_dogId: string) => {
        await refetchDogs()
    }

    const handleEditDog = (dogId: string) => {
        if (!dogId) {
            console.warn("Cannot open edit form without dogId")
            return
        }
        const targetDog = dogs.find((dog) => dog.id === dogId)
        setEditingDogHasAppointments(Boolean(targetDog?.hasAppointmentHistory))
        setEditingDogId(dogId)
        setIsEditDialogOpen(true)
    }

    const handleDeleteDog = (dog: Dog) => {
        setDogPendingDeletion(dog)
    }

    const closeDeleteDialog = () => {
        if (isDeletingDog) {
            return
        }
        setDogPendingDeletion(null)
    }

    const confirmDeleteDog = async () => {
        if (!dogPendingDeletion) {
            return
        }

        setIsDeletingDog(true)

        try {
            const response = await deleteDog(dogPendingDeletion.id, {
                ownerId: dogPendingDeletion.ownerId,
                dogName: dogPendingDeletion.name,
            })

            if (!response?.success) {
                throw new Error(response?.error || "שגיאה במחיקת הכלב")
            }

            toast({
                title: "הכלב הוסר",
                description: "כל התורים והנתונים המשויכים לכלב הוסרו בהצלחה.",
            })

            setDogPendingDeletion(null)
            await refetchDogs()
        } catch (error) {
            console.error("Failed to delete dog:", error)
            toast({
                title: "שגיאה במחיקה",
                description: error instanceof Error ? error.message : "לא ניתן למחוק את הכלב כעת",
                variant: "destructive",
            })
        } finally {
            setIsDeletingDog(false)
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

                {/* Add Dog Button */}
                <div className="mb-6">
                    <Button onClick={handleAddDog} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="mr-2 h-4 w-4" />
                        הוסף כלב חדש
                    </Button>
                </div>

                {/* Dogs Grid */}
                {isInitialLoading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">טוען את הכלבים שלך...</p>
                    </div>
                ) : dogsErrorMessage ? (
                    <Card className="bg-red-50 border-red-200">
                        <CardContent className="p-6 text-center">
                            <p className="text-red-600 mb-4">{dogsErrorMessage}</p>
                            <Button onClick={handleRetry} variant="outline">
                                נסה שוב
                            </Button>
                        </CardContent>
                    </Card>
                ) : dogs.length === 0 ? (
                    <Card className="bg-yellow-50 border-yellow-200">
                        <CardContent className="p-12 text-center">
                            <Dog className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">לא נמצאו כלבים</h3>
                            <p className="text-gray-600 mb-6">עדיין לא הוספת כלבים.</p>
                            <Button onClick={handleAddDog} className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="mr-2 h-4 w-4" />
                                הוסף את הכלב הראשון שלך
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {dogs.map((dog) => {
                            const { label: genderLabel, Icon: GenderIcon, iconClass } = getGenderMeta(dog.gender)

                            console.log("🐶 [MyDogs] Rendering dog card:", {
                                id: dog.id,
                                name: dog.name,
                                breed: dog.breed,
                                gender: dog.gender,
                                genderLabel,
                                image_url: dog.image_url,
                            })

                            const hasImage = dog.image_url && dog.image_url.trim().length > 0

                            return (
                                <Card key={dog.id} className="hover:shadow-lg transition-shadow">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-primary ${hasImage ? '' : 'bg-blue-100'}`}>
                                                    {hasImage ? (
                                                        <img
                                                            src={dog.image_url!}
                                                            alt={dog.name}
                                                            className="w-full h-full object-cover rounded-full"
                                                            onError={(e) => {
                                                                console.error("❌ [MyDogs] Failed to load dog image", {
                                                                    dogId: dog.id,
                                                                    dogName: dog.name,
                                                                    imageUrl: dog.image_url,
                                                                })
                                                                // Hide broken image - the parent div will show background and we can add icon
                                                                const parent = e.currentTarget.parentElement
                                                                if (parent) {
                                                                    parent.classList.add('bg-blue-100')
                                                                    parent.innerHTML = '<svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        <Dog className="h-6 w-6 text-blue-600" />
                                                    )}
                                                </div>
                                                <div>
                                                    <CardTitle className="text-xl text-gray-900">{dog.name}</CardTitle>
                                                    <p className="mt-1 text-sm text-gray-500">{dog.breed}</p>
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
                                            onClick={() => handleEditDog(dog.id)}
                                            className="flex-1 inline-flex items-center justify-center gap-2"
                                            title={
                                                dog.hasAppointmentHistory
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
                                            onClick={() => handleDeleteDog(dog)}
                                            disabled={dog.hasAppointmentHistory}
                                            title={
                                                dog.hasAppointmentHistory
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
            <Dialog open={Boolean(dogPendingDeletion)} onOpenChange={(open) => (open ? null : closeDeleteDialog())}>
                <DialogContent dir="rtl" className="text-right">
                    <DialogHeader className="items-start text-right sm:text-right">
                        <DialogTitle>מחיקת כלב</DialogTitle>
                        <DialogDescription>
                            האם אתה בטוח שברצונך למחוק את {dogPendingDeletion?.name}? כל התורים והנתונים המשויכים לכלב הזה יימחקו לצמיתות.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteDog}
                            disabled={isDeletingDog}
                            className="inline-flex items-center gap-2"
                        >
                            {isDeletingDog && <Loader2 className="h-4 w-4 animate-spin" />}
                            מחק כלב
                        </Button>
                        <Button variant="outline" onClick={closeDeleteDialog} disabled={isDeletingDog}>
                            בטל
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Dog Dialog */}
            <AddDogDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                customerId={ownerId}
                onSuccess={handleAddDogSuccess}
            />

            {/* Edit Dog Dialog */}
            <EditDogDialog
                open={isEditDialogOpen}
                onOpenChange={(open) => {
                    setIsEditDialogOpen(open)
                    if (!open) {
                        setEditingDogId(null)
                        setEditingDogHasAppointments(false)
                    }
                }}
                dogId={editingDogId}
                lockBreedSelection={editingDogHasAppointments}
                onSuccess={async () => {
                    await refetchDogs()
                }}
            />
        </div>
    )
}
