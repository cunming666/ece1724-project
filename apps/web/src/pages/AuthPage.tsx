import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, FieldLabel, Input, Pill, Select } from "../components/ui";
import { apiFetch, clearSessionToken, getSessionToken, setSessionToken } from "../lib/api";
import { SESSION_QUERY_KEY } from "../lib/session";

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

  useEffect(() => {
    if (getSessionToken()) {
      navigate("/panel", { replace: true });
    }
  }, [navigate]);

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

  return (
    <main className="app-shell mx-auto grid min-h-screen w-full max-w-7xl items-center gap-6 px-4 py-8 md:grid-cols-[1.1fr_0.9fr] md:px-8">
      <div className="hero-glow" />

      <section className="stagger-enter rounded-3xl bg-slate-900 p-7 text-white md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">ECE1724 Project 3</p>
        <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight leading-tight">
          Sign In First, Then Enter Control Panel
        </h1>
        <p className="mt-4 max-w-xl text-sm text-slate-200 md:text-base">
          Complete authentication first, then enter the event control panel. You can sign in with an existing account,
          register a new account, or click the quick demo button to seed demo data and sign in instantly.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
            <p className="text-xs text-slate-200">Entry Flow</p>
            <p className="mt-1 text-lg font-semibold">Auth ➜ Panel ➜ Dashboard</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
            <p className="text-xs text-slate-200">Demo Support</p>
            <p className="mt-1 text-lg font-semibold">One-click Demo Seed</p>
          </div>
        </div>
      </section>

      <Card className="stagger-enter stagger-2" title="Authentication" subtitle="Use account login, register new account, or quick demo.">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button variant={mode === "signin" ? "secondary" : "ghost"} onClick={() => setMode("signin")}>
            Sign In
          </Button>
          <Button variant={mode === "signup" ? "secondary" : "ghost"} onClick={() => setMode("signup")}>
            Sign Up
          </Button>
          <Button
            className="ml-auto"
            onClick={() => quickDemo.mutate()}
            disabled={quickDemo.isPending}
          >
            {quickDemo.isPending ? "Preparing Demo..." : "Quick Start Demo"}
          </Button>
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
          <div className="space-y-3">
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                placeholder="name@mail.utoronto.ca"
                value={signInForm.email}
                onChange={(e) => setSignInForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <Input
                placeholder="Password"
                type="password"
                value={signInForm.password}
                onChange={(e) => setSignInForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>

            <Button onClick={() => signIn.mutate()} className="w-full" disabled={signIn.isPending}>
              {signIn.isPending ? "Signing In..." : "Sign In and Enter Control Panel"}
            </Button>

            <div className="rounded-xl bg-slate-100/80 px-3 py-2 text-xs text-slate-700">
              Don't have an account?
              <button className="ml-1 font-semibold text-brand-700 underline" onClick={() => setMode("signup")}>
                Sign Up
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                placeholder="name@mail.utoronto.ca"
                value={signUpForm.email}
                onChange={(e) => setSignUpForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>Name</FieldLabel>
              <Input
                placeholder="Full name"
                value={signUpForm.name}
                onChange={(e) => setSignUpForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <Input
                placeholder="At least 6 characters"
                type="password"
                value={signUpForm.password}
                onChange={(e) => setSignUpForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>Role</FieldLabel>
              <Select value={signUpForm.role} onChange={(e) => setSignUpForm((prev) => ({ ...prev, role: e.target.value }))}>
                <option value="ATTENDEE">ATTENDEE</option>
                <option value="STAFF">STAFF</option>
                <option value="ORGANIZER">ORGANIZER</option>
              </Select>
            </div>

            <Button onClick={() => signUp.mutate()} className="w-full" disabled={signUp.isPending}>
              {signUp.isPending ? "Signing Up..." : "Create Account"}
            </Button>

            <div className="rounded-xl bg-slate-100/80 px-3 py-2 text-xs text-slate-700">
              Already have an account?
              <button className="ml-1 font-semibold text-brand-700 underline" onClick={() => setMode("signin")}>
                Back to Sign In
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Pill tone="brand">Auth First</Pill>
          <Pill tone="slate">Role-based Entry</Pill>
        </div>
      </Card>
    </main>
  );
}