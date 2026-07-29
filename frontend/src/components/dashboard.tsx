"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthView } from "@/components/auth-view";
import { Modal, StatusMessage } from "@/components/common";
import { GroupsSidebar } from "@/components/groups-sidebar";
import { ScheduleDetail } from "@/components/schedule-detail";
import { ScheduleCalendar, ScheduleForm } from "@/components/schedules";
import { TaskDetail } from "@/components/task-detail";
import { TaskForm, TaskList } from "@/components/tasks";
import { apiBase, apiRequest, errorMessage, isUnauthorizedError, tokenKey, userKey } from "@/lib/api";
import { isAllDayRange, isValidDateRange, toDateTimeLocal, toRFC3339 } from "@/lib/date";
import { initialScheduleForm, initialTaskForm } from "@/lib/forms";
import { savedToken, savedUser } from "@/lib/storage";
import type { AuthMode, AuthResponse, Schedule, Task, TaskGroup, User } from "@/types";

type ActiveModal = "group" | "task" | "task-detail" | "schedule" | "schedule-detail" | null;
type MobileWorkspaceView = "tasks" | "calendar";

export function Dashboard() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedGroupID, setSelectedGroupID] = useState("all");
  const [taskStatusView, setTaskStatusView] = useState<Task["status"]>("open");
  const [mobileWorkspaceView, setMobileWorkspaceView] = useState<MobileWorkspaceView>("tasks");
  const [undoTaskID, setUndoTaskID] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [scheduleForm, setScheduleForm] = useState(initialScheduleForm);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [editingScheduleID, setEditingScheduleID] = useState<string | null>(null);
  const [selectedScheduleID, setSelectedScheduleID] = useState<string | null>(null);
  const [editingTaskID, setEditingTaskID] = useState<string | null>(null);
  const [selectedTaskID, setSelectedTaskID] = useState<string | null>(null);
  const [editingGroupID, setEditingGroupID] = useState<string | null>(null);
  const [groupEditName, setGroupEditName] = useState("");
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const visibleSchedules = useMemo(() => {
    if (selectedGroupID === "all") return schedules;
    return schedules.filter((schedule) => schedule.group_id === selectedGroupID);
  }, [schedules, selectedGroupID]);

  const scopedTasks = useMemo(() => {
    const filteredTasks =
      selectedGroupID === "all" ? tasks : tasks.filter((task) => task.group_id === selectedGroupID);
    return filteredTasks;
  }, [tasks, selectedGroupID]);

  const openTasks = useMemo(
    () => scopedTasks.filter((task) => task.status === "open").sort(compareTasksByPriority),
    [scopedTasks],
  );

  const completedTasks = useMemo(
    () => scopedTasks.filter((task) => task.status === "completed").sort(compareCompletedTasks),
    [scopedTasks],
  );

  const visibleTasks = taskStatusView === "open" ? openTasks : completedTasks;

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskID) ?? null,
    [selectedTaskID, tasks],
  );

  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === selectedScheduleID) ?? null,
    [schedules, selectedScheduleID],
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      setToken(savedToken());
      setUser(savedUser());
      setAuthReady(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const loadWorkspace = useCallback(async (authToken = token) => {
    setLoading(true);
    setError("");
    try {
      const [nextGroups, nextSchedules, nextTasks] = await Promise.all([
        apiRequest<TaskGroup[]>("/task-groups", {}, authToken),
        apiRequest<Schedule[]>("/schedules", {}, authToken),
        apiRequest<Task[]>("/tasks", {}, authToken),
      ]);
      setGroups(nextGroups);
      setSchedules(nextSchedules);
      setTasks(nextTasks);

      if (selectedGroupID !== "all" && !nextGroups.some((group) => group.id === selectedGroupID)) {
        setSelectedGroupID("all");
      }
      setStatus("");
    } catch (err) {
      if (isUnauthorizedError(err)) {
        window.localStorage.removeItem(tokenKey);
        window.localStorage.removeItem(userKey);
        setToken("");
        setUser(null);
        setGroups([]);
        setSchedules([]);
        setTasks([]);
        setSelectedGroupID("all");
        setStatus("");
        setError("Session expired. Please log in again.");
        return;
      }
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedGroupID, token]);

  useEffect(() => {
    if (!token) return;
    const id = window.setTimeout(() => {
      void loadWorkspace(token);
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadWorkspace, token]);

  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => {
      setStatus("");
      setUndoTaskID(null);
    }, undoTaskID ? 5000 : 2600);
    return () => window.clearTimeout(id);
  }, [status, undoTaskID]);

  useEffect(() => {
    if (!settingsOpen) return;

    function closeSettings(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setSettingsOpen(false);
        return;
      }
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    }

    document.addEventListener("mousedown", closeSettings);
    document.addEventListener("keydown", closeSettings);
    return () => {
      document.removeEventListener("mousedown", closeSettings);
      document.removeEventListener("keydown", closeSettings);
    };
  }, [settingsOpen]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");

    const payload = authMode === "register" ? authForm : { email: authForm.email, password: authForm.password };

    try {
      const response = await apiRequest<AuthResponse>(`/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      window.localStorage.setItem(tokenKey, response.token);
      window.localStorage.setItem(userKey, JSON.stringify(response.user));
      setToken(response.token);
      setUser(response.user);
      setStatus("Logged in");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(tokenKey);
    window.localStorage.removeItem(userKey);
    setSettingsOpen(false);
    setToken("");
    setUser(null);
    setGroups([]);
    setSchedules([]);
    setTasks([]);
    setSelectedGroupID("all");
    setStatus("");
    setError("");
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const group = await apiRequest<TaskGroup>("/task-groups", {
        method: "POST",
        body: JSON.stringify({ name: groupName.trim() }),
      }, token);
      setGroups((current) => [...current, group]);
      setSelectedGroupID(group.id);
      setGroupName("");
      setScheduleForm((current) => ({ ...current, group_id: group.id }));
      setTaskForm((current) => ({ ...current, group_id: group.id }));
      setCalendarMonth(new Date());
      setActiveModal(null);
      setStatus("Group created");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function deleteGroup(groupID: string) {
    const group = groups.find((item) => item.id === groupID);
    const name = group?.name ?? "this group";
    if (!window.confirm(`${name} will be deleted. Linked tasks and schedules will move to No group.`)) return;

    setLoading(true);
    setError("");
    try {
      await apiRequest<void>(`/task-groups/${groupID}`, { method: "DELETE" }, token);
      setGroups((current) => current.filter((group) => group.id !== groupID));
      setSchedules((current) =>
        current.map((schedule) =>
          schedule.group_id === groupID ? { ...schedule, group_id: null, group: null } : schedule,
        ),
      );
      setTasks((current) =>
        current.map((task) => (task.group_id === groupID ? { ...task, group_id: null, group: null } : task)),
      );
      if (selectedGroupID === groupID) setSelectedGroupID("all");
      if (editingGroupID === groupID) cancelGroupEdit();
      setStatus("Group deleted");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function startGroupEdit(group: TaskGroup) {
    setEditingGroupID(group.id);
    setGroupEditName(group.name);
  }

  function cancelGroupEdit() {
    setEditingGroupID(null);
    setGroupEditName("");
  }

  async function saveGroupName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingGroupID || !groupEditName.trim()) return;

    setLoading(true);
    setError("");
    try {
      const updated = await apiRequest<TaskGroup>(`/task-groups/${editingGroupID}`, {
        method: "PATCH",
        body: JSON.stringify({ name: groupEditName.trim() }),
      }, token);
      setGroups((current) => current.map((group) => (group.id === updated.id ? updated : group)));
      setSchedules((current) =>
        current.map((schedule) =>
          schedule.group_id === updated.id && schedule.group ? { ...schedule, group: updated } : schedule,
        ),
      );
      setTasks((current) =>
        current.map((task) => (task.group_id === updated.id && task.group ? { ...task, group: updated } : task)),
      );
      cancelGroupEdit();
      setStatus("Group renamed");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidDateRange(scheduleForm.start_time, scheduleForm.end_time)) {
      setError("End must be after start");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const body = {
        title: scheduleForm.title,
        group_id: scheduleForm.group_id || null,
        location_name: scheduleForm.location_name,
        start_time: toRFC3339(scheduleForm.start_time),
        end_time: toRFC3339(scheduleForm.end_time),
      };
      const saved = await apiRequest<Schedule>(
        editingScheduleID ? `/schedules/${editingScheduleID}` : "/schedules",
        {
          method: editingScheduleID ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
        token,
      );
      setSchedules((current) =>
        editingScheduleID
          ? current.map((schedule) => (schedule.id === saved.id ? saved : schedule))
          : [...current, saved],
      );
      resetScheduleForm();
      setActiveModal(null);
      setStatus(editingScheduleID ? "Schedule updated" : "Schedule created");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function deleteSchedule(scheduleID: string) {
    if (!window.confirm("Delete this schedule?")) return;

    setLoading(true);
    setError("");
    try {
      await apiRequest<void>(`/schedules/${scheduleID}`, { method: "DELETE" }, token);
      setSchedules((current) => current.filter((schedule) => schedule.id !== scheduleID));
      if (editingScheduleID === scheduleID) resetScheduleForm();
      if (selectedScheduleID === scheduleID) setSelectedScheduleID(null);
      setActiveModal(null);
      setStatus("Schedule deleted");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      taskForm.start_time &&
      taskForm.deadline &&
      new Date(taskForm.deadline).getTime() <= new Date(taskForm.start_time).getTime()
    ) {
      setError("Due must be after start");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = {
        title: taskForm.title,
        description: taskForm.description,
        group_id: taskForm.group_id || null,
        location_name: taskForm.location_name,
        start_time: taskForm.start_time ? toRFC3339(taskForm.start_time) : null,
        deadline: toRFC3339(taskForm.deadline),
        estimated_minutes: Number(taskForm.estimated_minutes),
        weight: Number(taskForm.weight),
      };
      const task = await apiRequest<Task>(
        editingTaskID ? `/tasks/${editingTaskID}` : "/tasks",
        {
          method: editingTaskID ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
        token,
      );
      setTasks((current) =>
        editingTaskID ? current.map((item) => (item.id === task.id ? task : item)) : [task, ...current],
      );
      resetTaskForm();
      setActiveModal(null);
      setStatus(editingTaskID ? "Task updated" : "Task created");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function updateTaskStatus(task: Task, statusValue: Task["status"]) {
    setLoading(true);
    setError("");
    try {
      const updated = await apiRequest<Task>(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusValue }),
      }, token);
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (statusValue === "completed") {
        setUndoTaskID(updated.id);
        setSelectedTaskID(null);
        setActiveModal(null);
        setStatus("Task completed");
      } else {
        setUndoTaskID(null);
        setTaskStatusView("open");
        setSelectedTaskID(null);
        setActiveModal(null);
        setStatus("Task reopened");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function undoTaskCompletion() {
    const task = tasks.find((item) => item.id === undoTaskID);
    if (!task || task.status !== "completed") {
      setUndoTaskID(null);
      return;
    }
    void updateTaskStatus(task, "open");
  }

  async function deleteTask(taskID: string) {
    if (!window.confirm("Delete this task?")) return;

    setLoading(true);
    setError("");
    try {
      await apiRequest<void>(`/tasks/${taskID}`, { method: "DELETE" }, token);
      setTasks((current) => current.filter((task) => task.id !== taskID));
      if (undoTaskID === taskID) setUndoTaskID(null);
      if (editingTaskID === taskID) resetTaskForm();
      if (selectedTaskID === taskID) closeTaskDetail();
      setStatus("Task deleted");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function editTask(task: Task) {
    setEditingTaskID(task.id);
    setSelectedTaskID(null);
    setActiveModal("task");
    setTaskForm({
      title: task.title,
      description: task.description,
      group_id: task.group_id ?? "",
      location_name: task.location_name ?? "",
      start_time: task.start_time ? toDateTimeLocal(task.start_time) : "",
      deadline: toDateTimeLocal(task.deadline),
      estimated_minutes: String(task.estimated_minutes),
      weight: String(task.weight),
    });
  }

  function resetTaskForm() {
    setEditingTaskID(null);
    setTaskForm({
      ...initialTaskForm,
      group_id: selectedGroupID === "all" ? "" : selectedGroupID,
    });
  }

  function openTaskForm() {
    setEditingTaskID(null);
    setSelectedTaskID(null);
    setTaskForm({
      ...initialTaskForm,
      group_id: selectedGroupID === "all" ? "" : selectedGroupID,
    });
    setActiveModal("task");
  }

  function closeTaskForm() {
    resetTaskForm();
    setActiveModal(null);
  }

  function openTaskDetail(task: Task) {
    setSelectedTaskID(task.id);
    setActiveModal("task-detail");
  }

  function closeTaskDetail() {
    setSelectedTaskID(null);
    setActiveModal(null);
  }

  async function downloadICS() {
    setSettingsOpen(false);
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/export/ics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`ICS export failed: HTTP ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "nexttask.ics";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus("ICS downloaded");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function editSchedule(schedule: Schedule) {
    setSelectedScheduleID(null);
    const startTime = toDateTimeLocal(schedule.start_time);
    const endTime = toDateTimeLocal(schedule.end_time);
    setEditingScheduleID(schedule.id);
    setActiveModal("schedule");
    setScheduleForm({
      title: schedule.title,
      group_id: schedule.group_id ?? "",
      location_name: schedule.location_name ?? "",
      all_day: isAllDayRange(startTime, endTime),
      start_time: startTime,
      end_time: endTime,
    });
  }

  function openScheduleDetail(schedule: Schedule) {
    setSelectedScheduleID(schedule.id);
    setActiveModal("schedule-detail");
  }

  function closeScheduleDetail() {
    setSelectedScheduleID(null);
    setActiveModal(null);
  }

  function resetScheduleForm() {
    setEditingScheduleID(null);
    setScheduleForm({
      ...initialScheduleForm,
      group_id: selectedGroupID === "all" ? "" : selectedGroupID,
    });
  }

  function openScheduleForm() {
    const start = new Date();
    start.setSeconds(0, 0);
    start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setEditingScheduleID(null);
    setScheduleForm({
      ...initialScheduleForm,
      group_id: selectedGroupID === "all" ? "" : selectedGroupID,
      start_time: toLocalInput(start),
      end_time: toLocalInput(end),
    });
    setActiveModal("schedule");
  }

  function closeScheduleForm() {
    resetScheduleForm();
    setActiveModal(null);
  }

  function openGroupForm() {
    setGroupName("");
    setActiveModal("group");
  }

  function closeGroupForm() {
    setGroupName("");
    setActiveModal(null);
  }

  function selectGroup(groupID: string) {
    setSelectedGroupID(groupID);
    setScheduleForm((current) => ({ ...current, group_id: groupID === "all" ? "" : groupID }));
    setTaskForm((current) => ({ ...current, group_id: groupID === "all" ? "" : groupID }));
    setEditingTaskID(null);
    setEditingScheduleID(null);
    setSelectedTaskID(null);
    setActiveModal(null);
  }

  function refreshWorkspace() {
    setSettingsOpen(false);
    void loadWorkspace();
  }

  if (!authReady) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div>
            <div className="brand">
              <div className="brand-mark">N</div>
              <div>
                <p className="brand-title">NextTask</p>
                <p className="brand-subtitle">Schedule and task workspace</p>
              </div>
            </div>
            <h1>Plan schedules and tasks in one workspace</h1>
            <p>Checking your session.</p>
          </div>
        </section>
        <section className="auth-form-wrap">
          <div className="auth-form stack">
            <h2>Loading</h2>
            <p className="status-line">Please wait</p>
          </div>
        </section>
      </main>
    );
  }

  if (!token || !user) {
    return (
      <AuthView
        authMode={authMode}
        authForm={authForm}
        error={error}
        loading={loading}
        status={status}
        onAuthModeChange={setAuthMode}
        onAuthFormChange={setAuthForm}
        onSubmit={handleAuth}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">N</div>
            <h1 className="brand-title">NextTask</h1>
          </div>
          <div className="user-row">
            <div className="settings-menu" ref={settingsRef}>
              <button
                aria-expanded={settingsOpen}
                aria-label={settingsOpen ? "Close settings menu" : "Open settings menu"}
                className="icon-button"
                onClick={() => setSettingsOpen((current) => !current)}
                type="button"
              >
                <span />
                <span />
                <span />
              </button>
              {settingsOpen ? (
                <div className="settings-panel" role="menu">
                  <div className="settings-panel-header">
                    <span>Settings</span>
                    <small>{user.email}</small>
                  </div>
                  <button disabled={loading} onClick={refreshWorkspace} role="menuitem" type="button">
                    Sync data
                  </button>
                  <button disabled={loading} onClick={downloadICS} role="menuitem" type="button">
                    Export calendar (.ics)
                  </button>
                  <button className="danger-text" onClick={logout} role="menuitem" type="button">
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      {status || error ? (
        <div className={error ? "status-toast error" : "status-toast"}>
          <StatusMessage status={status} error={error} />
          {undoTaskID && !error ? (
            <button className="status-toast-action" disabled={loading} onClick={undoTaskCompletion} type="button">
              Undo
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="page">
        <div className="dashboard">
          <GroupsSidebar
            groups={groups}
            loading={loading}
            selectedGroupID={selectedGroupID}
            onDeleteGroup={deleteGroup}
            onOpenCreateGroup={openGroupForm}
            onSelectGroup={selectGroup}
            onStartGroupEdit={startGroupEdit}
          />

          <section className="workarea">
            <div className="mobile-workspace-tabs" aria-label="Workspace view" role="tablist">
              <button
                aria-selected={mobileWorkspaceView === "tasks"}
                className={mobileWorkspaceView === "tasks" ? "active" : ""}
                onClick={() => setMobileWorkspaceView("tasks")}
                role="tab"
                type="button"
              >
                Tasks
              </button>
              <button
                aria-selected={mobileWorkspaceView === "calendar"}
                className={mobileWorkspaceView === "calendar" ? "active" : ""}
                onClick={() => setMobileWorkspaceView("calendar")}
                role="tab"
                type="button"
              >
                Calendar
              </button>
            </div>
            <div className="workspace-columns">
              <div className={mobileWorkspaceView === "tasks" ? "workspace-column" : "workspace-column mobile-inactive"}>
                <div className="section-header">
                  <h2>Tasks</h2>
                  <div className="task-header-actions">
                    <div className="task-view-tabs" aria-label="Task status" role="tablist">
                      <button
                        aria-selected={taskStatusView === "open"}
                        className={taskStatusView === "open" ? "active" : ""}
                        onClick={() => setTaskStatusView("open")}
                        role="tab"
                        type="button"
                      >
                        Open
                      </button>
                      <button
                        aria-selected={taskStatusView === "completed"}
                        className={taskStatusView === "completed" ? "active" : ""}
                        onClick={() => setTaskStatusView("completed")}
                        role="tab"
                        type="button"
                      >
                        Completed
                      </button>
                    </div>
                    <button className="btn primary small" disabled={loading} onClick={openTaskForm} type="button">
                      New task
                    </button>
                  </div>
                </div>
                <div className="list-pane">
                  <TaskList
                    groups={groups}
                    status={taskStatusView}
                    tasks={visibleTasks}
                    onSelect={openTaskDetail}
                  />
                </div>
              </div>

              <div className={mobileWorkspaceView === "calendar" ? "workspace-column" : "workspace-column mobile-inactive"}>
                <div className="section-header">
                  <h2>Calendar</h2>
                  <button
                    className="btn primary small"
                    disabled={loading}
                    onClick={openScheduleForm}
                    type="button"
                  >
                    New schedule
                  </button>
                </div>
                <div className="list-pane">
                  <ScheduleCalendar
                    groups={groups}
                    month={calendarMonth}
                    schedules={visibleSchedules}
                    tasks={openTasks}
                    onMonthChange={setCalendarMonth}
                    onSelectSchedule={openScheduleDetail}
                    onSelectTask={openTaskDetail}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      {activeModal === "group" ? (
        <Modal title="New group" onClose={closeGroupForm} size="small">
          <form className="stack" onSubmit={createGroup}>
            <div className="field">
              <label htmlFor="group-name">Group name</label>
              <input
                id="group-name"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Example: Research presentation"
                required
              />
            </div>
            <div className="form-actions">
              <button className="btn ghost" onClick={closeGroupForm} type="button">
                Cancel
              </button>
              <button className="btn primary" disabled={loading || !groupName.trim()} type="submit">
                Create
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {editingGroupID ? (
        <Modal title="Rename group" onClose={cancelGroupEdit} size="small">
          <form className="stack" onSubmit={saveGroupName}>
            <div className="field">
              <label htmlFor="group-edit-name">Group name</label>
              <input
                id="group-edit-name"
                value={groupEditName}
                onChange={(event) => setGroupEditName(event.target.value)}
                required
              />
            </div>
            <div className="form-actions">
              <button className="btn ghost" onClick={cancelGroupEdit} type="button">
                Cancel
              </button>
              <button className="btn primary" disabled={loading || !groupEditName.trim()} type="submit">
                Save
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {activeModal === "task-detail" && selectedTask ? (
        <Modal title={selectedTask.title} onClose={closeTaskDetail}>
          <TaskDetail
            groups={groups}
            loading={loading}
            task={selectedTask}
            onDelete={deleteTask}
            onEdit={editTask}
            onToggleStatus={(task) =>
              updateTaskStatus(task, task.status === "completed" ? "open" : "completed")
            }
          />
        </Modal>
      ) : null}
      {activeModal === "schedule-detail" && selectedSchedule ? (
        <Modal title={selectedSchedule.title} onClose={closeScheduleDetail} size="small">
          <ScheduleDetail
            groups={groups}
            loading={loading}
            schedule={selectedSchedule}
            onDelete={deleteSchedule}
            onEdit={editSchedule}
          />
        </Modal>
      ) : null}
      {activeModal === "task" ? (
        <Modal title={editingTaskID ? "Edit task" : "New task"} onClose={closeTaskForm}>
          <TaskForm
            editing={Boolean(editingTaskID)}
            form={taskForm}
            groups={groups}
            loading={loading}
            onCancel={closeTaskForm}
            onChange={setTaskForm}
            onSubmit={saveTask}
          />
        </Modal>
      ) : null}
      {activeModal === "schedule" ? (
        <Modal title={editingScheduleID ? "Edit schedule" : "New schedule"} onClose={closeScheduleForm}>
          <ScheduleForm
            editing={Boolean(editingScheduleID)}
            form={scheduleForm}
            groups={groups}
            loading={loading}
            onCancel={closeScheduleForm}
            onChange={setScheduleForm}
            onSubmit={saveSchedule}
          />
        </Modal>
      ) : null}
    </main>
  );
}

function compareTasksByPriority(a: Task, b: Task) {
  if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
  return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
}

function compareCompletedTasks(a: Task, b: Task) {
  return new Date(b.completed_at ?? b.deadline).getTime() - new Date(a.completed_at ?? a.deadline).getTime();
}

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}
