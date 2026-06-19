import type { CSSProperties, FormEvent } from "react";
import type { Schedule, ScheduleFormState, Task, TaskGroup } from "@/types";
import {
  dateKey,
  datePart,
  endOfAllDay,
  formatMonthLabel,
  formatRange,
  isAllDayRange,
  startOfAllDay,
  timePart,
  withDatePart,
  withTimePart,
} from "@/lib/date";

type ScheduleListProps = {
  groups: TaskGroup[];
  schedules: Schedule[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (schedule: Schedule) => void;
  loading: boolean;
};

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
  month: Date;
  schedules: Schedule[];
  tasks: Task[];
  selectedDate: string;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: string) => void;
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
  columnStart: number;
  columnEnd: number;
  lane: number;
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ScheduleCalendar({
  month,
  schedules = [],
  tasks = [],
  selectedDate,
  onMonthChange,
  onSelectDate,
}: ScheduleCalendarProps) {
  const cells = calendarCells(month);
  const weeks = chunkWeeks(cells);
  const todayKey = dateKey(new Date());

  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        <button className="btn ghost small" onClick={() => onMonthChange(addMonths(month, -1))} type="button">
          Previous
        </button>
        <h4>{formatMonthLabel(month)}</h4>
        <button className="btn ghost small" onClick={() => onMonthChange(addMonths(month, 1))} type="button">
          Next
        </button>
      </div>
      <div className="calendar-weekdays">
        {weekdays.map((weekday) => (
          <div key={weekday}>{weekday}</div>
        ))}
      </div>
      <div className="calendar-grid">
        {weeks.map((week) => {
          const bars = calendarBarsForWeek(schedules, tasks, week);
          const laneCount = Math.max(1, ...bars.map((bar) => bar.lane + 1));

          return (
            <div
              className="calendar-week"
              key={week[0].key}
              style={{ "--calendar-lanes": laneCount } as CSSProperties}
            >
              <div className="calendar-week-days">
                {week.map((cell) => {
                  const active = selectedDate === cell.key;
                  const today = todayKey === cell.key;
                  const hasItems = calendarItemsForDate(schedules, tasks, cell.key).length > 0;

                  return (
                    <button
                      className={[
                        "calendar-day",
                        cell.inMonth ? "" : "muted",
                        active ? "active" : "",
                        today ? "today" : "",
                        hasItems ? "has-items" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={cell.key}
                      onClick={() => onSelectDate(active ? "" : cell.key)}
                      type="button"
                    >
                      <span className="calendar-date-number">{cell.date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
              <div className="calendar-bars" aria-hidden="true">
                {bars.map((bar) => (
                  <div
                    className={[
                      "calendar-bar",
                      bar.type === "task" ? "task" : "",
                      bar.allDay ? "all-day" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={`${bar.type}-${bar.id}-${bar.columnStart}-${bar.columnEnd}`}
                    style={{
                      gridColumn: `${bar.columnStart} / ${bar.columnEnd}`,
                      gridRow: bar.lane + 1,
                    }}
                    title={bar.title}
                  >
                    {bar.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ScheduleList({ groups, schedules, onDelete, onEdit, loading }: ScheduleListProps) {
  if (schedules.length === 0) {
    return <div className="empty">No schedules yet</div>;
  }

  return (
    <div className="item-list">
      {schedules.map((schedule) => (
        <article className="item" key={schedule.id}>
          <div>
            <h3 className="item-title">{schedule.title}</h3>
            <div className="item-meta">
              <span>{schedule.group_id ? groupName(groups, schedule.group_id) : "No group"}</span>
              <span>{formatRange(schedule.start_time, schedule.end_time)}</span>
              {schedule.location_name ? <span>{schedule.location_name}</span> : null}
            </div>
          </div>
          <div className="actions">
            <button className="btn ghost small" disabled={loading} onClick={() => onEdit(schedule)} type="button">
              Edit
            </button>
            <button className="btn danger small" disabled={loading} onClick={() => onDelete(schedule.id)} type="button">
              Delete
            </button>
          </div>
        </article>
      ))}
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
  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="section-header" style={{ padding: 0, borderBottom: 0 }}>
        <div>
          <h3>{editing ? "Edit schedule" : "Create schedule"}</h3>
          <p>Create a calendar block with an optional group</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="schedule-title">Title</label>
        <input
          id="schedule-title"
          value={form.title}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
          required
        />
      </div>
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
        <label htmlFor="schedule-location">Location</label>
        <input
          id="schedule-location"
          value={form.location_name}
          onChange={(event) => onChange({ ...form, location_name: event.target.value })}
          placeholder="Optional"
        />
      </div>
      <label className="checkbox-field" htmlFor="schedule-all-day">
        <input
          id="schedule-all-day"
          type="checkbox"
          checked={form.all_day}
          onChange={(event) => {
            const allDay = event.target.checked;
            const startDate = datePart(form.start_time);
            onChange({
              ...form,
              all_day: allDay,
              start_time: allDay && startDate ? startOfAllDay(startDate) : form.start_time,
              end_time: allDay && startDate ? endOfAllDay(startDate) : form.end_time,
            });
          }}
        />
        <span>All day</span>
      </label>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="schedule-start-date">{form.all_day ? "Date" : "Start date"}</label>
          <input
            id="schedule-start-date"
            type="date"
            value={datePart(form.start_time)}
            onChange={(event) => {
              const date = event.target.value;
              onChange({
                ...form,
                start_time: form.all_day ? startOfAllDay(date) : withDatePart(form.start_time, date, "09:00"),
                end_time: form.all_day ? endOfAllDay(date) : form.end_time,
              });
            }}
            required
          />
        </div>
        {!form.all_day ? (
          <>
            <div className="field">
              <label htmlFor="schedule-start-time">Start time</label>
              <input
                id="schedule-start-time"
                type="time"
                value={timePart(form.start_time)}
                onChange={(event) => onChange({ ...form, start_time: withTimePart(form.start_time, event.target.value) })}
                disabled={!datePart(form.start_time)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="schedule-end-date">End date</label>
              <input
                id="schedule-end-date"
                type="date"
                value={datePart(form.end_time)}
                onChange={(event) => onChange({ ...form, end_time: withDatePart(form.end_time, event.target.value, "10:00") })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="schedule-end-time">End time</label>
              <input
                id="schedule-end-time"
                type="time"
                value={timePart(form.end_time)}
                onChange={(event) => onChange({ ...form, end_time: withTimePart(form.end_time, event.target.value) })}
                disabled={!datePart(form.end_time)}
                required
              />
            </div>
          </>
        ) : null}
      </div>
      <div className="actions">
        {editing ? (
          <button className="btn ghost" onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
        <button className="btn primary" disabled={loading} type="submit">
          {editing ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

function groupName(groups: TaskGroup[], id: string) {
  return groups.find((group) => group.id === id)?.name ?? "Ungrouped";
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

function calendarBarsForWeek(schedules: Schedule[], tasks: Task[], week: CalendarCell[]) {
  const weekStart = startOfDate(week[0].date);
  const weekEnd = startOfDate(week[6].date);
  const calendarItems = [
    ...schedules.map((schedule) => ({
      id: schedule.id,
      title: schedule.title,
      type: "schedule" as const,
      allDay: isAllDayRange(toLocalDateTime(schedule.start_time), toLocalDateTime(schedule.end_time)),
      start: scheduleDateStart(schedule),
      end: scheduleDateEnd(schedule),
    })),
    ...tasks.map((task) => ({
      id: task.id,
      title: task.title,
      type: "task" as const,
      allDay: false,
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
        columnStart: daysBetween(weekStart, visibleStart) + 1,
        columnEnd: daysBetween(weekStart, visibleEnd) + 2,
        lane: 0,
      };
    })
    .filter((bar): bar is CalendarBar => bar !== null)
    .sort((a, b) => {
      if (a.columnStart !== b.columnStart) return a.columnStart - b.columnStart;
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
