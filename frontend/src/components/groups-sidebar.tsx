import type { FormEvent } from "react";
import type { TaskGroup } from "@/types";

type GroupsSidebarProps = {
  editingGroupID: string | null;
  groupEditName: string;
  groupName: string;
  groupScheduleCounts: Record<string, number>;
  groups: TaskGroup[];
  loading: boolean;
  schedulesCount: number;
  selectedGroup: TaskGroup | null;
  selectedGroupID: string;
  onCancelGroupEdit: () => void;
  onCreateGroup: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteGroup: (groupID: string) => Promise<void>;
  onGroupEditNameChange: (name: string) => void;
  onGroupNameChange: (name: string) => void;
  onSaveGroupName: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSelectGroup: (groupID: string) => void;
  onStartGroupEdit: (group: TaskGroup) => void;
};

export function GroupsSidebar({
  editingGroupID,
  groupEditName,
  groupName,
  groupScheduleCounts,
  groups,
  loading,
  schedulesCount,
  selectedGroup,
  selectedGroupID,
  onCancelGroupEdit,
  onCreateGroup,
  onDeleteGroup,
  onGroupEditNameChange,
  onGroupNameChange,
  onSaveGroupName,
  onSelectGroup,
  onStartGroupEdit,
}: GroupsSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="section-header">
        <div>
          <h2>グループ</h2>
          <p>予定とタスクのまとまり</p>
        </div>
      </div>
      <div className="group-list">
        <button
          className={selectedGroupID === "all" ? "group-button active" : "group-button"}
          onClick={() => onSelectGroup("all")}
          type="button"
        >
          <span className="group-name">すべて</span>
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
              <label htmlFor="group-edit-name">グループ名編集</label>
              <input
                id="group-edit-name"
                value={groupEditName}
                onChange={(event) => onGroupEditNameChange(event.target.value)}
              />
            </div>
            <div className="actions">
              <button className="btn ghost" onClick={onCancelGroupEdit} type="button">
                キャンセル
              </button>
              <button className="btn primary" disabled={loading || !groupEditName.trim()} type="submit">
                更新
              </button>
            </div>
          </form>
        ) : (
          <form className="stack" onSubmit={onCreateGroup}>
            <div className="field">
              <label htmlFor="group-name">新規グループ</label>
              <input
                id="group-name"
                value={groupName}
                onChange={(event) => onGroupNameChange(event.target.value)}
                placeholder="例: 研究発表"
              />
            </div>
            <button className="btn primary" disabled={loading || !groupName.trim()} type="submit">
              グループ作成
            </button>
          </form>
        )}
        {selectedGroup ? (
          <div className="actions">
            <button className="btn ghost" disabled={loading} onClick={() => onStartGroupEdit(selectedGroup)} type="button">
              名前変更
            </button>
            <button className="btn danger" disabled={loading} onClick={() => onDeleteGroup(selectedGroup.id)} type="button">
              削除
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
