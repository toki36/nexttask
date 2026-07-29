import { useState, type FormEvent } from "react";
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
  const [showPassword, setShowPassword] = useState(false);

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
          <p>
            See what matters, protect time for focused work, and keep every deadline within reach.
          </p>
        </div>
        <p className="auth-note">Make time for the work that moves you forward.</p>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form stack" onSubmit={onSubmit}>
          <h2>{authMode === "login" ? "Welcome back" : "Create your account"}</h2>
          <div className="auth-tabs" aria-label="Authentication mode" role="tablist">
            <button
              aria-selected={authMode === "login"}
              role="tab"
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => onAuthModeChange("login")}
            >
              Log in
            </button>
            <button
              aria-selected={authMode === "register"}
              role="tab"
              type="button"
              className={authMode === "register" ? "active" : ""}
              onClick={() => onAuthModeChange("register")}
            >
              Sign up
            </button>
          </div>
          {authMode === "register" ? (
            <div className="field">
              <label htmlFor="name">Name</label>
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
            <label htmlFor="email">Email</label>
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
            <label htmlFor="password">Password</label>
            <div className="password-control">
              <input
                id="password"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                type={showPassword ? "text" : "password"}
                minLength={8}
                value={authForm.password}
                onChange={(event) => onAuthFormChange({ ...authForm, password: event.target.value })}
                required
              />
              <button onClick={() => setShowPassword((current) => !current)} type="button">
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {authMode === "register" ? <span className="field-hint">Use at least 8 characters.</span> : null}
          </div>
          <button className="btn primary" disabled={loading} type="submit">
            {loading ? "Please wait..." : authMode === "login" ? "Log in" : "Create account"}
          </button>
          <StatusMessage status={status} error={error} />
        </form>
      </section>
    </main>
  );
}
