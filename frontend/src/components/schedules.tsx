import type { FormEvent } from "react";
import type { Schedule, ScheduleFormState, TaskGroup } from "@/types";
import { datePart, endOfAllDay, formatRange, startOfAllDay, timePart, withDatePart, withTimePart } from "@/lib/date";

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

export function ScheduleList({ groups, schedules, onDelete, onEdit, loading }: ScheduleListProps) {
  if (schedules.length === 0) {
    return <div className="empty">予定はまだありません</div>;
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
              編集
            </button>
            <button className="btn danger small" disabled={loading} onClick={() => onDelete(schedule.id)} type="button">
              削除
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
          <h3>{editing ? "予定編集" : "予定作成"}</h3>
          <p>グループに予定を紐付けます</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="schedule-title">タイトル</label>
        <input
          id="schedule-title"
          value={form.title}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="schedule-group">グループ</label>
        <select
          id="schedule-group"
          value={form.group_id}
          onChange={(event) => onChange({ ...form, group_id: event.target.value })}
          required
        >
          <option value="">選択</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="schedule-location">場所名</label>
        <input
          id="schedule-location"
          value={form.location_name}
          onChange={(event) => onChange({ ...form, location_name: event.target.value })}
          placeholder="任意"
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
        <span>終日</span>
      </label>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="schedule-start-date">{form.all_day ? "日付" : "開始日"}</label>
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
              <label htmlFor="schedule-start-time">開始時刻</label>
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
              <label htmlFor="schedule-end-date">終了日</label>
              <input
                id="schedule-end-date"
                type="date"
                value={datePart(form.end_time)}
                onChange={(event) => onChange({ ...form, end_time: withDatePart(form.end_time, event.target.value, "10:00") })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="schedule-end-time">終了時刻</label>
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
            キャンセル
          </button>
        ) : null}
        <button className="btn primary" disabled={loading || groups.length === 0} type="submit">
          {editing ? "更新" : "作成"}
        </button>
      </div>
    </form>
  );
}

function groupName(groups: TaskGroup[], id: string) {
  return groups.find((group) => group.id === id)?.name ?? "未分類";
}
