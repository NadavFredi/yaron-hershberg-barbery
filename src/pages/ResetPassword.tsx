import { ResetPassword } from '@/components/auth/ResetPassword';
import logoImage from '@/assets/logo.png';

const ResetPasswordPage = () => {
    return (
        <div className="pt-4 px-4">
            <div className="max-w-md mx-auto">
                <div className="text-center mb-4">
                    <div className="w-48 h-48 mx-auto mb-3">
                        <img src={logoImage} alt="Yaron Hershberg Logo" className="w-full h-full object-contain" />
                    </div>
                </div>
                <ResetPassword
                    onBackToSignIn={() => { }}
                />
            </div>
        </div>
    );
};

export default ResetPasswordPage;
