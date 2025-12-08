import { supabase } from "@/integrations/supabase/client"

const IMAGES_BUCKET = "images"
const DOG_PROFILE_FOLDER = "dog-profile"
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]

export interface UploadDogImageResult {
  success: boolean
  imageUrl?: string
  error?: string
}

/**
 * Uploads a dog image to Supabase Storage
 * @param file - The image file to upload
 * @param userId - The authenticated user's ID (for folder organization)
 * @param dogId - The dog's ID (for unique file naming)
 * @returns Promise with upload result containing the public URL
 */
export async function uploadDogImage(
  file: File,
  userId: string,
  dogId: string
): Promise<UploadDogImageResult> {
  try {
    console.log("📸 [uploadDogImage] Starting image upload", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId,
      dogId,
    })

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      const error = `סוג קובץ לא נתמך. יש להשתמש בתמונות: JPEG, PNG, WebP, או GIF.`
      console.error("❌ [uploadDogImage] Invalid file type", { fileType: file.type })
      return { success: false, error }
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const error = `גודל הקובץ גדול מדי. הגודל המקסימלי הוא 5MB.`
      console.error("❌ [uploadDogImage] File too large", { fileSize: file.size, maxSize: MAX_FILE_SIZE })
      return { success: false, error }
    }

    // Get file extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "jpg"
    
    // Create unique filename: dog-profile/{userId}/{dogId}-{timestamp}.{ext}
    const timestamp = Date.now()
    const fileName = `${DOG_PROFILE_FOLDER}/${userId}/${dogId}-${timestamp}.${fileExtension}`
    
    console.log("📤 [uploadDogImage] Uploading file to storage", {
      bucket: IMAGES_BUCKET,
      folder: DOG_PROFILE_FOLDER,
      fileName,
    })

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false, // Don't overwrite existing files
      })

    if (uploadError) {
      console.error("❌ [uploadDogImage] Upload error", uploadError)
      return {
        success: false,
        error: `שגיאה בהעלאת התמונה: ${uploadError.message}`,
      }
    }

    console.log("✅ [uploadDogImage] File uploaded successfully", {
      path: uploadData.path,
    })

    // Get public URL for the uploaded image
    const { data: urlData } = supabase.storage
      .from(IMAGES_BUCKET)
      .getPublicUrl(uploadData.path)

    const publicUrl = urlData.publicUrl

    console.log("✅ [uploadDogImage] Upload complete", {
      publicUrl,
    })

    return {
      success: true,
      imageUrl: publicUrl,
    }
  } catch (error) {
    console.error("❌ [uploadDogImage] Unexpected error", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "שגיאה לא צפויה בהעלאת התמונה",
    }
  }
}

/**
 * Deletes a dog image from Supabase Storage
 * @param imageUrl - The public URL of the image to delete
 * @param userId - The authenticated user's ID
 * @returns Promise with deletion result
 */
export async function deleteDogImage(
  imageUrl: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("🗑️ [deleteDogImage] Starting image deletion", {
      imageUrl,
      userId,
    })

    // Extract file path from URL
    // URL format: https://{project}.supabase.co/storage/v1/object/public/images/{path}
    const urlParts = imageUrl.split("/images/")
    if (urlParts.length < 2) {
      console.error("❌ [deleteDogImage] Invalid image URL format", { imageUrl })
      return {
        success: false,
        error: "כתובת תמונה לא תקינה",
      }
    }

    const filePath = urlParts[1]
    
    // Verify the file is in dog-profile folder and belongs to this user (security check)
    if (!filePath.startsWith(`${DOG_PROFILE_FOLDER}/${userId}/`)) {
      console.error("❌ [deleteDogImage] Unauthorized deletion attempt", {
        filePath,
        userId,
      })
      return {
        success: false,
        error: "אין הרשאה למחוק תמונה זו",
      }
    }

    console.log("🗑️ [deleteDogImage] Deleting file from storage", {
      bucket: IMAGES_BUCKET,
      filePath,
    })

    const { error: deleteError } = await supabase.storage
      .from(IMAGES_BUCKET)
      .remove([filePath])

    if (deleteError) {
      console.error("❌ [deleteDogImage] Delete error", deleteError)
      return {
        success: false,
        error: `שגיאה במחיקת התמונה: ${deleteError.message}`,
      }
    }

    console.log("✅ [deleteDogImage] Image deleted successfully", {
      filePath,
    })

    return { success: true }
  } catch (error) {
    console.error("❌ [deleteDogImage] Unexpected error", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "שגיאה לא צפויה במחיקת התמונה",
    }
  }
}

