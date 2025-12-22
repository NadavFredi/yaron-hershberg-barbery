import React from "react"

export function AppFooter() {
    return (
        <footer className="mt-10" dir="rtl">
            <a
                href="https://easyflow.co.il"
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-background text-foreground border-t border-border hover:bg-background/95 transition-colors cursor-pointer"
            >
                <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
                    <div className="flex items-center gap-3 md:flex-row">
                        <img
                            src="/easyflow-logo.png"
                            alt="Easyflow logo"
                            className="h-16 w-auto md:h-20"
                            style={{
                                mixBlendMode: 'multiply'
                            }}
                        />
                        <div className="text-right text-sm md:text-base">
                            <p className="font-semibold">Easy Flow</p>
                            <p className="text-xs opacity-90 md:text-sm">
                                פתרונות טכנולוגיים, אוטומציה, וCRM לעסקים חכמים
                            </p>
                        </div>
                    </div>
                    <span className="text-sm font-medium underline-offset-4 hover:underline md:text-base">
                        Easyflow.co.il
                    </span>
                </div>
            </a>
        </footer>
    )
}
