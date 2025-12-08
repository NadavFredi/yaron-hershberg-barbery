// Module-level ref store for scroll synchronization between ScheduleHeader and ManagerScheduleContent
// No context - just a simple module-level store

export const scheduleScrollRefs = {
  headerScrollContainerRef: { current: null as HTMLDivElement | null },
  contentScrollContainerRef: { current: null as HTMLDivElement | null },
  isSyncingHorizontalScroll: { current: false },
  savedScrollPosition: { current: null as { scrollLeft: number; scrollTop: number } | null },
}

