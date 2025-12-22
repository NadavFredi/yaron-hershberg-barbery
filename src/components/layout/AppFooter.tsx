import React from "react"

export function AppFooter() {
    return (
        <footer className="mt-10" dir="rtl">
            <div className="bg-background text-foreground border-t border-border">
                <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-6 md:flex-row">
                    <div className="flex items-center gap-3 md:flex-row">
                        <img
                            src="/easyflow-logo.png"
                            alt="Easyflow logo"
                            className="h-10 w-auto"
                        />
                        <div className="text-right text-sm md:text-base">
                            <p className="font-semibold">Easy Flow</p>
                            <p className="text-xs opacity-90 md:text-sm">
                                פתרונות טכנולוגיים, אוטומציה, וCRM לעסקים חכמים
                            </p>
                        </div>
                    </div>
                    <a
                        href="https://easyflow.co.il"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium underline-offset-4 hover:underline md:text-base"
                    >
                        Easyflow.co.il
                    </a>
                </div>
            </div>
        </footer>
    )
}
