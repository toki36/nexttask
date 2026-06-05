import type { FormEvent } from "react";
import type { TaskGroup } from "@/types";

type GroupsSidebarProps = {
  editingGroupID: string | null;
  groupEditName: string;
  groupScheduleCounts: Record<string, number>;
  groups: TaskGroup[];
  loading: boolean;
  schedulesCount: number;
  selectedGroup: TaskGroup | null;
  selectedGroupID: string;
  onCancelGroupEdit: () => void;
  onDeleteGroup: (groupID: string) => Promise<void>;
  onGroupEditNameChange: (name: string) => void;
  onOpenCreateGroup: () => void;
  onSaveGroupName: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSelectGroup: (groupID: string) => void;
  onStartGroupEdit: (group: TaskGroup) => void;
};

export function GroupsSidebar({
  editingGroupID,
  groupEditName,
  groupScheduleCounts,
  groups,
  loading,
  schedulesCount,
  selectedGroup,
  selectedGroupID,
  onCancelGroupEdit,
  onDeleteGroup,
  onGroupEditNameChange,
  onOpenCreateGroup,
  onSaveGroupName,
  onSelectGroup,
  onStartGroupEdit,
}: GroupsSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="section-header">
        <div>
          <h2>Group</h2>
          <p>Organize related schedules and tasks</p>
        </div>
      </div>
      <div className="group-list">
        <button
          className={selectedGroupID === "all" ? "group-button active" : "group-button"}
          onClick={() => onSelectGroup("all")}
          type="button"
        >
          <span className="group-name">All</span>
          <span className="group-count">{schedulesCount}</span>
        </button>
        {groups.map((group) => (
          <button
            className={selectedGroupID === group.id ? "group-button active" : "group-button"}
            key={group.id}
            onClick={() => onSelectGroup(group.id)}
            type="button"
          >
            <span className="group-name">{group.name}</span>
            <span className="group-count">{groupScheduleCounts[group.id] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="stack" style={{ padding: 16, paddingTop: 6 }}>
        {editingGroupID ? (
          <form className="stack" onSubmit={onSaveGroupName}>
            <div className="field">
              <label htmlFor="group-edit-name">Edit group name</label>
              <input
                id="group-edit-name"
                value={groupEditName}
                onChange={(event) => onGroupEditNameChange(event.target.value)}
              />
            </div>
            <div className="actions">
              <button className="btn ghost" onClick={onCancelGroupEdit} type="button">
                Cancel
              </button>
              <button className="btn primary" disabled={loading || !groupEditName.trim()} type="submit">
                Update
              </button>
            </div>
          </form>
        ) : (
          <button className="btn primary" disabled={loading} onClick={onOpenCreateGroup} type="button">
            New group
          </button>
        )}
        {selectedGroup ? (
          <div className="actions">
            <button className="btn ghost" disabled={loading} onClick={() => onStartGroupEdit(selectedGroup)} type="button">
              Rename
            </button>
            <button className="btn danger" disabled={loading} onClick={() => onDeleteGroup(selectedGroup.id)} type="button">
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
