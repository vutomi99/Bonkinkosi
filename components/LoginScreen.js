"use client";
import { useState } from "react";
import BrandLogo from "@/components/BrandLogo";

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onLogin({ email: email.trim(), password });
    } catch (err) {
      setError(err.message || "Sign-in failed.");
      setSubmitting(false);
    }
  }

  return (
    <div id="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-mark"><BrandLogo /></div>
          <div className="login-brand-text">
            <b>AI-Driven Integrated SOC</b>
            <span>Security Operations Console</span>
          </div>
        </div>
        <div className="login-title">Sign in to the console</div>
        <div className="login-sub">
          Sign in with your analyst account to open the live alert queue.
        </div>
        {error && (
          <div className="err" style={{ display: "block" }}>
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="email-input">Work email</label>
          <input
            id="email-input"
            type="email"
            placeholder="you@yourcompany.com"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password-input">Password</label>
          <input
            id="password-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <div className="login-foot">
          Accounts are created by an administrator. Contact your SOC lead for access.
        </div>
      </form>
    </div>
  );
}
