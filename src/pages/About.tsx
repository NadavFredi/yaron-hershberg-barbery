import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "../components/ui/badge.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx"
import { cn } from "../lib/utils.ts"
import { useBreeds } from "../hooks/useBreeds.ts"
import { AutocompleteFilter } from "../components/AutocompleteFilter.tsx"
import { groomingPriceCopy, groomingPriceSections } from "../copy/pricing.ts"

type ExperienceId = "garden" | "barber" | "pricing"
type ExperienceType = "fillout" | "pricing"

interface ExperienceOption {
    id: ExperienceId
    type: ExperienceType
    title: string
    subtitle: string
    description: string
    emoji: string
    accent: string
    filloutId?: string
}

const FILL_OUT_SCRIPT_SRC = "https://server.fillout.com/embed/v1/"

const experienceOptions: Record<ExperienceId, ExperienceOption> = {
    garden: {
        id: "garden",
        type: "fillout",
        title: "הכירו את גן הכלבים שלנו",
        subtitle: "שגרה שמלאה באהבה, משחקים ולמידה",
        description: "קבלו הצצה ליום של כלב בגן B LOVED - התכנית, הצוות והאווירה שאנחנו בונים לכל חבר על ארבע.",
        emoji: "🌿",
        filloutId: "o4iG1m9JH9us",
        accent: "from-emerald-50 to-emerald-100"
    },
    barber: {
        id: "barber",
        type: "fillout",
        title: "הכירו את המספרה המקצועית שלנו",
        subtitle: "טיפוח שמרגיש כמו ספא",
        description: "גלו כיצד אנחנו הופכים כל תספורת לחוויה רגועה ומפנקת - מהשיטות ועד המוצרים המיוחדים.",
        emoji: "✂️",
        filloutId: "jjExQ3PQZZus",
        accent: "from-sky-50 to-blue-100"
    },
    pricing: {
        id: "pricing",
        type: "pricing",
        title: "השקיפות שלנו בתמחור",
        subtitle: "בחרו גזע וקבלו טווח מחיר מיידי",
        description: "התאימו את חוויית הטיפוח לצרכים של הכלב שלכם. בחרו גזע, ראו את טווח המחירים המשוער וגלו מה משפיע על התמחור.",
        emoji: "💰",
        accent: "from-amber-50 to-orange-100"
    }
}

type PricingBreed = {
    id: string
    name: string
    size_class?: string | null
    min_groom_price?: number | null
    max_groom_price?: number | null
}

export default function About() {
    const [selectedId, setSelectedId] = useState<ExperienceId>("garden")

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
                        בחרו אם תרצו לגלות עוד על גן הכלבים שלנו או על המספרה המקצועית. כל בחירה תפתח עבורכם חוויית עומק ממוקדת ומהנה.
                    </p>
                </header>

                <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                            {selectedExperience.type === "fillout" && selectedExperience.filloutId ? (
                                <FilloutEmbed
                                    key={selectedExperience.id}
                                    filloutId={selectedExperience.filloutId}
                                    accent={selectedExperience.accent}
                                />
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

interface FilloutEmbedProps {
    filloutId: string
    accent: string
}

function FilloutEmbed({ filloutId, accent }: FilloutEmbedProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        container.innerHTML = ""

        const embedDiv = document.createElement("div")
        embedDiv.style.width = "100%"
        embedDiv.style.height = "500px"
        embedDiv.setAttribute("data-fillout-id", filloutId)
        embedDiv.setAttribute("data-fillout-embed-type", "standard")
        embedDiv.setAttribute("data-fillout-inherit-parameters", "")
        embedDiv.setAttribute("data-fillout-dynamic-resize", "")
        container.appendChild(embedDiv)

        const script = document.createElement("script")
        script.src = FILL_OUT_SCRIPT_SRC
        script.async = true
        script.setAttribute("data-fillout-script", `about-${filloutId}`)
        container.appendChild(script)

        return () => {
            container.innerHTML = ""
        }
    }, [filloutId])

    return (
        <div
            ref={containerRef}
            className={cn(
                "flex min-h-[500px] items-center justify-center rounded-2xl border shadow-inner transition-colors",
                "border-blue-100 bg-white",
                accent ? `bg-gradient-to-br ${accent}` : undefined
            )}
        />
    )
}

function PricingExperience() {
    const { data: breeds, isLoading, isError, error } = useBreeds()
    const [selectedBreedId, setSelectedBreedId] = useState<string | undefined>(undefined)
    const [inputValue, setInputValue] = useState("")

    const sortedBreeds = useMemo<PricingBreed[]>(() => {
        if (!breeds?.length) {
            return []
        }

        const normalized = (breeds as unknown[]).map((breed) => {
            const record = breed as PricingBreed & { [key: string]: unknown }
            return {
                id: record.id,
                name: record.name,
                size_class: (record.size_class ?? null) as string | null,
                min_groom_price: typeof record.min_groom_price === "number" ? record.min_groom_price : null,
                max_groom_price: typeof record.max_groom_price === "number" ? record.max_groom_price : null
            }
        })

        return normalized.sort((a, b) => a.name.localeCompare(b.name, "he"))
    }, [breeds])

    useEffect(() => {
        if (sortedBreeds.length) {
            console.log("🐾 [PricingExperience] נטענו", sortedBreeds.length, "גזעים להצגת מחירים")
        }
    }, [sortedBreeds])

    const selectedBreed = useMemo<PricingBreed | null>(() => {
        return sortedBreeds.find((breed) => breed.id === selectedBreedId) ?? null
    }, [selectedBreedId, sortedBreeds])

    useEffect(() => {
        if (selectedBreed) {
            console.log("💡 [PricingExperience] הגזע שנבחר עבור תמחור:", {
                id: selectedBreed.id,
                name: selectedBreed.name,
                size: selectedBreed.size_class,
                minPrice: selectedBreed.min_groom_price,
                maxPrice: selectedBreed.max_groom_price
            })
        }
    }, [selectedBreed])

    const searchBreeds = (term: string) => {
        if (!sortedBreeds.length) {
            return Promise.resolve<string[]>([])
        }

        const needle = term.trim().toLowerCase()
        if (!needle) {
            return Promise.resolve(sortedBreeds.slice(0, 8).map((breed) => breed.name))
        }

        return Promise.resolve(
            sortedBreeds
                .filter((breed) => breed.name.toLowerCase().includes(needle))
                .slice(0, 8)
                .map((breed) => breed.name)
        )
    }

    const formatPrice = (price: number | null | undefined) => {
        if (typeof price !== "number") {
            return "—"
        }

        return `₪${price.toLocaleString("he-IL")}`
    }

    const translateSize = (size: string | null | undefined) => {
        if (!size) {
            return "גודל מותאם אישית"
        }

        switch (size.toLowerCase()) {
            case "small":
                return "כלבים קטנים"
            case "medium":
                return "כלבים בינוניים"
            case "large":
                return "כלבים גדולים"
            default:
                return "גודל מותאם אישית"
        }
    }

    const hasPriceData =
        typeof selectedBreed?.min_groom_price === "number" || typeof selectedBreed?.max_groom_price === "number"

    return (
        <div className="space-y-4 text-right" dir="rtl">

            {isLoading ? (
                <div className="rounded-2xl border border-blue-100 bg-white/90 p-4 text-sm text-gray-600">
                    טוען רשימת גזעים...
                </div>
            ) : null}

            {!isLoading && isError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    קרתה תקלה בטעינת המחירים. נסו לרענן את העמוד או דברו איתנו ונשמח לעזור.
                    {error instanceof Error ? ` (${error.message})` : null}
                </div>
            ) : null}

            {!isLoading && !isError && !sortedBreeds.length ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    עוד לא הזנו מחירים בטבלה – דברו איתנו כדי לקבל הצעת מחיר מותאמת.
                </div>
            ) : null}

            {!isLoading && !isError && sortedBreeds.length ? (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <span className="text-sm font-medium text-gray-800">
                            חפשו גזע והציגו את טווח המחירים שלנו
                        </span>
                        <AutocompleteFilter
                            value={inputValue}
                            onChange={(value) => {
                                setInputValue(value)
                                if (!value.trim()) {
                                    setSelectedBreedId(undefined)
                                    return
                                }
                            }}
                            onSelect={(value) => {
                                setInputValue(value)
                                const breed = sortedBreeds.find((option) => option.name === value)
                                if (breed) {
                                    setSelectedBreedId(breed.id)
                                    console.log("🎯 [PricingExperience] משתמש בחר גזע חדש:", {
                                        id: breed.id,
                                        name: breed.name
                                    })
                                }
                            }}
                            placeholder="הקלידו את שם הגזע..."
                            className="rounded-2xl border border-blue-200 bg-white/90 py-5 text-base font-medium text-gray-900"
                            searchFn={searchBreeds}
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

                    {selectedBreed ? (
                        <div className="space-y-3 rounded-2xl border border-blue-200 bg-white/95 p-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-sm text-gray-500">
                                    טווח המחירים המשוער ל{translateSize(selectedBreed.size_class)}
                                </span>
                                {hasPriceData ? (
                                    <div className="text-2xl font-bold text-blue-700">
                                        {formatPrice(selectedBreed.min_groom_price)} – {formatPrice(selectedBreed.max_groom_price)}
                                    </div>
                                ) : (
                                    <div className="text-sm text-amber-700">
                                        עוד לא הזנו טווח מחירים לגזע {selectedBreed.name}. נשמח להתאים הצעת מחיר אישית.
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
