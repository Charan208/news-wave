import { useState, useEffect, useCallback, useRef } from "react";
import {
  Rss, Clock, Users, BookOpen, Send, RefreshCw, Plus, Trash2,
  CheckCircle, XCircle, AlertTriangle, Zap, Shield, Globe,
  TrendingUp, FlaskConical, Tv, Trophy, Newspaper, ChevronRight,
  Activity, Wifi, WifiOff, Play, Square, Bell, Eye, EyeOff,
  MessageCircle, ExternalLink
} from "lucide-react";

const SERVER = ""; // ← change to deployed URL e.g. "https://your-server.railway.app"

// Hardcoded API key — must match SERVER_API_KEY in server .env
const API_KEY = "f38c23b0a0bbf82a443675f7970daf2dcda073861c05e9df7d59d474ef327e65";
const API_HEADERS = { "Content-Type": "application/json", "x-api-key": API_KEY };

// ── Compute the next cron fire time (client-side, handles all 5-part expressions)
function nextCronRun(expr) {
  if (!expr) return null;
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minP, hourP, , , dowP] = parts;
  const matches = (val, pattern) => {
    if (pattern === "*") return true;
    if (pattern.startsWith("*/")) return val % parseInt(pattern.slice(2)) === 0;
    if (pattern.includes("-")) { const [a, b] = pattern.split("-").map(Number); return val >= a && val <= b; }
    return val === parseInt(pattern);
  };
  const next = new Date();
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);
  for (let i = 0; i < 10080; i++) {
    if (matches(next.getMinutes(), minP) && matches(next.getHours(), hourP) && matches(next.getDay(), dowP))
      return new Date(next);
    next.setMinutes(next.getMinutes() + 1);
  }
  return null;
}

const CATS = [
  { id: "technology", label: "Technology", icon: "💻", color: "#38bdf8", rgb: "56,189,248" },
  { id: "cybersecurity", label: "Cybersecurity", icon: "🛡️", color: "#f43f5e", rgb: "244,63,94" },
  { id: "hacking", label: "Hacking & Exploits", icon: "💀", color: "#fb923c", rgb: "251,146,60" },
  { id: "ai agents", label: "AI Agents", icon: "🤖", color: "#a78bfa", rgb: "167,139,250" },
  { id: "ai tools & releases", label: "AI Tools & Releases", icon: "🚀", color: "#f0abfc", rgb: "240,171,252" },
  { id: "science", label: "Science", icon: "🔬", color: "#34d399", rgb: "52,211,153" },
  { id: "business", label: "Business", icon: "📈", color: "#a78bfa", rgb: "167,139,250" },
  { id: "politics", label: "Politics", icon: "🏛️", color: "#fbbf24", rgb: "251,191,36" },
  { id: "health", label: "Health", icon: "🏥", color: "#4ade80", rgb: "74,222,128" },
  { id: "sports", label: "Sports", icon: "⚽", color: "#60a5fa", rgb: "96,165,250" },
  { id: "entertainment", label: "Entertainment", icon: "🎬", color: "#e879f9", rgb: "232,121,249" },
  { id: "world news", label: "World News", icon: "🌍", color: "#22d3ee", rgb: "34,211,238" },
];

const SEV = {
  critical: { label: "CRITICAL", color: "#f43f5e", bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.35)", dot: "🔴" },
  high: { label: "HIGH", color: "#fb923c", bg: "rgba(251,146,60,0.10)", border: "rgba(251,146,60,0.3)", dot: "🟠" },
  medium: { label: "MEDIUM", color: "#fbbf24", bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.3)", dot: "🟡" },
  low: { label: "LOW", color: "#4ade80", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.25)", dot: "🟢" },
  info: { label: "INFO", color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.2)", dot: "ℹ️" },
};

const CRONS = [
  { label: "Every 10 min", expr: "*/10 * * * *" },
  { label: "Every 30 min", expr: "*/30 * * * *" },
  { label: "Every hour", expr: "0 * * * *" },
  { label: "Every 6h", expr: "0 */6 * * *" },
  { label: "Every 12h", expr: "0 */12 * * *" },
  { label: "Daily 8 AM", expr: "0 8 * * *" },
  { label: "Daily 9 PM", expr: "0 21 * * *" },
  { label: "Weekdays 9AM", expr: "0 9 * * 1-5" },
];

function buildWA(articles, cats) {
  const d = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  let m = `📰 *AI News Digest — ${d}*\n🔖 ${cats.join(" · ")}\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  articles.forEach((a, i) => {
    const e = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢", info: "ℹ️" }[a.severity] || "📌";
    m += `${e} *${i + 1}. ${a.headline}*\n${a.summary}\n`;
    if (a.tags?.length) m += `🏷️ ${a.tags.join(" · ")}\n`;
    if (a.url) m += `🔗 ${a.url}\n`;
    m += "\n";
  });
  m += `━━━━━━━━━━━━━━━━━━━━\n_News Agent v4 · NVIDIA NIM + 4 sources_ 🤖`;
  return m;
}

// ── Inline global CSS ────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
:root{
  --bg:#080b12;--surface:#0f1420;--s2:#141929;--s3:#1a2235;
  --border:rgba(255,255,255,0.07);--border2:rgba(255,255,255,0.12);
  --text:#e2e8f0;--muted:#64748b;--accent:#38bdf8;--green:#22c55e;
  --red:#f43f5e;--orange:#fb923c;--radius:14px;
}
html,body,#root{height:100%;}
body{background:var(--bg);font-family:'Inter',sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px;}

/* layout */
.shell{display:flex;height:100vh;overflow:hidden;background:var(--bg);}

/* sidebar */
.sidebar{
  width:220px;flex-shrink:0;background:var(--surface);
  border-right:1px solid var(--border);display:flex;flex-direction:column;
  padding:24px 12px;gap:4px;overflow-y:auto;
}
.logo{display:flex;align-items:center;gap:10px;padding:6px 12px 20px;margin-bottom:4px;}
.logo-icon{width:34px;height:34px;background:linear-gradient(135deg,#22c55e,#38bdf8);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
.logo-text{font-size:13px;font-weight:700;color:#fff;line-height:1.2;}
.logo-sub{font-size:10px;color:var(--muted);font-weight:400;}

.nav-section{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);padding:12px 12px 4px;font-weight:600;}
.nav-btn{
  display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;
  border:none;background:transparent;color:var(--muted);cursor:pointer;
  font-family:'Inter',sans-serif;font-size:13px;font-weight:500;
  transition:all 0.18s;text-align:left;width:100%;
}
.nav-btn:hover{background:var(--s2);color:var(--text);}
.nav-btn.active{background:rgba(56,189,248,0.1);color:var(--accent);border:1px solid rgba(56,189,248,0.18);}
.nav-btn svg{opacity:0.75;flex-shrink:0;}
.nav-btn.active svg{opacity:1;}

.sidebar-foot{margin-top:auto;padding-top:16px;border-top:1px solid var(--border);}
.status-pill{
  display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;
  background:var(--s2);font-size:12px;font-weight:500;
}
.sdot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.sdot.on{background:var(--green);box-shadow:0 0 8px rgba(34,197,94,0.6);animation:pulse 2s infinite;}
.sdot.off{background:var(--red);}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(0.9)}}

/* main content */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.topbar{
  height:60px;flex-shrink:0;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
  padding:0 28px;background:rgba(8,11,18,0.8);backdrop-filter:blur(12px);
}
.topbar-title{font-size:16px;font-weight:700;color:#fff;}
.topbar-sub{font-size:12px;color:var(--muted);margin-top:2px;}
.stat-chips{display:flex;gap:8px;}
.chip{
  display:flex;align-items:center;gap:6px;padding:6px 12px;
  background:var(--s2);border:1px solid var(--border);border-radius:8px;
  font-size:12px;font-weight:600;color:var(--muted);
}
.chip span{font-family:'JetBrains Mono',monospace;font-size:13px;}
.chip.red span{color:var(--red);}
.chip.orange span{color:var(--orange);}
.chip.green span{color:var(--green);}

.content{flex:1;overflow-y:auto;padding:28px;}

/* glass card */
.gcard{
  background:var(--surface);border:1px solid var(--border);
  border-radius:18px;padding:26px;margin-bottom:20px;
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
}
.gcard-title{font-size:17px;font-weight:700;color:#fff;margin-bottom:4px;}
.gcard-sub{font-size:13px;color:var(--muted);margin-bottom:22px;}

/* category grid */
.catgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:22px;}
.catbtn{
  display:flex;align-items:center;gap:8px;padding:11px 14px;
  border-radius:10px;border:1.5px solid var(--border);
  background:var(--s2);cursor:pointer;font-family:'Inter',sans-serif;
  font-size:12px;font-weight:500;color:var(--muted);transition:all 0.15s;
}
.catbtn:hover{border-color:var(--border2);color:var(--text);}
.catbtn.sel{color:#fff;font-weight:600;}
.cat-icon{font-size:15px;line-height:1;}

/* count row */
.count-row{display:flex;gap:6px;margin-bottom:22px;}
.cnt{
  flex:1;padding:10px;border-radius:9px;border:1.5px solid var(--border);
  background:var(--s2);color:var(--muted);cursor:pointer;
  font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;
  transition:all 0.15s;text-align:center;
}
.cnt.a{background:rgba(56,189,248,0.12);border-color:rgba(56,189,248,0.4);color:var(--accent);}

/* inputs */
.label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:7px;display:block;}
.ifield{
  width:100%;background:var(--s2);border:1.5px solid var(--border);
  border-radius:10px;padding:12px 15px;font-family:'Inter',sans-serif;
  font-size:14px;color:#fff;outline:none;transition:border-color 0.2s;
}
.ifield:focus{border-color:rgba(56,189,248,0.5);}
.ifield::placeholder{color:rgba(255,255,255,0.18);}
.igroup{margin-bottom:18px;}

/* buttons */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:12px 20px;border-radius:10px;border:none;cursor:pointer;
  font-family:'Inter',sans-serif;font-size:14px;font-weight:600;
  transition:all 0.18s;
}
.btn-primary{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;width:100%;padding:14px;}
.btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 28px rgba(34,197,94,0.28);}
.btn-primary:disabled{opacity:0.3;cursor:not-allowed;transform:none;}
.btn-secondary{background:var(--s3);border:1px solid var(--border2);color:var(--text);}
.btn-secondary:hover{background:var(--s2);border-color:var(--border2);}
.btn-danger{background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.25);color:var(--red);}
.btn-danger:hover{background:rgba(244,63,94,0.18);}
.btn-accent{background:rgba(56,189,248,0.12);border:1.5px solid rgba(56,189,248,0.3);color:var(--accent);}
.btn-accent:hover{background:rgba(56,189,248,0.2);}
.btn-sm{padding:7px 12px;font-size:12px;border-radius:8px;}

/* divider */
.hr{height:1px;background:var(--border);margin:22px 0;}

/* news cards */
.nlist{display:flex;flex-direction:column;gap:12px;}
.ncard{
  border-radius:12px;padding:18px;border:1px solid;
  animation:fadeUp 0.3s ease both;
}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.ncard-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;}
.sev{
  font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;
  letter-spacing:0.5px;font-family:'JetBrains Mono',monospace;
}
.src{
  margin-left:auto;font-size:10px;padding:2px 8px;border-radius:6px;
  background:rgba(255,255,255,0.06);color:var(--muted);
  font-family:'JetBrains Mono',monospace;
}
.nhead{font-size:15px;font-weight:700;color:#fff;margin-bottom:7px;line-height:1.45;}
.nsub{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.65;margin-bottom:10px;}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;}
.tag{font-size:10px;padding:2px 8px;border-radius:5px;background:rgba(255,255,255,0.06);color:var(--muted);border:1px solid rgba(255,255,255,0.08);font-family:'JetBrains Mono',monospace;}
.hn-meta{display:flex;gap:14px;font-size:11px;color:rgba(251,146,60,0.8);font-family:'JetBrains Mono',monospace;margin-bottom:8px;}
.read{font-size:12px;color:rgba(56,189,248,0.75);text-decoration:none;font-weight:500;display:inline-flex;align-items:center;gap:4px;}
.read:hover{color:var(--accent);}

/* stats bar */
.stats-row{display:flex;gap:10px;margin-bottom:22px;}
.stat-box{
  flex:1;background:var(--s2);border:1px solid var(--border);
  border-radius:12px;padding:14px;text-align:center;
}
.stat-val{font-size:24px;font-weight:800;font-family:'JetBrains Mono',monospace;line-height:1;}
.stat-lbl{font-size:11px;color:var(--muted);margin-top:4px;}

/* spinner */
.spin-wrap{text-align:center;padding:64px 0;}
.spinner{width:48px;height:48px;border:3px solid rgba(56,189,248,0.15);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 20px;}
@keyframes spin{to{transform:rotate(360deg)}}
.spin-title{font-size:18px;font-weight:700;color:#fff;margin-bottom:6px;}
.spin-sub{color:var(--muted);font-size:13px;}

/* preview box */
.preview{background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;white-space:pre-wrap;line-height:1.6;max-height:200px;overflow-y:auto;margin-top:14px;}

/* schedule */
.cron-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:18px;}
.cron-btn{padding:12px;border-radius:10px;border:1.5px solid var(--border);background:var(--s2);color:var(--muted);cursor:pointer;font-family:'Inter',sans-serif;font-size:12px;font-weight:600;transition:all 0.15s;text-align:left;}
.cron-btn:hover{border-color:var(--border2);color:var(--text);}
.cron-btn.sel{border-color:rgba(34,197,94,0.5);background:rgba(34,197,94,0.08);color:var(--green);}
.cron-expr{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted);display:block;margin-top:3px;}

/* toggle */
.toggle{width:42px;height:23px;border-radius:100px;border:none;cursor:pointer;background:var(--s3);transition:all 0.2s;position:relative;flex-shrink:0;}
.toggle.on{background:var(--green);}
.toggle::after{content:'';width:17px;height:17px;border-radius:50%;background:#fff;position:absolute;top:3px;left:3px;transition:all 0.2s;}
.toggle.on::after{left:22px;}
.flex-row{display:flex;align-items:center;gap:12px;}
.toggle-row{display:flex;align-items:center;gap:12px;padding:14px;background:var(--s2);border:1px solid var(--border);border-radius:12px;margin-bottom:18px;}
.toggle-info{flex:1;}
.toggle-label{font-size:14px;font-weight:600;color:#fff;}
.toggle-desc{font-size:12px;color:var(--muted);margin-top:2px;}

/* recipient cards */
.rcard{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;border:1px solid var(--border);background:var(--s2);margin-bottom:8px;transition:all 0.2s;}
.rcard.active-r{border-color:rgba(34,197,94,0.25);background:rgba(34,197,94,0.05);}
.avatar{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
.rname{font-size:14px;font-weight:600;color:#fff;}
.rphone{font-size:12px;color:var(--muted);font-family:'JetBrains Mono',monospace;}
.rlast{font-size:11px;color:rgba(34,197,94,0.65);margin-top:2px;}
.raction{display:flex;gap:6px;margin-left:auto;flex-shrink:0;}

/* history */
.hcard{padding:16px;border-radius:12px;border:1px solid var(--border);background:var(--s2);margin-bottom:8px;}
.hcard-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;}
.htime{font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;}
.hbadges{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}
.hbadge{font-size:10px;padding:2px 8px;border-radius:5px;background:rgba(255,255,255,0.06);color:var(--muted);}

/* alert box */
.alert{padding:12px 16px;border-radius:10px;font-size:13px;margin-bottom:16px;display:flex;align-items:flex-start;gap:8px;}
.alert.warn{background:rgba(251,146,60,0.08);border:1px solid rgba(251,146,60,0.2);color:rgba(255,255,255,0.75);}
.alert.err{background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.2);color:var(--red);}
.alert.ok{background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);color:var(--green);}
.alert svg{flex-shrink:0;margin-top:1px;}

/* offline banner */
.offline-banner{background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.25);border-radius:14px;padding:32px;text-align:center;margin-bottom:20px;}
.offline-banner h2{font-size:20px;font-weight:700;color:var(--red);margin-bottom:6px;}
.offline-banner p{font-size:13px;color:var(--muted);}
.mono{font-family:'JetBrains Mono',monospace;background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-size:12px;}

/* sched status */
.sched-running{background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:14px;margin-top:14px;}
.sched-running strong{color:var(--green);font-family:'JetBrains Mono',monospace;}

/* sources */
.src-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;}
.src-chip{font-size:11px;padding:4px 11px;border-radius:7px;font-weight:600;font-family:'JetBrains Mono',monospace;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);color:var(--green);}
.src-chip.hn{background:rgba(251,146,60,0.08);border-color:rgba(251,146,60,0.25);color:var(--orange);}
.src-chip.ai{background:rgba(56,189,248,0.08);border-color:rgba(56,189,248,0.2);color:var(--accent);}

.empty{text-align:center;padding:48px 0;color:var(--muted);font-size:14px;}
`;

export default function App() {
  const [tab, setTab] = useState("fetch");
  const [step, setStep] = useState("prefs");
  const [cats, setCats] = useState([]);
  const [count, setCount] = useState(5);
  const [phone, setPhone] = useState("");
  const [articles, setArts] = useState([]);
  const [sources, setSrc] = useState([]);
  const [error, setError] = useState("");
  const [waMsg, setWaMsg] = useState("");
  const [showPrev, setShowPrev] = useState(false);

  const [cron, setCron] = useState("");
  const [schedOn, setSchedOn] = useState(false);
  const [schedMsg, setSchedMsg] = useState("");
  const [autoSend, setAutoSend] = useState(true);

  const [recips, setRecips] = useState([]);
  const [nPhone, setNPhone] = useState("");
  const [nName, setNName] = useState("");
  const [rMsg, setRMsg] = useState("");
  const [tPhone, setTPhone] = useState("");
  const [tMsg, setTMsg] = useState("");
  const [testing, setTesting] = useState(false);

  const [history, setHist] = useState([]);
  const [serverOk, setOk] = useState(null);

  // poll server status
  useEffect(() => {
    const check = () =>
      fetch(`${SERVER}/api/status`, { headers: { "x-api-key": API_KEY } }).then(r => r.json())
        .then(d => {
          setOk(true);
          // build source list from the sources object in /api/status
          const s = d.sources || {};
          setSrc(Object.keys(s).filter(k => s[k] && k !== "nvidia_nim"));
        })
        .catch(() => setOk(false));
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  const toggleCat = id => setCats(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id]);
  const catLabels = cats.map(id => CATS.find(c => c.id === id)?.label || id);

  /* ── fetch news ── */
  const doFetch = async () => {
    if (!cats.length) return;
    setStep("loading"); setError(""); setArts([]);
    try {
      const r = await fetch(`${SERVER}/api/news`, {
        method: "POST", headers: API_HEADERS,
        body: JSON.stringify({ categories: catLabels, count, autoSend: autoSend && recips.filter(r => r.active).length > 0 })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Server error");
      setArts(d.articles); setSrc(d.sources || []);
      setWaMsg(buildWA(d.articles, catLabels)); setStep("results");
    } catch (e) { setError(e.message); setStep("prefs"); }
  };

  /* ── recipients ── */
  const loadRecips = useCallback(async () => {
    try { const r = await fetch(`${SERVER}/api/recipients`, { headers: { "x-api-key": API_KEY } }); const d = await r.json(); setRecips(d.recipients || []); }
    catch { setRecips([]); }
  }, []);

  const addRecip = async () => {
    if (!nPhone.trim()) return;
    try {
      const r = await fetch(`${SERVER}/api/recipients`, {
        method: "POST", headers: API_HEADERS,
        body: JSON.stringify({ action: "add", phone: nPhone.trim(), name: nName.trim() || "Recipient" })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setRMsg("✅ " + d.message); setNPhone(""); setNName(""); loadRecips();
    } catch (e) { setRMsg("❌ " + e.message); }
    setTimeout(() => setRMsg(""), 4000);
  };

  const toggleRecip = async (p) => {
    await fetch(`${SERVER}/api/recipients`, {
      method: "POST", headers: API_HEADERS,
      body: JSON.stringify({ action: "toggle", phone: p })
    });
    loadRecips();
  };

  const removeRecip = async (p) => {
    await fetch(`${SERVER}/api/recipients`, {
      method: "POST", headers: API_HEADERS,
      body: JSON.stringify({ action: "remove", phone: p })
    });
    loadRecips();
  };

  const testPing = async () => {
    if (!tPhone.trim()) return;
    setTesting(true); setTMsg("");
    try {
      const r = await fetch(`${SERVER}/api/test-whatsapp`, {
        method: "POST", headers: API_HEADERS,
        body: JSON.stringify({ to: tPhone.trim() })
      });
      const d = await r.json();
      setTMsg(r.ok ? "✅ Ping sent! Check WhatsApp." : "❌ " + (d.error || "Failed"));
    } catch { setTMsg("❌ Could not reach server"); }
    setTesting(false);
  };

  /* ── history ── */
  const loadHist = useCallback(async () => {
    try { const r = await fetch(`${SERVER}/api/history`, { headers: { "x-api-key": API_KEY } }); const d = await r.json(); setHist(d.digests || []); }
    catch { setHist([]); }
  }, []);

  /* ── schedule ── */
  const startSched = async () => {
    if (!cron || !cats.length) return;
    try {
      const r = await fetch(`${SERVER}/api/schedule`, {
        method: "POST", headers: API_HEADERS,
        body: JSON.stringify({ cronExpr: cron, categories: catLabels, count, enabled: true, autoSend })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSchedOn(true); setSchedMsg(d.message);
    } catch (e) { setSchedMsg("❌ " + e.message); }
  };

  const stopSched = async () => {
    await fetch(`${SERVER}/api/schedule`, {
      method: "POST", headers: API_HEADERS,
      body: JSON.stringify({ enabled: false })
    });
    setSchedOn(false); setSchedMsg("Scheduler stopped.");
  };

  // ── Countdown timer ──
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!schedOn || !cron) { setCountdown(""); return; }
    const tick = () => {
      const next = nextCronRun(cron);
      if (!next) return setCountdown("--:--:--");
      const diff = next - Date.now();
      if (diff <= 0) return setCountdown("Running now…");
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [schedOn, cron]);

  useEffect(() => { if (tab === "recipients") loadRecips(); }, [tab, loadRecips]);
  useEffect(() => { if (tab === "history") loadHist(); }, [tab, loadHist]);

  const critical = articles.filter(a => a.severity === "critical").length;
  const high = articles.filter(a => a.severity === "high").length;

  const NAV = [
    { id: "fetch", icon: <Rss size={15} />, label: "Fetch News" },
    { id: "schedule", icon: <Clock size={15} />, label: "Scheduler" },
    { id: "recipients", icon: <Users size={15} />, label: "Recipients" },
    { id: "history", icon: <BookOpen size={15} />, label: "History" },
  ];

  const titles = {
    fetch: { t: "Fetch & Analyze", s: "Pull live news and send to WhatsApp" },
    schedule: { t: "Auto Scheduler", s: "Set cron-based auto-delivery" },
    recipients: { t: "Recipients", s: "Manage your WhatsApp send list" },
    history: { t: "Digest History", s: "Last 50 fetched digests" },
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-icon">📰</div>
            <div>
              <div className="logo-text">News Agent</div>
              <div className="logo-sub">v4.0 — NVIDIA NIM</div>
            </div>
          </div>

          <div className="nav-section">Navigation</div>
          {NAV.map(n => (
            <button key={n.id} className={`nav-btn${tab === n.id ? " active" : ""}`} onClick={() => setTab(n.id)}>
              {n.icon} {n.label}
            </button>
          ))}

          <div className="sidebar-foot">
            <div className="status-pill">
              <div className={`sdot ${serverOk === true ? "on" : "off"}`} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: serverOk === true ? "#22c55e" : serverOk === false ? "#f43f5e" : "#64748b" }}>
                  {serverOk === null ? "Checking..." : serverOk ? "Server Online" : "Server Offline"}
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>localhost:3001</div>
              </div>
            </div>
            {recips.filter(r => r.active).length > 0 && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 10, fontSize: 11, color: "rgba(34,197,94,0.8)" }}>
                📱 {recips.filter(r => r.active).length} recipient{recips.filter(r => r.active).length > 1 ? "s" : ""} active
              </div>
            )}
          </div>
        </aside>

        {/* MAIN */}
        <div className="main">
          {/* top bar */}
          <div className="topbar">
            <div>
              <div className="topbar-title">{titles[tab].t}</div>
              <div className="topbar-sub">{titles[tab].s}</div>
            </div>
            {tab === "fetch" && step === "results" && (
              <div className="stat-chips">
                <div className="chip"><span className="red">{critical}</span> Critical</div>
                <div className="chip"><span className="orange">{high}</span> High</div>
                <div className="chip"><span className="green">{articles.length}</span> Total</div>
              </div>
            )}
          </div>

          {/* content */}
          <div className="content">

            {serverOk === false && (
              <div className="offline-banner">
                <WifiOff size={32} color="#f43f5e" style={{ marginBottom: 12 }} />
                <h2>Backend Offline</h2>
                <p>Start your server: <span className="mono">node server.js</span> in the project root</p>
              </div>
            )}

            {/* ── FETCH TAB ── */}
            {tab === "fetch" && (
              <>
                {step === "prefs" && (
                  <div className="gcard">
                    <div className="gcard-title">Select Topics</div>
                    <div className="gcard-sub">Choose one or more news categories to fetch</div>

                    {error && <div className="alert err"><AlertTriangle size={14} />{error}</div>}

                    <div className="catgrid">
                      {CATS.map(c => {
                        const sel = cats.includes(c.id);
                        return (
                          <button key={c.id} className={`catbtn${sel ? " sel" : ""}`}
                            style={sel ? { borderColor: c.color, background: `rgba(${c.rgb},0.12)`, color: "#fff" } : {}}
                            onClick={() => toggleCat(c.id)}>
                            <span className="cat-icon">{c.icon}</span>{c.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="igroup">
                      <span className="label">Number of articles</span>
                      <div className="count-row">
                        {[3, 5, 7, 10, 15].map(n => (
                          <button key={n} className={`cnt${count === n ? " a" : ""}`} onClick={() => setCount(n)}>{n}</button>
                        ))}
                      </div>
                    </div>

                    <div className="igroup">
                      <span className="label">Send directly to (optional)</span>
                      <input className="ifield" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} />
                    </div>

                    <div className="hr" />
                    <button className="btn btn-primary" disabled={!cats.length || serverOk === false} onClick={doFetch}>
                      <Rss size={16} /> {serverOk === false ? "Server Offline — Cannot Fetch" : "Fetch & Analyze News"}
                    </button>
                    {!cats.length && <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", marginTop: 10 }}>Select at least one topic above</p>}
                  </div>
                )}

                {step === "loading" && (
                  <div className="gcard">
                    <div className="spin-wrap">
                      <div className="spinner" />
                      <div className="spin-title">Fetching from 4 sources…</div>
                      <div className="spin-sub">Deduplicating → NVIDIA NIM analysis → severity tagging</div>
                    </div>
                  </div>
                )}

                {step === "results" && (
                  <>
                    {/* source chips + stats */}
                    <div className="gcard" style={{ marginBottom: 16, padding: "18px 22px" }}>
                      <div className="src-chips">
                        {sources.map(s => (
                          <span key={s} className={`src-chip${s === "hackernews" ? " hn" : ""}`}>
                            {s === "hackernews" ? "🔶 Hacker News" : s}
                          </span>
                        ))}
                        <span className="src-chip ai">🧠 NVIDIA NIM</span>
                      </div>
                      <div className="stats-row">
                        <div className="stat-box"><div className="stat-val" style={{ color: "#fff" }}>{articles.length}</div><div className="stat-lbl">Articles</div></div>
                        <div className="stat-box"><div className="stat-val" style={{ color: "#f43f5e" }}>{critical}</div><div className="stat-lbl">Critical</div></div>
                        <div className="stat-box"><div className="stat-val" style={{ color: "#fb923c" }}>{high}</div><div className="stat-lbl">High</div></div>
                        <div className="stat-box"><div className="stat-val" style={{ color: "#fb923c" }}>{articles.filter(a => a.origin === "hackernews").length}</div><div className="stat-lbl">From HN</div></div>
                        <div className="stat-box"><div className="stat-val" style={{ color: "var(--green)" }}>{sources.length}</div><div className="stat-lbl">Sources</div></div>
                      </div>
                    </div>

                    {/* articles */}
                    <div className="gcard">
                      <div className="gcard-title">AI-Analyzed Articles</div>
                      <div className="gcard-sub">{catLabels.join(" · ")}</div>
                      <div className="nlist">
                        {articles.map((a, i) => {
                          const s = SEV[a.severity] || SEV.info;
                          return (
                            <div key={i} className="ncard" style={{ borderColor: s.border, background: s.bg, animationDelay: `${i * 45}ms` }}>
                              <div className="ncard-top">
                                <span className="sev" style={{
                                  background: `rgba(${a.severity === "critical" ? "244,63,94" : a.severity === "high" ? "251,146,60" :
                                    a.severity === "medium" ? "251,191,36" : a.severity === "low" ? "74,222,128" : "100,116,139"},0.18)`, color: s.color
                                }}>
                                  {s.dot} {s.label}
                                </span>
                                <span style={{ fontSize: 12, color: "var(--muted)" }}>{a.category}</span>
                                <span className="src">{a.origin || a.source}</span>
                              </div>
                              <div className="nhead">{a.headline}</div>
                              <div className="nsub">{a.summary}</div>
                              {a.tags?.length > 0 && <div className="tags">{a.tags.map((t, ti) => <span key={ti} className="tag">{t}</span>)}</div>}
                              {a.origin === "hackernews" && <div className="hn-meta"><span>▲ {a.score} pts</span><span>💬 {a.comments}</span><span>👤 {a.author}</span></div>}
                              {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="read">{a.origin === "hackernews" ? "🔶 Hacker News" : "Read article"}<ExternalLink size={11} /></a>}
                            </div>
                          );
                        })}
                      </div>

                      <div className="hr" />
                      <button onClick={() => setShowPrev(!showPrev)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
                        {showPrev ? <EyeOff size={13} /> : <Eye size={13} />} {showPrev ? "Hide" : "Preview"} WhatsApp message
                      </button>
                      {showPrev && <div className="preview">{waMsg}</div>}

                      <div className="hr" />
                      <div className="flex-row">
                        <button className="btn btn-accent" style={{ flex: 1 }} onClick={() => {
                          const enc = encodeURIComponent(waMsg);
                          const n = phone.replace(/[\s+]/g, "");
                          window.open(n ? `https://wa.me/${n}?text=${enc}` : `https://wa.me/?text=${enc}`, "_blank");
                        }}>
                          <MessageCircle size={15} /> Open in WhatsApp
                        </button>
                        <button className="btn btn-secondary" onClick={() => { setStep("prefs"); setArts([]); }}>
                          <RefreshCw size={14} /> New Fetch
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── SCHEDULE TAB ── */}
            {tab === "schedule" && (
              <div className="gcard">
                <div className="gcard-title">Auto-Scheduler</div>
                <div className="gcard-sub">Automatically fetch and send digests on a cron schedule</div>

                <div className="igroup">
                  <span className="label">Topics</span>
                  <div className="catgrid">
                    {CATS.map(c => {
                      const sel = cats.includes(c.id);
                      return (
                        <button key={c.id} className={`catbtn${sel ? " sel" : ""}`}
                          style={sel ? { borderColor: c.color, background: `rgba(${c.rgb},0.12)`, color: "#fff" } : {}}
                          onClick={() => toggleCat(c.id)}>
                          <span className="cat-icon">{c.icon}</span>{c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="igroup">
                  <span className="label">Interval</span>
                  <div className="cron-grid">
                    {CRONS.map(p => (
                      <button key={p.expr} className={`cron-btn${cron === p.expr ? " sel" : ""}`} onClick={() => setCron(p.expr)}>
                        {p.label}<span className="cron-expr">{p.expr}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="igroup">
                  <span className="label">Custom Interval</span>
                  <div className="flex-row" style={{ gap: 8, marginBottom: 8 }}>
                    <input
                      type="number" min="1" max="999"
                      className="ifield" placeholder="e.g. 45"
                      style={{ width: 90, fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}
                      onChange={e => {
                        const n = parseInt(e.target.value);
                        if (!n || n < 1) return;
                        const unit = document.getElementById("cron-unit").value;
                        setCron(unit === "min"
                          ? (n === 1 ? "* * * * *" : `*/${n} * * * *`)
                          : (n === 1 ? "0 * * * *" : `0 */${n} * * *`));
                      }}
                    />
                    <select id="cron-unit" className="ifield" style={{ flex: 1 }}
                      onChange={e => {
                        const raw = document.querySelector("input[type=number]");
                        const n = parseInt(raw?.value);
                        if (!n || n < 1) return;
                        setCron(e.target.value === "min"
                          ? (n === 1 ? "* * * * *" : `*/${n} * * * *`)
                          : (n === 1 ? "0 * * * *" : `0 */${n} * * *`));
                      }}>
                      <option value="min">Minutes</option>
                      <option value="hr">Hours</option>
                    </select>
                  </div>
                  {cron && (
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--accent)", background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 7, padding: "6px 10px" }}>
                      cron: <strong>{cron}</strong>
                    </div>
                  )}
                </div>

                <div className="toggle-row">
                  <div className="toggle-info">
                    <div className="toggle-label">📱 Auto-send to WhatsApp</div>
                    <div className="toggle-desc">
                      {recips.filter(r => r.active).length > 0
                        ? `Sends to ${recips.filter(r => r.active).length} active recipient(s)`
                        : "Add recipients in the Recipients tab first"}
                    </div>
                  </div>
                  <button className={`toggle${autoSend ? " on" : ""}`} onClick={() => setAutoSend(!autoSend)} />
                </div>

                <div className="hr" />
                <div className="flex-row">
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={!cron || !cats.length || schedOn} onClick={startSched}>
                    <Play size={14} /> Start Scheduler
                  </button>
                  {schedOn && <button className="btn btn-danger" onClick={stopSched}><Square size={14} /> Stop</button>}
                </div>

                {schedMsg && (
                  <div className={`sched-running${schedOn ? "" : " alert warn"}`} style={!schedOn ? { marginTop: 14 } : {}}>
                    {schedOn ? (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span><Activity size={14} style={{ display: "inline", marginRight: 6, color: "var(--green)" }} />
                            Scheduler running — <strong style={{ fontFamily: "'JetBrains Mono',monospace" }}>{cron}</strong>
                          </span>
                          {countdown && (
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "var(--accent)", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                              ⏱ {countdown}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Next run in</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Topics: {catLabels.join(", ")}</div>
                      </>
                    ) : schedMsg}
                  </div>
                )}

                <div className="hr" />
                <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                  Scheduler state is <strong style={{ color: "#fff" }}>in-memory</strong> — it resets when server restarts. Use <span className="mono">pm2</span> to keep it alive.
                </p>
              </div>
            )}

            {/* ── RECIPIENTS TAB ── */}
            {tab === "recipients" && (
              <>
                <div className="alert warn" style={{ marginBottom: 20 }}>
                  <AlertTriangle size={14} />
                  <span><strong style={{ color: "#fb923c" }}>Twilio Sandbox:</strong> Each recipient must send <span className="mono">join &lt;word&gt;</span> to WhatsApp <strong>+1 415 523 8886</strong> once. Find your sandbox word at <strong>console.twilio.com → Messaging → Try WhatsApp</strong></span>
                </div>

                <div className="gcard">
                  <div className="gcard-title">Add Recipient</div>
                  <div className="gcard-sub">Include country code (e.g. +91 98765 43210)</div>
                  <div className="flex-row" style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <div style={{ flex: "2 1 160px" }}>
                      <span className="label">Phone</span>
                      <input className="ifield" placeholder="+91 98765 43210" value={nPhone} onChange={e => setNPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && addRecip()} />
                    </div>
                    <div style={{ flex: "1 1 120px" }}>
                      <span className="label">Name</span>
                      <input className="ifield" placeholder="My Phone" value={nName} onChange={e => setNName(e.target.value)} onKeyDown={e => e.key === "Enter" && addRecip()} />
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={addRecip} disabled={!nPhone.trim()}>
                    <Plus size={15} /> Add Recipient
                  </button>
                  {rMsg && <div className={`alert ${rMsg.startsWith("✅") ? "ok" : "err"}`} style={{ marginTop: 12 }}>
                    {rMsg.startsWith("✅") ? <CheckCircle size={14} /> : <XCircle size={14} />}{rMsg.replace(/^[✅❌]\s/, "")}
                  </div>}
                </div>

                <div className="gcard">
                  <div className="gcard-title">Recipients ({recips.length})</div>
                  <div className="gcard-sub">{recips.filter(r => r.active).length} active · {recips.filter(r => !r.active).length} paused</div>

                  {recips.length === 0 ? <div className="empty">No recipients yet. Add one above.</div> : (
                    recips.map((r, i) => (
                      <div key={i} className={`rcard${r.active ? " active-r" : ""}`}>
                        <div className="avatar" style={{ background: r.active ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)" }}>{r.active ? "📱" : "😴"}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="rname">{r.name}</div>
                          <div className="rphone">{r.phone}</div>
                          {r.lastSent && <div className="rlast">Last sent {new Date(r.lastSent).toLocaleString()} · {r.sentCount || 0} total</div>}
                        </div>
                        <div className="raction">
                          <button className="btn btn-secondary btn-sm" onClick={() => toggleRecip(r.phone)}>
                            {r.active ? "Pause" : "Resume"}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => removeRecip(r.phone)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {recips.length > 0 && <button className="btn btn-secondary" style={{ width: "100%", marginTop: 8 }} onClick={loadRecips}><RefreshCw size={13} /> Refresh</button>}
                </div>

                <div className="gcard">
                  <div className="gcard-title">Test Ping</div>
                  <div className="gcard-sub">Send a test message to verify Twilio is working</div>
                  <div className="flex-row">
                    <input className="ifield" style={{ flex: 1 }} placeholder="+91 98765 43210" value={tPhone} onChange={e => setTPhone(e.target.value)} />
                    <button className="btn btn-accent" onClick={testPing} disabled={!tPhone.trim() || testing}>
                      <Send size={14} /> {testing ? "Sending…" : "Send Ping"}
                    </button>
                  </div>
                  {tMsg && <div className={`alert ${tMsg.startsWith("✅") ? "ok" : "err"}`} style={{ marginTop: 12 }}>
                    {tMsg.startsWith("✅") ? <CheckCircle size={14} /> : <XCircle size={14} />}{tMsg.replace(/^[✅❌]\s/, "")}
                  </div>}
                </div>
              </>
            )}

            {/* ── HISTORY TAB ── */}
            {tab === "history" && (
              <div className="gcard">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div>
                    <div className="gcard-title">Digest History</div>
                    <div className="gcard-sub">{history.length} stored digests</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={loadHist}><RefreshCw size={13} /> Refresh</button>
                </div>

                {history.length === 0 ? <div className="empty">No digests yet. Fetch some news first!</div> : (
                  history.map(d => (
                    <div key={d.id} className="hcard">
                      <div className="hcard-top">
                        <div>
                          <span style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>{d.count} articles</span>
                          {d.articles?.filter(a => a.severity === "critical").length > 0 && (
                            <span style={{ marginLeft: 8, fontSize: 12, color: "var(--red)" }}>🔴 {d.articles.filter(a => a.severity === "critical").length} critical</span>
                          )}
                          {d.sent && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--green)" }}>✅ sent</span>}
                        </div>
                        <span className="htime">{new Date(d.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="hbadges">
                        {d.categories?.map((c, i) => <span key={i} className="hbadge">{c}</span>)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
