import type { FormEvent } from "react";
import type { Schedule, ScheduleFormState, TaskGroup } from "@/types";
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
  selectedDate: string;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: string) => void;
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ScheduleCalendar({
  month,
  schedules,
  selectedDate,
  onMonthChange,
  onSelectDate,
}: ScheduleCalendarProps) {
  const cells = calendarCells(month);

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
        {cells.map((cell) => {
          const daySchedules = schedulesForDate(schedules, cell.key);
          const active = selectedDate === cell.key;

          return (
            <button
              className={[
                "calendar-day",
                cell.inMonth ? "" : "muted",
                active ? "active" : "",
                daySchedules.length > 0 ? "has-items" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={cell.key}
              onClick={() => onSelectDate(active ? "" : cell.key)}
              type="button"
            >
              <span className="calendar-date-number">{cell.date.getDate()}</span>
              <span className="calendar-items">
                {daySchedules.slice(0, 2).map((schedule) => (
                  <span className="calendar-item" key={schedule.id}>
                    {isAllDayRange(toLocalDateTime(schedule.start_time), toLocalDateTime(schedule.end_time))
                      ? "All day "
                      : ""}
                    {schedule.title}
                  </span>
                ))}
                {daySchedules.length > 2 ? <span className="calendar-more">+{daySchedules.length - 2}</span> : null}
              </span>
            </button>
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
              <span className="pill strong">{groupName(groups, schedule.group_id)}</span>
              <span className="pill">{formatRange(schedule.start_time, schedule.end_time)}</span>
              {schedule.location_name ? <span className="pill">{schedule.location_name}</span> : null}
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
          <p>Attach a schedule to a group</p>
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
          required
        >
          <option value="">Select</option>
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
        <button className="btn primary" disabled={loading || groups.length === 0} type="submit">
          {editing ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

function groupName(groups: TaskGroup[], id: string) {
  return groups.find((group) => group.id === id)?.name ?? "Ungrouped";
}

function calendarCells(month: Date) {
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

function addMonths(month: Date, amount: number) {
  return new Date(month.getFullYear(), month.getMonth() + amount, 1);
}

function schedulesForDate(schedules: Schedule[], targetDate: string) {
  return schedules.filter((schedule) => datePart(toLocalDateTime(schedule.start_time)) === targetDate);
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
