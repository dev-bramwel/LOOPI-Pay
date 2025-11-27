import React, { useState, useEffect, useRef } from "react";

// Simple LineChart component extracted from VendorDashboard.jsx
export default function LineChart({ transactions }) {
  // timeframe options: hours, days, weeks, months, years
  const [timeframe, setTimeframe] = useState("days");
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    label: "",
  });
  const [selectedPoint, setSelectedPoint] = useState(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(700);

  const scaleRef = useRef(1);
  const [scaleState, setScaleState] = useState(1);
  const scaleYRef = useRef(1);
  const [scaleYState, setScaleYState] = useState(1);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1);

  const baseSpacingFor = (tf) =>
    tf === "hours"
      ? 80
      : tf === "days"
      ? 56
      : tf === "weeks"
      ? 72
      : tf === "months"
      ? 90
      : 120;

  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.clientWidth || 700;
      setContainerWidth(w);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const completed = (transactions || []).filter((t) => {
    const s = (t.status || "").toString().toLowerCase();
    return s === "completed" || s === "paid";
  });

  // derive a key for grouping based on timeframe
  const keyFor = (date) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    switch (timeframe) {
      case "hours": {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const minute = d.getMinutes();
        const mbin = minute < 30 ? "00" : "30";
        return `${yyyy}-${mm}-${dd}T${hh}:${mbin}`;
      }
      case "weeks": {
        const tmp = new Date(
          Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
        );
        const day = tmp.getUTCDay() || 7;
        tmp.setUTCDate(tmp.getUTCDate() - day + 1);
        return tmp.toISOString().slice(0, 10);
      }
      case "months":
        return d.toISOString().slice(0, 7);
      case "years":
        return d.getFullYear().toString();
      case "days":
      default:
        return d.toISOString().slice(0, 10);
    }
  };

  const labelFor = (key) => {
    if (!key) return "";
    switch (timeframe) {
      case "hours":
        return key.slice(-5);
      case "weeks":
        return key;
      case "months":
        return key;
      case "years":
        return key;
      case "days":
      default:
        return key.slice(5);
    }
  };

  const groups = {};
  completed.forEach((t) => {
    const d =
      t.paid_at || t.created_at || t.createdAt || new Date().toISOString();
    const k = keyFor(d);
    if (!k) return;
    const amt = parseFloat(t.amount || 0) || 0;
    groups[k] = (groups[k] || 0) + amt;
  });

  const keys = Object.keys(groups).sort();
  if (timeframe === "hours") {
    let targetDay = null;
    if (completed.length > 0) {
      const latest = completed.reduce((a, b) => {
        const da = new Date(a.paid_at || a.created_at || a.createdAt || 0);
        const db = new Date(b.paid_at || b.created_at || b.createdAt || 0);
        return da > db ? a : b;
      });
      const d = new Date(
        latest.paid_at || latest.created_at || latest.createdAt || Date.now()
      );
      targetDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
    } else {
      const now = new Date();
      targetDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(now.getDate()).padStart(2, "0")}`;
    }

    const allBins = [];
    for (let i = 0; i < 48; i++) {
      const hh = String(Math.floor(i / 2)).padStart(2, "0");
      const mm = i % 2 === 0 ? "00" : "30";
      allBins.push(`${targetDay}T${hh}:${mm}`);
    }
    allBins.forEach((k) => {
      if (!Object.prototype.hasOwnProperty.call(groups, k)) groups[k] = 0;
    });
    keys.length = 0;
    allBins.forEach((k) => keys.push(k));
  }

  // Trim keys so the chart only extends up to the current timeframe (no future bins)
  {
    const now = new Date();
    let cutoffKey = null;
    if (timeframe === "hours") {
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const hh = String(now.getHours()).padStart(2, "0");
      const minute = now.getMinutes();
      const mbin = minute < 30 ? "00" : "30";
      cutoffKey = `${yyyy}-${mm}-${dd}T${hh}:${mbin}`;
    } else if (timeframe === "weeks") {
      const tmp = new Date(
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
      );
      const day = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() - day + 1);
      cutoffKey = tmp.toISOString().slice(0, 10);
    } else if (timeframe === "months") {
      cutoffKey = now.toISOString().slice(0, 7);
    } else if (timeframe === "years") {
      cutoffKey = String(now.getFullYear());
    } else {
      cutoffKey = now.toISOString().slice(0, 10);
    }

    if (cutoffKey) {
      const idx = keys.findIndex((k) => k > cutoffKey);
      if (idx !== -1) keys.length = Math.max(0, idx);
    }
  }
  if (keys.length === 0)
    return <div className="chart-empty">No completed payments yet</div>;

  // attach handlers for pan (drag), wheel-zoom, and pinch-zoom on the container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      if (e.shiftKey) {
        const oldY = scaleYRef.current || 1;
        const zoomFactorY = e.deltaY > 0 ? 0.9 : 1.1;
        const newY = Math.max(0.2, Math.min(5, oldY * zoomFactorY));
        scaleYRef.current = newY;
        setScaleYState(newY);
        return;
      }

      const rect = el.getBoundingClientRect();
      const clientX = e.clientX - rect.left + el.scrollLeft;
      const oldScale = scaleRef.current || 1;
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      let newScale = Math.max(0.4, Math.min(4, oldScale * zoomFactor));
      scaleRef.current = newScale;
      setScaleState(newScale);

      const base = baseSpacingFor(timeframe);
      const pad = 24;
      const oldWidth = Math.max(
        containerWidth,
        keys.length * base * oldScale + pad * 2
      );
      const newWidth = Math.max(
        containerWidth,
        keys.length * base * newScale + pad * 2
      );
      const ratio = clientX / oldWidth || 0;
      const newScroll = ratio * newWidth - (e.clientX - rect.left);
      el.scrollLeft = Math.max(0, newScroll);
    };

    const onMouseDown = (e) => {
      isDraggingRef.current = true;
      dragStartXRef.current = e.pageX - el.getBoundingClientRect().left;
      dragStartScrollRef.current = el.scrollLeft;
      el.classList.add("dragging");
    };

    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const x = e.pageX - el.getBoundingClientRect().left;
      const dx = x - dragStartXRef.current;
      el.scrollLeft = Math.max(0, dragStartScrollRef.current - dx);
    };

    const stopDrag = () => {
      isDraggingRef.current = false;
      el.classList.remove("dragging");
    };

    const getDist = (t1, t2) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const onTouchStart = (ev) => {
      if (ev.touches.length === 1) {
        dragStartXRef.current =
          ev.touches[0].clientX - el.getBoundingClientRect().left;
        dragStartScrollRef.current = el.scrollLeft;
      } else if (ev.touches.length === 2) {
        pinchStartDistRef.current = getDist(ev.touches[0], ev.touches[1]);
        pinchStartScaleRef.current = scaleRef.current || 1;
      }
    };

    const onTouchMove = (ev) => {
      if (ev.touches.length === 1 && !isDraggingRef.current) {
        const x = ev.touches[0].clientX - el.getBoundingClientRect().left;
        const dx = x - dragStartXRef.current;
        el.scrollLeft = Math.max(0, dragStartScrollRef.current - dx);
      } else if (ev.touches.length === 2) {
        ev.preventDefault();
        const d = getDist(ev.touches[0], ev.touches[1]);
        const factor = d / (pinchStartDistRef.current || d || 1);
        let newScale = Math.max(
          0.4,
          Math.min(4, (pinchStartScaleRef.current || 1) * factor)
        );
        scaleRef.current = newScale;
        setScaleState(newScale);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDrag);
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopDrag);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [containerRef, keys.length, timeframe, containerWidth]);

  const pointSpacing = baseSpacingFor(timeframe) * (scaleRef.current || 1);

  const padLeft = 48;
  const padTop = 24;
  const padBottom = 24;
  const padRight = 24;

  const w = Math.max(
    containerWidth,
    keys.length * pointSpacing + padLeft + padRight
  );
  const h = 200;

  const values = (() => {
    const out = [];
    let running = 0;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      running += parseFloat(groups[k] || 0) || 0;
      out.push(running);
    }
    return out;
  })();
  const rawMax = values.length > 0 ? Math.max(...values) : 0;
  const rawMin = 0;

  const yScale = typeof scaleState === "number" ? scaleYRef.current || 1 : 1;
  const mid = (rawMax + rawMin) / 2 || 0;
  const max = mid + (rawMax - mid) / Math.max(1e-6, yScale);
  const min = mid - (mid - rawMin) / Math.max(1e-6, yScale);

  const innerWidth = w - padLeft - padRight;
  const innerHeight = h - padTop - padBottom;

  const points = values.map((v, i) => {
    const x = padLeft + i * (innerWidth / Math.max(1, keys.length - 1));
    const norm = Math.max(
      0,
      Math.min(1, (v - min) / Math.max(1e-6, max - min))
    );
    const y = padTop + (1 - norm) * innerHeight;
    return { x, y, v, k: keys[i] };
  });

  const tensionRef = useRef(0.5);
  const [tension, setTension] = useState(0.5);
  useEffect(() => {
    tensionRef.current = tension;
  }, [tension]);

  const catmullRom2bezier = (pts, t = 0.5) => {
    if (!pts || pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const x1 = p1.x + ((p2.x - p0.x) / 6) * t;
      const y1 = p1.y + ((p2.y - p0.y) / 6) * t;

      const x2 = p2.x - ((p3.x - p1.x) / 6) * t;
      const y2 = p2.y - ((p3.y - p1.y) / 6) * t;

      d += ` C ${x1} ${y1}, ${x2} ${y2}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const pathD = catmullRom2bezier(points, tensionRef.current);

  const buildAreaPath = (pts, chartW, chartH) => {
    if (!pts || pts.length === 0) return "";
    const top = catmullRom2bezier(pts, tensionRef.current);
    const startX = pts[0].x || padLeft;
    const endX = pts[pts.length - 1].x || chartW - padRight;
    return `${top} L ${endX} ${chartH - padBottom} L ${startX} ${
      chartH - padBottom
    } Z`;
  };

  const areaD = buildAreaPath(points, w, h);

  const pathRef = useRef(null);
  const areaRef = useRef(null);

  useEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    try {
      const len = p.getTotalLength();
      p.style.transition = "none";
      p.style.strokeDasharray = `${len} ${len}`;
      p.style.strokeDashoffset = String(len);
      p.getBoundingClientRect();
      p.style.transition = "stroke-dashoffset 700ms ease, opacity 400ms";
      p.style.strokeDashoffset = "0";
      p.style.opacity = "1";
    } catch (e) {
      // ignore
    }
    const a = areaRef.current;
    if (a) {
      a.style.transition = "opacity 700ms ease";
      a.style.opacity = "1";
    }
  }, [pathD, areaD]);

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {[
            ["hours", "Hours"],
            ["days", "Days"],
            ["weeks", "Weeks"],
            ["months", "Months"],
            ["years", "Years"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`btn ${
                timeframe === k ? "btn-primary" : "btn-outline"
              }`}
              onClick={() => setTimeframe(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className="chart-summary"
          style={{ display: "flex", gap: 12, alignItems: "center" }}
        >
          <div>
            Total completed:{" "}
            <strong>
              KES {values.reduce((a, b) => a + b, 0).toLocaleString()}
            </strong>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, color: "#475569" }}>Smoothing</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={tension}
              onChange={(e) => setTension(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          overflowX: "auto",
          width: "100%",
          border: "1px solid rgba(0,0,0,0.04)",
          borderRadius: 6,
        }}
      >
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width={w}
          height={h}
          preserveAspectRatio="xMinYMid"
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(14,165,233,0.14)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0.02)" />
            </linearGradient>
          </defs>

          <path
            ref={areaRef}
            d={areaD}
            fill="url(#areaGrad)"
            stroke="none"
            style={{ opacity: 0 }}
          />

          <path
            ref={pathRef}
            d={pathD}
            fill="none"
            stroke="var(--brand-blue)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0 }}
          />

          {/* Y axis gridlines and labels */}
          {(() => {
            const yNodes = [];
            const yTicks = 4;
            for (let i = 0; i <= yTicks; i++) {
              const t = i / yTicks;
              const y = padTop + t * innerHeight;
              const value = Math.round((1 - t) * (max - min) + min);
              yNodes.push(
                <g key={`y-${i}`}>
                  <line
                    x1={padLeft}
                    x2={w - padRight}
                    y1={y}
                    y2={y}
                    stroke="rgba(15,23,42,0.04)"
                    strokeWidth={1}
                  />
                  <text
                    x={8}
                    y={y + 4}
                    fontSize={11}
                    textAnchor="start"
                    fill="#475569"
                  >
                    {value.toLocaleString()}
                  </text>
                </g>
              );
            }
            return yNodes;
          })()}

          {/* x ticks and light vertical grid lines */}
          {(() => {
            const ticks = Math.min(10, Math.max(2, points.length));
            const step = Math.max(1, Math.floor(points.length / (ticks - 1)));
            const nodes = [];
            for (let i = 0; i < points.length; i += step) {
              const p = points[i];
              nodes.push(
                <g key={`xt-${p.k}`}>
                  <line
                    x1={p.x}
                    x2={p.x}
                    y1={padTop}
                    y2={h - padBottom}
                    stroke="rgba(15,23,42,0.04)"
                    strokeWidth={1}
                  />
                  <text
                    x={p.x}
                    y={h - 6}
                    fontSize={10}
                    textAnchor="middle"
                    fill="#334155"
                  >
                    {labelFor(p.k)}
                  </text>
                </g>
              );
            }
            if (
              !nodes.find(
                (n) => n && n.key === `xt-${points[points.length - 1].k}`
              )
            ) {
              const p = points[points.length - 1];
              nodes.push(
                <g key={`xt-${p.k}`}>
                  <line
                    x1={p.x}
                    x2={p.x}
                    y1={padTop}
                    y2={h - padBottom}
                    stroke="rgba(15,23,42,0.04)"
                    strokeWidth={1}
                  />
                  <text
                    x={p.x}
                    y={h - 6}
                    fontSize={10}
                    textAnchor="middle"
                    fill="#334155"
                  >
                    {labelFor(p.k)}
                  </text>
                </g>
              );
            }
            return nodes;
          })()}

          {/* invisible hit areas for points (keep interactivity without visible bubbles) */}
          {points.map((p) => (
            <g key={p.k}>
              <circle
                cx={p.x}
                cy={p.y}
                r={12}
                fill="transparent"
                style={{
                  cursor: "pointer",
                  transition: "r 120ms",
                  pointerEvents: "all",
                }}
                onClick={() =>
                  setSelectedPoint((s) => (s && s.k === p.k ? null : p))
                }
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  const clientX =
                    e.clientX || (e.nativeEvent && e.nativeEvent.clientX);
                  const clientY =
                    e.clientY || (e.nativeEvent && e.nativeEvent.clientY);
                  const x = rect ? clientX - rect.left : p.x;
                  const y = rect ? clientY - rect.top : p.y;
                  setTooltip({
                    visible: true,
                    x,
                    y,
                    label: `${labelFor(p.k)}: KES ${p.v.toLocaleString()}`,
                  });
                }}
                onMouseMove={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  const clientX =
                    e.clientX || (e.nativeEvent && e.nativeEvent.clientX);
                  const clientY =
                    e.clientY || (e.nativeEvent && e.nativeEvent.clientY);
                  const x = rect ? clientX - rect.left : p.x;
                  const y = rect ? clientY - rect.top : p.y;
                  setTooltip((t) => ({ ...t, x, y }));
                }}
                onMouseLeave={() =>
                  setTooltip({ visible: false, x: 0, y: 0, label: "" })
                }
              />
            </g>
          ))}

          {/* selected point marker (visible) */}
          {selectedPoint && (
            <g key={`selected-${selectedPoint.k}`}>
              <circle
                cx={selectedPoint.x}
                cy={selectedPoint.y}
                r={5}
                fill="var(--brand-green)"
                stroke="#fff"
                strokeWidth={1.5}
              />
            </g>
          )}
        </svg>
      </div>

      {tooltip.visible && (
        <div
          className="chart-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
