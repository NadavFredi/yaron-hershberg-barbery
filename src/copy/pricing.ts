export const groomingPriceCopy = {
  overview: "המחיר משתנה לפי סוג הכלב, גודל, מצב הפרווה, אורך וסוג התספורת, רמת שיתוף הפעולה ועוד.",
  hourly:
    "במקרים של קשרים קשים, התנהגות חריגה, או רגישות יוצאת דופן - המחיר עשוי לחרוג מהמקור ולעבור לתמחור לפי שעת עבודה (עד 220 ₪ לשעה).",
  final: "המחיר הסופי יקבע בתום הטיפול.",
} as const

export type GroomingPriceCopy = typeof groomingPriceCopy

export interface PricingSection {
  title: string
  paragraphs: string[]
}

export const groomingPriceSections: PricingSection[] = [
  {
    title: "מה כולל הטיפול?",
    paragraphs: [
      "כל טיפול כולל גזיזת ציפורניים, גילוח כפות רגליים ואזורים אינטימיים, ניקוי והוצאת שיער מהאוזניים (במידת הצורך), מקלחת עם שמפו מותאם, ייבוש מלא, סירוק והכנת הפרווה, תספורת/דילול/טיפוח בהתאם לצורך וכמובן בושם לסיום",
    ],
  },
  {
    title: "כמה זה עולה?",
    paragraphs: [groomingPriceCopy.overview, groomingPriceCopy.hourly, groomingPriceCopy.final],
  },
  {
    title: "כמה זמן זה לוקח?",
    paragraphs: [
      "משך הטיפול הממוצע הוא כשעתיים, אך הוא משתנה בהתאם לגזע ולמאפייני הכלב.",
      "אנחנו נעדכן אתכם כ־15 דקות לפני סיום הטיפול כדי שתדעו מתי להגיע לאיסוף",
    ],
  },
]
