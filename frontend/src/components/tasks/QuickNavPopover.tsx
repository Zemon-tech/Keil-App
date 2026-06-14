import { useMemo, useState, useRef, useEffect } from "react";
import { format, addMonths, setMonth, setYear } from "date-fns";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface QuickNavPopoverProps {
  currentViewDate: Date;
  calendarRef: React.RefObject<any>;
  children: React.ReactNode;
}

export function QuickNavPopover({
  currentViewDate,
  calendarRef,
  children,
}: QuickNavPopoverProps) {
  const [navDate, setNavDate] = useState(currentViewDate);
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const isCancelledRef = useRef(false);
  const selectedDateRef = useRef<Date | undefined>(undefined);

  // Sync navDate when popover opens
  useEffect(() => {
    if (isOpen) {
      setNavDate(currentViewDate);
      setView("days");
      setSelectedDate(undefined);
      selectedDateRef.current = undefined;
      isCancelledRef.current = false;
    }
  }, [isOpen, currentViewDate]);

  const handleOpenChange = (open: boolean) => {
    const calendarApi = calendarRef.current?.getApi();
    if (!open && !isCancelledRef.current && calendarApi) {
      if (selectedDateRef.current) {
        calendarApi.changeView("timeGridDay", selectedDateRef.current);
      } else {
        // If the user browsed to a different month/year but didn't pick a day,
        // still navigate to that period on close.
        calendarApi.gotoDate(navDate);
      }
    }
    setIsOpen(open);
  };

  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        calendarApi.changeView("timeGridDay", date);
      }
      setSelectedDate(date);
      selectedDateRef.current = date;
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    setIsOpen(false);
  };

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const handleMonthSelect = (monthIndex: number) => {
    setNavDate(setMonth(navDate, monthIndex));
    setView("days");
  };

  const handleYearSelect = (year: number) => {
    setNavDate(setYear(navDate, year));
    setView("months");
  };

  const years = useMemo(() => {
    const currentYear = navDate.getFullYear();
    const startYear = currentYear - 5;
    return Array.from({ length: 12 }, (_, i) => startYear + i);
  }, [navDate]);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-auto p-3 rounded-xl shadow-xl border-border/60"
        align="center"
        sideOffset={8}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            isCancelledRef.current = true;
          }
        }}
      >
        {view === "days" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md hover:bg-accent"
                  onClick={handleCancel}
                >
                  <X className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-sm font-bold hover:bg-accent rounded-md"
                  onClick={() => setView("months")}
                >
                  {format(navDate, "MMMM")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-sm font-bold hover:bg-accent rounded-md"
                  onClick={() => setView("years")}
                >
                  {format(navDate, "yyyy")}
                </Button>
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md"
                  onClick={() => setNavDate(addMonths(navDate, -1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md"
                  onClick={() => setNavDate(addMonths(navDate, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <CalendarUI
              mode="single"
              selected={selectedDate}
              onSelect={handleDaySelect}
              month={navDate}
              onMonthChange={setNavDate}
              initialFocus
              className="p-0"
              classNames={{
                nav: "hidden",
                month_caption: "hidden",
                today: "bg-primary text-primary-foreground rounded-full",
                selected: "bg-accent text-accent-foreground rounded-md",
              }}
            />
          </div>
        )}

        {view === "months" && (
          <div className="space-y-4 w-[240px]">
            <div className="flex items-center justify-center pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-sm font-bold hover:bg-accent rounded-md"
                onClick={() => setView("years")}
              >
                {navDate.getFullYear()}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {months.map((m, i) => (
                <Button
                  key={m}
                  variant={navDate.getMonth() === i ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9 text-xs font-medium rounded-md",
                    navDate.getMonth() === i
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent",
                  )}
                  onClick={() => handleMonthSelect(i)}
                >
                  {m}
                </Button>
              ))}
            </div>
          </div>
        )}

        {view === "years" && (
          <div className="space-y-4 w-[240px]">
            <div className="flex items-center justify-between px-1 pt-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md"
                onClick={() =>
                  setNavDate(setYear(navDate, navDate.getFullYear() - 12))
                }
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs font-bold tabular-nums">
                {years[0]} - {years[years.length - 1]}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md"
                onClick={() =>
                  setNavDate(setYear(navDate, navDate.getFullYear() + 12))
                }
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {years.map((y) => (
                <Button
                  key={y}
                  variant={navDate.getFullYear() === y ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9 text-xs font-medium rounded-md",
                    navDate.getFullYear() === y
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent",
                  )}
                  onClick={() => handleYearSelect(y)}
                >
                  {y}
                </Button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
