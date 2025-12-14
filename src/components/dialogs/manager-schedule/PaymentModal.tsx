// Re-export from the new modular structure
export { PaymentModal } from "./PaymentModal/index.tsx"
export type { PaymentModalProps, PaymentData } from "./PaymentModal/types.ts"

// Legacy default export for backward compatibility
import { PaymentModal as PaymentModalComponent } from "./PaymentModal/index.tsx"
export default PaymentModalComponent

/* 
 * This file has been refactored into a modular structure:
 * - PaymentModal/index.tsx - Main component orchestrator
 * - PaymentModal/usePaymentModal.ts - Business logic hook
 * - PaymentModal/AppointmentDetailsSection.tsx - Appointment details component (Image 1)
 * - PaymentModal/ProductsSection.tsx - Products table component (Image 2)
 * - PaymentModal/TotalSummarySection.tsx - Total summary component (Image 3)
 * - PaymentModal/types.ts - Shared types and interfaces
 */
