
interface DashboardHeaderProps {
  onSettingsClick?: () => void;
  onServicesClick?: () => void;
  onStationsClick?: () => void;
  onClientsClick?: () => void;
  onAvailabilityClick?: () => void;
  onHomeClick?: () => void;
}

const DashboardHeader = ({ }: DashboardHeaderProps) => {
  return (
    <header className="bg-white shadow-sm border-b" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-gray-900">מרפאה יוצאת דופן - ניהול</h1>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
