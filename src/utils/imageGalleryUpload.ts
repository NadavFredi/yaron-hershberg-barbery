import { supabase } from "@/integrations/supabase/client"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]

export interface UploadImageResult {
  success: boolean
  imageUrl?: string
  storagePath?: string
  error?: string
}

export type ImageType = "dog-desired-goal" | "appointment-session"

const BUCKET_NAME = "images"

const FOLDER_MAP: Record<ImageType, string> = {
  "dog-desired-goal": "dog-desired-goal",
  "appointment-session": "appointment-session",
}

/**
 * Uploads an image to Supabase Storage
 * @param file - The image file to upload
 * @param userId - The authenticated user's ID (for folder organization)
 * @param imageType - Type of image (determines bucket)
 * @param entityId - The ID of the dog or appointment (for unique file naming)
 * @returns Promise with upload result containing the public URL and storage path
 */
export async function uploadGalleryImage(
  file: File,
  userId: string,
  imageType: ImageType,
  entityId: string
): Promise<UploadImageResult> {
  try {
    console.log("📸 [uploadGalleryImage] Starting image upload", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId,
      imageType,
      entityId,
    })

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      const error = `סוג קובץ לא נתמך. יש להשתמש בתמונות: JPEG, PNG, WebP, או GIF.`
      console.error("❌ [uploadGalleryImage] Invalid file type", { fileType: file.type })
      return { success: false, error }
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const error = `גודל הקובץ גדול מדי. הגודל המקסימלי הוא 5MB.`
      console.error("❌ [uploadGalleryImage] File too large", { fileSize: file.size, maxSize: MAX_FILE_SIZE })
      return { success: false, error }
    }

    const folder = FOLDER_MAP[imageType]

    // Get file extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "jpg"
    
    // Create unique filename: {folder}/{userId}/{entityId}-{timestamp}.{ext}
    const timestamp = Date.now()
    const fileName = `${folder}/${userId}/${entityId}-${timestamp}.${fileExtension}`
    
    console.log("📤 [uploadGalleryImage] Uploading file to storage", {
      bucket: BUCKET_NAME,
      folder,
      fileName,
    })

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false, // Don't overwrite existing files
      })

    if (uploadError) {
      console.error("❌ [uploadGalleryImage] Upload error", uploadError)
      return {
        success: false,
        error: `שגיאה בהעלאת התמונה: ${uploadError.message}`,
      }
    }

    console.log("✅ [uploadGalleryImage] File uploaded successfully", {
      path: uploadData.path,
    })

    // Get public URL for the uploaded image
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path)

    const publicUrl = urlData.publicUrl

    console.log("✅ [uploadGalleryImage] Upload complete", {
      publicUrl,
      storagePath: uploadData.path,
    })

    return {
      success: true,
      imageUrl: publicUrl,
      storagePath: uploadData.path,
    }
  } catch (error) {
    console.error("❌ [uploadGalleryImage] Unexpected error", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "שגיאה לא צפויה בהעלאת התמונה",
    }
  }
}

/**
 * Deletes an image from Supabase Storage
 * @param storagePath - The storage path of the image to delete
 * @param imageType - Type of image (determines bucket)
 * @returns Promise with deletion result
 */
export async function deleteGalleryImage(
  storagePath: string,
  imageType: ImageType
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("🗑️ [deleteGalleryImage] Starting image deletion", {
      storagePath,
      imageType,
    })

    console.log("🗑️ [deleteGalleryImage] Deleting file from storage", {
      bucket: BUCKET_NAME,
      storagePath,
    })

    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath])

    if (deleteError) {
      console.error("❌ [deleteGalleryImage] Delete error", deleteError)
      return {
        success: false,
        error: `שגיאה במחיקת התמונה: ${deleteError.message}`,
      }
    }

    console.log("✅ [deleteGalleryImage] Image deleted successfully", {
      storagePath,
    })

    return { success: true }
  } catch (error) {
    console.error("❌ [deleteGalleryImage] Unexpected error", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "שגיאה לא צפויה במחיקת התמונה",
    }
  }
}

