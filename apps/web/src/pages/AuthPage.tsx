import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, FieldLabel, Input, Pill, Select } from "../components/ui";
import { apiFetch, clearSessionToken, getSessionToken, setSessionToken } from "../lib/api";
import { SESSION_QUERY_KEY, useSessionQuery } from "../lib/session";

type AuthMode = "signin" | "signup";
type NoticeTone = "success" | "error" | "info";

interface Notice {
  tone: NoticeTone;
  text: string;
}

interface BootstrapPayload {
  accounts: Array<{
    role: "ORGANIZER" | "STAFF" | "ATTENDEE";
    email: string;
    password: string;
    token: string;
  }>;
}

export function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [notice, setNotice] = useState<Notice | null>(null);
  const hasCachedToken = useMemo(() => Boolean(getSessionToken()), []);
  const existingSessionQuery = useSessionQuery(hasCachedToken);
  const existingSession = existingSessionQuery.data;

  useEffect(() => {
    if (existingSessionQuery.isError && hasCachedToken) {
      clearSessionToken();
      queryClient.removeQueries({ queryKey: SESSION_QUERY_KEY });
    }
  }, [existingSessionQuery.isError, hasCachedToken, queryClient]);

  const [signInForm, setSignInForm] = useState({
    email: "",
    password: "",
  });

  const [signUpForm, setSignUpForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "ATTENDEE",
  });

  const signIn = useMutation({
    mutationFn: () =>
      apiFetch<{ token: string; user: { id: string; email: string; name: string; role: string } }>("/auth/sign-in", {
        method: "POST",
        body: JSON.stringify(signInForm),
      }),
    onSuccess: async (payload) => {
      try {
        setSessionToken(payload.token);
        queryClient.removeQueries({ queryKey: SESSION_QUERY_KEY });
        await queryClient.fetchQuery({
          queryKey: SESSION_QUERY_KEY,
          queryFn: () => apiFetch("/auth/session"),
          retry: false,
        });
        navigate("/panel", { replace: true });
      } catch (error) {
        clearSessionToken();
        setNotice({ tone: "error", text: (error as Error).message });
      }
    },
    onError: (error: Error) => {
      setNotice({ tone: "error", text: error.message });
    },
  });

  const signUp = useMutation({
    mutationFn: () =>
      apiFetch("/auth/sign-up", {
        method: "POST",
        body: JSON.stringify(signUpForm),
      }),
    onSuccess: () => {
      setNotice({ tone: "success", text: "Registration successful. Please sign in with your new account." });
      setMode("signin");
      setSignInForm((prev) => ({ ...prev, email: signUpForm.email }));
    },
    onError: (error: Error) => {
      setNotice({ tone: "error", text: error.message });
    },
  });

  const quickDemo = useMutation({
    mutationFn: () => apiFetch<BootstrapPayload>("/api/demo/bootstrap", { method: "POST" }),
    onSuccess: async (payload) => {
      try {
        const organizer = payload.accounts.find((item) => item.role === "ORGANIZER");
        if (!organizer) {
          throw new Error("Demo organizer account is missing.");
        }

        setSessionToken(organizer.token);
        queryClient.removeQueries({ queryKey: SESSION_QUERY_KEY });
        await queryClient.fetchQuery({
          queryKey: SESSION_QUERY_KEY,
          queryFn: () => apiFetch("/auth/session"),
          retry: false,
        });
        navigate("/panel", { replace: true });
      } catch (error) {
        clearSessionToken();
        setNotice({ tone: "error", text: (error as Error).message });
      }
    },
    onError: (error: Error) => {
      setNotice({ tone: "error", text: error.message });
    },
  });

  const isBusy = signIn.isPending || signUp.isPending || quickDemo.isPending;

  function switchMode(nextMode: AuthMode) {
    if (isBusy) {
      return;
    }
    setMode(nextMode);
    setNotice(null);
  }

  return (
    <main className="app-shell page-auth mx-auto grid min-h-screen w-full max-w-7xl items-center gap-6 px-4 py-8 md:grid-cols-[1.15fr_0.85fr] md:px-8">
      <div className="hero-glow" />

      <section className="stagger-enter auth-hero-panel rounded-3xl border border-slate-200 bg-white p-7 text-slate-900 shadow-sm md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">ECE1724 Project</p>
        <h1 className="mt-3 font-heading text-4xl font-bold leading-tight tracking-tight">Event Console</h1>
        <p className="mt-4 max-w-xl text-sm text-slate-600 md:text-base">
          Sign in to continue. You can also create an account or load the demo data.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-600">Access</p>
            <p className="mt-1 text-lg font-semibold">Sign in or register</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-600">Demo</p>
            <p className="mt-1 text-lg font-semibold">Load demo data</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-600">Roles</p>
            <p className="mt-1 text-lg font-semibold">Organizer / Staff / Attendee</p>
          </div>
        </div>
      </section>

      <Card
        className="stagger-enter stagger-2 auth-form-card"
        title={mode === "signin" ? "Sign In" : "Create Account"}
        subtitle={mode === "signin" ? "Enter your account details." : "Create a new account."}
        headerRight={<Pill tone="brand">{mode === "signin" ? "Account" : "New"}</Pill>}
      >
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            className={`h-9 rounded-lg text-sm font-semibold transition ${mode === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            onClick={() => switchMode("signin")}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`h-9 rounded-lg text-sm font-semibold transition ${mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            onClick={() => switchMode("signup")}
          >
            Register
          </button>
        </div>

        {existingSession ? (
          <Button
            className="mb-3 w-full"
            variant="ghost"
            onClick={() => navigate("/panel")}
            disabled={isBusy}
          >
            Continue as {existingSession.name} ({existingSession.role})
          </Button>
        ) : null}

        <Button className="auth-demo-btn mb-4 w-full" variant="secondary" onClick={() => quickDemo.mutate()} disabled={quickDemo.isPending}>
          {quickDemo.isPending ? "Loading Demo..." : "Load Demo (Organizer)"}
        </Button>

        <p className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
          Loads demo data and signs in as the organizer account.
        </p>

        <div className="mb-4 flex gap-2">
          <Pill tone="brand">Sign In</Pill>
          <Pill tone="slate">Demo</Pill>
        </div>

        {notice ? (
          <div
            className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : notice.tone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-sky-200 bg-sky-50 text-sky-700"
            }`}
          >
            {notice.text}
          </div>
        ) : null}

        {mode === "signin" ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              signIn.mutate();
            }}
          >
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                placeholder="name@mail.utoronto.ca"
                value={signInForm.email}
                onChange={(event) => setSignInForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <Input
                placeholder="Password"
                type="password"
                value={signInForm.password}
                onChange={(event) => setSignInForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>

            <Button type="submit" className="h-11 w-full" disabled={signIn.isPending}>
              {signIn.isPending ? "Signing In..." : "Sign In"}
            </Button>

            <div className="rounded-xl bg-slate-100/80 px-3 py-2 text-xs text-slate-700">
              No account?
              <button type="button" className="ml-1 font-semibold text-brand-700 underline" onClick={() => switchMode("signup")}>
                Register
              </button>
            </div>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              signUp.mutate();
            }}
          >
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                placeholder="name@mail.utoronto.ca"
                value={signUpForm.email}
                onChange={(event) => setSignUpForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>Name</FieldLabel>
              <Input
                placeholder="Full name"
                value={signUpForm.name}
                onChange={(event) => setSignUpForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <Input
                placeholder="At least 6 characters"
                type="password"
                value={signUpForm.password}
                onChange={(event) => setSignUpForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>Role</FieldLabel>
              <Select value={signUpForm.role} onChange={(event) => setSignUpForm((prev) => ({ ...prev, role: event.target.value }))}>
                <option value="ATTENDEE">ATTENDEE</option>
                <option value="STAFF">STAFF</option>
                <option value="ORGANIZER">ORGANIZER</option>
              </Select>
            </div>

            <Button type="submit" className="h-11 w-full" disabled={signUp.isPending}>
              {signUp.isPending ? "Signing Up..." : "Create Account"}
            </Button>

            <div className="rounded-xl bg-slate-100/80 px-3 py-2 text-xs text-slate-700">
              Already have an account?
              <button type="button" className="ml-1 font-semibold text-brand-700 underline" onClick={() => switchMode("signin")}>
                Sign In
              </button>
            </div>
          </form>
        )}
      </Card>
    </main>
  );
}


