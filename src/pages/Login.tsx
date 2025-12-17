import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignIn } from '@/components/auth/SignIn';
import logoImage from '@/assets/logo.jpeg';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useManagerRole } from '@/hooks/useManagerRole';

const Login = () => {
    const navigate = useNavigate();
    const { user, hasInitialized } = useSupabaseAuth();
    const { isManager, isLoading: isManagerLoading } = useManagerRole();

    useEffect(() => {
        // Wait for auth and manager role to initialize
        if (!hasInitialized || isManagerLoading) {
            return;
        }

        // If user is logged in, redirect based on role
        if (user) {
            if (isManager) {
                // Admin/Manager - redirect to manager board
                navigate('/manager', { replace: true });
            } else {
                // Regular user - redirect to appointments page
                navigate('/appointments', { replace: true });
            }
        }
        // If not logged in, let them stay on login page
    }, [user, hasInitialized, isManager, isManagerLoading, navigate]);

    return (
        <div className="pt-4 px-4">
            <div className="max-w-md mx-auto">
                <div className="text-center mb-4">
                    <div className="w-20 h-20 mx-auto mb-3">
                        <img src={logoImage} alt="Yaron Hershberg Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Yaron Hershberg</h1>
                    <p className="text-gray-600">מספרת לקוחות מקצועית</p>
                </div>
                <SignIn
                    onSwitchToSignUp={() => { }}
                    onSwitchToResetPassword={() => { }}
                    onUserOnboarding={(email) => { }}
                />
            </div>
        </div>
    );
};

export default Login;
