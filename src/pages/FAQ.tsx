import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent } from "../components/ui/card.tsx"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion.tsx"
import { Input } from "../components/ui/input.tsx"
import { HelpCircle, ChevronLeft, Search, Loader2, X } from "lucide-react"
import { useFAQs } from "@/hooks/useFAQs"

export default function FAQ() {
    const [searchQuery, setSearchQuery] = useState("")
    const { data: faqs = [], isLoading, error } = useFAQs(false) // Only visible FAQs

    // Filter FAQ items based on search query
    const filteredFaqs = useMemo(() => {
        if (!searchQuery.trim()) {
            return faqs
        }

        const query = searchQuery.toLowerCase().trim()
        return faqs.filter(
            (faq) =>
                faq.question.toLowerCase().includes(query) ||
                faq.answer.toLowerCase().includes(query)
        )
    }, [searchQuery, faqs])

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50" dir="rtl">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
                            שאלות ותשובות
                        </li>
                    </ol>
                </nav>

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center gap-3 mb-6">
                        <div className="p-3 bg-green-100 rounded-full">
                            <HelpCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                            שאלות ותשובות
                        </h1>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="mb-8">
                    <div className="relative">
                        <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            type="text"
                            placeholder="חפשו שאלות ותשובות..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pr-12 pl-10 py-6 text-base border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            dir="rtl"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute left-4 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                aria-label="נקה חיפוש"
                            >
                                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <Card className="bg-white shadow-lg border border-gray-200 rounded-3xl p-8">
                        <CardContent className="p-0">
                            <div className="text-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                                <p className="text-lg text-gray-600">טוען שאלות ותשובות...</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Error State */}
                {error && !isLoading && (
                    <Card className="bg-white shadow-lg border border-gray-200 rounded-3xl p-8">
                        <CardContent className="p-0">
                            <div className="text-center py-12">
                                <p className="text-lg text-red-600">שגיאה בטעינת השאלות</p>
                                <p className="text-sm text-gray-500 mt-2">אנא נסה שוב מאוחר יותר</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* FAQ Accordion */}
                {!isLoading && !error && filteredFaqs.length > 0 && (
                    <Card className="bg-white shadow-lg border border-gray-200 rounded-3xl p-4 md:p-6">
                        <CardContent className="p-0">
                            <Accordion
                                type="multiple"
                                className="w-full"
                            >
                                {filteredFaqs.map((faq) => (
                                    <AccordionItem
                                        key={faq.id}
                                        value={faq.id}
                                        className="border-b border-gray-200 last:border-b-0 py-1"
                                    >
                                        <AccordionTrigger className="text-right hover:no-underline py-3">
                                            <span className="text-base md:text-lg font-semibold text-gray-900">
                                                {faq.question}
                                            </span>
                                        </AccordionTrigger>
                                        <AccordionContent className="text-right">
                                            <div
                                                className="text-sm md:text-base text-gray-800 leading-relaxed pt-2 prose prose-sm max-w-none"
                                                dangerouslySetInnerHTML={{ __html: faq.answer }}
                                            />
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </CardContent>
                    </Card>
                )}

                {/* No Results State */}
                {!isLoading && !error && filteredFaqs.length === 0 && (
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
                                        אין שאלות זמינות כרגע
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
