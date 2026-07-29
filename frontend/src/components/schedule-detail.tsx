import { formatRange } from "@/lib/date";
import type { Schedule, TaskGroup } from "@/types";

type ScheduleDetailProps = {
  groups: TaskGroup[];
  loading: boolean;
  schedule: Schedule;
  onDelete: (scheduleID: string) => Promise<void>;
  onEdit: (schedule: Schedule) => void;
};

export function ScheduleDetail({
  groups,
  loading,
  schedule,
  onDelete,
  onEdit,
}: ScheduleDetailProps) {
  const groupName = schedule.group_id
    ? groups.find((group) => group.id === schedule.group_id)?.name
    : null;

  return (
    <div className="schedule-detail">
      <section className="schedule-detail-time">
        <span className="task-detail-label">When</span>
        <strong>{formatRange(schedule.start_time, schedule.end_time)}</strong>
      </section>

      {groupName || schedule.location_name ? (
        <dl className="task-detail-facts">
          {groupName ? (
            <div>
              <dt>Group</dt>
              <dd>{groupName}</dd>
            </div>
          ) : null}
          {schedule.location_name ? (
            <div>
              <dt>Location</dt>
              <dd>{schedule.location_name}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="task-detail-actions">
        <button
          className="btn danger"
          disabled={loading}
          onClick={() => void onDelete(schedule.id)}
          type="button"
        >
          Delete
        </button>
        <button className="btn primary" disabled={loading} onClick={() => onEdit(schedule)} type="button">
          Edit
        </button>
      </div>
    </div>
  );
}
