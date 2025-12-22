
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { User, UserPlus, Loader2 } from 'lucide-react';
import logoImage from '@/assets/logo.png';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useManagerRole } from '@/hooks/useManagerRole';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const navigate = useNavigate();
  const { user, hasInitialized } = useSupabaseAuth();
  const { isManager, isLoading: isManagerLoading } = useManagerRole();
  const [isWorker, setIsWorker] = useState<boolean | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  // Check if user is a worker
  useEffect(() => {
    const checkWorkerRole = async () => {
      if (!hasInitialized) {
        setIsCheckingRole(true);
        return;
      }

      if (!user?.id) {
        setIsWorker(false);
        setIsCheckingRole(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          setIsWorker(false);
        } else {
          setIsWorker(data?.role === 'worker');
        }
      } catch (_error) {
        setIsWorker(false);
      } finally {
        setIsCheckingRole(false);
      }
    };

    checkWorkerRole();
  }, [user?.id, hasInitialized]);

  // Redirect logic when user is logged in
  useEffect(() => {
    // Wait for all checks to complete
    if (!hasInitialized || isManagerLoading || isCheckingRole) {
      return;
    }

    // Only redirect if user is logged in
    if (user) {
      // If user is manager or worker, redirect to manager page
      if (isManager || isWorker) {
        navigate('/manager', { replace: true });
      } else {
        // Otherwise, redirect to setup appointment page
        navigate('/setup-appointment', { replace: true });
      }
    }
  }, [user, hasInitialized, isManager, isManagerLoading, isWorker, isCheckingRole, navigate]);

  // Show loading state while checking auth and roles
  if (!hasInitialized || isManagerLoading || isCheckingRole) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-80 mx-auto mb-4">
              <img 
                src={logoImage} 
                alt="Yaron Hershberg Logo" 
                className="w-full h-auto object-contain mix-blend-multiply" 
                style={{ filter: 'contrast(1.1)' }}
              />
            </div>
            <div className="flex items-center justify-center gap-2 text-gray-500 mb-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>טוען...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If user is logged in, don't show the landing page (redirect will happen)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-80 mx-auto mb-4">
            <img 
              src={logoImage} 
              alt="Yaron Hershberg Logo" 
              className="w-full h-auto object-contain mix-blend-multiply" 
              style={{ filter: 'contrast(1.1)' }}
            />
          </div>
          <p className="text-gray-500 mb-8">ברוכים הבאים למערכת הזימון תורים שלנו</p>
        </div>

        <div className="space-y-4">
          <Button
            asChild
            className="w-full h-12 text-lg bg-primary hover:bg-primary/90"
          >
            <a href="/login">
              <User className="w-5 h-5 ml-2" />
              כניסה לחשבון
            </a>
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full h-12 text-lg border-2 border-primary text-primary hover:bg-primary/10"
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
