
import { useState } from 'react';
import { ArrowRight, Calendar, PawPrint, Plus, User, Edit3, Phone, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

interface Dog {
  id: string;
  name: string;
  breed: string;
  notes?: string;
  groomingMinPrice?: number | null;
  groomingMaxPrice?: number | null;
}

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  dogs: Dog[];
  nextAppointment?: string | null;
  lastAppointment: string;
  generalNotes?: string;
}

interface ClientCardProps {
  client: Client;
  onBack: () => void;
  onStatusChange: (newStatus: string) => void;
}

// Mock appointment history
const mockAppointmentHistory = [
  {
    id: '1',
    date: '2024-01-18 09:00',
    service: 'תספורת מלאה',
    dogName: 'רקסי',
    station: 'עמדה 1 - יוסי',
    status: 'הושלם'
  },
  {
    id: '2',
    date: '2024-01-25 14:00',
    service: 'רחצה ויבוש',
    dogName: 'בוני',
    station: 'עמדה 2 - שרה',
    status: 'עתידי'
  },
  {
    id: '3',
    date: '2024-01-10 10:30',
    service: 'גיזום ציפורניים',
    dogName: 'רקסי',
    station: 'עמדה 1 - יוסי',
    status: 'הושלם'
  }
];

const statusOptions = [
  { value: 'לקוח רגיל', label: 'לקוח רגיל', color: 'bg-gray-100 text-gray-800' },
  { value: 'VIP - לקוח ותיק', label: 'VIP - לקוח ותיק', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'מנוי גן', label: 'מנוי גן', color: 'bg-green-100 text-green-800' },
  { value: 'לקוח עבר', label: 'לקוח עבר', color: 'bg-red-100 text-red-800' }
];

const ClientCard = ({ client, onBack, onStatusChange }: ClientCardProps) => {
  const [dogs, setDogs] = useState(client.dogs);
  const [generalNotes, setGeneralNotes] = useState(client.generalNotes || '');
  const [clientDetails, setClientDetails] = useState({
    name: client.name,
    phone: client.phone,
    email: client.email
  });

  const getStatusColor = (status: string) => {
    const statusOption = statusOptions.find(opt => opt.value === status);
    return statusOption?.color || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'הושלם':
        return 'bg-green-100 text-green-800';
      case 'עתידי':
        return 'bg-blue-100 text-blue-800';
      case 'בוטל':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const updateDogNotes = (dogId: string, notes: string) => {
    setDogs(prev => prev.map(dog =>
      dog.id === dogId ? { ...dog, notes } : dog
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={onBack} className="mb-4">
            <ArrowRight className="w-4 h-4 ml-2" />
            חזרה לרשימת הלקוחות
          </Button>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">
                כרטיס לקוח: {client.name}
              </h1>
              <Select value={client.status} onValueChange={onStatusChange}>
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
            
            <div className="flex gap-6 text-gray-600">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>טלפון: {client.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>אימייל: {client.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="appointments" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="appointments">היסטוריית תורים</TabsTrigger>
            <TabsTrigger value="dogs">הכלבים שלי</TabsTrigger>
            <TabsTrigger value="notes">הערות ופרטים</TabsTrigger>
          </TabsList>

          {/* Appointments History Tab */}
          <TabsContent value="appointments">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>היסטוריית תורים</CardTitle>
                  <Button className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    קבע תור חדש ללקוח זה
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>תאריך ושעה</TableHead>
                      <TableHead>שירות</TableHead>
                      <TableHead>שם הכלב</TableHead>
                      <TableHead>עמדה מטפלת</TableHead>
                      <TableHead>סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockAppointmentHistory.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell>{formatDate(appointment.date)}</TableCell>
                        <TableCell>{appointment.service}</TableCell>
                        <TableCell>{appointment.dogName}</TableCell>
                        <TableCell>{appointment.station}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(appointment.status)}>
                            {appointment.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dogs Tab */}
          <TabsContent value="dogs">
            <div className="space-y-4">
              {dogs.map((dog) => (
                <Card key={dog.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PawPrint className="w-5 h-5 text-blue-600" />
                      שם הכלב: {dog.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        גזע: {dog.breed}
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        הערות ורגישויות לגבי {dog.name}:
                      </label>
                      <Textarea
                        value={dog.notes || ''}
                        onChange={(e) => updateDogNotes(dog.id, e.target.value)}
                        placeholder="למשל: רגיש במיוחד באוזניים, לא אוהב את המייבש, נובח כשרואה כלבים אחרים..."
                        className="min-h-[100px]"
                      />
                      <Button size="sm" className="mt-2">
                        שמור הערות
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Card className="border-dashed border-2 border-gray-300">
                <CardContent className="p-6 text-center">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    הוסף כלב חדש ללקוח
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Notes and Details Tab */}
          <TabsContent value="notes">
            <div className="space-y-6">
              {/* General Notes */}
              <Card>
                <CardHeader>
                  <CardTitle>הערות כלליות על {client.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="למשל: תמיד מגיע 5 דקות לפני הזמן, מעדיף לשלם באשראי, שואל הרבה שאלות על התספורת..."
                    className="min-h-[120px]"
                  />
                  <Button className="mt-3">
                    שמור הערות
                  </Button>
                </CardContent>
              </Card>

              {/* Contact Details */}
              <Card>
                <CardHeader>
                  <CardTitle>פרטי התקשרות</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      שם מלא
                    </label>
                    <Input
                      value={clientDetails.name}
                      onChange={(e) => setClientDetails(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      מספר טלפון
                    </label>
                    <Input
                      value={clientDetails.phone}
                      onChange={(e) => setClientDetails(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      כתובת אימייל
                    </label>
                    <Input
                      value={clientDetails.email}
                      onChange={(e) => setClientDetails(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <Button>
                    עדכן פרטים
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ClientCard;
