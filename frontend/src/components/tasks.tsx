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
    return <div className="empty">タスクはまだありません</div>;
  }

  return (
    <div className="item-list">
      {tasks.map((task) => (
        <article className={task.status === "completed" ? "item done" : "item"} key={task.id}>
          <div>
            <h3 className="item-title">{task.title}</h3>
            <div className="item-meta">
              <span className="pill strong">{task.group_id ? groupName(groups, task.group_id) : "グループなし"}</span>
              <span className={task.status === "completed" ? "pill" : "pill warn"}>
                {task.status === "completed" ? "完了" : "未完了"}
              </span>
              <span className="pill">{formatDateTime(task.deadline)}</span>
              <span className="pill">{task.estimated_minutes}分</span>
              <span className="pill">重み {task.weight}</span>
              <span className="pill">優先度 {task.priority_score.toFixed(1)}</span>
              {task.location_name ? <span className="pill">{task.location_name}</span> : null}
            </div>
            {task.description ? <p className="status-line">{task.description}</p> : null}
          </div>
          <div className="actions">
            <button className="btn ghost small" disabled={loading} onClick={() => onEdit(task)} type="button">
              編集
            </button>
            <button
              className="btn ghost small"
              disabled={loading}
              onClick={() => onStatus(task, task.status === "completed" ? "open" : "completed")}
              type="button"
            >
              {task.status === "completed" ? "戻す" : "完了"}
            </button>
            <button className="btn danger small" disabled={loading} onClick={() => onDelete(task.id)} type="button">
              削除
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
          <h3>{editing ? "タスク編集" : "タスク作成"}</h3>
          <p>予定に向けた作業を追加します</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="task-title">タイトル</label>
        <input
          id="task-title"
          value={form.title}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="task-group">グループ</label>
        <select
          id="task-group"
          value={form.group_id}
          onChange={(event) => onChange({ ...form, group_id: event.target.value })}
        >
          <option value="">なし</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="task-description">説明</label>
        <textarea
          id="task-description"
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="task-location">場所名</label>
        <input
          id="task-location"
          value={form.location_name}
          onChange={(event) => onChange({ ...form, location_name: event.target.value })}
          placeholder="任意"
        />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="task-deadline-date">期限日</label>
          <input
            id="task-deadline-date"
            type="date"
            value={datePart(form.deadline)}
            onChange={(event) => onChange({ ...form, deadline: withDatePart(form.deadline, event.target.value, "23:59") })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="task-deadline-time">期限時刻</label>
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
          <label htmlFor="task-minutes">見積分</label>
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
          <label htmlFor="task-weight">重み</label>
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
            キャンセル
          </button>
        ) : null}
        <button className="btn primary" disabled={loading} type="submit">
          {editing ? "更新" : "作成"}
        </button>
      </div>
    </form>
  );
}

function groupName(groups: TaskGroup[], id: string) {
  return groups.find((group) => group.id === id)?.name ?? "未分類";
}
