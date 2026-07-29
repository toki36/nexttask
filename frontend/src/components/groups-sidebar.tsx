import { useEffect, useRef, useState } from "react";
import type { TaskGroup } from "@/types";
import { groupColor } from "@/lib/group-colors";

type GroupsSidebarProps = {
  groups: TaskGroup[];
  loading: boolean;
  selectedGroupID: string;
  onDeleteGroup: (groupID: string) => Promise<void>;
  onOpenCreateGroup: () => void;
  onSelectGroup: (groupID: string) => void;
  onStartGroupEdit: (group: TaskGroup) => void;
};

export function GroupsSidebar({
  groups,
  loading,
  selectedGroupID,
  onDeleteGroup,
  onOpenCreateGroup,
  onSelectGroup,
  onStartGroupEdit,
}: GroupsSidebarProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!sidebarRef.current?.contains(event.target as Node)) setActionsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActionsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function selectGroup(groupID: string) {
    setActionsOpen(false);
    onSelectGroup(groupID);
  }

  return (
    <aside className="sidebar" ref={sidebarRef}>
      <div className="section-header">
        <h2>Groups</h2>
      </div>
      <div className="group-list">
        <button
          className={selectedGroupID === "all" ? "group-button active" : "group-button"}
          onClick={() => selectGroup("all")}
          type="button"
        >
          <span aria-hidden="true" className="group-color-dot all" />
          <span className="group-name">All</span>
        </button>
        {groups.map((group) => {
          const selected = selectedGroupID === group.id;
          return (
            <div
              className={[
                "group-row",
                selected ? "selected" : "",
                selected && actionsOpen ? "actions-open" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={group.id}
            >
              <button
                className={selected ? "group-button active" : "group-button"}
                onClick={() => selectGroup(group.id)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="group-color-dot"
                  style={{ backgroundColor: groupColor(groups, group.id) }}
                />
                <span className="group-name">{group.name}</span>
              </button>
              {selected ? (
                <button
                  aria-expanded={actionsOpen}
                  aria-haspopup="menu"
                  aria-label={`${actionsOpen ? "Close" : "Open"} actions for ${group.name}`}
                  className="group-options-button"
                  onClick={() => setActionsOpen((current) => !current)}
                  title="Group actions"
                  type="button"
                >
                  <span aria-hidden="true" className="group-options-icon">
                    <span />
                    <span />
                    <span />
                  </span>
                </button>
              ) : null}
              {selected && actionsOpen ? (
                <div className="group-actions-menu" role="menu">
                  <div className="group-actions-heading">{group.name}</div>
                  <button
                    disabled={loading}
                    onClick={() => {
                      setActionsOpen(false);
                      onStartGroupEdit(group);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Rename
                  </button>
                  <button
                    className="danger-text"
                    disabled={loading}
                    onClick={() => {
                      setActionsOpen(false);
                      void onDeleteGroup(group.id);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="sidebar-actions">
        <button className="btn primary" disabled={loading} onClick={onOpenCreateGroup} type="button">
          New group
        </button>
      </div>
    </aside>
  );
}
