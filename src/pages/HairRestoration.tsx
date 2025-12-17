import { Link } from "react-router-dom"
import { Card, CardContent } from "../components/ui/card.tsx"
import { Button } from "../components/ui/button.tsx"
import { Sparkles, CheckCircle, ArrowRight, ChevronLeft, Info } from "lucide-react"

export default function HairRestoration() {
    const primaryColor = "#4f60a8"

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50" dir="rtl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Breadcrumb */}
                <nav className="mb-8">
                    <ol className="flex items-center gap-2 text-sm text-gray-600">
                        <li>
                            <Link to="/about" className="hover:text-blue-600 transition-colors">
                                אודות
                            </Link>
                        </li>
                        <li>
                            <ChevronLeft className="h-4 w-4" />
                        </li>
                        <li className="text-gray-900 font-medium">
                            שיקום וטיפולי שיער
                        </li>
                    </ol>
                </nav>

                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl text-gray-900 mb-4">
                        שיקום וטיפולי שיער
                    </h1>
                </div>

                {/* Main Information Section */}
                <section className="mb-12">
                    <Card className="bg-white shadow-xl border border-gray-200 rounded-3xl p-8 md:p-12">
                        <CardContent className="p-0">
                            <div className="space-y-8">
                                {/* Who is it suitable for */}
                                <div>
                                    <h3 className="text-2xl text-gray-900 mb-4">
                                        שיקום וטיפולי שיער למי מתאים?
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <p className="text-base md:text-lg text-gray-800 leading-relaxed">
                                                שיקום שיער מתאים לשיער יבש, פגום או חלש, במיוחד לאחר תהליכים כימיים.
                                            </p>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <p className="text-base md:text-lg text-gray-800 leading-relaxed">
                                                הטיפול אינו מתאים למי שסובלת מבעיות בקרקפת כגון גירויים, קשקשים או שומניות יתר, 
                                                ובמקרים אלו יש לטפל תחילה בקרקפת באמצעות טיפולים ייעודיים.
                                            </p>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <p className="text-base md:text-lg text-gray-800 leading-relaxed">
                                                לפני תחילת תהליך השיקום, חשוב לבצע אבחון מקצועי לשיער ולקרקפת, 
                                                על מנת להתאים את הטיפול המדויק ביותר לצרכים האישיים שלך.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Difference from straightening treatments */}
                                <div>
                                    <h3 className="text-2xl text-gray-900 mb-4">
                                        מה ההבדל מטיפולי החלקה?
                                    </h3>
                                    <div className="space-y-3">
                                        <p className="text-base md:text-lg text-gray-800 leading-relaxed">
                                            טיפולי החלקה או קרטין מעניקים לשיער מראה חלק ומסודר,
                                            אך אינם נחשבים לשיקום שיער עמוק.
                                        </p>
                                        <p className="text-base md:text-lg text-gray-800 leading-relaxed">
                                            אלו טיפולים שתמצאי בקטגוריית שירותי מספרה, ומטרתם תוצאה מיידית וקוסמטית.
                                        </p>
                                        <p className="text-base md:text-lg text-gray-800 leading-relaxed">
                                            שיקום שיער אמיתי מתמקד בבריאות סיב השערה לאורך זמן.
                                        </p>
                                    </div>
                                </div>

                                {/* Treatment Components */}
                                <div>
                                    <h3 className="text-2xl text-gray-900 mb-4">
                                        מה כולל הטיפול?
                                    </h3>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800">
                                                שימוש בפרוטאין טהור
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800">
                                                חלבונים מן הצומח
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800">
                                                קרטין צמחי
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800">
                                                תמציות צמחים ושמנים אורגניים
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3 md:col-span-2">
                                            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800">
                                                מכשיר הספא מיסט שמחדיר לחות באמצעות כובע האדים הידוע
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Treatment Process */}
                                <div>
                                    <p className="text-base md:text-lg text-gray-800 leading-relaxed">
                                        זהו תהליך טיפולי שמבוסס על אבחון מקצועי, התאמה אישית ועבודה מדורגת,
                                        ולא על פתרון חד־פעמי או זמני.
                                    </p>
                                </div>

                                {/* Benefits */}
                                <div>
                                    <h3 className="text-2xl text-gray-900 mb-4">
                                        באמצעות סדרת טיפולים ייעודיים, ניתן:
                                    </h3>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800">
                                                לחזק מבנה שיער חלש ופגום
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800">
                                                לשפר את איכות ומרקם השיער
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800">
                                                להשיב גמישות, חיוניות ומראה בריא
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800">
                                                להשיג תוצאות יציבות ועמידות לאורך זמן
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Important Note about Process */}
                                <div className="my-8 py-6">
                                    <div className="bg-gray-50 rounded-2xl p-6 border-r-4 border-purple-500">
                                        <p className="text-lg md:text-xl text-gray-900 leading-relaxed text-center">
                                            שיקום שיער מקצועי אינו "קסם של טיפול אחד",
                                            אלא תהליך שמאפשר לשיער להשתקם באמת – מבפנים החוצה.
                                        </p>
                                    </div>
                                </div>

                                {/* Call to Action */}
                                <div className="text-center pt-4">
                                    <Button
                                        asChild
                                        size="lg"
                                        className="text-white text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:opacity-90"
                                        style={{ backgroundColor: primaryColor }}
                                    >
                                        <Link to="/setup-appointment" className="flex items-center justify-center gap-2">
                                            להתאמת סדרת טיפולים נתחיל באבחון
                                            <ArrowRight className="h-5 w-5" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </div>
        </div>
    )
}

