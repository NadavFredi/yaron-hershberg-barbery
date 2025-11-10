
import { Button } from '@/components/ui/button';
import { User, UserPlus, Lock } from 'lucide-react';
import logoImage from '@/assets/logo.jpeg';

const Index = () => {
  return (
    <div className="pt-4 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4">
            <img src={logoImage} alt="B LOVED Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">B LOVED</h1>
          <p className="text-xl text-gray-600 mb-6">מספרת כלבים מקצועית</p>
          <p className="text-gray-500 mb-8">ברוכים הבאים למערכת הזימון תורים שלנו</p>
        </div>

        <div className="space-y-4">
          <Button
            asChild
            className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
          >
            <a href="/login">
              <User className="w-5 h-5 ml-2" />
              כניסה לחשבון
            </a>
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full h-12 text-lg border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <a href="/signup">
              <UserPlus className="w-5 h-5 ml-2" />
              יצירת חשבון חדש
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
