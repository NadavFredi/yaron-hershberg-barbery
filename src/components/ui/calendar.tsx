import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, CaptionProps } from "react-day-picker";
import { format } from "date-fns";
import { he } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Custom caption component for the calendar header
interface CustomCaptionProps extends CaptionProps {
  onMonthChange?: (month: Date) => void;
}

function CustomCaption(props: CustomCaptionProps) {
  const { displayMonth, onMonthChange } = props;

  const title = format(displayMonth, "MMMM yyyy", { locale: he });

  const handlePrevious = () => {
    const previousMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1);
    onMonthChange?.(previousMonth);
  };

  const handleToday = () => {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    onMonthChange?.(firstOfMonth);
  };

  const handleNext = () => {
    const nextMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1);
    onMonthChange?.(nextMonth);
  };

  return (
    <div className="mb-2 flex w-full items-center justify-center gap-3 px-4">
      <button
        type="button"
        onClick={handlePrevious}
        aria-label="חודש קודם"
        className="rounded-full border border-slate-200 bg-white/80 p-1 text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleToday}
        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-all duration-200 hover:shadow-md"
      >
        היום
      </button>
      <span className="text-base font-semibold text-slate-700 min-w-[120px] text-center">{title}</span>
      <button
        type="button"
        onClick={handleNext}
        aria-label="חודש הבא"
        className="rounded-full border border-slate-200 bg-white/80 p-1 text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  month: controlledMonth,
  defaultMonth,
  onMonthChange,
  ...props
}: CalendarProps) {
  const [uncontrolledMonth, setUncontrolledMonth] = React.useState<Date>(
    controlledMonth ?? defaultMonth ?? new Date()
  );

  React.useEffect(() => {
    if (controlledMonth) {
      setUncontrolledMonth(controlledMonth);
    } else if (defaultMonth) {
      setUncontrolledMonth(defaultMonth);
    }
  }, [controlledMonth, defaultMonth]);

  const handleMonthChange = React.useCallback(
    (newMonth: Date) => {
      if (!controlledMonth) {
        setUncontrolledMonth(newMonth);
      }
      onMonthChange?.(newMonth);
    },
    [controlledMonth, onMonthChange]
  );

  const currentMonth = controlledMonth ?? uncontrolledMonth;

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      dir="rtl"
      locale={he}
      month={currentMonth}
      onMonthChange={handleMonthChange}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "hidden",
        nav_button: "hidden",
        nav_button_previous: "hidden",
        nav_button_next: "hidden",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        Caption: (captionProps) => (
          <CustomCaption {...captionProps} onMonthChange={handleMonthChange} />
        ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
