
import { useState } from 'react';
import { Search, Users, PawPrint, ArrowRight, Plus, Calendar, Edit3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ClientCard from './ClientCard';

// Mock data - replace with real data from your backend
const mockClients = [
  {
    id: '1',
    name: 'ישראל ישראלי',
    phone: '050-1234567',
    email: 'israel@example.com',
    status: 'VIP - לקוח ותיק',
    dogs: [
      { id: '1', name: 'רקסי', breed: 'גולדן רטריבר' },
      { id: '2', name: 'בוני', breed: 'לברדור' }
    ],
    nextAppointment: '2024-01-25 14:00',
    lastAppointment: '2024-01-10 10:30'
  },
  {
    id: '2',
    name: 'שרה כהן',
    phone: '052-9876543',
    email: 'sarah@example.com',
    status: 'לקוח רגיל',
    dogs: [
      { id: '3', name: 'מקס', breed: 'פינצ\'ר' }
    ],
    nextAppointment: null,
    lastAppointment: '2023-12-15 11:00'
  },
  {
    id: '3',
    name: 'דוד לוי',
    phone: '054-5555555',
    email: 'david@example.com',
    status: 'מנוי גן',
    dogs: [
      { id: '4', name: 'לוסי', breed: 'יורקשייר טרייר' },
      { id: '5', name: 'צ\'ארלי', breed: 'פודל' }
    ],
    nextAppointment: '2024-01-28 16:30',
    lastAppointment: '2024-01-18 09:00'
  }
];

const statusOptions = [
  { value: 'לקוח רגיל', label: 'לקוח רגיל', color: 'bg-gray-100 text-gray-800' },
  { value: 'VIP - לקוח ותיק', label: 'VIP - לקוח ותיק', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'מנוי גן', label: 'מנוי גן', color: 'bg-green-100 text-green-800' },
  { value: 'לקוח עבר', label: 'לקוח עבר', color: 'bg-red-100 text-red-800' }
];

const ClientsManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clients, setClients] = useState(mockClients);

  const filteredClients = clients.filter(client =>
    client.name.includes(searchTerm) ||
    client.phone.includes(searchTerm) ||
    client.dogs.some(dog => dog.name.includes(searchTerm))
  );

  const handleStatusChange = (clientId: string, newStatus: string) => {
    setClients(prev => prev.map(client =>
      client.id === clientId ? { ...client, status: newStatus } : client
    ));
  };

  const getStatusColor = (status: string) => {
    const statusOption = statusOptions.find(opt => opt.value === status);
    return statusOption?.color || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (selectedClient) {
    const client = clients.find(c => c.id === selectedClient);
    if (client) {
      return (
        <ClientCard 
          client={client} 
          onBack={() => setSelectedClient(null)}
          onStatusChange={(newStatus) => handleStatusChange(client.id, newStatus)}
        />
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">מרכז הלקוחות שלנו</h1>
          <p className="text-gray-600">כל הלקוחות, הכלבים וההיסטוריה שלהם במקום אחד</p>
        </div>

        {/* Search and Add Client */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="חפש/י לקוח, כלב או מספר טלפון..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 text-lg py-3"
              />
            </div>
          </div>
          <Button size="lg" className="px-6">
            <Plus className="w-5 h-5 ml-2" />
            לקוח חדש
          </Button>
        </div>

        {/* Clients List */}
        <div className="space-y-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  {/* Client Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <h3 className="text-xl font-semibold text-gray-900">{client.name}</h3>
                      <Select
                        value={client.status}
                        onValueChange={(value) => handleStatusChange(client.id, value)}
                      >
                        <SelectTrigger className="w-auto">
                          <Badge className={getStatusColor(client.status)}>
                            {client.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <Badge className={option.color}>
                                {option.label}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Dogs */}
                      <div className="flex items-center gap-2">
                        <PawPrint className="w-4 h-4 text-blue-600" />
                        <span className="text-gray-700">
                          שמות הכלבים: {client.dogs.map(dog => `[${dog.name}]`).join(', ')}
                        </span>
                      </div>

                      {/* Next/Last Appointment */}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-green-600" />
                        <span className="text-gray-700">
                          {client.nextAppointment ? (
                            <>תור הבא: {formatDate(client.nextAppointment)}</>
                          ) : (
                            <>תור אחרון: {formatDate(client.lastAppointment)}</>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    variant="outline"
                    onClick={() => setSelectedClient(client.id)}
                    className="flex items-center gap-2"
                  >
                    צפה בכרטיס לקוח
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredClients.length === 0 && (
          <Card className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">לא נמצאו לקוחות התואמים לחיפוש</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ClientsManagement;
