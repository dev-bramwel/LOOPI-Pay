import { useEffect, useState } from "react";

export default function Footer() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n) => n.toString().padStart(2, "0");
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const timeString = `${hours}:${minutes}:${seconds}`;
  const year = now.getFullYear();

  const day = now.getDate();
  const month = now.toLocaleString("en-US", { month: "short" });
  const ordinal = (d) => {
    const s = ["th", "st", "nd", "rd"];
    const v = d % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };
  const dateString = `${day}${ordinal(day)} ${month} ${year}`;

  return (
    <footer
      className="app-footer"
      style={{
        borderTop: "1px solid rgba(0,0,0,0.06)",
        padding: "12px 16px",
        marginTop: 20,
        background: "var(--bg-white, #fff)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div style={{ color: "#475569" }}>
          © {year} LOOPI+ Bramwel Mutugi. All rights reserved.
        </div>
        <div
          style={{
            color: "#0f172a",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          <span style={{ marginRight: 12 }}>{dateString}</span>
          <span>{timeString}</span>
        </div>
      </div>
    </footer>
  );
}
