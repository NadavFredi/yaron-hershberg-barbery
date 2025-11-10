import React, { useState } from "react"
import { SignIn } from "./SignIn"
import { SignUp } from "./SignUp"
import { ResetPassword } from "./ResetPassword"
import { UserOnboarding } from "./UserOnboarding"

type AuthView = "signin" | "signup" | "reset" | "onboarding"

export function AuthContainer() {
    const [currentView, setCurrentView] = useState<AuthView>("signin")
    const [userEmail, setUserEmail] = useState<string>("")

    const switchToSignIn = () => setCurrentView("signin")
    const switchToSignUp = () => setCurrentView("signup")
    const switchToResetPassword = () => setCurrentView("reset")
    const switchToUserOnboarding = (email: string) => {
        setUserEmail(email)
        setCurrentView("onboarding")
    }

    switch (currentView) {
        case "signin":
            return (
                <SignIn
                    onSwitchToSignUp={switchToSignUp}
                    onSwitchToResetPassword={switchToResetPassword}
                    onUserOnboarding={switchToUserOnboarding}
                />
            )
        case "signup":
            return <SignUp onSwitchToSignIn={switchToSignIn} />
        case "reset":
            return <ResetPassword onBackToSignIn={switchToSignIn} />
        case "onboarding":
            return <UserOnboarding userEmail={userEmail} onBackToAuth={switchToSignIn} />
        default:
            return (
                <SignIn
                    onSwitchToSignUp={switchToSignUp}
                    onSwitchToResetPassword={switchToResetPassword}
                    onUserOnboarding={switchToUserOnboarding}
                />
            )
    }
}
