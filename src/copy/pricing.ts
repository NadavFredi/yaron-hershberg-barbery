export const barberyPriceCopy = {
  overview: "המחיר משתנה לפי סוג השירות, אורך השיער, סגנון התספורת המבוקש, ומורכבות הטיפול.",
  hourly:
    "במקרים של שיער ארוך במיוחד, עיצוב מורכב, או טיפולים מיוחדים - המחיר עשוי לחרוג מהמקור ולעבור לתמחור לפי שעת עבודה.",
  final: "המחיר הסופי יקבע בתום הטיפול בהתאם לצרכים הספציפיים שלכם.",
} as const

export type BarberyPriceCopy = typeof barberyPriceCopy

export interface PricingSection {
  title: string
  paragraphs: string[]
}

export const barberyPriceSections: PricingSection[] = [
  {
    title: "מה כולל השירות?",
    paragraphs: [
      "כל שירות כולל ייעוץ מקצועי, תספורת מדויקת, עיצוב השיער, טיפוח וסיום מקצועי. השירותים שלנו מותאמים אישית לכל לקוח בהתאם לצרכים ולסגנון המבוקש.",
    ],
  },
  {
    title: "כמה זה עולה?",
    paragraphs: [barberyPriceCopy.overview, barberyPriceCopy.hourly, barberyPriceCopy.final],
  },
  {
    title: "כמה זמן זה לוקח?",
    paragraphs: [
      "משך הטיפול משתנה בהתאם לסוג השירות שנבחר - מתספורת מהירה של 30 דקות ועד טיפוח מלא של שעה וחצי.",
      "אנחנו נעדכן אתכם כ־10 דקות לפני סיום הטיפול כדי שתדעו מתי להגיע",
    ],
  },
]
