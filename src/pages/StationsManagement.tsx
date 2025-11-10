
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/layout/AdminLayout';
import StationsManagement from '@/components/admin/StationsManagement';

const StationsManagementPage = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/admin');
  };

  return (
    <AdminLayout>
      <div className="p-6" dir="rtl">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={handleBack}
              className="mb-4 text-blue-600 hover:text-blue-700"
            >
              <ArrowRight className="w-4 h-4 ml-2" />
              חזרה לדשבורד
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">ניהול עמדות</h1>
            <p className="text-gray-600 mt-2">נהל את כל העמדות במערכת - צור, ערוך, ומחק עמדות</p>
          </div>

          <StationsManagement />
        </div>
      </div>
    </AdminLayout>
  );
};

export default StationsManagementPage;
