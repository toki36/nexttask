import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { Schedule, ScheduleFormState, Task, TaskGroup } from "@/types";
import {
  dateKey,
  datePart,
  endOfAllDay,
  formatMonthLabel,
  isAllDayRange,
  startOfAllDay,
  timePart,
} from "@/lib/date";
import { taskPriorityLevel, type TaskPriorityLevel } from "@/lib/priority";
import { groupColor } from "@/lib/group-colors";

type ScheduleFormProps = {
  editing: boolean;
  form: ScheduleFormState;
  groups: TaskGroup[];
  loading: boolean;
  onCancel: () => void;
  onChange: (form: ScheduleFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

type ScheduleCalendarProps = {
  groups: TaskGroup[];
  month: Date;
  schedules: Schedule[];
  tasks: Task[];
  onMonthChange: (month: Date) => void;
  onSelectSchedule: (schedule: Schedule) => void;
  onSelectTask: (task: Task) => void;
};

type CalendarCell = {
  date: Date;
  key: string;
  inMonth: boolean;
};

type CalendarBar = {
  id: string;
  title: string;
  type: "schedule" | "task";
  allDay: boolean;
  priorityScore: number;
  priorityLevel: TaskPriorityLevel;
  color: string | undefined;
  columnStart: number;
  columnEnd: number;
  lane: number;
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function ScheduleCalendar({
  groups,
  month,
  schedules = [],
  tasks = [],
  onMonthChange,
  onSelectSchedule,
  onSelectTask,
}: ScheduleCalendarProps) {
  const cells = calendarCells(month);
  const weeks = chunkWeeks(cells);
  const todayKey = dateKey(new Date());
  const scheduleByID = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  const taskByID = new Map(tasks.map((task) => [task.id, task]));

  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        <button
          aria-label="Previous month"
          className="calendar-nav-button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          title="Previous month"
          type="button"
        >
          &#8592;
        </button>
        <h4>{formatMonthLabel(month)}</h4>
        <button
          aria-label="Next month"
          className="calendar-nav-button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          title="Next month"
          type="button"
        >
          &#8594;
        </button>
      </div>
      <div className="calendar-weekdays">
        {weekdays.map((weekday) => (
          <div key={weekday}>{weekday}</div>
        ))}
      </div>
      <div className="calendar-grid">
        {weeks.map((week) => {
          const bars = calendarBarsForWeek(schedules, tasks, groups, week);
          const laneCount = Math.max(1, ...bars.map((bar) => bar.lane + 1));

          return (
            <div
              className="calendar-week"
              key={week[0].key}
              style={{ "--calendar-lanes": laneCount } as CSSProperties}
            >
              <div className="calendar-week-days">
                {week.map((cell) => {
                  const today = todayKey === cell.key;
                  const hasItems = calendarItemsForDate(schedules, tasks, cell.key).length > 0;

                  return (
                    <div
                      className={[
                        "calendar-day",
                        cell.inMonth ? "" : "muted",
                        today ? "today" : "",
                        hasItems ? "has-items" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={cell.key}
                    >
                      <span className="calendar-date-number">{cell.date.getDate()}</span>
                    </div>
                  );
                })}
              </div>
              <div className="calendar-bars">
                {bars.map((bar) => {
                  const style = {
                    "--task-color": bar.color,
                    gridColumn: `${bar.columnStart} / ${bar.columnEnd}`,
                    gridRow: bar.lane + 1,
                  } as CSSProperties;

                  if (bar.type === "task") {
                    const task = taskByID.get(bar.id);
                    return (
                      <button
                        className={`calendar-bar task priority-${bar.priorityLevel}`}
                        key={`${bar.type}-${bar.id}-${bar.columnStart}-${bar.columnEnd}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (task) onSelectTask(task);
                        }}
                        style={style}
                        title={bar.title}
                        type="button"
                      >
                        {bar.title}
                      </button>
                    );
                  }

                  const schedule = scheduleByID.get(bar.id);
                  return (
                    <button
                      className={["calendar-bar", "schedule", bar.allDay ? "all-day" : ""].filter(Boolean).join(" ")}
                      key={`${bar.type}-${bar.id}-${bar.columnStart}-${bar.columnEnd}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (schedule) onSelectSchedule(schedule);
                      }}
                      style={style}
                      title={bar.title}
                      type="button"
                    >
                      {bar.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ScheduleForm({
  editing,
  form,
  groups,
  loading,
  onCancel,
  onChange,
  onSubmit,
}: ScheduleFormProps) {
  const timedRangeRef = useRef<{ start: string; end: string } | null>(null);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(Boolean(form.group_id || form.location_name));

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="schedule-title">Title</label>
        <input
          id="schedule-title"
          value={form.title}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
          required
        />
      </div>

      <div className="form-section">
        <div className="form-section-heading">
          <h3>When</h3>
          <label className="switch-field" htmlFor="schedule-all-day">
            <input
              checked={form.all_day}
              id="schedule-all-day"
              role="switch"
              type="checkbox"
              onChange={(event) => {
                const allDay = event.target.checked;
                const startDate = datePart(form.start_time);
                if (allDay && form.start_time && form.end_time) {
                  timedRangeRef.current = { start: form.start_time, end: form.end_time };
                }
                const restored = timedRangeRef.current;
                onChange({
                  ...form,
                  all_day: allDay,
                  start_time: allDay
                    ? startOfAllDay(startDate)
                    : restored?.start ?? (startDate ? `${startDate}T09:00` : ""),
                  end_time: allDay
                    ? endOfAllDay(startDate)
                    : restored?.end ?? (startDate ? `${startDate}T10:00` : ""),
                });
              }}
            />
            <span className="switch-control" aria-hidden="true" />
            <span>All day</span>
          </label>
        </div>
        {form.all_day ? (
          <div className="field">
            <label htmlFor="schedule-date">Date</label>
            <input
              id="schedule-date"
              type="date"
              value={datePart(form.start_time)}
              onChange={(event) => {
                const date = event.target.value;
                onChange({
                  ...form,
                  start_time: startOfAllDay(date),
                  end_time: endOfAllDay(date),
                });
              }}
              required
            />
          </div>
        ) : (
          <div className="form-grid">
            <div className="field">
              <label htmlFor="schedule-start">Start</label>
              <input
                id="schedule-start"
                type="datetime-local"
                value={form.start_time}
                onChange={(event) => {
                  const start = event.target.value;
                  onChange({
                    ...form,
                    start_time: start,
                    end_time: nextScheduleEnd(start, form.end_time),
                  });
                }}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="schedule-end">End</label>
              <input
                id="schedule-end"
                type="datetime-local"
                value={form.end_time}
                min={form.start_time}
                onChange={(event) => onChange({ ...form, end_time: event.target.value })}
                required
              />
            </div>
          </div>
        )}
      </div>

      <details
        className="form-disclosure"
        open={moreOptionsOpen}
        onToggle={(event) => setMoreOptionsOpen(event.currentTarget.open)}
      >
        <summary>More options</summary>
        <div className="form-disclosure-body">
          <div className="field">
            <label htmlFor="schedule-group">Group</label>
            <select
              id="schedule-group"
              value={form.group_id}
              onChange={(event) => onChange({ ...form, group_id: event.target.value })}
            >
              <option value="">None</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="schedule-location">Location <span className="optional-label">Optional</span></label>
            <input
              id="schedule-location"
              value={form.location_name}
              onChange={(event) => onChange({ ...form, location_name: event.target.value })}
            />
          </div>
        </div>
      </details>

      <div className="form-actions">
        <button className="btn ghost" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="btn primary" disabled={loading} type="submit">
          {editing ? "Update schedule" : "Create schedule"}
        </button>
      </div>
    </form>
  );
}

function nextScheduleEnd(start: string, currentEnd: string) {
  if (!start) return currentEnd;
  if (currentEnd && new Date(currentEnd).getTime() > new Date(start).getTime()) return currentEnd;

  const end = new Date(new Date(start).getTime() + 60 * 60 * 1000);
  return toLocalDateTime(end.toISOString());
}

function calendarCells(month: Date): CalendarCell[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: dateKey(date),
      inMonth: date.getMonth() === month.getMonth(),
    };
  });
}

function chunkWeeks(cells: CalendarCell[]) {
  return Array.from({ length: 6 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}

function addMonths(month: Date, amount: number) {
  return new Date(month.getFullYear(), month.getMonth() + amount, 1);
}

function calendarItemsForDate(schedules: Schedule[], tasks: Task[], targetDate: string) {
  const target = new Date(`${targetDate}T00:00`);
  const matchingSchedules = schedules.filter((schedule) => {
    return scheduleDateStart(schedule) <= target && target <= scheduleDateEnd(schedule);
  });
  const matchingTasks = tasks.filter((task) => {
    const range = taskDateRange(task);
    return range.start <= target && target <= range.end;
  });
  return [...matchingSchedules, ...matchingTasks];
}

function calendarBarsForWeek(
  schedules: Schedule[],
  tasks: Task[],
  groups: TaskGroup[],
  week: CalendarCell[],
): CalendarBar[] {
  const weekStart = startOfDate(week[0].date);
  const weekEnd = startOfDate(week[6].date);
  const calendarItems = [
    ...schedules.map((schedule) => ({
      id: schedule.id,
      title: schedule.title,
      type: "schedule" as const,
      allDay: isAllDayRange(toLocalDateTime(schedule.start_time), toLocalDateTime(schedule.end_time)),
      priorityScore: Number.NEGATIVE_INFINITY,
      priorityLevel: "normal" as const,
      color: undefined,
      start: scheduleDateStart(schedule),
      end: scheduleDateEnd(schedule),
    })),
    ...tasks.map((task) => ({
      id: task.id,
      title: task.title,
      type: "task" as const,
      allDay: false,
      priorityScore: task.priority_score,
      priorityLevel: taskPriorityLevel(task.priority_score),
      color: groupColor(groups, task.group_id),
      ...taskDateRange(task),
    })),
  ];

  const bars = calendarItems
    .map((item) => {
      if (item.end < weekStart || item.start > weekEnd) return null;

      const visibleStart = item.start < weekStart ? weekStart : item.start;
      const visibleEnd = item.end > weekEnd ? weekEnd : item.end;
      return {
        id: item.id,
        title: item.title,
        type: item.type,
        allDay: item.allDay,
        priorityScore: item.priorityScore,
        priorityLevel: item.priorityLevel,
        color: item.color,
        columnStart: daysBetween(weekStart, visibleStart) + 1,
        columnEnd: daysBetween(weekStart, visibleEnd) + 2,
        lane: 0,
      };
    })
    .filter((bar): bar is CalendarBar => bar !== null)
    .sort((a, b) => {
      if (a.type === "task" && b.type === "task" && a.priorityScore !== b.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      if (a.columnStart !== b.columnStart) return a.columnStart - b.columnStart;
      if (a.type !== b.type) return a.type === "schedule" ? -1 : 1;
      return b.columnEnd - b.columnStart - (a.columnEnd - a.columnStart);
    });

  const laneEnds: number[] = [];
  for (const bar of bars) {
    const lane = laneEnds.findIndex((end) => end <= bar.columnStart);
    if (lane === -1) {
      bar.lane = laneEnds.length;
      laneEnds.push(bar.columnEnd);
    } else {
      bar.lane = lane;
      laneEnds[lane] = bar.columnEnd;
    }
  }

  return bars;
}

function scheduleDateStart(schedule: Schedule) {
  return startOfDate(new Date(toLocalDateTime(schedule.start_time)));
}

function scheduleDateEnd(schedule: Schedule) {
  const localEnd = toLocalDateTime(schedule.end_time);
  const end = startOfDate(new Date(localEnd));
  if (timePart(localEnd) === "00:00" && end.getTime() > scheduleDateStart(schedule).getTime()) {
    end.setDate(end.getDate() - 1);
  }
  return end;
}

function taskDateRange(task: Task) {
  const today = startOfDate(new Date());
  if (task.start_time) {
    const start = startOfDate(new Date(toLocalDateTime(task.start_time)));
    const end = startOfDate(new Date(toLocalDateTime(task.deadline)));
    return end < start ? { start: end, end: start } : { start, end };
  }
  const deadline = startOfDate(new Date(toLocalDateTime(task.deadline)));
  return deadline < today ? { start: deadline, end: today } : { start: today, end: deadline };
}

function startOfDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(start: Date, end: Date) {
  return Math.round((startOfDate(end).getTime() - startOfDate(start).getTime()) / 86_400_000);
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
