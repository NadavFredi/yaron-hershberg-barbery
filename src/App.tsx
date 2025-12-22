
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";
import StationsManagementPage from "./pages/StationsManagement";
import NotFound from "./pages/NotFound";
import { SimpleTest } from "./components/SimpleTest";
import { AuthContainer } from "./components/auth/AuthContainer";
import { UserOnboarding } from "./components/auth/UserOnboarding";
import { Navbar } from "./components/navigation/Navbar";
import { ManagerSubnav } from "./components/navigation/ManagerSubnav";
import { ThirdLevelSubnav } from "./components/navigation/ThirdLevelSubnav";
import { AppFooter } from "./components/layout/AppFooter";
import { useAppSelector } from "./store/hooks";
import SetupAppointment from "./pages/SetupAppointment"
import Appointments from "./pages/Appointments/Appointments"
import ProfileSettings from "./pages/ProfileSettings"
import Subscriptions from "./pages/Subscriptions"
import About from "./pages/About"
import ScalpTreatments from "./pages/ScalpTreatments"
import HairRestoration from "./pages/HairRestoration"
import FAQ from "./pages/FAQ"
import SalonServices from "./pages/SalonServices"
import ManagerSchedule from "./pages/ManagerSchedule"
import Settings from "./pages/Settings/Settings"
import ManagerScreens from "./pages/ManagerScreens"
import { useManagerRole } from "./hooks/useManagerRole"
import FloatingWhatsAppButton from "./components/FloatingWhatsAppButton"
import ProposedMeetingPage from "./pages/ProposedMeetingPage"
import PaymentPage from "./pages/PaymentPage"
import { useDevMode } from "./hooks/useDevMode"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Keep React Query from re-firing when navigating between tabs/routes
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

// Inner component to access location for conditional padding
const AppContent = () => {
  const { isManager } = useManagerRole()
  const location = useLocation()
  const { isOnManagerBoard, isNavbarPinned, isNavbarVisible } = useAppSelector((state) => state.navbar)
  useDevMode() // Global keyboard listener for dev mode

  // Manager routes don't need padding (they have their own spacing)
  const isManagerRoute = location.pathname.startsWith("/manager")
  const mainPaddingClass = isManagerRoute ? "pt-0" : "pt-6 sm:pt-10"

  // Hide footer when on any manager page
  const shouldHideFooter = isManagerRoute

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-purple-50" dir="rtl">
      <div className="flex min-h-screen flex-col">
        <Navbar isManager={!!isManager} />
        <ManagerSubnav isManager={!!isManager} />
        <ThirdLevelSubnav />
        <main className={`flex-1 ${mainPaddingClass}`}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/auth" element={<AuthContainer />} />
            <Route path="/onboarding" element={<UserOnboarding userEmail="" onBackToAuth={() => { }} />} />
            <Route path="/setup-appointment" element={<SetupAppointment />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/manager" element={<ManagerSchedule />} />
            <Route path="/about" element={<About />} />
            <Route path="/scalp-treatments" element={<ScalpTreatments />} />
            <Route path="/hair-restoration" element={<HairRestoration />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/salon-services" element={<SalonServices />} />
            <Route path="/profile" element={<ProfileSettings />} />
            <Route path="/test" element={<SimpleTest />} />
            <Route path="/admin/stations" element={<StationsManagementPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/manager-screens" element={<ManagerScreens />} />
            <Route path="/proposed/:meetingId" element={<ProposedMeetingPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        {!shouldHideFooter && <AppFooter />}
        {!isManager && <FloatingWhatsAppButton />}
      </div>
    </div>
  )
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
