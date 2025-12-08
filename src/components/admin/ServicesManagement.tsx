
import { useState } from 'react';
import ServiceLibrary from './ServiceLibrary';
import ServiceEditor from './ServiceEditor';

const ServicesManagement = () => {
  const [currentView, setCurrentView] = useState<'library' | 'editor'>('library');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const handleEditService = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setCurrentView('editor');
  };

  const handleBackToLibrary = () => {
    setCurrentView('library');
    setSelectedServiceId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'library' && (
          <ServiceLibrary onEditService={handleEditService} />
        )}
        
        {currentView === 'editor' && selectedServiceId && (
          <ServiceEditor 
            serviceId={selectedServiceId} 
            onBack={handleBackToLibrary}
          />
        )}
      </div>
    </div>
  );
};

export default ServicesManagement;
