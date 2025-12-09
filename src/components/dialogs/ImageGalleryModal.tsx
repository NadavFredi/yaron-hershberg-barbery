import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Upload, X, Trash2, Loader2, Image as ImageIcon } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { uploadGalleryImage, deleteGalleryImage, type ImageType } from "@/utils/imageGalleryUpload"
import type { Database } from "@/integrations/supabase/types"

type DogDesiredGoalImage = Database["public"]["Tables"]["dog_desired_goal_images"]["Row"]
type AppointmentSessionImage = Database["public"]["Tables"]["appointment_session_images"]["Row"]

interface ImageGalleryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  imageType: ImageType
  entityId: string // dog_id or appointment_id
  userId: string
}

export function ImageGalleryModal({
  open,
  onOpenChange,
  title,
  imageType,
  entityId,
  userId,
}: ImageGalleryModalProps) {
  const [images, setImages] = useState<(DogDesiredGoalImage | AppointmentSessionImage)[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Fetch images when modal opens
  useEffect(() => {
    if (!open || !entityId) {
      setImages([])
      return
    }

    const fetchImages = async () => {
      setIsLoading(true)
      try {
        console.log("📸 [ImageGalleryModal] Fetching images", {
          imageType,
          entityId,
        })

        if (imageType === "dog-desired-goal") {
          const { data, error } = await supabase
            .from("dog_desired_goal_images")
            .select("*")
            .eq("dog_id", entityId)
            .order("created_at", { ascending: false })

          if (error) {
            console.error("❌ [ImageGalleryModal] Error fetching dog desired goal images:", error)
            toast({
              title: "שגיאה",
              description: "לא ניתן לטעון תמונות",
              variant: "destructive",
            })
            return
          }

          setImages(data || [])
        } else if (imageType === "appointment-session") {
          const { data: groomingData, error: groomingError } = await supabase
            .from("appointment_session_images")
            .select("*")
            .eq("grooming_appointment_id", entityId)
            .order("created_at", { ascending: false })

          if (groomingError && groomingError.code !== "PGRST116") {
            console.error("❌ [ImageGalleryModal] Error fetching grooming appointment images:", groomingError)
          }

          setImages(groomingData || [])
        }
      } catch (error) {
        console.error("❌ [ImageGalleryModal] Unexpected error fetching images:", error)
        toast({
          title: "שגיאה",
          description: "לא ניתן לטעון תמונות",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchImages()
  }, [open, entityId, imageType, toast])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      console.log("📤 [ImageGalleryModal] Uploading new image", {
        fileName: file.name,
        imageType,
        entityId,
      })

      // Upload image to storage
      const uploadResult = await uploadGalleryImage(file, userId, imageType, entityId)

      if (!uploadResult.success || !uploadResult.imageUrl || !uploadResult.storagePath) {
        toast({
          title: "שגיאה",
          description: uploadResult.error || "לא ניתן להעלות את התמונה",
          variant: "destructive",
        })
        return
      }

      // Save image record to database
      if (imageType === "dog-desired-goal") {
        const { data, error } = await supabase
          .from("dog_desired_goal_images")
          .insert({
            dog_id: entityId,
            image_url: uploadResult.imageUrl,
            storage_path: uploadResult.storagePath,
            created_by: userId,
          })
          .select()
          .single()

        if (error) {
          console.error("❌ [ImageGalleryModal] Error saving dog desired goal image record:", error)
          // Try to delete the uploaded file
          await deleteGalleryImage(uploadResult.storagePath, imageType)
          toast({
            title: "שגיאה",
            description: "לא ניתן לשמור את פרטי התמונה",
            variant: "destructive",
          })
          return
        }

        setImages((prev) => [data, ...prev])
      } else if (imageType === "appointment-session") {
        const { data: groomingCheck, error: groomingError } = await supabase
          .from("grooming_appointments")
          .select("id")
          .eq("id", entityId)
          .maybeSingle()

        if (!groomingCheck || groomingError) {
          console.error("❌ [ImageGalleryModal] Grooming appointment not found", {
            entityId,
            groomingError,
          })
          // Try to delete the uploaded file
          await deleteGalleryImage(uploadResult.storagePath, imageType)
          toast({
            title: "שגיאה",
            description: "לא ניתן למצוא את התור",
            variant: "destructive",
          })
          return
        }

        const insertData: any = {
          image_url: uploadResult.imageUrl,
          storage_path: uploadResult.storagePath,
          created_by: userId,
          grooming_appointment_id: entityId,
        }

        const { data, error } = await supabase
          .from("appointment_session_images")
          .insert(insertData)
          .select()
          .single()

        if (error) {
          console.error("❌ [ImageGalleryModal] Error saving appointment session image record:", error)
          // Try to delete the uploaded file
          await deleteGalleryImage(uploadResult.storagePath, imageType)
          toast({
            title: "שגיאה",
            description: "לא ניתן לשמור את פרטי התמונה",
            variant: "destructive",
          })
          return
        }

        setImages((prev) => [data, ...prev])
      }

      toast({
        title: "תמונה הועלתה",
        description: "התמונה הועלתה בהצלחה",
      })

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("❌ [ImageGalleryModal] Unexpected error uploading image:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן להעלות את התמונה",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteImage = async (image: DogDesiredGoalImage | AppointmentSessionImage) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק תמונה זו?")) {
      return
    }

    setDeletingImageId(image.id)
    try {
      console.log("🗑️ [ImageGalleryModal] Deleting image", {
        imageId: image.id,
        storagePath: "storage_path" in image ? image.storage_path : undefined,
      })

      const storagePath = "storage_path" in image ? image.storage_path : undefined
      if (!storagePath) {
        toast({
          title: "שגיאה",
          description: "לא ניתן למצוא את נתיב התמונה",
          variant: "destructive",
        })
        return
      }

      // Delete from storage
      const deleteResult = await deleteGalleryImage(storagePath, imageType)
      if (!deleteResult.success) {
        toast({
          title: "שגיאה",
          description: deleteResult.error || "לא ניתן למחוק את התמונה מהאחסון",
          variant: "destructive",
        })
        return
      }

      // Delete from database
      if (imageType === "dog-desired-goal") {
        const { error } = await supabase
          .from("dog_desired_goal_images")
          .delete()
          .eq("id", image.id)

        if (error) {
          console.error("❌ [ImageGalleryModal] Error deleting dog desired goal image record:", error)
          toast({
            title: "שגיאה",
            description: "לא ניתן למחוק את רשומת התמונה",
            variant: "destructive",
          })
          return
        }
      } else if (imageType === "appointment-session") {
        const { error } = await supabase
          .from("appointment_session_images")
          .delete()
          .eq("id", image.id)

        if (error) {
          console.error("❌ [ImageGalleryModal] Error deleting appointment session image record:", error)
          toast({
            title: "שגיאה",
            description: "לא ניתן למחוק את רשומת התמונה",
            variant: "destructive",
          })
          return
        }
      }

      setImages((prev) => prev.filter((img) => img.id !== image.id))
      toast({
        title: "תמונה נמחקה",
        description: "התמונה נמחקה בהצלחה",
      })
    } catch (error) {
      console.error("❌ [ImageGalleryModal] Unexpected error deleting image:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק את התמונה",
        variant: "destructive",
      })
    } finally {
      setDeletingImageId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Button */}
          <div className="flex justify-end">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isLoading}
              className="gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  מעלה תמונה...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  העלה תמונה חדשה
                </>
              )}
            </Button>
          </div>

          {/* Images Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
              <ImageIcon className="h-12 w-12 mb-4 text-gray-300" />
              <p>אין תמונות</p>
              <p className="text-sm mt-2">לחץ על 'העלה תמונה חדשה' כדי להוסיף תמונות</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {images.map((image) => (
                <div key={image.id} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    <img
                      src={image.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteImage(image)}
                    disabled={deletingImageId === image.id}
                  >
                    {deletingImageId === image.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

