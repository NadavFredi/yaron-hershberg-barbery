import { supabase } from "@/integrations/supabase/client"

export interface CustomerSearchResult {
  id: string
  fullName?: string
  phone?: string
  email?: string
  treatmentNames?: string
  recordId?: string
}

/**
 * Search customers by name, phone, or email
 * Uses RLS - managers can see all customers, regular users see only their own
 */
export async function searchCustomers(searchTerm: string): Promise<{
  customers: CustomerSearchResult[]
  count: number
  searchTerm: string
}> {
  const searchPattern = searchTerm.trim()

  let query = supabase.from("customers").select("id, full_name, phone, email").limit(20)

  // If there's a search term, filter by it; otherwise return first 20
  if (searchPattern.length > 0) {
    query = query.or(`full_name.ilike.%${searchPattern}%,phone.ilike.%${searchPattern}%,email.ilike.%${searchPattern}%`)
  } else {
    // Return first 20 customers ordered by name when no search term
    query = query.order("full_name").limit(20)
  }

  const { data: customersData, error: customersError } = await query

  if (customersError) {
    console.error("Error searching customers:", customersError)
    throw new Error(`Failed to search customers: ${customersError.message}`)
  }

  console.log(`Found ${customersData?.length || 0} customers matching "${searchTerm}"`)

  // For each customer, get their treatments' names
  const customersWithTreatments: CustomerSearchResult[] = []

  if (customersData && customersData.length > 0) {
    // Get all customer IDs
    const customerIds = customersData.map((c) => c.id)

    // Treatments table no longer exists - services are global, not per-customer
    // So we just use empty treatments for all customers
    const treatmentsByCustomer: Record<string, string[]> = {}

    // Build result array
    customersData.forEach((customer) => {
      customersWithTreatments.push({
        id: customer.id,
        fullName: customer.full_name || undefined,
        phone: customer.phone || undefined,
        email: customer.email || undefined,
        treatmentNames: treatmentsByCustomer[customer.id]?.join(", ") || undefined,
      })
    })
  }

  return {
    customers: customersWithTreatments,
    count: customersWithTreatments.length,
    searchTerm,
  }
}

/**
 * Update customer information
 */
export async function updateCustomer(params: {
  customerId: string
  full_name?: string
  phone_number?: string
  email?: string
  address?: string
  customer_type_id?: string | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { customerId, full_name, phone_number, email, address, customer_type_id } = params

    if (!customerId) {
      throw new Error("customerId נדרש")
    }

    // Check if at least one field is provided
    if (!full_name && !phone_number && !email && !address && customer_type_id === undefined) {
      throw new Error("יש לספק לפחות שדה אחד לעדכון")
    }

    // Build update payload
    const updatePayload: Record<string, string | null> = {}
    if (full_name !== undefined) updatePayload.full_name = full_name
    if (phone_number !== undefined) updatePayload.phone = phone_number
    if (email !== undefined) updatePayload.email = email
    if (address !== undefined) updatePayload.address = address
    if (customer_type_id !== undefined) updatePayload.customer_type_id = customer_type_id || null

    const { error } = await supabase.from("customers").update(updatePayload).eq("id", customerId)

    if (error) {
      throw new Error(`Failed to update customer: ${error.message}`)
    }

    return { success: true }
  } catch (error) {
    console.error("Error updating customer:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update customer",
    }
  }
}
