
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, Building2, MapPin, Phone, Mail } from 'lucide-react';

interface BusinessSettingsProps {
  onBack: () => void;
}

const BusinessSettings = ({ onBack }: BusinessSettingsProps) => {
  const [businessData, setBusinessData] = useState({
    name: 'ירון הרשברג- מספרה יוצאת דופן',
    description: 'מרכז טיפוח מקצועי לכלבים',
    address: 'ירושלים, ירושלים',
    phone: '03-1234567',
    email: 'info@yaronhershberg.co.il'
  });

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log('Saving business settings:', businessData);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={onBack}
            className="mb-4 text-blue-600 hover:text-blue-700"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            חזרה לדשבורד
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">הגדרות עסק</h1>
          <p className="text-gray-600 mt-2">נהל את פרטי העסק הבסיסיים</p>
        </div>

        {/* Business Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="w-5 h-5 ml-2" />
              פרטי העסק
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="businessName">שם העסק</Label>
                <Input
                  id="businessName"
                  value={businessData.name}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="הקלד/י את שם העסק"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessPhone" className="flex items-center">
                  <Phone className="w-4 h-4 ml-1" />
                  טלפון ראשי
                </Label>
                <Input
                  id="businessPhone"
                  value={businessData.phone}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="מספר טלפון"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessDescription">תיאור העסק</Label>
              <Textarea
                id="businessDescription"
                value={businessData.description}
                onChange={(e) => setBusinessData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="תיאור קצר של העסק"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessAddress" className="flex items-center">
                <MapPin className="w-4 h-4 ml-1" />
                כתובת העסק
              </Label>
              <Input
                id="businessAddress"
                value={businessData.address}
                onChange={(e) => setBusinessData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="כתובת מלאה"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessEmail" className="flex items-center">
                <Mail className="w-4 h-4 ml-1" />
                אימייל
              </Label>
              <Input
                id="businessEmail"
                type="email"
                value={businessData.email}
                onChange={(e) => setBusinessData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="כתובת אימייל"
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                שמור שינויים
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BusinessSettings;
