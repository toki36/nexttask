import { useState, type FormEvent } from "react";
import type { Task, TaskFormState, TaskGroup } from "@/types";
import { formatDateTime } from "@/lib/date";
import { taskPriorityLabel, taskPriorityLevel } from "@/lib/priority";

type TaskListProps = {
  groups: TaskGroup[];
  status: Task["status"];
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

export function TaskList({ groups, status, tasks, onSelect }: TaskListProps) {
  if (tasks.length === 0) {
    return <div className="empty">{status === "completed" ? "No completed tasks" : "No open tasks"}</div>;
  }

  return (
    <div className="item-list">
      {tasks.map((task) => {
        const priority = taskPriorityLevel(task.priority_score);
        const priorityLabel = task.status === "completed" ? "" : taskPriorityLabel(priority);
        const completion = task.status === "completed" ? completionTiming(task) : null;

        return (
          <button
            className={[
              "item",
              "task-item",
              task.status === "completed" ? "done" : "",
              task.status !== "completed" ? `priority-${priority}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={task.id}
            onClick={() => onSelect(task)}
            type="button"
          >
            <span className="task-state-dot" aria-hidden="true" />
            <div className="task-copy">
              <div className="task-title-row">
                <h3 className="item-title">{task.title}</h3>
                {priorityLabel ? <span className={`priority-label ${priority}`}>{priorityLabel}</span> : null}
              </div>
              {task.status === "open" ? (
                <div className="task-compact-meta">
                  <span>Due {formatDateTime(task.deadline)}</span>
                  <span>{formatEstimate(task.estimated_minutes)}</span>
                </div>
              ) : (
                <div className="completed-task-meta">
                  <span>{task.completed_at ? `Completed ${formatDateTime(task.completed_at)}` : "Completed"}</span>
                  {completion?.label ? <span className={completion.late ? "late" : ""}>{completion.label}</span> : null}
                  {task.group_id ? (
                    <span>{groups.find((group) => group.id === task.group_id)?.name ?? "Ungrouped"}</span>
                  ) : null}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function completionTiming(task: Task) {
  if (!task.completed_at) return { label: "", late: false };

  const minutes = Math.round(
    (new Date(task.deadline).getTime() - new Date(task.completed_at).getTime()) / 60_000,
  );
  const late = minutes < 0;
  const absoluteMinutes = Math.abs(minutes);

  if (absoluteMinutes < 2) return { label: "On time", late };
  if (absoluteMinutes < 60) return { label: `${absoluteMinutes} min ${late ? "late" : "early"}`, late };
  if (absoluteMinutes < 2880) {
    return { label: `${Math.round(absoluteMinutes / 60)} hr ${late ? "late" : "early"}`, late };
  }
  return { label: `${Math.round(absoluteMinutes / 1440)} days ${late ? "late" : "early"}`, late };
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
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(
    Boolean(form.group_id || form.location_name || form.description || form.start_time),
  );

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="task-title">Title</label>
        <input
          id="task-title"
          value={form.title}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
          required
        />
      </div>

      <div className="form-section">
        <div className="form-section-heading">
          <h3>Plan</h3>
          <span>Required</span>
        </div>
        <div className="field">
          <label htmlFor="task-deadline">Due</label>
          <input
            id="task-deadline"
            min={form.start_time || undefined}
            type="datetime-local"
            value={form.deadline}
            onChange={(event) => onChange({ ...form, deadline: event.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="task-minutes">Estimate</label>
          <div className="estimate-control">
            <div className="estimate-presets" aria-label="Estimate presets">
              {[
                ["15m", "15"],
                ["30m", "30"],
                ["1h", "60"],
                ["2h", "120"],
              ].map(([label, minutes]) => (
                <button
                  className={form.estimated_minutes === minutes ? "active" : ""}
                  key={minutes}
                  onClick={() => onChange({ ...form, estimated_minutes: minutes })}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="number-with-unit">
              <input
                aria-label="Custom estimate in minutes"
                id="task-minutes"
                min={1}
                type="number"
                value={form.estimated_minutes}
                onChange={(event) => onChange({ ...form, estimated_minutes: event.target.value })}
                required
              />
              <span>min</span>
            </div>
          </div>
        </div>
        <div className="field weight-field">
          <div className="weight-label">
            <label htmlFor="task-weight">Weight</label>
            <output htmlFor="task-weight">{form.weight}</output>
          </div>
          <input
            aria-describedby="task-weight-hint"
            id="task-weight"
            min={1}
            max={10}
            step={1}
            type="range"
            value={form.weight}
            onChange={(event) => onChange({ ...form, weight: event.target.value })}
            required
          />
          <div className="range-scale" id="task-weight-hint">
            <span>Low impact</span>
            <span>High impact</span>
          </div>
        </div>
      </div>

      <details
        className="form-disclosure"
        open={moreOptionsOpen}
        onToggle={(event) => setMoreOptionsOpen(event.currentTarget.open)}
      >
        <summary>More options</summary>
        <div className="form-disclosure-body">
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
            <label htmlFor="task-start-time">Start <span className="optional-label">Optional</span></label>
            <input
              id="task-start-time"
              max={form.deadline || undefined}
              type="datetime-local"
              value={form.start_time}
              onChange={(event) => onChange({ ...form, start_time: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="task-location">Location <span className="optional-label">Optional</span></label>
            <input
              id="task-location"
              value={form.location_name}
              onChange={(event) => onChange({ ...form, location_name: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="task-description">Notes <span className="optional-label">Optional</span></label>
            <textarea
              id="task-description"
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
            />
          </div>
        </div>
      </details>

      <div className="form-actions">
        <button className="btn ghost" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="btn primary" disabled={loading} type="submit">
          {editing ? "Update task" : "Create task"}
        </button>
      </div>
    </form>
  );
}

function formatEstimate(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
}
