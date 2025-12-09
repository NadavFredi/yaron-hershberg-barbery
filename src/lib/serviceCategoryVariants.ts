// Service category color variants based on Tailwind color palette
export type ServiceCategoryVariant =
  | "blue"
  | "indigo"
  | "purple"
  | "pink"
  | "rose"
  | "red"
  | "orange"
  | "amber"
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "green"
  | "lime"
  | "yellow"
  | "violet"
  | "fuchsia"
  | "slate"
  | "gray"
  | "zinc"

export interface ServiceCategoryVariantConfig {
  id: ServiceCategoryVariant
  name: string
  bg: string
  bgLight: string
  bgHover: string
  text: string
  textLight: string
  border: string
  ring: string
}

export const SERVICE_CATEGORY_VARIANTS: Record<ServiceCategoryVariant, ServiceCategoryVariantConfig> = {
  blue: {
    id: "blue",
    name: "כחול",
    bg: "bg-blue-600",
    bgLight: "bg-blue-50",
    bgHover: "hover:bg-blue-700",
    text: "text-blue-600",
    textLight: "text-blue-50",
    border: "border-blue-200",
    ring: "ring-blue-500",
  },
  indigo: {
    id: "indigo",
    name: "אינדיגו",
    bg: "bg-indigo-600",
    bgLight: "bg-indigo-50",
    bgHover: "hover:bg-indigo-700",
    text: "text-indigo-600",
    textLight: "text-indigo-50",
    border: "border-indigo-200",
    ring: "ring-indigo-500",
  },
  purple: {
    id: "purple",
    name: "סגול",
    bg: "bg-purple-600",
    bgLight: "bg-purple-50",
    bgHover: "hover:bg-purple-700",
    text: "text-purple-600",
    textLight: "text-purple-50",
    border: "border-purple-200",
    ring: "ring-purple-500",
  },
  pink: {
    id: "pink",
    name: "ורוד",
    bg: "bg-pink-600",
    bgLight: "bg-pink-50",
    bgHover: "hover:bg-pink-700",
    text: "text-pink-600",
    textLight: "text-pink-50",
    border: "border-pink-200",
    ring: "ring-pink-500",
  },
  rose: {
    id: "rose",
    name: "ורוד כהה",
    bg: "bg-rose-600",
    bgLight: "bg-rose-50",
    bgHover: "hover:bg-rose-700",
    text: "text-rose-600",
    textLight: "text-rose-50",
    border: "border-rose-200",
    ring: "ring-rose-500",
  },
  red: {
    id: "red",
    name: "אדום",
    bg: "bg-red-600",
    bgLight: "bg-red-50",
    bgHover: "hover:bg-red-700",
    text: "text-red-600",
    textLight: "text-red-50",
    border: "border-red-200",
    ring: "ring-red-500",
  },
  orange: {
    id: "orange",
    name: "כתום",
    bg: "bg-orange-600",
    bgLight: "bg-orange-50",
    bgHover: "hover:bg-orange-700",
    text: "text-orange-600",
    textLight: "text-orange-50",
    border: "border-orange-200",
    ring: "ring-orange-500",
  },
  amber: {
    id: "amber",
    name: "ענבר",
    bg: "bg-amber-600",
    bgLight: "bg-amber-50",
    bgHover: "hover:bg-amber-700",
    text: "text-amber-600",
    textLight: "text-amber-50",
    border: "border-amber-200",
    ring: "ring-amber-500",
  },
  emerald: {
    id: "emerald",
    name: "אזמרגד",
    bg: "bg-emerald-600",
    bgLight: "bg-emerald-50",
    bgHover: "hover:bg-emerald-700",
    text: "text-emerald-600",
    textLight: "text-emerald-50",
    border: "border-emerald-200",
    ring: "ring-emerald-500",
  },
  teal: {
    id: "teal",
    name: "טורקיז",
    bg: "bg-teal-600",
    bgLight: "bg-teal-50",
    bgHover: "hover:bg-teal-700",
    text: "text-teal-600",
    textLight: "text-teal-50",
    border: "border-teal-200",
    ring: "ring-teal-500",
  },
  cyan: {
    id: "cyan",
    name: "ציאן",
    bg: "bg-cyan-600",
    bgLight: "bg-cyan-50",
    bgHover: "hover:bg-cyan-700",
    text: "text-cyan-600",
    textLight: "text-cyan-50",
    border: "border-cyan-200",
    ring: "ring-cyan-500",
  },
  sky: {
    id: "sky",
    name: "שמיים",
    bg: "bg-sky-600",
    bgLight: "bg-sky-50",
    bgHover: "hover:bg-sky-700",
    text: "text-sky-600",
    textLight: "text-sky-50",
    border: "border-sky-200",
    ring: "ring-sky-500",
  },
  green: {
    id: "green",
    name: "ירוק",
    bg: "bg-green-600",
    bgLight: "bg-green-50",
    bgHover: "hover:bg-green-700",
    text: "text-green-600",
    textLight: "text-green-50",
    border: "border-green-200",
    ring: "ring-green-500",
  },
  lime: {
    id: "lime",
    name: "ליים",
    bg: "bg-lime-600",
    bgLight: "bg-lime-50",
    bgHover: "hover:bg-lime-700",
    text: "text-lime-600",
    textLight: "text-lime-50",
    border: "border-lime-200",
    ring: "ring-lime-500",
  },
  yellow: {
    id: "yellow",
    name: "צהוב",
    bg: "bg-yellow-600",
    bgLight: "bg-yellow-50",
    bgHover: "hover:bg-yellow-700",
    text: "text-yellow-600",
    textLight: "text-yellow-50",
    border: "border-yellow-200",
    ring: "ring-yellow-500",
  },
  violet: {
    id: "violet",
    name: "סגול כהה",
    bg: "bg-violet-600",
    bgLight: "bg-violet-50",
    bgHover: "hover:bg-violet-700",
    text: "text-violet-600",
    textLight: "text-violet-50",
    border: "border-violet-200",
    ring: "ring-violet-500",
  },
  fuchsia: {
    id: "fuchsia",
    name: "פוקסיה",
    bg: "bg-fuchsia-600",
    bgLight: "bg-fuchsia-50",
    bgHover: "hover:bg-fuchsia-700",
    text: "text-fuchsia-600",
    textLight: "text-fuchsia-50",
    border: "border-fuchsia-200",
    ring: "ring-fuchsia-500",
  },
  slate: {
    id: "slate",
    name: "צפחה",
    bg: "bg-slate-600",
    bgLight: "bg-slate-50",
    bgHover: "hover:bg-slate-700",
    text: "text-slate-600",
    textLight: "text-slate-50",
    border: "border-slate-200",
    ring: "ring-slate-500",
  },
  gray: {
    id: "gray",
    name: "אפור",
    bg: "bg-gray-600",
    bgLight: "bg-gray-50",
    bgHover: "hover:bg-gray-700",
    text: "text-gray-600",
    textLight: "text-gray-50",
    border: "border-gray-200",
    ring: "ring-gray-500",
  },
  zinc: {
    id: "zinc",
    name: "אבץ",
    bg: "bg-zinc-600",
    bgLight: "bg-zinc-50",
    bgHover: "hover:bg-zinc-700",
    text: "text-zinc-600",
    textLight: "text-zinc-50",
    border: "border-zinc-200",
    ring: "ring-zinc-500",
  },
}

export const SERVICE_CATEGORY_VARIANTS_ARRAY = Object.values(SERVICE_CATEGORY_VARIANTS)
