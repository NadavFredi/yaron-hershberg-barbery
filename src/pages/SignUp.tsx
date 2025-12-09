import { SignUp } from '@/components/auth/SignUp';
import logoImage from '@/assets/logo.jpeg';

const SignUpPage = () => {
    return (
        <div className="pt-4 px-4">
            <div className="max-w-md mx-auto">
                <div className="text-center mb-4">
                    <div className="w-20 h-20 mx-auto mb-3">
                        <img src={logoImage} alt="Yaron Hershberg Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Yaron Hershberg</h1>
                    <p className="text-gray-600">מספרת כלבים מקצועית</p>
                </div>
                <SignUp
                    onSwitchToSignIn={() => { }}
                />
            </div>
        </div>
    );
};

export default SignUpPage;
