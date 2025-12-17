import { Link } from "react-router-dom"
import { Card, CardContent } from "../components/ui/card.tsx"
import { Button } from "../components/ui/button.tsx"
import { Heart, Camera, CheckCircle, ArrowRight } from "lucide-react"

export default function ScalpTreatments() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50" dir="rtl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center gap-3 mb-6">
                        <div className="p-3 bg-amber-100 rounded-full">
                            <Heart className="h-8 w-8 text-amber-600" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                            אבחון וטיפולי קרקפת
                        </h1>
                    </div>
                    <p className="text-xl text-gray-600">
                        עבור נשים / גברים
                    </p>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
                {/* Women Section */}
                <section>
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-3xl p-8 md:p-12">
                        <CardContent className="p-0">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-pink-100 rounded-full">
                                    <Heart className="h-6 w-6 text-pink-600" />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                                    עבור נשים
                                </h2>
                            </div>

                            <div className="space-y-8">
                                {/* Introduction */}
                                <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-6 border-r-4 border-pink-400">
                                    <p className="text-lg md:text-xl text-gray-800 leading-relaxed">
                                        לפני התאמת טיפול מתחילים באבחון קרקפת מקצועי עם ירון-טריקולוג מוסמך
                                    </p>
                                </div>

                                {/* Diagnosis Section */}
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                                        האבחון כולל:
                                    </h3>
                                    <ul className="space-y-3">
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                בדיקת קרקפת עם מצלמה מיקרוסקופית
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                זיהוי שורש הבעיה
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                התאמת תכנית טיפול
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                המלצה על מוצרים משלימים
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Treatments Section */}
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                                        הטיפולים כוללים:
                                    </h3>
                                    <ul className="space-y-3">
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                פילינג על בסיס טבעי ואורגני לניקוי ואיזון הקרקפת
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                ספא-מיסט מכשור אדים ייחודי המפחית גירויים
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                שימוש בתאי גזע צמחיים לחיזוק ולעידוד צמיחה
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                ליווי מקצועי ומעקב אישי לאורך כל הדרך
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                הטיפולים נעימים, בטוחים ואינם פולשניים.
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                מספר הטיפולים הדרוש נקבע באבחון לפי חומרת המצב.
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Pricing Section */}
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border-r-4 border-blue-400">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                                        עלויות לנשים:
                                    </h3>
                                    <ul className="space-y-3">
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800 font-medium">
                                                אבחון + סדרת 6 טיפולי קרקפת – <span className="text-blue-700 font-bold">2,700₪</span>
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800 font-medium">
                                                אבחון + טיפול בודד <span className="text-blue-700 font-bold">750₪</span>
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3 mt-4">
                                            <CheckCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800">
                                                <span className="font-semibold">מומלץ לאחר הסדרת טיפולים</span>
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800 font-medium">
                                                אבחון ללא טיפול <span className="text-blue-700 font-bold">250₪</span>
                                            </span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Men Section */}
                <section>
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-3xl p-8 md:p-12">
                        <CardContent className="p-0">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-blue-100 rounded-full">
                                    <Camera className="h-6 w-6 text-blue-600" />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                                    עבור גברים
                                </h2>
                            </div>

                            <div className="space-y-8">
                                {/* Introduction */}
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border-r-4 border-blue-400">
                                    <p className="text-lg md:text-xl text-gray-800 leading-relaxed">
                                        לפני התאמת טיפול מתחילים באבחון קרקפת מקצועי עם ירון-טריקולוג מוסמך
                                    </p>
                                </div>

                                {/* Diagnosis Section */}
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                                        האבחון כולל:
                                    </h3>
                                    <ul className="space-y-3">
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                בדיקת קרקפת עם מצלמה מיקרוסקופית
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                זיהוי שורש הבעיה
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                התאמת תכנית טיפול
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                המלצה על מוצרים משלימים
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Treatments Section */}
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                                        הטיפולים כוללים:
                                    </h3>
                                    <ul className="space-y-3">
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                פילינג מותאם על בסיס טבעי ואורגני לניקוי ואיזון הקרקפת
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                ספא-מיסט מכשור אדים ייחודי המפחית גירויים
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                שימוש בתאי גזע צמחיים לחיזוק ולעידוד צמיחה
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                ליווי מקצועי ומעקב אישי לאורך כל הדרך
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                הטיפולים נעימים, בטוחים ואינם פולשניים.
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-700">
                                                מספר הטיפולים הדרוש נקבע באבחון לפי חומרת המצב.
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Pricing Section */}
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border-r-4 border-blue-400">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                                        עלויות לגברים:
                                    </h3>
                                    <ul className="space-y-3">
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800 font-medium">
                                                אבחון + סדרת 6 טיפולי קרקפת – <span className="text-blue-700 font-bold">2,400₪</span>
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800 font-medium">
                                                אבחון + טיפול בודד <span className="text-blue-700 font-bold">700₪</span>
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3 mt-4">
                                            <CheckCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800">
                                                <span className="font-semibold">מומלץ לאחר הסדרת טיפולים</span>
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-base md:text-lg text-gray-800 font-medium">
                                                אבחון ללא טיפול <span className="text-blue-700 font-bold">250₪</span>
                                            </span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>
                </div>

                {/* Call to Action */}
                <div className="text-center">
                    <Button
                        asChild
                        size="lg"
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 text-lg px-8 py-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                    >
                        <Link to="/setup-appointment" className="flex items-center gap-2">
                            קבעו תור לאבחון וטיפול
                            <ArrowRight className="h-5 w-5" />
                        </Link>
                    </Button>
                </div>

                {/* Back Link */}
                <div className="text-center mt-8">
                    <Link
                        to="/about"
                        className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-2"
                    >
                        <ArrowRight className="h-4 w-4" />
                        חזרה לעמוד אודות
                    </Link>
                </div>
            </div>
        </div>
    )
}

