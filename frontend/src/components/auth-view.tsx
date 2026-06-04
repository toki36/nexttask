import type { FormEvent } from "react";
import type { AuthMode } from "@/types";
import { StatusMessage } from "@/components/common";

type AuthFormState = {
  name: string;
  email: string;
  password: string;
};

type AuthViewProps = {
  authMode: AuthMode;
  authForm: AuthFormState;
  error: string;
  loading: boolean;
  status: string;
  onAuthModeChange: (mode: AuthMode) => void;
  onAuthFormChange: (form: AuthFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function AuthView({
  authMode,
  authForm,
  error,
  loading,
  status,
  onAuthModeChange,
  onAuthFormChange,
  onSubmit,
}: AuthViewProps) {
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
        <form className="auth-form stack" onSubmit={onSubmit}>
          <h2>アカウント</h2>
          <div className="auth-tabs" aria-label="auth mode">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => onAuthModeChange("login")}
            >
              ログイン
            </button>
            <button
              type="button"
              className={authMode === "register" ? "active" : ""}
              onClick={() => onAuthModeChange("register")}
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
                onChange={(event) => onAuthFormChange({ ...authForm, name: event.target.value })}
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
              onChange={(event) => onAuthFormChange({ ...authForm, email: event.target.value })}
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
              onChange={(event) => onAuthFormChange({ ...authForm, password: event.target.value })}
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
