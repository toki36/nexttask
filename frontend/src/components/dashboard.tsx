"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AuthView } from "@/components/auth-view";
import { Modal, Stat, StatusMessage } from "@/components/common";
import { GroupsSidebar } from "@/components/groups-sidebar";
import { ScheduleCalendar, ScheduleForm, ScheduleList } from "@/components/schedules";
import { TaskForm, TaskList } from "@/components/tasks";
import { apiBase, apiRequest, errorMessage, tokenKey, userKey } from "@/lib/api";
import { datePart, isAllDayRange, isValidDateRange, toDateTimeLocal, toRFC3339 } from "@/lib/date";
import { initialScheduleForm, initialTaskForm } from "@/lib/forms";
import { savedToken, savedUser } from "@/lib/storage";
import type { AuthMode, AuthResponse, Schedule, Task, TaskGroup, User } from "@/types";

type ActiveModal = "group" | "task" | "schedule" | null;

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
  const [selectedScheduleDate, setSelectedScheduleDate] = useState("");
  const [selectedGroupID, setSelectedGroupID] = useState("all");
  const [groupName, setGroupName] = useState("");
  const [scheduleForm, setScheduleForm] = useState(initialScheduleForm);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [editingScheduleID, setEditingScheduleID] = useState<string | null>(null);
  const [editingTaskID, setEditingTaskID] = useState<string | null>(null);
  const [editingGroupID, setEditingGroupID] = useState<string | null>(null);
  const [groupEditName, setGroupEditName] = useState("");
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupID) ?? null,
    [groups, selectedGroupID],
  );

  const visibleSchedules = useMemo(() => {
    if (selectedGroupID === "all") return schedules;
    return schedules.filter((schedule) => schedule.group_id === selectedGroupID);
  }, [schedules, selectedGroupID]);

  const selectedDateSchedules = useMemo(() => {
    if (!selectedScheduleDate) return visibleSchedules;
    return visibleSchedules.filter((schedule) => datePart(toDateTimeLocal(schedule.start_time)) === selectedScheduleDate);
  }, [selectedScheduleDate, visibleSchedules]);

  const visibleTasks = useMemo(() => {
    if (selectedGroupID === "all") return tasks;
    return tasks.filter((task) => task.group_id === selectedGroupID);
  }, [tasks, selectedGroupID]);

  const groupScheduleCounts = useMemo(() => {
    return schedules.reduce<Record<string, number>>((counts, schedule) => {
      if (!schedule.group_id) return counts;
      counts[schedule.group_id] = (counts[schedule.group_id] ?? 0) + 1;
      return counts;
    }, {});
  }, [schedules]);

  const openTaskCount = tasks.filter((task) => task.status === "open").length;

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
      setStatus("Synced");
    } catch (err) {
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
      setSelectedScheduleDate("");
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
    if (!window.confirm(`${name} will be deleted. Linked schedules will move to No group.`)) return;

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
      setStatus("Schedule deleted");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const body = {
        title: taskForm.title,
        description: taskForm.description,
        group_id: taskForm.group_id || null,
        location_name: taskForm.location_name,
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
      setStatus(statusValue === "completed" ? "Task completed" : "Task reopened");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function deleteTask(taskID: string) {
    if (!window.confirm("Delete this task?")) return;

    setLoading(true);
    setError("");
    try {
      await apiRequest<void>(`/tasks/${taskID}`, { method: "DELETE" }, token);
      setTasks((current) => current.filter((task) => task.id !== taskID));
      if (editingTaskID === taskID) resetTaskForm();
      setStatus("Task deleted");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function editTask(task: Task) {
    setEditingTaskID(task.id);
    setActiveModal("task");
    setTaskForm({
      title: task.title,
      description: task.description,
      group_id: task.group_id ?? "",
      location_name: task.location_name ?? "",
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

  async function downloadICS() {
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

  function resetScheduleForm() {
    setEditingScheduleID(null);
    setScheduleForm({
      ...initialScheduleForm,
      group_id: selectedGroupID === "all" ? "" : selectedGroupID,
    });
  }

  function openScheduleForm() {
    setEditingScheduleID(null);
    setScheduleForm({
      ...initialScheduleForm,
      group_id: selectedGroupID === "all" ? "" : selectedGroupID,
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
    setActiveModal(null);
    setSelectedScheduleDate("");
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
            <div>
              <h1 className="brand-title">NextTask</h1>
              <p className="brand-subtitle">{selectedGroup ? selectedGroup.name : "All groups"}</p>
            </div>
          </div>
          <div className="user-row">
            <span className="user-email">{user.email}</span>
            <button className="btn ghost small" onClick={() => void loadWorkspace()} disabled={loading} type="button">
              Update
            </button>
            <button className="btn ghost small" onClick={downloadICS} disabled={loading} type="button">
              ICS
            </button>
            <button className="btn small" onClick={logout} type="button">
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="page">
        <div className="summary-row">
          <Stat label="Group" value={groups.length} />
          <Stat label="Schedules" value={schedules.length} />
          <Stat label="Open tasks" value={openTaskCount} />
          <Stat label="Visible" value={visibleTasks.length + selectedDateSchedules.length} />
        </div>

        <div className="dashboard">
          <GroupsSidebar
            editingGroupID={editingGroupID}
            groupEditName={groupEditName}
            groupScheduleCounts={groupScheduleCounts}
            groups={groups}
            loading={loading}
            schedulesCount={schedules.length}
            selectedGroup={selectedGroup}
            selectedGroupID={selectedGroupID}
            onCancelGroupEdit={cancelGroupEdit}
            onDeleteGroup={deleteGroup}
            onGroupEditNameChange={setGroupEditName}
            onOpenCreateGroup={openGroupForm}
            onSaveGroupName={saveGroupName}
            onSelectGroup={selectGroup}
            onStartGroupEdit={startGroupEdit}
          />

          <section className="workarea">
            <div className="toolbar">
              <div>
                <h2 className="workspace-title">Workspace</h2>
                <p className="workspace-subtitle">View tasks and schedules side by side</p>
              </div>
              <StatusMessage status={status} error={error} />
            </div>

            <div className="workspace-columns">
              <div className="workspace-column">
                <div className="section-header">
                  <div>
                    <h3>Tasks</h3>
                    <p>Manage work on the left</p>
                  </div>
                  <button className="btn primary small" disabled={loading} onClick={openTaskForm} type="button">
                    New task
                  </button>
                </div>
                <div className="list-pane">
                  <TaskList
                    groups={groups}
                    tasks={visibleTasks}
                    onDelete={deleteTask}
                    onEdit={editTask}
                    onStatus={updateTaskStatus}
                    loading={loading}
                  />
                </div>
              </div>

              <div className="workspace-column">
                <div className="section-header">
                  <div>
                    <h3>Schedules</h3>
                    <p>Manage calendar schedules on the right</p>
                  </div>
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
                    month={calendarMonth}
                    schedules={visibleSchedules}
                    selectedDate={selectedScheduleDate}
                    onMonthChange={setCalendarMonth}
                    onSelectDate={setSelectedScheduleDate}
                  />
                  {selectedScheduleDate ? (
                    <div className="calendar-filter-row">
                      <span>{selectedScheduleDate} schedules</span>
                      <button className="btn ghost small" onClick={() => setSelectedScheduleDate("")} type="button">
                        Clear
                      </button>
                    </div>
                  ) : null}
                  <ScheduleList
                    groups={groups}
                    schedules={selectedDateSchedules}
                    onDelete={deleteSchedule}
                    onEdit={editSchedule}
                    loading={loading}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      {activeModal === "group" ? (
        <Modal title="New group" onClose={closeGroupForm}>
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
            <div className="actions">
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
