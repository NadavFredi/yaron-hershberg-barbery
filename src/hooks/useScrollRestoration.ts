import { useLayoutEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import type { Location } from "react-router-dom"


export function useScrollRestoration() {
  const location = useLocation()
  const previousScrollRestorationRef = useRef<History["scrollRestoration"] | null>(null)
  const previousLocationRef = useRef<Location | null>(null)

  // Disable browser's automatic scroll restoration
  useLayoutEffect(() => {
    const history = globalThis?.history
    if (!history || typeof history.scrollRestoration === "undefined") {
      return
    }

    previousScrollRestorationRef.current = history.scrollRestoration
    history.scrollRestoration = "manual"

    return () => {
      history.scrollRestoration = previousScrollRestorationRef.current ?? "auto"
    }
  }, [])

  // Handle scroll position based on URL params and location state
  useLayoutEffect(() => {
    const params = new URLSearchParams(location.search)
    const skipParamKeys = [
      "highlightAppointment",
      "focusAppointment",
      "previewWaitlist",
      "scrollTarget",
      "constraintFocus"
    ]

    const skipReason = skipParamKeys.find((key) => params.has(key)) ?? null
    const locationState = (location.state as { preserveManagerScroll?: boolean } | null) ?? null
    const isDateOnlyChange = (() => {
      if (!previousLocationRef.current) return false
      if (previousLocationRef.current.pathname !== location.pathname) return false

      const prevParams = new URLSearchParams(previousLocationRef.current.search)
      const nextParams = new URLSearchParams(location.search)
      const prevDate = prevParams.get("date")
      const nextDate = nextParams.get("date")

      prevParams.delete("date")
      nextParams.delete("date")

      const serializeParams = (p: URLSearchParams) =>
        Array.from(p.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join("&")

      const nonDateParamsEqual = serializeParams(prevParams) === serializeParams(nextParams)
      return nonDateParamsEqual && prevDate !== nextDate
    })()

    const shouldPreserveScroll =
      Boolean(skipReason) ||
      Boolean(locationState?.preserveManagerScroll) ||
      isDateOnlyChange

    if (shouldPreserveScroll) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug("[useScrollRestoration] Preserving scroll position", {
          pathname: location.pathname,
          search: location.search,
          reason: skipReason
            ? `query:${skipReason}`
            : isDateOnlyChange
              ? "query:date-change"
              : "location-state",
          preserveManagerScroll: locationState?.preserveManagerScroll ?? false
        })
      }
      return
    }

    const scrollingElement =
      globalThis?.document?.scrollingElement ??
      globalThis?.document?.documentElement ??
      null

    if (scrollingElement) {
      scrollingElement.scrollTop = 0
      scrollingElement.scrollLeft = 0
    } else if (typeof window !== "undefined") {
      window.scrollTo(0, 0)
    }

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[useScrollRestoration] Forced scroll to top", {
        pathname: location.pathname,
        search: location.search,
        timestamp: typeof performance !== "undefined" ? performance.now() : Date.now()
      })
    }

    previousLocationRef.current = location
  }, [location.key, location.pathname, location.search])
}
