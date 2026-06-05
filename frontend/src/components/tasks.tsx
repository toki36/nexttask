import type { FormEvent } from "react";
import type { Task, TaskFormState, TaskGroup } from "@/types";
import { datePart, formatDateTime, timePart, withDatePart, withTimePart } from "@/lib/date";

type TaskListProps = {
  groups: TaskGroup[];
  tasks: Task[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (task: Task) => void;
  onStatus: (task: Task, status: Task["status"]) => Promise<void>;
  loading: boolean;
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

export function TaskList({ groups, tasks, onDelete, onEdit, onStatus, loading }: TaskListProps) {
  if (tasks.length === 0) {
    return <div className="empty">No tasks yet</div>;
  }

  return (
    <div className="item-list">
      {tasks.map((task) => (
        <article className={task.status === "completed" ? "item done" : "item"} key={task.id}>
          <div>
            <h3 className="item-title">{task.title}</h3>
            <div className="item-meta">
              <span className="pill strong">{task.group_id ? groupName(groups, task.group_id) : "No group"}</span>
              <span className={task.status === "completed" ? "pill" : "pill warn"}>
                {task.status === "completed" ? "Done" : "Open"}
              </span>
              <span className="pill">{formatDateTime(task.deadline)}</span>
              <span className="pill">{task.estimated_minutes}min</span>
              <span className="pill">Weight {task.weight}</span>
              <span className="pill">Priority {task.priority_score.toFixed(1)}</span>
              {task.location_name ? <span className="pill">{task.location_name}</span> : null}
            </div>
            {task.description ? <p className="status-line">{task.description}</p> : null}
          </div>
          <div className="actions">
            <button className="btn ghost small" disabled={loading} onClick={() => onEdit(task)} type="button">
              Edit
            </button>
            <button
              className="btn ghost small"
              disabled={loading}
              onClick={() => onStatus(task, task.status === "completed" ? "open" : "completed")}
              type="button"
            >
              {task.status === "completed" ? "Reopen" : "Done"}
            </button>
            <button className="btn danger small" disabled={loading} onClick={() => onDelete(task.id)} type="button">
              Delete
            </button>
          </div>
        </article>
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

function groupName(groups: TaskGroup[], id: string) {
  return groups.find((group) => group.id === id)?.name ?? "Ungrouped";
}
