import { useAppSelector } from "@/store/hooks"
import { useSearchParams, useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect, useRef, useMemo } from "react"
import { Loader2 } from "lucide-react"
import { useProtectedScreenPassword } from "@/hooks/useProtectedScreenPassword"
import { ProtectedScreenPasswordDialog } from "@/components/dialogs/ProtectedScreenPasswordDialog"
import { ProtectedScreenGuard } from "@/components/ProtectedScreenGuard"
import { useManagerSchedulePersistence } from "./ManagerSchedule/hooks/useManagerSchedulePersistence"
import { useManagerScheduleData } from "./ManagerSchedule/hooks/useManagerScheduleData"
import { useManagerScheduleStations } from "./ManagerSchedule/hooks/useManagerScheduleStations"
import {
  ApproveWithModifyDialog,
  CancelConfirmationDialog,
  DeleteConfirmationDialog,
  DeleteConstraintDialog,
  DeleteProposedMeetingDialog,
  DuplicateSeriesModal,
  DuplicateSuccessModal,
  ManagerConstraintEditDialog,
  ManagerDuplicateStationDialog,
  ManagerGroomingEditModal,
  ManagerPersonalAppointmentEditModal,
  ManagerProposedMeetingModal,
  ManagerProposeRescheduleModal,
  ManagerStationConstraintsModal,
  ManagerStationEditDialog,
  MoveConfirmationDialog,
  WaitlistDropDialog,
  PinnedAppointmentDropDialog,
  ManagerCustomerCommunicationModal,
  ManagerInvoiceModal
} from "@/components/dialogs/manager-schedule/index"
import { ManagerAppointmentCreationModals } from "@/components/modals/manager-schedule/ManagerAppointmentCreationModals"
import { ManagerAppointmentDetailsSheet } from "@/components/sheets/manager-schedule/ManagerAppointmentDetailsSheet"
import { ManagerClientDetailsSheet } from "@/components/sheets/manager-schedule/ManagerClientDetailsSheet"
import { ManagerConstraintDetailsSheet } from "@/components/sheets/manager-schedule/ManagerConstraintDetailsSheet"
import { ManagerScheduleLoadingState } from "./ManagerSchedule/components/ManagerScheduleLoadingState"
import { ManagerScheduleContent } from "./ManagerSchedule/components/managerScheduleContent/ManagerScheduleContent.tsx"
import { ManagerScheduleSidebar } from "./ManagerSchedule/components/ManagerScheduleSidebar"

const ManagerSchedule = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { isProtected, isChecking, isPasswordVerified } = useProtectedScreenPassword()
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  useManagerSchedulePersistence()

  // Redux state

  const serviceFilter = useAppSelector(
    (state) => state.managerSchedule.serviceFilter
  )
  const visibleStationIds = useAppSelector(
    (state) => state.managerSchedule.visibleStationIds
  )
  const hasUrlStationsOverride = Boolean(searchParams.get("stations"))

  const showPinnedAppointmentsColumn = useAppSelector(
    (state) => state.managerSchedule.showPinnedAppointmentsColumn
  )
  const showWaitingListColumn = useAppSelector(
    (state) => state.managerSchedule.showWaitingListColumn
  )

  // Data fetching and management
  const {
    data,
    isLoading,
    selectedDate: dataSelectedDate,
  } = useManagerScheduleData()

  // Track first mount to show loader only on initial load
  const isFirstMountRef = useRef(true)
  const [showBoardLoader, setShowBoardLoader] = useState(true)

  // Check if content is actually ready
  // Content is ready when:
  // 1. Not loading
  // 2. Data exists AND has the required structure (stations and appointments arrays)
  const isContentReady = useMemo(() => {
    if (isLoading) return false
    if (!data) return false
    // Content is ready when we have stations and appointments data (even if empty arrays)
    return Array.isArray(data.stations) && Array.isArray(data.appointments)
  }, [data, isLoading])

  useEffect(() => {
    if (isFirstMountRef.current) {
      // On first mount, show loader until content is fully ready
      if (!isContentReady) {
        setShowBoardLoader(true)
      } else {
        // Content is ready, hide loader and mark first mount as complete
        setShowBoardLoader(false)
        isFirstMountRef.current = false
      }
    }
    // After first mount, never show loader again (even if data changes)
  }, [isContentReady])


  const {

  } = useManagerScheduleStations({
    data,
    serviceFilter,
    showWaitingListColumn,
    showPinnedAppointmentsColumn,
    visibleStationIds,
    hasUrlStationsOverride,
  })


  const isUnpinMode = !showPinnedAppointmentsColumn

  // Don't auto-show dialog - user must click "Enter Password" on the guard

  // Show loading while checking protection status
  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="mr-4 text-gray-600">טוען...</span>
      </div>
    )
  }

  const showGuard = isProtected && !isPasswordVerified() && !showPasswordDialog

  return (
    <>
      <ProtectedScreenPasswordDialog
        open={showPasswordDialog}
        onClose={() => {
          setShowPasswordDialog(false)
        }}
        onSuccess={() => {
          setShowPasswordDialog(false)
        }}
        screenName="לוח מנהל"
      />
      <div className="relative" dir="rtl">
        {showGuard && (
          <ProtectedScreenGuard
            screenName="לוח מנהל"
            onEnterPassword={() => setShowPasswordDialog(true)}
          />
        )}
        <div className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${showGuard ? "opacity-40 pointer-events-none select-none" : ""}`}>
          <ManagerScheduleLoadingState />
          <div className={`flex gap-4 transition-all duration-300 ease-in-out ${isUnpinMode ? 'h-screen py-4' : ''}`}>
            <ManagerScheduleSidebar />
            <div className={`overflow-x-auto  flex-1 h-full`}>
              {showBoardLoader ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-slate-200 bg-white">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm text-gray-600">טוען את לוח הניהול...</span>
                  </div>
                </div>
              ) : (
                <ManagerScheduleContent />
              )}
            </div>
          </div>
          <ManagerAppointmentDetailsSheet />
          <ManagerClientDetailsSheet />
          <ManagerConstraintDetailsSheet />
          <MoveConfirmationDialog />
          <DeleteConfirmationDialog />
          <CancelConfirmationDialog />
          <DuplicateSeriesModal />
          <DuplicateSuccessModal />
          <DeleteProposedMeetingDialog />
          <ManagerGroomingEditModal />
          <ManagerPersonalAppointmentEditModal />
          <WaitlistDropDialog />
          <ManagerAppointmentCreationModals />
          <ManagerProposedMeetingModal />
          <ManagerConstraintEditDialog />
          <DeleteConstraintDialog />
          <ManagerStationEditDialog />
          <ManagerDuplicateStationDialog />
          <ManagerStationConstraintsModal />
          <ManagerProposeRescheduleModal />
          <PinnedAppointmentDropDialog />
          <ManagerCustomerCommunicationModal />
          <ManagerInvoiceModal />
          <ApproveWithModifyDialog />
        </div>
      </div>
    </>
  )
}

export default ManagerSchedule
