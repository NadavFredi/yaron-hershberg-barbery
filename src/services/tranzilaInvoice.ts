/**
 * Service for fetching Tranzila invoices
 * This is a client-side wrapper that calls the edge function which uses the TranzilaApiClient
 */

/**
 * Get invoice for a payment
 * Uses edge function that has access to server-side env vars and TranzilaApiClient
 */
import { supabase } from "@/integrations/supabase/client"

export async function getInvoiceForPayment(transactionId: string): Promise<string> {
  const { data: invoiceResult, error: invoiceError } = await supabase.functions.invoke("tranzila-get-invoice", {
    body: { transactionId },
  })

  if (invoiceError) {
    throw invoiceError
  }

  const data = invoiceResult as any
  if (!data || (typeof data === "object" && "success" in data && !data.success)) {
    throw new Error(data?.error || "Failed to fetch invoice")
  }

  return data.invoice
}
