import { Link } from "react-router-dom"
import { Button } from "../components/ui/button.tsx"
import { Card, CardContent } from "../components/ui/card.tsx"
import { Dialog, DialogContent } from "../components/ui/dialog.tsx"
import { Play, Scissors, Sparkles, Heart, HelpCircle, Store, Camera, UserCheck, Leaf, Clock, GraduationCap, Star, ChevronRight, ChevronLeft } from "lucide-react"
import heroImage from "../assets/images/hairs_preview.jpeg"
import recommendation1 from "../assets/images/recommendations/1.jpeg"
import recommendation2 from "../assets/images/recommendations/2.jpeg"
import recommendation3 from "../assets/images/recommendations/3.jpeg"
import recommendation4 from "../assets/images/recommendations/4.jpeg"
import recommendation5 from "../assets/images/recommendations/5.jpeg"
import recommendation6 from "../assets/images/recommendations/6.jpeg"
import recommendation7 from "../assets/images/recommendations/7.jpeg"
import recommendation8 from "../assets/images/recommendations/8.jpeg"
import recommendation9 from "../assets/images/recommendations/9.jpeg"
import recommendation10 from "../assets/images/recommendations/10.jpeg"
import useEmblaCarousel from 'embla-carousel-react'
import { useCallback, useEffect, useState, useRef } from "react"

// Image Carousel Component
function ImageCarousel() {
    const images = [
        recommendation1,
        recommendation2,
        recommendation3,
        recommendation4,
        recommendation5,
        recommendation6,
        recommendation7,
        recommendation8,
        recommendation9,
        recommendation10,
    ]

    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: true,
        align: 'start',
        slidesToScroll: 1,
        dragFree: false,
    })

    const [isPlaying, setIsPlaying] = useState(true)
    const [prevBtnDisabled, setPrevBtnDisabled] = useState(true)
    const [nextBtnDisabled, setNextBtnDisabled] = useState(true)
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
    const autoplayIntervalRef = useRef<number | null>(null)

    const scrollPrev = useCallback(() => {
        if (emblaApi) emblaApi.scrollPrev()
    }, [emblaApi])

    const scrollNext = useCallback(() => {
        if (emblaApi) emblaApi.scrollNext()
    }, [emblaApi])

    const onSelect = useCallback(() => {
        if (!emblaApi) return
        setPrevBtnDisabled(!emblaApi.canScrollPrev())
        setNextBtnDisabled(!emblaApi.canScrollNext())
    }, [emblaApi])

    useEffect(() => {
        if (!emblaApi) return
        onSelect()
        emblaApi.on('select', onSelect)
        emblaApi.on('reInit', onSelect)
    }, [emblaApi, onSelect])

    // Custom autoplay implementation
    useEffect(() => {
        if (!emblaApi || !isPlaying) {
            if (autoplayIntervalRef.current) {
                clearInterval(autoplayIntervalRef.current)
                autoplayIntervalRef.current = null
            }
            return
        }

        autoplayIntervalRef.current = setInterval(() => {
            if (emblaApi) {
                emblaApi.scrollNext()
            }
        }, 3000)

        return () => {
            if (autoplayIntervalRef.current) {
                clearInterval(autoplayIntervalRef.current)
            }
        }
    }, [emblaApi, isPlaying])

    const handleImageClick = useCallback((index: number) => {
        setSelectedImageIndex(index)
        setIsPlaying(false)
    }, [])

    // Stop autoplay on user interaction
    useEffect(() => {
        if (!emblaApi) return

        const onPointerDown = () => {
            if (isPlaying) {
                setIsPlaying(false)
            }
        }

        emblaApi.on('pointerDown', onPointerDown)
        return () => {
            emblaApi.off('pointerDown', onPointerDown)
        }
    }, [emblaApi, isPlaying])

    return (
        <div className="relative w-full" dir="ltr">
            <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
                <div className="flex">
                    {images.map((img, index) => (
                        <div
                            key={index}
                            className="flex-[0_0_100%] sm:flex-[0_0_50%] lg:flex-[0_0_33.333%] xl:flex-[0_0_25%] min-w-0 pl-4 first:pl-0"
                        >
                            <div
                                className="relative h-[300px] md:h-[400px] lg:h-[450px] rounded-xl overflow-hidden cursor-pointer group"
                                onClick={() => handleImageClick(index)}
                            >
                                <img
                                    src={img}
                                    alt={`תמונות המלצות ${index + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                                {!isPlaying && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                        <div className="bg-white/90 rounded-full p-3">
                                            <Play className="h-6 w-6 text-primary" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation buttons */}
            <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={scrollPrev}
                disabled={prevBtnDisabled}
                aria-label="Previous image"
            >
                <ChevronRight className="h-5 w-5 text-foreground" />
            </button>
            <button
                type="button"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={scrollNext}
                disabled={nextBtnDisabled}
                aria-label="Next image"
            >
                <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>

            {/* Image Preview Modal */}
            <Dialog open={selectedImageIndex !== null} onOpenChange={(open) => !open && setSelectedImageIndex(null)}>
                <DialogContent className="max-w-7xl w-[95vw] p-0 bg-background/95 backdrop-blur-sm border-0">
                    {selectedImageIndex !== null && (
                        <div className="relative w-full h-[85vh] max-h-[900px] flex items-center justify-center p-4 md:p-8">
                            <img
                                src={images[selectedImageIndex]}
                                alt={`תמונות המלצות ${selectedImageIndex + 1}`}
                                className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default function About() {
    return (
        <div className="min-h-screen from-slate-50 via-primary/10 to-primary/10 relative" dir="rtl">
            {/* Hero Image Section - Absolute Positioned */}
            <section className="absolute top-0 left-0 right-0 w-screen h-[250px] md:h-[300px] lg:h-[350px] overflow-hidden z-0">
                <div className="relative w-full h-full">
                    <img
                        src={heroImage}
                        alt="אבחון מקצועי של קרקפת ושיער"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                </div>
            </section>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-30">
                {/* Main Heading Section */}
                <section className="mb-16 pt-[150px] md:pt-[200px] lg:pt-[250px]">
                    <Card className="bg-card/90 backdrop-blur-sm shadow-xl border-0 rounded-3xl p-8 md:p-12 relative z-30">
                        <div className="text-center space-y-4">
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold ">
                                קרקפת לא מאוזנת דורשת אבחון מקצועי                            </h2>
                            <p className="text-xl md:text-2xl text-card-foreground font-medium">
                                אבחון טריקולוגי  • תהליך מותאם • ליווי אישי
                            </p>
                            <p className="text-base md:text-lg text-card-foreground/80 max-w-2xl mx-auto">
                                לא בטוחים מה הבעיה? אבחון מקצועי עושה סדר.
                            </p>
                        </div>
                    </Card>
                </section>

                {/* Services Grid */}
                <section className="mb-16">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Service Card 1 - Scalp Diagnosis (Top Left) */}
                        <Link to="/scalp-treatments" className="block h-full">
                            <Card className="bg-card/90 backdrop-blur-sm shadow-lg border-0 rounded-2xl p-6 hover:shadow-xl transition-all hover:scale-105 cursor-pointer min-h-[200px] h-full">
                                <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center">
                                    <div className="p-3 bg-primary/20 rounded-full mb-4">
                                        <Heart className="h-6 w-6 text-primary" />
                                    </div>
                                    <p className="text-lg font-semibold text-card-foreground mb-2">
                                        אבחון וטיפולי קרקפת
                                    </p>
                                    <p className="text-sm text-card-foreground/80">
                                        עבור נשים / גברים
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>

                        {/* Service Card 2 - Hair Restoration (Top Middle) */}
                        <Link to="/hair-restoration" className="block h-full">
                            <Card className="bg-card/90 backdrop-blur-sm shadow-lg border-0 rounded-2xl p-6 hover:shadow-xl transition-all hover:scale-105 cursor-pointer min-h-[200px] h-full">
                                <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center">
                                    <div className="p-3 bg-primary/20 rounded-full mb-4">
                                        <Sparkles className="h-6 w-6 text-primary" />
                                    </div>
                                    <p className="text-lg font-semibold text-gray-900">
                                        שיקום וטיפולי שיער
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>

                        {/* Service Card 3 - Color/Haircut (Top Right) */}
                        <Link to="/salon-services" className="block h-full">
                            <Card className="bg-card/90 backdrop-blur-sm shadow-lg border-0 rounded-2xl p-6 hover:shadow-xl transition-all hover:scale-105 cursor-pointer min-h-[200px] h-full">
                                <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center">
                                    <div className="p-3 bg-primary/20 rounded-full mb-4">
                                        <Scissors className="h-6 w-6 text-primary" />
                                    </div>
                                    <p className="text-lg font-semibold text-gray-900">
                                        צבע, גוונים תספורת וטיפולי מספרה
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>



                        {/* Video Card 1 (Bottom Middle) */}
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0 rounded-2xl p-6 hover:shadow-xl transition-shadow min-h-[200px]">
                            <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center">
                                <div className="p-3 bg-primary/20 rounded-full mb-4">
                                    <Play className="h-6 w-6 text-primary" />
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
                        <Link to="/faq" className="block h-full md:col-span-2 lg:col-span-1">
                            <Card className="bg-card/90 backdrop-blur-sm shadow-lg border-0 rounded-2xl p-6 hover:shadow-xl transition-all hover:scale-105 cursor-pointer min-h-[200px] h-full">
                                <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center">
                                    <div className="p-3 bg-primary/20 rounded-full mb-4">
                                        <HelpCircle className="h-6 w-6 text-primary" />
                                    </div>
                                    <h3 className="text-xl font-bold text-card-foreground mb-6">
                                        שאלות שחשוב לדעת
                                    </h3>
                                    <ul className="space-y-3 w-full">
                                        <li className="text-base text-card-foreground/90">
                                            עם איזה חומרים אתם משתמשים?
                                        </li>
                                        <li className="text-base text-card-foreground/90">
                                            כמה זמן כל טיפול?
                                        </li>
                                        <li className="text-base text-card-foreground/90">
                                            מתי רואים הטבה?
                                        </li>
                                        <li className="text-base text-card-foreground/90">
                                            כמה טיפולים צריך?
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </Link>

                        {/* Video Card 2 (Bottom Right) */}
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0 rounded-2xl p-6 hover:shadow-xl transition-shadow min-h-[200px]">
                            <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center">
                                <div className="p-3 bg-primary/20 rounded-full mb-4">
                                    <Play className="h-6 w-6 text-primary" />
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
                    <Card className="bg-card/90 backdrop-blur-sm shadow-xl border-0 rounded-3xl p-8 md:p-12">
                        <CardContent className="p-0">
                            <div className="flex items-center justify-center gap-3 mb-8">
                                <div className="p-3 bg-primary/20 rounded-full">
                                    <Store className="h-8 w-8 text-primary" />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-card-foreground">
                                    אודות ירון הרשברג
                                </h2>
                            </div>

                            <div className="space-y-6 text-right">
                                <div className="bg-primary/10 rounded-2xl p-6 border-r-4 border-primary">
                                    <p className="text-xl md:text-2xl font-bold text-card-foreground mb-4">
                                        "מספרה יוצאת דופן" – בוטיק ייחודי ברמת גן לבריאות הקרקפת והשיער.
                                    </p>
                                </div>

                                <p className="text-base md:text-lg leading-relaxed text-card-foreground/90">
                                    הוקם על-ידי ירון הרשברג, מעצב שיער וכימאי משנת 2001, ובשנים האחרונות גם טריקולוג מוסמך לאבחון וטיפול בבעיות קרקפת בשיטה טבעית ולא פולשנית.
                                </p>

                                <p className="text-base md:text-lg leading-relaxed text-card-foreground/90">
                                    הבוטיק מציע עיצוב שיער מוקפד לצד טיפולי קרקפת מקצועיים ומתקדמים – שילוב נדיר שנותן מענה אמיתי מהשורש ועד הקצוות, מעטפת הכרחית לשיער בריא ומראה מושלם.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recommendations Carousel Card */}
                    <Card className="bg-card/90 backdrop-blur-sm shadow-xl border-0 rounded-3xl p-0 md:p-0 overflow-hidden">
                        <CardContent className="p-0">
                            <ImageCarousel />
                        </CardContent>
                    </Card>

                    {/* Why We're Unique Section */}
                    <Card className="bg-card/90 backdrop-blur-sm shadow-xl border-0 rounded-3xl p-8 md:p-12">
                        <CardContent className="p-0">
                            <div className="flex items-center justify-center gap-3 mb-10">
                                <div className="p-3 bg-primary/20 rounded-full">
                                    <Star className="h-8 w-8 text-primary" />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-card-foreground">
                                    למה אנחנו יוצאי דופן
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Feature 1 */}
                                <div className="flex gap-4 p-6 bg-primary/10 rounded-2xl hover:shadow-lg transition-shadow">
                                    <div className="flex-shrink-0">
                                        <div className="p-3 bg-primary/20 rounded-full">
                                            <Camera className="h-6 w-6 text-primary" />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            אבחון מקצועי מבוסס ידע ונסיון
                                        </h3>
                                        <p className="text-sm text-card-foreground/80">
                                            בשילוב מצלמת קרקפת מתקדמת לפני כל טיפול.
                                        </p>
                                    </div>
                                </div>

                                {/* Feature 2 */}
                                <div className="flex gap-4 p-6 bg-gradient-to-br from-primary/10 to-primary/10 rounded-2xl hover:shadow-lg transition-shadow">
                                    <div className="flex-shrink-0">
                                        <div className="p-3 bg-primary/20 rounded-full">
                                            <UserCheck className="h-6 w-6 text-primary" />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            טיפולים מותאמים אישית
                                        </h3>
                                        <p className="text-sm text-card-foreground/80">
                                            לכל לקוח/ה פרוטוקול ייחודי מותאם אישית לקרקפת ולשיער.
                                        </p>
                                    </div>
                                </div>

                                {/* Feature 3 */}
                                <div className="flex gap-4 p-6 bg-primary/10 rounded-2xl hover:shadow-lg transition-shadow">
                                    <div className="flex-shrink-0">
                                        <div className="p-3 bg-primary/20 rounded-full">
                                            <Leaf className="h-6 w-6 text-primary" />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            מוצרי פרימיום
                                        </h3>
                                        <p className="text-sm text-card-foreground/80">
                                            אורגנים, ללא SLS, מלחים או חומרים משמרים, ולא נוסו על בעלי חיים.
                                        </p>
                                    </div>
                                </div>

                                {/* Feature 4 */}
                                <div className="flex gap-4 p-6 bg-primary/10 rounded-2xl hover:shadow-lg transition-shadow">
                                    <div className="flex-shrink-0">
                                        <div className="p-3 bg-primary/20 rounded-full">
                                            <Clock className="h-6 w-6 text-primary" />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            זמינות וגמישות
                                        </h3>
                                        <p className="text-sm text-card-foreground/80">
                                            פתוחים עד חצות כדי להתאים ללוח הזמנים שלכם.
                                        </p>
                                    </div>
                                </div>

                                {/* Feature 5 */}
                                <div className="flex gap-4 p-6 bg-gradient-to-br from-primary/10 to-primary/10 rounded-2xl hover:shadow-lg transition-shadow">
                                    <div className="flex-shrink-0">
                                        <div className="p-3 bg-primary/20 rounded-full">
                                            <GraduationCap className="h-6 w-6 text-primary" />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            מומחיות אמיתית
                                        </h3>
                                        <p className="text-sm text-card-foreground/80">
                                            ניסיון של מעל 20 שנה בעיצוב שיער לצד הסמכה בינלאומית בטריקולוגיה.
                                        </p>
                                    </div>
                                </div>

                                {/* Feature 6 */}
                                <div className="flex gap-4 p-6 bg-primary/10 rounded-2xl hover:shadow-lg transition-shadow">
                                    <div className="flex-shrink-0">
                                        <div className="p-3 bg-primary/20 rounded-full">
                                            <Heart className="h-6 w-6 text-primary" />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            חוויית שירות גבוהה
                                        </h3>
                                        <p className="text-sm text-card-foreground/80">
                                            אווירה נעימה, יחס אישי וליווי מקצועי.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Closing Statement */}
                            <div className="mt-10 text-center">
                                <div className="inline-flex items-center gap-3 bg-primary/20 rounded-2xl px-8 py-4">
                                    <Heart className="h-6 w-6 text-primary" />
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
                    <Card className="bg-card shadow-2xl border-2 border-primary rounded-3xl p-8 md:p-12">
                        <CardContent className="p-0">
                            <h2 className="text-2xl md:text-3xl font-bold text-card-foreground mb-6">
                                מוכנים להתחיל?
                            </h2>
                            <p className="text-lg text-card-foreground/80 mb-8 max-w-2xl mx-auto">
                                קבעו תור לאבחון וטיפול ראשון וקבלו ייעוץ מקצועי מותאם אישית
                            </p>
                            <Button
                                asChild
                                size="lg"
                                className="bg-primary text-white hover:bg-primary/90 text-lg px-8 py-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
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
