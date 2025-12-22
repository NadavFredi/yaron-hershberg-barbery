import { Link } from "react-router-dom"
import { Card, CardContent } from "../components/ui/card.tsx"
import { Button } from "../components/ui/button.tsx"
import { Heart, CheckCircle, ArrowRight, ChevronLeft } from "lucide-react"

export default function ScalpTreatments() {

    return (
        <div className="min-h-screen  from-slate-50 via-primary/10 to-primary/10" dir="rtl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Breadcrumb */}
                <nav className="mb-8">
                    <ol className="flex items-center gap-2 text-sm text-foreground/80">
                        <li>
                            <Link to="/about" className="hover:text-primary transition-colors">
                                אודות
                            </Link>
                        </li>
                        <li>
                            <ChevronLeft className="h-4 w-4" />
                        </li>
                        <li className="text-foreground font-medium">
                            אבחון וטיפולי קרקפת
                        </li>
                    </ol>
                </nav>

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center gap-3 mb-6">
                        <div className="p-3 bg-amber-100 rounded-full">
                            <Heart className="h-8 w-8 text-amber-600" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-semibold text-foreground">
                            אבחון וטיפולי קרקפת
                        </h1>
                    </div>
                    <p className="text-xl text-foreground/90 font-medium">
                        עבור נשים / גברים
                    </p>
                </div>

                {/* Shared Information Section */}
                <section className="mb-12">
                    <Card className="bg-card shadow-xl border border-border rounded-3xl p-8 md:p-12">
                        <CardContent className="p-0">
                            <div className="space-y-8">
                                {/* Introduction */}
                                <div className=" from-primary/20 to-indigo-100 rounded-2xl p-6 border-r-4 border-primary">
                                    <p className="text-lg md:text-xl text-card-foreground font-medium leading-relaxed">
                                        לפני התאמת טיפול מתחילים באבחון קרקפת מקצועי עם ירון-טריקולוג מוסמך
                                    </p>
                                </div>

                                {/* Two Column Layout for Diagnosis and Treatments */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Diagnosis Section - Left Column */}
                                    <div>
                                        <h3 className="text-2xl font-semibold text-card-foreground mb-4">
                                            האבחון כולל:
                                        </h3>
                                        <ul className="space-y-3">
                                            <li className="flex items-start gap-3">
                                                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                                <span className="text-base md:text-lg text-card-foreground/90">
                                                    בדיקת קרקפת עם מצלמה מיקרוסקופית
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                                <span className="text-base md:text-lg text-card-foreground/90">
                                                    זיהוי שורש הבעיה
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                                <span className="text-base md:text-lg text-card-foreground/90">
                                                    התאמת תכנית טיפול
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                                <span className="text-base md:text-lg text-card-foreground/90">
                                                    המלצה על מוצרים משלימים
                                                </span>
                                            </li>
                                        </ul>
                                    </div>

                                    {/* Treatments Section - Right Column */}
                                    <div>
                                        <h3 className="text-2xl font-semibold text-card-foreground mb-4">
                                            הטיפולים כוללים:
                                        </h3>
                                        <ul className="space-y-3">
                                            <li className="flex items-start gap-3">
                                                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                                <span className="text-base md:text-lg text-card-foreground/90">
                                                    פילינג מותאם על בסיס טבעי ואורגני לניקוי ואיזון הקרקפת
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                                <span className="text-base md:text-lg text-card-foreground/90">
                                                    שימוש בתאי גזע צמחיים לחיזוק ולעידוד צמיחה
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                                <span className="text-base md:text-lg text-card-foreground/90">
                                                    הטיפולים נעימים, בטוחים ואינם פולשניים.
                                                </span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Pricing Cards - Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
                    {/* Women Pricing Card */}
                    <Card className="bg-card shadow-xl border border-border rounded-3xl p-8 md:p-12">
                        <CardContent className="p-0">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-red-100 rounded-full">
                                    <Heart className="h-6 w-6 text-red-600" />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-semibold text-card-foreground">
                                    עלויות לנשים
                                </h2>
                            </div>

                            <div className="space-y-6">
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-3">
                                        <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-base md:text-lg text-gray-800 font-medium">
                                            אבחון + סדרת 6 טיפולי קרקפת – <span className="text-primary font-bold">2,700₪</span>
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-base md:text-lg text-gray-800 font-medium">
                                            אבחון + טיפול בודד <span className="text-primary font-bold">750₪</span>
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-3 mt-4">
                                        <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-base md:text-lg text-gray-800">
                                            <span className="font-semibold">מומלץ לאחר הסדרת טיפולים</span>
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-base md:text-lg text-gray-800 font-medium">
                                            אבחון ללא טיפול <span className="text-primary font-bold">250₪</span>
                                        </span>
                                    </li>
                                </ul>

                                {/* Call to Action Button */}
                                <div className="pt-4">
                                    <Button
                                        asChild
                                        size="lg"
                                        className="w-full bg-primary hover:bg-primary/90 text-white text-lg px-8 py-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                                    >
                                        <Link to="/setup-appointment" className="flex items-center justify-center gap-2">
                                            קבעו תור לאבחון וטיפול
                                            <ArrowRight className="h-5 w-5" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Men Pricing Card */}
                    <Card className="bg-card shadow-xl border border-border rounded-3xl p-8 md:p-12">
                        <CardContent className="p-0">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-primary/20 rounded-full">
                                    <Heart className="h-6 w-6 text-primary" />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-semibold text-card-foreground">
                                    עלויות לגברים
                                </h2>
                            </div>

                            <div className="space-y-6">
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-3">
                                        <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-base md:text-lg text-gray-800 font-medium">
                                            אבחון + סדרת 6 טיפולי קרקפת – <span className="text-primary font-bold">2,400₪</span>
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-base md:text-lg text-gray-800 font-medium">
                                            אבחון + טיפול בודד <span className="text-primary font-bold">700₪</span>
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-3 mt-4">
                                        <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-base md:text-lg text-gray-800">
                                            <span className="font-semibold">מומלץ לאחר הסדרת טיפולים</span>
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-base md:text-lg text-gray-800 font-medium">
                                            אבחון ללא טיפול <span className="text-primary font-bold">250₪</span>
                                        </span>
                                    </li>
                                </ul>

                                {/* Call to Action Button */}
                                <div className="pt-4">
                                    <Button
                                        asChild
                                        size="lg"
                                        className="w-full bg-primary hover:bg-primary/90 text-white text-lg px-8 py-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                                    >
                                        <Link to="/setup-appointment" className="flex items-center justify-center gap-2">
                                            קבעו תור לאבחון וטיפול
                                            <ArrowRight className="h-5 w-5" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
