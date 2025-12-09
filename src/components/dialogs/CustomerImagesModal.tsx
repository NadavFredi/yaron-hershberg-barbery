import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Image as ImageIcon, Calendar } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import type { Database } from "@/integrations/supabase/types"
import { format } from "date-fns"
import { he } from "date-fns/locale"

type AppointmentSessionImage = Database["public"]["Tables"]["appointment_session_images"]["Row"]
type GroomingAppointment = Database["public"]["Tables"]["grooming_appointments"]["Row"]

interface GroupedImage {
  image: AppointmentSessionImage
  appointment: GroomingAppointment
  date: Date
}

interface CustomerImagesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  customerName?: string
}

export function CustomerImagesModal({
  open,
  onOpenChange,
  customerId,
  customerName,
}: CustomerImagesModalProps) {
  const [groupedImages, setGroupedImages] = useState<Map<string, GroupedImage[]>>(new Map())
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open || !customerId) {
      setGroupedImages(new Map())
      return
    }

    const fetchCustomerImages = async () => {
      setIsLoading(true)
      try {
        // Get all grooming appointments for this customer
        const { data: appointments, error: appointmentsError } = await supabase
          .from("grooming_appointments")
          .select("id, start_at")
          .eq("customer_id", customerId)
          .order("start_at", { ascending: false })

        if (appointmentsError) {
          console.error("❌ [CustomerImagesModal] Error fetching appointments:", appointmentsError)
          setIsLoading(false)
          return
        }

        if (!appointments || appointments.length === 0) {
          setGroupedImages(new Map())
          setIsLoading(false)
          return
        }

        const appointmentIds = appointments.map((apt) => apt.id)

        // Get all images for these appointments
        const { data: images, error: imagesError } = await supabase
          .from("appointment_session_images")
          .select("*")
          .in("grooming_appointment_id", appointmentIds)
          .order("created_at", { ascending: false })

        if (imagesError) {
          console.error("❌ [CustomerImagesModal] Error fetching images:", imagesError)
          setIsLoading(false)
          return
        }

        // Group images by date
        const grouped = new Map<string, GroupedImage[]>()

        for (const image of images || []) {
          if (!image.grooming_appointment_id) continue

          const appointment = appointments.find((apt) => apt.id === image.grooming_appointment_id)
          if (!appointment) continue

          const appointmentDate = new Date(appointment.start_at)
          const dateKey = format(appointmentDate, "yyyy-MM-dd")

          if (!grouped.has(dateKey)) {
            grouped.set(dateKey, [])
          }

          grouped.get(dateKey)!.push({
            image,
            appointment,
            date: appointmentDate,
          })
        }

        setGroupedImages(grouped)
      } catch (error) {
        console.error("❌ [CustomerImagesModal] Unexpected error:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCustomerImages()
  }, [open, customerId])

  // Sort dates in descending order
  const sortedDates = Array.from(groupedImages.keys()).sort((a, b) => b.localeCompare(a))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {customerName ? `תמונות של ${customerName}` : "תמונות לקוח"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">טוען תמונות...</p>
            </div>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
            <p>אין תמונות עבור לקוח זה</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((dateKey) => {
              const images = groupedImages.get(dateKey)!
              const date = images[0].date
              const dateFormatted = format(date, "EEEE, d בMMMM yyyy", { locale: he })

              return (
                <div key={dateKey} className="space-y-3">
                  <div className="flex items-center gap-2 text-lg font-semibold text-gray-800 border-b pb-2">
                    <Calendar className="h-5 w-5" />
                    <span>{dateFormatted}</span>
                    <span className="text-sm font-normal text-gray-500">
                      ({images.length} {images.length === 1 ? "תמונה" : "תמונות"})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((item) => (
                      <div
                        key={item.image.id}
                        className="relative group rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors"
                      >
                        <img
                          src={item.image.image_url}
                          alt={`תמונה מ-${dateFormatted}`}
                          className="w-full h-48 object-cover cursor-pointer"
                          onClick={() => {
                            if (typeof window !== "undefined") {
                              window.open(item.image.image_url, "_blank")
                            }
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          {format(new Date(item.image.created_at), "HH:mm", { locale: he })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}


