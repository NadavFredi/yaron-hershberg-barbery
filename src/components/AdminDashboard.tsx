
import { useState } from 'react';
import { appointments } from '@/data/mockData';
import BusinessSettings from './BusinessSettings';
import ServicesManagement from './admin/ServicesManagement';
import ClientsManagement from './admin/ClientsManagement';
import AvailabilityManagement from './admin/AvailabilityManagement';
import DashboardHeader from './admin/DashboardHeader';
import StatsCards from './admin/StatsCards';
import DashboardCalendar from './admin/DashboardCalendar';
import AppointmentsList from './admin/AppointmentsList';

const AdminDashboard = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [currentView, setCurrentView] = useState<'dashboard' | 'settings' | 'services' | 'clients' | 'availability'>('dashboard');

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.startTime);
      return aptDate.toDateString() === date.toDateString();
    });
  };

  const dayAppointments = getAppointmentsForDate(selectedDate);

  const handleHomeClick = () => {
    setCurrentView('dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <DashboardHeader 
        onSettingsClick={() => setCurrentView('settings')}
        onServicesClick={() => setCurrentView('services')}
        onStationsClick={() => {}} // Empty since stations now have their own page
        onClientsClick={() => setCurrentView('clients')}
        onAvailabilityClick={() => setCurrentView('availability')}
        onHomeClick={handleHomeClick}
      />

      {currentView === 'settings' && (
        <BusinessSettings onBack={() => setCurrentView('dashboard')} />
      )}

      {currentView === 'services' && (
        <ServicesManagement />
      )}

      {currentView === 'clients' && (
        <ClientsManagement />
      )}

      {currentView === 'availability' && (
        <AvailabilityManagement />
      )}

      {currentView === 'dashboard' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid lg:grid-cols-4 gap-6">
            <StatsCards dayAppointments={dayAppointments} />
            
            <DashboardCalendar
              selectedDate={selectedDate}
              onDateSelect={(date) => date && setSelectedDate(date)}
            />
            
            <AppointmentsList
              selectedDate={selectedDate}
              dayAppointments={dayAppointments}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
