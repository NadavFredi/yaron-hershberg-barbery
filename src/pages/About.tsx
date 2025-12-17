import { Link } from "react-router-dom"
import { Button } from "../components/ui/button.tsx"
import { Card, CardContent } from "../components/ui/card.tsx"
import { Play, Scissors, Sparkles, Heart, HelpCircle, Store, Camera, UserCheck, Leaf, Clock, GraduationCap, Star } from "lucide-react"
import logoImage from "../assets/logo.jpeg"

export default function About() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50" dir="rtl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">


                {/* Main Heading Section */}
                <section className="mb-16">
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-3xl p-8 md:p-12">
                        <div className="text-center space-y-4">
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold ">
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
                <section className="mb-16 space-y-8">
                    {/* Main About Card */}
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-3xl p-8 md:p-12">
                        <CardContent className="p-0">
                            <div className="flex items-center justify-center gap-3 mb-8">
                                <div className="p-3 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full">
                                    <Store className="h-8 w-8 text-amber-600" />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                                    אודות ירון הרשברג
                                </h2>
                            </div>

                            <div className="space-y-6 text-right">
                                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border-r-4 border-amber-400">
                                    <p className="text-xl md:text-2xl font-bold text-gray-900 mb-4">
                                        "מספרה יוצאת דופן" – בוטיק ייחודי ברמת גן לבריאות הקרקפת והשיער.
                                    </p>
                                </div>

                                <p className="text-base md:text-lg leading-relaxed text-gray-700">
                                    הוקם על-ידי ירון הרשברג, מעצב שיער וכימאי משנת 2001, ובשנים האחרונות גם טריקולוג מוסמך לאבחון וטיפול בבעיות קרקפת בשיטה טבעית ולא פולשנית.
                                </p>

                                <p className="text-base md:text-lg leading-relaxed text-gray-700">
                                    הבוטיק מציע עיצוב שיער מוקפד לצד טיפולי קרקפת מקצועיים ומתקדמים – שילוב נדיר שנותן מענה אמיתי מהשורש ועד הקצוות, מעטפת הכרחית לשיער בריא ומראה מושלם.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Why We're Unique Section */}
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-3xl p-8 md:p-12">
                        <CardContent className="p-0">
                            <div className="flex items-center justify-center gap-3 mb-10">
                                <div className="p-3 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full">
                                    <Star className="h-8 w-8 text-purple-600" />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                                    למה אנחנו יוצאי דופן
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Feature 1 */}
                                <div className="flex gap-4 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl hover:shadow-lg transition-shadow">
                                    <div className="flex-shrink-0">
                                        <div className="p-3 bg-blue-100 rounded-full">
                                            <Camera className="h-6 w-6 text-blue-600" />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            אבחון מקצועי מבוסס ידע ונסיון
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            בשילוב מצלמת קרקפת מתקדמת לפני כל טיפול.
                                        </p>
                                    </div>
                                </div>

                                {/* Feature 2 */}
                                <div className="flex gap-4 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl hover:shadow-lg transition-shadow">
                                    <div className="flex-shrink-0">
                                        <div className="p-3 bg-purple-100 rounded-full">
                                            <UserCheck className="h-6 w-6 text-purple-600" />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            טיפולים מותאמים אישית
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            לכל לקוח/ה פרוטוקול ייחודי מותאם אישית לקרקפת ולשיער.
                                        </p>
                                    </div>
                                </div>

                                {/* Feature 3 */}
                                <div className="flex gap-4 p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl hover:shadow-lg transition-shadow">
                                    <div className="flex-shrink-0">
                                        <div className="p-3 bg-green-100 rounded-full">
                                            <Leaf className="h-6 w-6 text-green-600" />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            מוצרי פרימיום
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            אורגנים, ללא SLS, מלחים או חומרים משמרים, ולא נוסו על בעלי חיים.
                                        </p>
                                    </div>
                                </div>

                                {/* Feature 4 */}
                                <div className="flex gap-4 p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl hover:shadow-lg transition-shadow">
                                    <div className="flex-shrink-0">
                                        <div className="p-3 bg-orange-100 rounded-full">
                                            <Clock className="h-6 w-6 text-orange-600" />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            זמינות וגמישות
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            פתוחים עד חצות כדי להתאים ללוח הזמנים שלכם.
                                        </p>
                                    </div>
                                </div>

                                {/* Feature 5 */}
                                <div className="flex gap-4 p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl hover:shadow-lg transition-shadow">
                                    <div className="flex-shrink-0">
                                        <div className="p-3 bg-indigo-100 rounded-full">
                                            <GraduationCap className="h-6 w-6 text-indigo-600" />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            מומחיות אמיתית
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            ניסיון של מעל 20 שנה בעיצוב שיער לצד הסמכה בינלאומית בטריקולוגיה.
                                        </p>
                                    </div>
                                </div>

                                {/* Feature 6 */}
                                <div className="flex gap-4 p-6 bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl hover:shadow-lg transition-shadow">
                                    <div className="flex-shrink-0">
                                        <div className="p-3 bg-rose-100 rounded-full">
                                            <Heart className="h-6 w-6 text-rose-600" />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            חוויית שירות גבוהה
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            אווירה נעימה, יחס אישי וליווי מקצועי.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Closing Statement */}
                            <div className="mt-10 text-center">
                                <div className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl px-8 py-4">
                                    <Heart className="h-6 w-6 text-rose-500" />
                                    <p className="text-lg font-semibold text-gray-800">
                                        אנחנו מאמינים שלשיער ולקרקפת שלכם מגיעה חוויה יוצאת דופן – ואם נפגשנו, זה בהחלט לא במקרה
                                    </p>
                                </div>
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
