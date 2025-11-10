
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/layout/AdminLayout';
import TreatmentTypesManagement from '@/components/admin/TreatmentTypesManagement';

const TreatmentTypesManagementPage = () => {
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
            <h1 className="text-3xl font-bold text-gray-900">ניהול גזעים</h1>
            <p className="text-gray-600 mt-2">נהל את כל הגזעים במערכת - צור, ערוך, ומחק גזעים</p>
          </div>

          <TreatmentTypesManagement />
        </div>
      </div>
    </AdminLayout>
  );
};

export default TreatmentTypesManagementPage;
