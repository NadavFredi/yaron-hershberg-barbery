import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Image as ImageIcon } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import type { Database } from "@/integrations/supabase/types"

type AppointmentSessionImage = Database["public"]["Tables"]["appointment_session_images"]["Row"]

interface ImageWithDate {
  image: AppointmentSessionImage
  appointmentDate: string
  appointmentType: "grooming" | "daycare"
}

interface DogAppointmentImagesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dogId: string
  dogName: string
}

export function DogAppointmentImagesModal({
  open,
  onOpenChange,
  dogId,
  dogName,
}: DogAppointmentImagesModalProps) {
  const [imagesWithDates, setImagesWithDates] = useState<ImageWithDate[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    } catch (error) {
      console.error("Error formatting date:", error)
      return dateString
    }
  }

  // Fetch all appointment images for the dog
  useEffect(() => {
    if (!open || !dogId) {
      setImagesWithDates([])
      return
    }

    const fetchImages = async () => {
      setIsLoading(true)
      try {
        console.log("📸 [DogAppointmentImagesModal] Fetching all appointment images for dog:", dogId)

        // First, get all appointments for this dog (both grooming and daycare)
        const [groomingResult, daycareResult] = await Promise.all([
          supabase
            .from("grooming_appointments")
            .select("id, start_at")
            .eq("dog_id", dogId),
          supabase
            .from("daycare_appointments")
            .select("id, start_at")
            .eq("dog_id", dogId),
        ])

        if (groomingResult.error) {
          console.error("❌ [DogAppointmentImagesModal] Error fetching grooming appointments:", groomingResult.error)
        }
        if (daycareResult.error) {
          console.error("❌ [DogAppointmentImagesModal] Error fetching daycare appointments:", daycareResult.error)
        }

        const groomingAppointments = groomingResult.data || []
        const daycareAppointments = daycareResult.data || []

        console.log("📸 [DogAppointmentImagesModal] Found appointments:", {
          grooming: groomingAppointments.length,
          daycare: daycareAppointments.length,
        })

        // Get all images for grooming appointments
        const groomingImagePromises = groomingAppointments.map(async (appointment) => {
          const { data, error } = await supabase
            .from("appointment_session_images")
            .select("*")
            .eq("grooming_appointment_id", appointment.id)
            .order("created_at", { ascending: false })

          if (error && error.code !== "PGRST116") {
            console.error("❌ [DogAppointmentImagesModal] Error fetching images for grooming appointment:", error)
            return []
          }

          return (data || []).map((image) => ({
            image,
            appointmentDate: appointment.start_at,
            appointmentType: "grooming" as const,
          }))
        })

        // Get all images for daycare appointments
        const daycareImagePromises = daycareAppointments.map(async (appointment) => {
          const { data, error } = await supabase
            .from("appointment_session_images")
            .select("*")
            .eq("daycare_appointment_id", appointment.id)
            .order("created_at", { ascending: false })

          if (error && error.code !== "PGRST116") {
            console.error("❌ [DogAppointmentImagesModal] Error fetching images for daycare appointment:", error)
            return []
          }

          return (data || []).map((image) => ({
            image,
            appointmentDate: appointment.start_at,
            appointmentType: "daycare" as const,
          }))
        })

        // Wait for all image fetches to complete
        const [groomingImages, daycareImages] = await Promise.all([
          Promise.all(groomingImagePromises),
          Promise.all(daycareImagePromises),
        ])

        // Flatten and combine all images
        const allImages: ImageWithDate[] = [
          ...groomingImages.flat(),
          ...daycareImages.flat(),
        ]

        // Sort by appointment date (newest first)
        allImages.sort((a, b) => {
          const dateA = new Date(a.appointmentDate).getTime()
          const dateB = new Date(b.appointmentDate).getTime()
          return dateB - dateA
        })

        console.log("📸 [DogAppointmentImagesModal] Found total images:", allImages.length)
        setImagesWithDates(allImages)
      } catch (error) {
        console.error("❌ [DogAppointmentImagesModal] Unexpected error fetching images:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchImages()
  }, [open, dogId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">תמונות מכל התורים של {dogName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Images Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : imagesWithDates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
              <ImageIcon className="h-12 w-12 mb-4 text-gray-300" />
              <p>אין תמונות מתורים</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {imagesWithDates.map(({ image, appointmentDate, appointmentType }) => (
                <div key={image.id} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    <img
                      src={image.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Date overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 rounded-b-lg">
                    <div className="text-xs font-medium">
                      {formatDate(appointmentDate)}
                    </div>
                    <div className="text-xs opacity-80">
                      {appointmentType === "grooming" ? "מספרה" : "גן"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

