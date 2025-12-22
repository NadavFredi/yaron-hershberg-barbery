import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent } from "../components/ui/card.tsx"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion.tsx"
import { Input } from "../components/ui/input.tsx"
import { Scissors, ChevronLeft, Search, Loader2, X } from "lucide-react"
import { useServices } from "@/hooks/useServices"

export default function SalonServices() {
    const [searchQuery, setSearchQuery] = useState("")
    const { data: allServices = [], isLoading, error } = useServices()
    
    // Filter only active services
    const services = useMemo(() => {
        return (allServices || []).filter(service => service.is_active === true)
    }, [allServices])

    // Filter services based on search query
    const filteredServices = useMemo(() => {
        if (!searchQuery.trim()) {
            return services
        }

        const query = searchQuery.toLowerCase().trim()
        return services.filter(
            (service) =>
                service.name.toLowerCase().includes(query) ||
                (service.description && service.description.toLowerCase().includes(query))
        )
    }, [searchQuery, services])

    const formatPrice = (price: number) => {
        return `₪${price.toLocaleString("he-IL")}`
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary/10 to-purple-50" dir="rtl">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Breadcrumb */}
                <nav className="mb-8">
                    <ol className="flex items-center gap-2 text-sm text-gray-600">
                        <li>
                            <Link to="/about" className="hover:text-primary transition-colors">
                                אודות
                            </Link>
                        </li>
                        <li>
                            <ChevronLeft className="h-4 w-4" />
                        </li>
                        <li className="text-gray-900 font-medium">
                            צבע, גוונים תספורת וטיפולי מספרה
                        </li>
                    </ol>
                </nav>

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center gap-3 mb-6">
                        <div className="p-3 bg-primary/20 rounded-full">
                            <Scissors className="h-8 w-8 text-primary" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-semibold text-gray-900">
                            צבע, גוונים תספורת וטיפולי מספרה
                        </h1>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="mb-8">
                    <div className="relative">
                        <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            type="text"
                            placeholder="חפשו שירותים..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pr-12 pl-10 py-6 text-base border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                            dir="rtl"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute left-4 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                                aria-label="נקה חיפוש"
                            >
                                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <Card className="bg-white shadow-lg border border-gray-200 rounded-3xl p-8">
                        <CardContent className="p-0">
                            <div className="text-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                                <p className="text-lg text-gray-600">טוען שירותים...</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Error State */}
                {error && !isLoading && (
                    <Card className="bg-white shadow-lg border border-gray-200 rounded-3xl p-8">
                        <CardContent className="p-0">
                            <div className="text-center py-12">
                                <p className="text-lg text-red-600">שגיאה בטעינת השירותים</p>
                                <p className="text-sm text-gray-500 mt-2">אנא נסה שוב מאוחר יותר</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Services Accordion */}
                {!isLoading && !error && filteredServices.length > 0 && (
                    <Card className="bg-white shadow-lg border border-gray-200 rounded-3xl p-4 md:p-6">
                        <CardContent className="p-0">
                            <Accordion
                                type="multiple"
                                className="w-full"
                            >
                                {filteredServices.map((service) => (
                                    <AccordionItem
                                        key={service.id}
                                        value={service.id}
                                        className="border-b border-gray-200 last:border-b-0 py-1"
                                    >
                                        <AccordionTrigger className="text-right hover:no-underline py-3">
                                            <div className="flex items-center justify-between w-full gap-6">
                                                <span className="text-base md:text-lg font-medium text-gray-900">
                                                    {service.name}
                                                </span>
                                                {service.base_price > 0 && (
                                                    <span className="text-base md:text-lg text-gray-700 flex-shrink-0 ml-4">
                                                        {formatPrice(service.base_price)}
                                                    </span>
                                                )}
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="text-right">
                                            {service.description ? (
                                                <div
                                                    className="text-sm md:text-base text-gray-800 leading-relaxed pt-2 prose prose-sm max-w-none"
                                                    dangerouslySetInnerHTML={{ __html: service.description }}
                                                />
                                            ) : (
                                                <p className="text-sm md:text-base text-gray-600 leading-relaxed pt-2">
                                                    אין תיאור זמין
                                                </p>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </CardContent>
                    </Card>
                )}

                {/* No Results State */}
                {!isLoading && !error && filteredServices.length === 0 && (
                    <Card className="bg-white shadow-lg border border-gray-200 rounded-3xl p-8">
                        <CardContent className="p-0">
                            <div className="text-center py-12">
                                {searchQuery ? (
                                    <>
                                        <p className="text-lg text-gray-600">
                                            לא נמצאו תוצאות עבור "{searchQuery}"
                                        </p>
                                        <p className="text-sm text-gray-500 mt-2">
                                            נסו לחפש במילים אחרות
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-lg text-gray-600">
                                        אין שירותים זמינים כרגע
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}

