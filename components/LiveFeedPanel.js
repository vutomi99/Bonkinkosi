"use client";
import { useEffect, useRef } from "react";
import { ALERT_THRESHOLD } from "@/lib/simulation";

function cssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export default function LiveFeedPanel({ consoleLines, sparkPoints, isLive, onToggle }) {
  const consoleRef = useRef(null);
  const canvasRef = useRef(null);

  // auto-scroll the console feed
  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [consoleLines]);

  // redraw the sparkline whenever new points arrive
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width,
      h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const pad = 8;
    const usable = h - pad * 2;

    const ty = pad + usable * (1 - ALERT_THRESHOLD / 100);
    ctx.strokeStyle = "rgba(240,70,107,0.35)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, ty);
    ctx.lineTo(w, ty);
    ctx.stroke();
    ctx.setLineDash([]);

    function dotColor(r) {
      if (r >= ALERT_THRESHOLD) return cssVar("--critical", "#F0466B");
      if (r >= 40) return cssVar("--warn", "#F5A623");
      return cssVar("--info", "#4F8CFF");
    }
    function drawDot(x, y, color) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    if (sparkPoints.length < 2) {
      if (sparkPoints.length === 1) {
        drawDot(w - 6, pad + usable * (1 - sparkPoints[0] / 100), dotColor(sparkPoints[0]));
      }
      return;
    }
    const n = sparkPoints.length;
    const stepX = w / Math.max(n - 1, 1);
    ctx.strokeStyle = "rgba(120,140,200,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    sparkPoints.forEach((v, i) => {
      const x = i * stepX,
        y = pad + usable * (1 - v / 100);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    sparkPoints.forEach((v, i) => {
      const x = i * stepX,
        y = pad + usable * (1 - v / 100);
      drawDot(x, y, dotColor(v));
    });
  }, [sparkPoints]);

  return (
    <div className="live-row">
      <div className="panel">
        <div className="live-head">
          <div className="live-head-left">
            <div className={`pulse-dot${isLive ? "" : " paused"}`}></div>
            <div>
              <div className="live-title">Live event ingestion</div>
              <div className="live-sub">
                {onToggle ? (
                  <>
                    Watching <span className="mono">20</span> endpoints &amp; network traffic in
                    real time
                  </>
                ) : (
                  "Simulator off — showing only alerts reported by real agents"
                )}
              </div>
            </div>
          </div>
          {onToggle && (
            <button className={`toggle-btn${isLive ? " on" : ""}`} onClick={onToggle}>
              {isLive ? "Pause monitoring" : "Resume monitoring"}
            </button>
          )}
        </div>
        <div id="console" ref={consoleRef}>
          {consoleLines.map((line) => (
            <div key={line.key} className={`console-line${line.flagged ? " flag" : ""}`}>
              <span className="ct">{line.time}</span>
              <span className="ce">{line.endpoint}</span>
              <span className="cs">
                {line.flagged ? "⚠ " : ""}
                {line.summary}
                {line.flagged ? " — ALERT RAISED" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="live-head">
          <div className="live-head-left">
            <div>
              <div className="live-title">AI risk score — live</div>
              <div className="live-sub">Isolation Forest inference on each incoming event</div>
            </div>
          </div>
        </div>
        <div id="chartwrap">
          <canvas ref={canvasRef} id="sparkline" width={600} height={120} />
          <div className="chart-legend">
            <span>
              <i style={{ background: "var(--info)" }}></i> Normal
            </span>
            <span>
              <i style={{ background: "var(--warn)" }}></i> Medium risk
            </span>
            <span>
              <i style={{ background: "var(--critical)" }}></i> High risk — alert raised
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
