import { useDraggable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { WaitlistCard } from "./WaitlistCard"
import type { ManagerWaitlistEntry } from "./useWaitingList"

interface DraggableWaitlistCardProps {
  entry: ManagerWaitlistEntry
  onCardClick?: () => void
}

export function DraggableWaitlistCard({ entry, onCardClick }: DraggableWaitlistCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `waitlist-${entry.id}`,
    data: {
      type: 'waitlist',
      entry,
    },
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-70"
      )}
    >
      <WaitlistCard entry={entry} isDragging={isDragging} onClick={onCardClick} />
    </div>
  )
}

