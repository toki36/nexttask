import { formatDateTime } from "@/lib/date";
import { taskPriorityLabel, taskPriorityLevel } from "@/lib/priority";
import type { Task, TaskGroup } from "@/types";

type TaskDetailProps = {
  groups: TaskGroup[];
  loading: boolean;
  task: Task;
  onDelete: (taskID: string) => Promise<void>;
  onEdit: (task: Task) => void;
  onToggleStatus: (task: Task) => Promise<void>;
};

export function TaskDetail({
  groups,
  loading,
  task,
  onDelete,
  onEdit,
  onToggleStatus,
}: TaskDetailProps) {
  const groupName = task.group_id
    ? groups.find((group) => group.id === task.group_id)?.name
    : null;
  const priority = taskPriorityLevel(task.priority_score);
  const priorityLabel = task.status === "completed" ? "Completed" : taskPriorityLabel(priority);

  return (
    <div className="task-detail">
      <section className="task-detail-overview">
        <div className="task-detail-overview-heading">
          <span className="task-detail-label">Due</span>
          {priorityLabel ? (
            <span className={`task-detail-status ${task.status === "completed" ? "completed" : priority}`}>
              {priorityLabel}
            </span>
          ) : null}
        </div>
        <strong className="task-detail-deadline">{formatDateTime(task.deadline)}</strong>
        {task.status === "completed" && task.completed_at ? (
          <p className="task-detail-start">Completed {formatDateTime(task.completed_at)}</p>
        ) : task.start_time ? (
          <p className="task-detail-start">Starts {formatDateTime(task.start_time)}</p>
        ) : null}
      </section>

      <dl className="task-detail-facts">
        <div>
          <dt>Estimate</dt>
          <dd>{formatDuration(task.estimated_minutes)}</dd>
        </div>
        {task.importance !== 2 ? (
          <div>
            <dt>Importance</dt>
            <dd>{task.importance === 3 ? "High" : "Low"}</dd>
          </div>
        ) : null}
        {groupName ? (
          <div>
            <dt>Group</dt>
            <dd>{groupName}</dd>
          </div>
        ) : null}
        {task.location_name ? (
          <div>
            <dt>Location</dt>
            <dd>{task.location_name}</dd>
          </div>
        ) : null}
      </dl>

      {task.description ? (
        <section className="task-detail-description">
          <h3>Notes</h3>
          <p>{task.description}</p>
        </section>
      ) : null}

      <div className="task-detail-actions">
        <button
          className="btn danger"
          disabled={loading}
          onClick={() => void onDelete(task.id)}
          type="button"
        >
          Delete
        </button>
        <div className="actions">
          <button className="btn ghost" disabled={loading} onClick={() => onEdit(task)} type="button">
            Edit
          </button>
          <button
            className="btn primary"
            disabled={loading}
            onClick={() => void onToggleStatus(task)}
            type="button"
          >
            {task.status === "completed" ? "Reopen" : "Mark done"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} hr` : `${hours} hr ${remainingMinutes} min`;
}
