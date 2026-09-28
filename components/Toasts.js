"use client";

export default function Toasts({ toasts }) {
  return (
    <div id="toast-wrap">
      {toasts.map((t) => (
        <div className={`toast${t.out ? " out" : ""}`} key={t.key}>
          <div className="toast-title">{t.title}</div>
          <div className="toast-body">{t.body}</div>
        </div>
      ))}
    </div>
  );
}
