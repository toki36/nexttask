"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
};

type AuthResponse = {
  token: string;
  user: User;
};

type TaskGroup = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type Schedule = {
  id: string;
  user_id: string;
  group_id: string;
  group?: TaskGroup;
  title: string;
  location_name?: string | null;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
};

type Task = {
  id: string;
  user_id: string;
  group_id?: string | null;
  group?: TaskGroup | null;
  title: string;
  description: string;
  location_name?: string | null;
  deadline: string;
  estimated_minutes: number;
  weight: number;
  priority_score: number;
  status: "open" | "completed";
};

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

type ActiveView = "schedules" | "tasks";
type AuthMode = "login" | "register";

const tokenKey = "nexttask.token";
const userKey = "nexttask.user";
const apiBase = "/api/backend";

const initialScheduleForm = {
  title: "",
  group_id: "",
  location_name: "",
  start_time: "",
  end_time: "",
};

const initialTaskForm = {
  title: "",
  description: "",
  group_id: "",
  location_name: "",
  deadline: "",
  estimated_minutes: "30",
  weight: "1",
};

async function apiRequest<T>(path: string, init: RequestInit = {}, authToken = ""): Promise<T> {
	const headers = new Headers(init.headers);
	if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
	if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

	const response = await fetch(`${apiBase}${path}`, {
		...init,
		headers,
	});

	if (!response.ok) {
		let message = `HTTP ${response.status}`;
		try {
			const body = (await response.json()) as ApiError;
			message = body.error?.message ?? body.error?.code ?? message;
		} catch {
			// Keep the HTTP status message when the response is not JSON.
		}
		throw new Error(message);
	}

	if (response.status === 204) return undefined as T;
	return (await response.json()) as T;
}

function savedToken() {
	if (typeof window === "undefined") return "";
	return window.localStorage.getItem(tokenKey) ?? "";
}

function savedUser() {
	if (typeof window === "undefined") return null;
	const value = window.localStorage.getItem(userKey);
	if (!value) return null;
	try {
		return JSON.parse(value) as User;
	} catch {
		return null;
	}
}

export default function Home() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [token, setToken] = useState(() => savedToken());
  const [user, setUser] = useState<User | null>(() => savedUser());
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedGroupID, setSelectedGroupID] = useState("all");
  const [activeView, setActiveView] = useState<ActiveView>("schedules");
  const [groupName, setGroupName] = useState("");
  const [scheduleForm, setScheduleForm] = useState(initialScheduleForm);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [editingScheduleID, setEditingScheduleID] = useState<string | null>(null);
  const [editingTaskID, setEditingTaskID] = useState<string | null>(null);
  const [editingGroupID, setEditingGroupID] = useState<string | null>(null);
  const [groupEditName, setGroupEditName] = useState("");
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

  const visibleTasks = useMemo(() => {
    if (selectedGroupID === "all") return tasks;
    return tasks.filter((task) => task.group_id === selectedGroupID);
  }, [tasks, selectedGroupID]);

  const groupScheduleCounts = useMemo(() => {
    return schedules.reduce<Record<string, number>>((counts, schedule) => {
      counts[schedule.group_id] = (counts[schedule.group_id] ?? 0) + 1;
      return counts;
    }, {});
  }, [schedules]);

  const openTaskCount = tasks.filter((task) => task.status === "open").length;

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
      setStatus("同期しました");
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

    const payload =
      authMode === "register"
        ? authForm
        : { email: authForm.email, password: authForm.password };

    try {
      const response = await apiRequest<AuthResponse>(`/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify(payload),
      }, "");
      window.localStorage.setItem(tokenKey, response.token);
      window.localStorage.setItem(userKey, JSON.stringify(response.user));
      setToken(response.token);
      setUser(response.user);
      setStatus("ログインしました");
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
      setStatus("グループを作成しました");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function deleteGroup(groupID: string) {
    const group = groups.find((item) => item.id === groupID);
    const name = group?.name ?? "このグループ";
    if (!window.confirm(`${name} を削除します。紐づく予定も削除されます。`)) return;

    setLoading(true);
    setError("");
    try {
      await apiRequest<void>(`/task-groups/${groupID}`, { method: "DELETE" }, token);
      setGroups((current) => current.filter((group) => group.id !== groupID));
      setSchedules((current) => current.filter((schedule) => schedule.group_id !== groupID));
      setTasks((current) =>
        current.map((task) => (task.group_id === groupID ? { ...task, group_id: null, group: null } : task)),
      );
      if (selectedGroupID === groupID) setSelectedGroupID("all");
      if (editingGroupID === groupID) cancelGroupEdit();
      setStatus("グループを削除しました");
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
        current.map((task) =>
          task.group_id === updated.id && task.group ? { ...task, group: updated } : task,
        ),
      );
      cancelGroupEdit();
      setStatus("グループ名を更新しました");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidDateRange(scheduleForm.start_time, scheduleForm.end_time)) {
      setError("終了は開始より後にしてください");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const body = {
        title: scheduleForm.title,
        group_id: scheduleForm.group_id,
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
      setStatus(editingScheduleID ? "予定を更新しました" : "予定を作成しました");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function deleteSchedule(scheduleID: string) {
    if (!window.confirm("予定を削除します。")) return;

    setLoading(true);
    setError("");
    try {
      await apiRequest<void>(`/schedules/${scheduleID}`, { method: "DELETE" }, token);
      setSchedules((current) => current.filter((schedule) => schedule.id !== scheduleID));
      if (editingScheduleID === scheduleID) resetScheduleForm();
      setStatus("予定を削除しました");
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
      setStatus(editingTaskID ? "タスクを更新しました" : "タスクを作成しました");
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
      setStatus(statusValue === "completed" ? "タスクを完了しました" : "タスクを未完了に戻しました");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function deleteTask(taskID: string) {
    if (!window.confirm("タスクを削除します。")) return;

    setLoading(true);
    setError("");
    try {
      await apiRequest<void>(`/tasks/${taskID}`, { method: "DELETE" }, token);
      setTasks((current) => current.filter((task) => task.id !== taskID));
      if (editingTaskID === taskID) resetTaskForm();
      setStatus("タスクを削除しました");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function editTask(task: Task) {
    setEditingTaskID(task.id);
    setTaskForm({
      title: task.title,
      description: task.description,
      group_id: task.group_id ?? "",
      location_name: task.location_name ?? "",
      deadline: toDateTimeLocal(task.deadline),
      estimated_minutes: String(task.estimated_minutes),
      weight: String(task.weight),
    });
    setActiveView("tasks");
  }

  function resetTaskForm() {
    setEditingTaskID(null);
    setTaskForm({
      ...initialTaskForm,
      group_id: selectedGroupID === "all" ? "" : selectedGroupID,
    });
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
      setStatus("ICSをダウンロードしました");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function editSchedule(schedule: Schedule) {
    setEditingScheduleID(schedule.id);
    setScheduleForm({
      title: schedule.title,
      group_id: schedule.group_id,
      location_name: schedule.location_name ?? "",
      start_time: toDateTimeLocal(schedule.start_time),
      end_time: toDateTimeLocal(schedule.end_time),
    });
    setActiveView("schedules");
  }

  function resetScheduleForm() {
    setEditingScheduleID(null);
    setScheduleForm({
      ...initialScheduleForm,
      group_id: selectedGroupID === "all" ? "" : selectedGroupID,
    });
  }

  function selectGroup(groupID: string) {
    setSelectedGroupID(groupID);
    setScheduleForm((current) => ({ ...current, group_id: groupID === "all" ? "" : groupID }));
    setTaskForm((current) => ({ ...current, group_id: groupID === "all" ? "" : groupID }));
    setEditingTaskID(null);
    setEditingScheduleID(null);
  }

  if (!token || !user) {
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
            <h1>予定とタスクを同じ流れで整理する</h1>
            <p>
              グループごとに予定を作り、その予定に向けたタスクを管理できます。
              バックエンドAPIを直接使うための最初のフロントです。
            </p>
          </div>
          <div className="auth-meta">
            <span className="pill">Schedule CRUD</span>
            <span className="pill">Task groups</span>
            <span className="pill">ICS export</span>
          </div>
        </section>
        <section className="auth-form-wrap">
          <form className="auth-form stack" onSubmit={handleAuth}>
            <h2>アカウント</h2>
            <div className="auth-tabs" aria-label="auth mode">
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => setAuthMode("login")}
              >
                ログイン
              </button>
              <button
                type="button"
                className={authMode === "register" ? "active" : ""}
                onClick={() => setAuthMode("register")}
              >
                登録
              </button>
            </div>
            {authMode === "register" ? (
              <div className="field">
                <label htmlFor="name">名前</label>
              <input
                id="name"
                autoComplete="name"
                value={authForm.name}
                onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                required
                />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="email">メールアドレス</label>
              <input
                id="email"
                autoComplete="email"
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">パスワード</label>
              <input
                id="password"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                type="password"
                minLength={8}
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                required
              />
            </div>
            <button className="btn primary" disabled={loading} type="submit">
              {authMode === "login" ? "ログイン" : "登録して開始"}
            </button>
            <StatusMessage status={status} error={error} />
          </form>
        </section>
      </main>
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
              <p className="brand-subtitle">
                {selectedGroup ? selectedGroup.name : "すべてのグループ"}
              </p>
            </div>
          </div>
          <div className="user-row">
            <span className="user-email">{user.email}</span>
            <button className="btn ghost small" onClick={() => void loadWorkspace()} disabled={loading} type="button">
              更新
            </button>
            <button className="btn ghost small" onClick={downloadICS} disabled={loading} type="button">
              ICS
            </button>
            <button className="btn small" onClick={logout} type="button">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <div className="page">
        <div className="summary-row">
          <Stat label="グループ" value={groups.length} />
          <Stat label="予定" value={schedules.length} />
          <Stat label="未完了タスク" value={openTaskCount} />
          <Stat label="表示中" value={activeView === "schedules" ? visibleSchedules.length : visibleTasks.length} />
        </div>

        <div className="dashboard">
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
                onClick={() => selectGroup("all")}
                type="button"
              >
                <span className="group-name">すべて</span>
                <span className="group-count">{schedules.length}</span>
              </button>
              {groups.map((group) => (
                <button
                  className={selectedGroupID === group.id ? "group-button active" : "group-button"}
                  key={group.id}
                  onClick={() => selectGroup(group.id)}
                  type="button"
                >
                  <span className="group-name">{group.name}</span>
                  <span className="group-count">{groupScheduleCounts[group.id] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="stack" style={{ padding: 16, paddingTop: 6 }}>
              {editingGroupID ? (
                <form className="stack" onSubmit={saveGroupName}>
                  <div className="field">
                    <label htmlFor="group-edit-name">グループ名編集</label>
                    <input
                      id="group-edit-name"
                      value={groupEditName}
                      onChange={(event) => setGroupEditName(event.target.value)}
                    />
                  </div>
                  <div className="actions">
                    <button className="btn ghost" onClick={cancelGroupEdit} type="button">
                      キャンセル
                    </button>
                    <button className="btn primary" disabled={loading || !groupEditName.trim()} type="submit">
                      更新
                    </button>
                  </div>
                </form>
              ) : (
                <form className="stack" onSubmit={createGroup}>
                  <div className="field">
                    <label htmlFor="group-name">新規グループ</label>
                    <input
                      id="group-name"
                      value={groupName}
                      onChange={(event) => setGroupName(event.target.value)}
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
                  <button className="btn ghost" disabled={loading} onClick={() => startGroupEdit(selectedGroup)} type="button">
                    名前変更
                  </button>
                  <button className="btn danger" disabled={loading} onClick={() => deleteGroup(selectedGroup.id)} type="button">
                    削除
                  </button>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="workarea">
            <div className="toolbar">
              <div className="tabs" aria-label="workspace view">
                <button
                  className={activeView === "schedules" ? "active" : ""}
                  onClick={() => setActiveView("schedules")}
                  type="button"
                >
                  予定
                </button>
                <button
                  className={activeView === "tasks" ? "active" : ""}
                  onClick={() => setActiveView("tasks")}
                  type="button"
                >
                  タスク
                </button>
              </div>
              <StatusMessage status={status} error={error} />
            </div>

            {activeView === "schedules" ? (
              <div className="content-grid">
                <div className="list-pane">
                  <ScheduleList
                    groups={groups}
                    schedules={visibleSchedules}
                    onDelete={deleteSchedule}
                    onEdit={editSchedule}
                    loading={loading}
                  />
                </div>
                <div className="editor-pane">
                  <ScheduleForm
                    editing={Boolean(editingScheduleID)}
                    form={scheduleForm}
                    groups={groups}
                    loading={loading}
                    onCancel={resetScheduleForm}
                    onChange={setScheduleForm}
                    onSubmit={saveSchedule}
                  />
                </div>
              </div>
            ) : (
              <div className="content-grid">
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
                <div className="editor-pane">
                  <TaskForm
                    editing={Boolean(editingTaskID)}
                    form={taskForm}
                    groups={groups}
                    loading={loading}
                    onCancel={resetTaskForm}
                    onChange={setTaskForm}
                    onSubmit={saveTask}
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function StatusMessage({ status, error }: { status: string; error: string }) {
  if (error) return <p className="status-line error">{error}</p>;
  return <p className="status-line">{status}</p>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}

function ScheduleList({
  groups,
  schedules,
  onDelete,
  onEdit,
  loading,
}: {
  groups: TaskGroup[];
  schedules: Schedule[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (schedule: Schedule) => void;
  loading: boolean;
}) {
  if (schedules.length === 0) {
    return <div className="empty">予定はまだありません</div>;
  }

  return (
    <div className="item-list">
      {schedules.map((schedule) => (
        <article className="item" key={schedule.id}>
          <div>
            <h3 className="item-title">{schedule.title}</h3>
            <div className="item-meta">
              <span className="pill strong">{groupName(groups, schedule.group_id)}</span>
              <span className="pill">{formatRange(schedule.start_time, schedule.end_time)}</span>
              {schedule.location_name ? <span className="pill">{schedule.location_name}</span> : null}
            </div>
          </div>
          <div className="actions">
            <button className="btn ghost small" disabled={loading} onClick={() => onEdit(schedule)} type="button">
              編集
            </button>
            <button className="btn danger small" disabled={loading} onClick={() => onDelete(schedule.id)} type="button">
              削除
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ScheduleForm({
  editing,
  form,
  groups,
  loading,
  onCancel,
  onChange,
  onSubmit,
}: {
  editing: boolean;
  form: typeof initialScheduleForm;
  groups: TaskGroup[];
  loading: boolean;
  onCancel: () => void;
  onChange: (form: typeof initialScheduleForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="section-header" style={{ padding: 0, borderBottom: 0 }}>
        <div>
          <h3>{editing ? "予定編集" : "予定作成"}</h3>
          <p>グループに予定を紐付けます</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="schedule-title">タイトル</label>
        <input
          id="schedule-title"
          value={form.title}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="schedule-group">グループ</label>
        <select
          id="schedule-group"
          value={form.group_id}
          onChange={(event) => onChange({ ...form, group_id: event.target.value })}
          required
        >
          <option value="">選択</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="schedule-location">場所名</label>
        <input
          id="schedule-location"
          value={form.location_name}
          onChange={(event) => onChange({ ...form, location_name: event.target.value })}
          placeholder="任意"
        />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="schedule-start">開始</label>
          <input
            id="schedule-start"
            type="datetime-local"
            value={form.start_time}
            onChange={(event) => onChange({ ...form, start_time: event.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="schedule-end">終了</label>
          <input
            id="schedule-end"
            type="datetime-local"
            value={form.end_time}
            onChange={(event) => onChange({ ...form, end_time: event.target.value })}
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
        <button className="btn primary" disabled={loading || groups.length === 0} type="submit">
          {editing ? "更新" : "作成"}
        </button>
      </div>
    </form>
  );
}

function TaskList({
  groups,
  tasks,
  onDelete,
  onEdit,
  onStatus,
  loading,
}: {
  groups: TaskGroup[];
  tasks: Task[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (task: Task) => void;
  onStatus: (task: Task, status: Task["status"]) => Promise<void>;
  loading: boolean;
}) {
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

function TaskForm({
  editing,
  form,
  groups,
  loading,
  onCancel,
  onChange,
  onSubmit,
}: {
  editing: boolean;
  form: typeof initialTaskForm;
  groups: TaskGroup[];
  loading: boolean;
  onCancel: () => void;
  onChange: (form: typeof initialTaskForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
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
      <div className="field">
        <label htmlFor="task-deadline">期限</label>
        <input
          id="task-deadline"
          type="datetime-local"
          value={form.deadline}
          onChange={(event) => onChange({ ...form, deadline: event.target.value })}
          required
        />
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

function toRFC3339(value: string) {
  return new Date(value).toISOString();
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRange(start: string, end: string) {
  return `${formatDateTime(start)} - ${formatDateTime(end)}`;
}

function isValidDateRange(start: string, end: string) {
  return Boolean(start && end && new Date(end).getTime() > new Date(start).getTime());
}

function groupName(groups: TaskGroup[], id: string) {
  return groups.find((group) => group.id === id)?.name ?? "未分類";
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "unknown error";
}
