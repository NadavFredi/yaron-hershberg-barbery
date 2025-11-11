import { useEffect, useMemo, useState } from "react"
import { Badge } from "../components/ui/badge.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx"
import { AutocompleteFilter } from "../components/AutocompleteFilter.tsx"
import { groomingPriceCopy, groomingPriceSections } from "../copy/pricing.ts"
import { cn } from "../lib/utils.ts"
// @ts-ignore - Bundler resolves this default export
import useTreatmentTypes from "../hooks/useTreatmentTypes.ts"

type ExperienceId = "barber" | "pricing"
type ExperienceType = "story" | "pricing"

interface ExperienceOption {
    id: ExperienceId
    type: ExperienceType
    title: string
    subtitle: string
    description: string
    emoji: string
    accent: string
}

const experienceOptions: Record<ExperienceId, ExperienceOption> = {
    barber: {
        id: "barber",
        type: "story",
        title: "מי אנחנו",
        subtitle: "מספרה יוצאת דופן",
        description: "הכירו את הבוטיק של ירון הרשברג – מעצב שיער, כימאי וטריקולוג מוסמך שמעניק מענה הוליסטי לקרקפת ולשיער.",
        emoji: "✂️",
        accent: "from-sky-50 to-blue-100"
    },
    pricing: {
        id: "pricing",
        type: "pricing",
        title: "השקיפות שלנו בתמחור",
        subtitle: "בחרו טיפול וקבלו טווח מחיר מיידי",
        description: "התאימו את חוויית השיער לצרכים שלכם. בחרו טיפול ייחודי, ראו את טווח המחירים המשוער וגלו מה משפיע על העלות.",
        emoji: "💰",
        accent: "from-amber-50 to-orange-100"
    }
}

type PricingTreatmentType = {
    id: string
    name: string
    description?: string | null
    default_duration_minutes?: number | null
    default_price?: number | null
    color_hex?: string | null
}

export default function About() {
    const [selectedId, setSelectedId] = useState<ExperienceId>("barber")

    const selectedExperience = useMemo(
        () => experienceOptions[selectedId],
        [selectedId]
    )

    return (
        <div className="py-12 px-4 sm:px-6 lg:px-8" dir="rtl">
            <div className="max-w-6xl mx-auto space-y-12">
                <header className="text-center space-y-4">
                    <Badge variant="secondary" className="text-sm px-4 py-1 rounded-full">
                        בואו נכיר מקרוב
                    </Badge>
                    <h1 className="text-4xl font-bold text-gray-900">
                        רוצים לדעת על מה כולם מדברים?
                    </h1>
                    <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                        בחרו את המסלול שמעניין אתכם – מהחוויה בסלון ועד פירוט הטיפולים המיוחדים. כל אפשרות חושפת שכבה נוספת במספרה יוצאת הדופן של ירון הרשברג.
                    </p>
                </header>

                <section className="grid gap-6 md:grid-cols-2">
                    {Object.values(experienceOptions).map((option) => {
                        const isActive = option.id === selectedId
                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setSelectedId(option.id)}
                                className={cn(
                                    "group relative flex h-full w-full flex-col items-start gap-4 rounded-2xl border bg-white/90 p-6 text-right transition-all",
                                    "hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                                    isActive
                                        ? "border-blue-300 shadow-lg"
                                        : "border-transparent hover:border-blue-200"
                                )}
                                aria-pressed={isActive}
                            >
                                <div className={cn(
                                    "flex h-12 w-12 items-center justify-center rounded-full text-2xl transition-transform",
                                    "bg-gradient-to-br shadow-inner",
                                    option.accent,
                                    isActive ? "scale-105" : "group-hover:scale-105"
                                )}>
                                    <span>{option.emoji}</span>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-blue-500">{option.subtitle}</p>
                                    <h2 className="text-2xl font-bold text-gray-900">{option.title}</h2>
                                    <p className="text-base text-gray-600 leading-relaxed">
                                        {option.description}
                                    </p>
                                </div>
                                <div className="mt-auto flex w-full items-center justify-between text-sm text-gray-500">
                                    <span>
                                        {isActive ? "מוצג כעת" : "הציגו פרטים מלאים"}
                                    </span>
                                    <span className="transition-transform group-hover:translate-x-1">
                                        ↗
                                    </span>
                                </div>
                            </button>
                        )
                    })}
                </section>

                <section>
                    <Card className="overflow-hidden border-0 shadow-xl">
                        <CardHeader className="bg-white/70 backdrop-blur-sm">
                            <CardTitle className="text-2xl font-bold text-gray-900">
                                {selectedExperience.title}
                            </CardTitle>
                            <CardDescription className="text-base text-gray-600">
                                {selectedExperience.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="bg-white/90 p-6">
                            {selectedExperience.type === "story" ? (
                                <StoryExperience />
                            ) : null}

                            {selectedExperience.type === "pricing" ? (
                                <PricingExperience key={selectedExperience.id} />
                            ) : null}
                        </CardContent>
                    </Card>
                </section>
            </div>
        </div>
    )
}

function StoryExperience() {
    return (
        <div className="space-y-8 text-right">
            <section className="space-y-4 rounded-2xl bg-gradient-to-br from-blue-50 to-emerald-50 p-6 shadow-inner">
                <h3 className="text-2xl font-semibold text-gray-900">"מספרה יוצאת דופן" – בוטיק ייחודי לבריאות הקרקפת והשיער</h3>
                <p className="text-base leading-7 text-gray-700">
                    ירון הרשברג, מעצב שיער וכימאי מאז 2001 וטריקולוג מוסמך בשנים האחרונות, הקים ברמת גן בית מקצועי שמחבר בין עיצוב שיער מדויק לטיפולי קרקפת טבעיים ולא פולשניים.
                </p>
                <p className="text-base leading-7 text-gray-700">
                    הבוטיק מעניק חוויית טיפוח הוליסטית – טיפול מהשורש ועד הקצוות, עם מעטפת של אבחון, התאמה אישית ומוצרים אורגניים מהשורה הראשונה.
                </p>
            </section>

            <section className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900">למה אנחנו יוצאי דופן</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm">
                        <h4 className="text-lg font-semibold text-blue-700">אבחון מקצועי מדויק</h4>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            מצלמת קרקפת מתקדמת ותשאול יסודי בתחילת כל טיפול – כדי להבין לעומק מה הקרקפת והשיער שלכם צריכים.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm">
                        <h4 className="text-lg font-semibold text-blue-700">טיפולים מותאמים אישית</h4>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            לכל לקוחה ולקוח נבנה פרוטוקול טיפולי ייחודי לפי מצב הקרקפת, השיער ואורח החיים.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm">
                        <h4 className="text-lg font-semibold text-blue-700">מוצרים אורגניים פרימיום</h4>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            אנו עובדים עם Philip Martin’s האיטלקיים – ללא SLS, מלחים או חומרים משמרים, ולא נוסו על בעלי חיים.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm">
                        <h4 className="text-lg font-semibold text-blue-700">זמינות וגמישות</h4>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            פתוחים עד חצות, כי הבריאות והטיפוח שלכם צריכים להתאים לשגרה ולא להפך.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm">
                        <h4 className="text-lg font-semibold text-blue-700">מומחיות אמיתית</h4>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            ניסיון של מעל 20 שנה בעיצוב שיער לצד הסמכה בינלאומית בטריקולוגיה – ידע עמוק שמורגש בכל מפגש.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm">
                        <h4 className="text-lg font-semibold text-blue-700">חוויית שירות גבוהה</h4>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            יחס אישי, אווירה נעימה וליווי צמוד כבר מהפגישה הראשונה ועד לתוצאות המלאות.
                        </p>
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-6 text-center shadow-sm">
                <p className="text-lg font-medium text-emerald-900">
                    אנחנו מאמינים שלשיער ולקרקפת שלכם מגיעה חוויה יוצאת דופן – ואם נפגשנו, זה בהחלט לא במקרה 🥰
                </p>
            </section>
        </div>
    )
}

function PricingExperience() {
    const { data: treatmentTypes, isLoading, isError, error } = useTreatmentTypes()
    const [selectedTreatmentTypeId, setSelectedTreatmentTypeId] = useState<string | undefined>(undefined)
    const [inputValue, setInputValue] = useState("")

    const sortedTreatmentTypes = useMemo<PricingTreatmentType[]>(() => {
        if (!treatmentTypes?.length) {
            return []
        }

        const normalized = (treatmentTypes as PricingTreatmentType[]).map((treatmentType) => ({
            id: treatmentType.id,
            name: treatmentType.name,
            description: treatmentType.description,
            default_duration_minutes: treatmentType.default_duration_minutes,
            default_price: treatmentType.default_price,
            color_hex: treatmentType.color_hex
        }))

        return normalized.sort((a, b) => a.name.localeCompare(b.name, "he"))
    }, [treatmentTypes])

    useEffect(() => {
        if (sortedTreatmentTypes.length) {
            console.log("✨ [PricingExperience] נטענו", sortedTreatmentTypes.length, "טיפולים להצגת מחירים")
        }
    }, [sortedTreatmentTypes])

    const selectedTreatmentType = useMemo<PricingTreatmentType | null>(() => {
        return sortedTreatmentTypes.find((treatmentType) => treatmentType.id === selectedTreatmentTypeId) ?? null
    }, [selectedTreatmentTypeId, sortedTreatmentTypes])

    useEffect(() => {
        if (selectedTreatmentType) {
            console.log("💡 [PricingExperience] הטיפול שנבחר עבור תמחור:", {
                id: selectedTreatmentType.id,
                name: selectedTreatmentType.name,
                duration: selectedTreatmentType.default_duration_minutes,
                price: selectedTreatmentType.default_price
            })
        }
    }, [selectedTreatmentType])

    const searchTreatmentTypes = (term: string) => {
        if (!sortedTreatmentTypes.length) {
            return Promise.resolve<string[]>([])
        }

        const needle = term.trim().toLowerCase()
        if (!needle) {
            return Promise.resolve(sortedTreatmentTypes.slice(0, 8).map((treatmentType) => treatmentType.name))
        }

        return Promise.resolve(
            sortedTreatmentTypes
                .filter((treatmentType) => treatmentType.name.toLowerCase().includes(needle))
                .slice(0, 8)
                .map((treatmentType) => treatmentType.name)
        )
    }

    const formatPrice = (price: number | null | undefined) => {
        if (typeof price !== "number") {
            return "—"
        }

        return `₪${price.toLocaleString("he-IL")}`
    }

    const hasPriceData = typeof selectedTreatmentType?.default_price === "number"

    const formatDuration = (minutes?: number | null) => {
        if (!minutes || minutes <= 0) return "משך מותאם אישית"
        if (minutes < 60) return `${minutes} דקות`
        const hours = Math.floor(minutes / 60)
        const remaining = minutes % 60
        return remaining
            ? `${hours} שעות ו-${remaining} דקות`
            : `${hours} שעות`
    }

    return (
        <div className="space-y-4 text-right" dir="rtl">

            {isLoading ? (
                <div className="rounded-2xl border border-blue-100 bg-white/90 p-4 text-sm text-gray-600">
                    טוען סוגי טיפולים...
                </div>
            ) : null}

            {!isLoading && isError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    קרתה תקלה בטעינת המחירים. נסו לרענן את העמוד או דברו איתנו ונשמח לעזור.
                    {error instanceof Error ? ` (${error.message})` : null}
                </div>
            ) : null}

            {!isLoading && !isError && !sortedTreatmentTypes.length ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    עוד לא הזנו מחירים בטבלה – דברו איתנו כדי לקבל הצעת מחיר מותאמת.
                </div>
            ) : null}

            {!isLoading && !isError && sortedTreatmentTypes.length ? (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <span className="text-sm font-medium text-gray-800">
                            חפשו טיפול והציגו את טווח המחירים שלנו
                        </span>
                        <AutocompleteFilter
                            value={inputValue}
                            onChange={(value) => {
                                setInputValue(value)
                                if (!value.trim()) {
                                    setSelectedTreatmentTypeId(undefined)
                                    return
                                }
                            }}
                            onSelect={(value) => {
                                setInputValue(value)
                                const treatmentType = sortedTreatmentTypes.find((option) => option.name === value)
                                if (treatmentType) {
                                    setSelectedTreatmentTypeId(treatmentType.id)
                                    console.log("🎯 [PricingExperience] משתמש בחר טיפול חדש:", {
                                        id: treatmentType.id,
                                        name: treatmentType.name
                                    })
                                }
                            }}
                            placeholder="הקלידו את שם הטיפול..."
                            className="rounded-2xl border border-blue-200 bg-white/90 py-5 text-base font-medium text-gray-900"
                            searchFn={searchTreatmentTypes}
                            minSearchLength={1}
                            debounceMs={150}
                            initialLoadOnMount
                            initialResultsLimit={8}
                        />
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                        {groomingPriceSections.map((section) => (
                            <div
                                key={section.title}
                                className="rounded-2xl border border-blue-50 bg-white/95 p-4 shadow-sm transition hover:shadow-md"
                            >
                                <h4 className="text-sm font-semibold text-gray-900">{section.title}</h4>
                                <div className="mt-2 space-y-2 text-xs text-gray-600">
                                    {section.paragraphs.map((paragraph, index) => (
                                        <p key={`${section.title}-${index}`}>{paragraph}</p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {selectedTreatmentType ? (
                        <div className="space-y-3 rounded-2xl border border-blue-200 bg-white/95 p-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-sm text-gray-500">
                                    משך טיפוסי: {formatDuration(selectedTreatmentType.default_duration_minutes)}
                                </span>
                                {hasPriceData ? (
                                    <div className="text-2xl font-bold text-blue-700">
                                        {formatPrice(selectedTreatmentType.default_price)}
                                    </div>
                                ) : (
                                    <div className="text-sm text-amber-700">
                                        עוד לא הזנו טווח מחירים לטיפול {selectedTreatmentType.name}. נשמח להתאים הצעת מחיר אישית.
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1 text-xs text-gray-600">
                                <p>{groomingPriceCopy.hourly}</p>
                                <p>{groomingPriceCopy.final}</p>
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}
