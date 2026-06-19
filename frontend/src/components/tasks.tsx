import type { FormEvent } from "react";
import type { Task, TaskFormState, TaskGroup } from "@/types";
import { datePart, timePart, withDatePart, withTimePart } from "@/lib/date";

type TaskListProps = {
  tasks: Task[];
  onSelect: (task: Task) => void;
};

type TaskFormProps = {
  editing: boolean;
  form: TaskFormState;
  groups: TaskGroup[];
  loading: boolean;
  onCancel: () => void;
  onChange: (form: TaskFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function TaskList({ tasks, onSelect }: TaskListProps) {
  if (tasks.length === 0) {
    return <div className="empty">No tasks yet</div>;
  }

  return (
    <div className="item-list">
      {tasks.map((task) => (
        <button
          className={task.status === "completed" ? "item task-item done" : "item task-item"}
          key={task.id}
          onClick={() => onSelect(task)}
          type="button"
        >
          <div>
            <h3 className="item-title">{task.title}</h3>
            {task.description ? <p className="status-line">{task.description}</p> : null}
          </div>
        </button>
      ))}
    </div>
  );
}

export function TaskForm({
  editing,
  form,
  groups,
  loading,
  onCancel,
  onChange,
  onSubmit,
}: TaskFormProps) {
  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="section-header" style={{ padding: 0, borderBottom: 0 }}>
        <div>
          <h3>{editing ? "Edit task" : "Create task"}</h3>
          <p>Add work that supports a schedule</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="task-title">Title</label>
        <input
          id="task-title"
          value={form.title}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="task-group">Group</label>
        <select
          id="task-group"
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
        <label htmlFor="task-description">Description</label>
        <textarea
          id="task-description"
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="task-location">Location</label>
        <input
          id="task-location"
          value={form.location_name}
          onChange={(event) => onChange({ ...form, location_name: event.target.value })}
          placeholder="Optional"
        />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="task-start-date">Start date</label>
          <input
            id="task-start-date"
            type="date"
            value={datePart(form.start_time)}
            onChange={(event) =>
              onChange({ ...form, start_time: event.target.value ? withDatePart(form.start_time, event.target.value, "09:00") : "" })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="task-start-time">Start time</label>
          <input
            id="task-start-time"
            type="time"
            value={timePart(form.start_time)}
            onChange={(event) => onChange({ ...form, start_time: withTimePart(form.start_time, event.target.value) })}
            disabled={!datePart(form.start_time)}
          />
        </div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="task-deadline-date">Due date</label>
          <input
            id="task-deadline-date"
            type="date"
            value={datePart(form.deadline)}
            onChange={(event) => onChange({ ...form, deadline: withDatePart(form.deadline, event.target.value, "23:59") })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="task-deadline-time">Due time</label>
          <input
            id="task-deadline-time"
            type="time"
            value={timePart(form.deadline)}
            onChange={(event) => onChange({ ...form, deadline: withTimePart(form.deadline, event.target.value) })}
            disabled={!datePart(form.deadline)}
            required
          />
        </div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="task-minutes">Estimate minutes</label>
          <input
            id="task-minutes"
            min={1}
            type="number"
            value={form.estimated_minutes}
            onChange={(event) => onChange({ ...form, estimated_minutes: event.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="task-weight">Weight</label>
          <input
            id="task-weight"
            min={1}
            type="number"
            value={form.weight}
            onChange={(event) => onChange({ ...form, weight: event.target.value })}
            required
          />
        </div>
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
