import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignUp } from '@/components/auth/SignUp';
import logoImage from '@/assets/logo.png';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useManagerRole } from '@/hooks/useManagerRole';

const SignUpPage = () => {
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
                // Regular user - redirect to setup appointment page
                navigate('/setup-appointment', { replace: true });
            }
        }
        // If not logged in, let them stay on signup page
    }, [user, hasInitialized, isManager, isManagerLoading, navigate]);

    return (
        <div className="pt-4 px-4">
            <div className="max-w-md mx-auto">
                <div className="text-center mb-4">
                    <div className="w-48 h-48 mx-auto mb-3">
                        <img src={logoImage} alt="Yaron Hershberg Logo" className="w-full h-full object-contain" />
                    </div>
                </div>
                <SignUp
                    onSwitchToSignIn={() => { }}
                />
            </div>
        </div>
    );
};

export default SignUpPage;
