import { Link } from "react-router-dom"
import { Button } from "../components/ui/button.tsx"
import { Card, CardContent } from "../components/ui/card.tsx"
import { Play, Scissors, Sparkles, Heart, HelpCircle } from "lucide-react"
import logoImage from "../assets/logo.jpeg"

export default function About() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50" dir="rtl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header with Logo */}
                <header className="text-center mb-16">
                    <div className="flex items-center justify-center gap-4 mb-4">
                        <img 
                            src={logoImage} 
                            alt="Yaron Hershberg Logo" 
                            className="h-16 w-16 object-contain"
                        />
                        <div className="text-right">
                            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                                YARON HERSHBERG
                            </h1>
                            <p className="text-sm md:text-base text-gray-600 mt-1">
                                HAIR BOUTIQUE | EST.2001
                            </p>
                        </div>
                    </div>
                </header>

                {/* Main Heading Section */}
                <section className="mb-16">
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-3xl p-8 md:p-12">
                        <div className="text-center space-y-4">
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-amber-700">
                                סובלים מנשירה או בעיות קרקפת?
                            </h2>
                            <p className="text-xl md:text-2xl text-gray-800 font-medium">
                                אבחון טיפול וליווי מקצועי
                            </p>
                            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
                                לא בטוחים מה הבעיה? אבחון מקצועי עושה סדר.
                            </p>
                        </div>
                    </Card>
                </section>

                {/* Services Grid */}
                <section className="mb-16">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Service Card 1 - Scalp Diagnosis (Top Left) */}
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0 rounded-2xl p-6 hover:shadow-xl transition-shadow min-h-[200px]">
                            <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center">
                                <div className="p-3 bg-amber-100 rounded-full mb-4">
                                    <Heart className="h-6 w-6 text-amber-600" />
                                </div>
                                <p className="text-lg font-semibold text-gray-900 mb-2">
                                    אבחון וטיפולי קרקפת
                                </p>
                                <p className="text-sm text-gray-600">
                                    עבור נשים / גברים
                                </p>
                            </CardContent>
                        </Card>

                        {/* Service Card 2 - Hair Restoration (Top Middle) */}
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0 rounded-2xl p-6 hover:shadow-xl transition-shadow min-h-[200px]">
                            <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center">
                                <div className="p-3 bg-purple-100 rounded-full mb-4">
                                    <Sparkles className="h-6 w-6 text-purple-600" />
                                </div>
                                <p className="text-lg font-semibold text-gray-900">
                                    שיקום וטיפולי שיער
                                </p>
                            </CardContent>
                        </Card>

                        {/* Service Card 3 - Color/Haircut (Top Right) */}
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0 rounded-2xl p-6 hover:shadow-xl transition-shadow min-h-[200px]">
                            <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center">
                                <div className="p-3 bg-blue-100 rounded-full mb-4">
                                    <Scissors className="h-6 w-6 text-blue-600" />
                                </div>
                                <p className="text-lg font-semibold text-gray-900">
                                    צבע, גוונים תספורת וטיפולי מספרה
                                </p>
                            </CardContent>
                        </Card>

                        {/* FAQ Card (Bottom Left) */}
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0 rounded-2xl p-6 hover:shadow-xl transition-shadow md:col-span-2 lg:col-span-1 min-h-[200px]">
                            <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center">
                                <div className="p-3 bg-green-100 rounded-full mb-4">
                                    <HelpCircle className="h-6 w-6 text-green-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-6">
                                    שאלות שחשוב לדעת
                                </h3>
                                <ul className="space-y-3 w-full">
                                    <li className="text-base text-gray-700">
                                        עם איזה חומרים אתם משתמשים?
                                    </li>
                                    <li className="text-base text-gray-700">
                                        כמה זמן כל טיפול?
                                    </li>
                                    <li className="text-base text-gray-700">
                                        מתי רואים הטבה?
                                    </li>
                                    <li className="text-base text-gray-700">
                                        כמה טיפולים צריך?
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        {/* Video Card 1 (Bottom Middle) */}
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0 rounded-2xl p-6 hover:shadow-xl transition-shadow min-h-[200px]">
                            <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center">
                                <div className="p-3 bg-red-100 rounded-full mb-4">
                                    <Play className="h-6 w-6 text-red-600" />
                                </div>
                                <p className="text-lg font-semibold text-gray-900 mb-2">
                                    סרטון לפני ואחרי
                                </p>
                                <p className="text-sm text-gray-500">
                                    YouTube video
                                </p>
                            </CardContent>
                        </Card>

                        {/* Video Card 2 (Bottom Right) */}
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0 rounded-2xl p-6 hover:shadow-xl transition-shadow min-h-[200px]">
                            <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center">
                                <div className="p-3 bg-red-100 rounded-full mb-4">
                                    <Play className="h-6 w-6 text-red-600" />
                                </div>
                                <p className="text-lg font-semibold text-gray-900 mb-2">
                                    סרטון לפני ואחרי
                                </p>
                                <p className="text-sm text-gray-500">
                                    YouTube video
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                {/* About Section */}
                <section className="mb-16">
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-3xl p-8 md:p-12">
                        <CardContent className="p-0">
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
                                אודות ירון הרשברג
                            </h2>
                            <div className="prose prose-lg max-w-none text-gray-700 text-right space-y-4">
                                <p className="text-base md:text-lg leading-relaxed">
                                    ירון הרשברג הוא מומחה מוביל בתחום הטיפול בשיער וקרקפת, עם ניסיון של למעלה מ-20 שנה. 
                                    המספרה שלו, שהוקמה בשנת 2001, מציעה שירותים מקצועיים ומתקדמים לטיפול בכל בעיות השיער והקרקפת.
                                </p>
                                <p className="text-base md:text-lg leading-relaxed">
                                    עם גישה אישית ומותאמת לכל לקוח, ירון מספק אבחון מקצועי, טיפולים מתקדמים וליווי צמוד 
                                    לאורך כל תהליך הטיפול. המספרה מציעה מגוון רחב של שירותים כולל צבע, גוונים, תספורות, 
                                    טיפולי שיקום שיער ואבחון מקצועי של בעיות קרקפת.
                                </p>
                                <p className="text-base md:text-lg leading-relaxed">
                                    המחויבות שלנו היא לספק לכם את הטיפול הטוב ביותר, תוך שימוש בחומרים איכותיים וטכניקות 
                                    מתקדמות. כל טיפול מותאם אישית לצרכים שלכם, ואנחנו כאן כדי ללוות אתכם בכל שלב בדרך 
                                    לשיער בריא ויפה.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Call to Action */}
                <section className="text-center">
                    <Card className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-2xl border-0 rounded-3xl p-8 md:p-12">
                        <CardContent className="p-0">
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
                                מוכנים להתחיל?
                            </h2>
                            <p className="text-lg text-blue-50 mb-8 max-w-2xl mx-auto">
                                קבעו תור לאבחון וטיפול ראשון וקבלו ייעוץ מקצועי מותאם אישית
                            </p>
                            <Button
                                asChild
                                size="lg"
                                className="bg-white text-blue-600 hover:bg-blue-50 text-lg px-8 py-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                            >
                                <Link to="/setup-appointment">
                                    קבעו תור עכשיו
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </section>
            </div>
        </div>
    )
}
