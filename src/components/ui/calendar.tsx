"use client"
import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const [month, setMonth] = React.useState<Date>(props.month || new Date())
  
  // Generate array of years (e.g., from 2020 to 2030)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
  
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const handleMonthChange = (newMonth: Date) => {
    setMonth(newMonth)
    props.onMonthChange?.(newMonth)
  }

  return (
    <>
      <style>{`
        .custom-calendar table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        .custom-calendar thead tr,
        .custom-calendar tbody tr {
          display: flex !important;
          width: 100% !important;
        }
        .custom-calendar th,
        .custom-calendar td {
          flex: 1 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          min-width: 0 !important;
        }
        .custom-calendar th {
          height: 36px !important;
        }
        .custom-calendar td {
          height: 36px !important;
          padding: 0 !important;
        }
      `}</style>
      <div className="space-y-4">
        {/* Year and Month Selectors */}
        <div className="flex gap-2 justify-center">
          <select
            value={month.getMonth()}
            onChange={(e) => {
              const newDate = new Date(month)
              newDate.setMonth(parseInt(e.target.value))
              handleMonthChange(newDate)
            }}
            className="px-3 py-1 border rounded-md text-sm"
          >
            {months.map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
          
          <select
            value={month.getFullYear()}
            onChange={(e) => {
              const newDate = new Date(month)
              newDate.setFullYear(parseInt(e.target.value))
              handleMonthChange(newDate)
            }}
            className="px-3 py-1 border rounded-md text-sm"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <DayPicker
          month={month}
          onMonthChange={handleMonthChange}
          showOutsideDays={showOutsideDays}
          className={cn("p-3 custom-calendar", className)}
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4",
            caption: "flex justify-center pt-1 relative items-center mb-4",
            caption_label: "text-sm font-medium",
            nav: "space-x-1 flex items-center",
            nav_button: cn(
              buttonVariants({ variant: "outline" }),
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full",
            head_row: "",
            head_cell: "text-muted-foreground font-normal text-[0.8rem]",
            row: "mt-1",
            cell: "text-center text-sm p-0 relative",
            day: cn(
              buttonVariants({ variant: "ghost" }),
              "h-8 w-8 p-0 font-normal aria-selected:opacity-100"
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
            IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
            IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
          }}
          {...props}
        />
      </div>
    </>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }