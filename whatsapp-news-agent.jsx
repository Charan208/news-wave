import { useState, useEffect, useCallback } from "react";

// ─── Config ──────────────────────────────────────────────────────
const SERVER = "http://localhost:3001";

const CATEGORIES = [
  { id: "technology",        label: "💻 Technology",        color: "#00d4ff", rgb: "0,212,255" },
  { id: "cybersecurity",     label: "🛡️ Cybersecurity",     color: "#ff0055", rgb: "255,0,85" },
  { id: "hacking",           label: "💀 Hacking & Exploits", color: "#ff4444", rgb: "255,68,68" },
  { id: "science",           label: "🔬 Science",            color: "#1abc9c", rgb: "26,188,156" },
  { id: "business",          label: "📈 Business",           color: "#2ecc71", rgb: "46,204,113" },
  { id: "politics",          label: "🏛️ Politics",           color: "#9b59b6", rgb: "155,89,182" },
  { id: "health",            label: "🏥 Health",             color: "#e74c3c", rgb: "231,76,60" },
  { id: "sports",            label: "⚽ Sports",             color: "#ff6b35", rgb: "255,107,53" },
  { id: "entertainment",     label: "🎬 Entertainment",      color: "#f39c12", rgb: "243,156,18" },
  { id: "world news",        label: "🌍 World News",         color: "#3498db", rgb: "52,152,219" },
];

const SEV = {
  critical: { color: "#ff0044", bg: "rgba(255,0,68,0.12)", label: "🔴 CRITICAL", border: "#ff0044" },
  high:     { color: "#ff6600", bg: "rgba(255,102,0,0.10)", label: "🟠 HIGH",     border: "#ff6600" },
  medium:   { color: "#ffcc00", bg: "rgba(255,204,0,0.10)", label: "🟡 MEDIUM",   border: "#ffcc00" },
  low:      { color: "#25d366", bg: "rgba(37,211,102,0.08)", label: "🟢 LOW",     border: "#25d366" },
  info:     { color: "#6c757d", bg: "rgba(108,117,125,0.08)", label: "ℹ️ INFO",   border: "#6c757d" },
};

const CRON_PRESETS = [
  { label: "Every 1 hour",   expr: "0 * * * *" },
  { label: "Every 6 hours",  expr: "0 */6 * * *" },
  { label: "Every 12 hours", expr: "0 */12 * * *" },
  { label: "Daily 8 AM",     expr: "0 8 * * *" },
  { label: "Daily 9 PM",     expr: "0 21 * * *" },
];

const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

// ─── Styles ──────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&family=DM+Sans:wght@300;400;500;600&display=swap');

  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}

  :root {
    --green: #25d366; --red: #ff0055; --bg: #080c0a;
    --surface: rgba(255,255,255,0.03); --border: rgba(255,255,255,0.07);
    --text: #e8f0ec; --muted: rgba(255,255,255,0.38);
  }

  body { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text); }

  .app {
    min-height: 100vh;
    background: radial-gradient(ellipse 80% 50% at 10% 0%, #0d2318 0%, var(--bg) 60%),
                radial-gradient(ellipse 60% 40% at 90% 100%, #0d1a2e 0%, transparent 60%);
    display: flex; flex-direction: column; align-items: center;
    padding: 32px 16px 80px;
    position: relative; overflow-x: hidden;
  }

  /* ── Scan line overlay ── */
  .app::after {
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px);
  }

  .z1 { position: relative; z-index: 1; }

  /* ── Header ── */
  .header { text-align: center; margin-bottom: 40px; }
  .pill {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(37,211,102,0.08); border: 1px solid rgba(37,211,102,0.2);
    padding: 6px 16px; border-radius: 100px; margin-bottom: 18px;
    font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--green); font-weight: 600;
  }
  .dot { width: 6px; height: 6px; background: var(--green); border-radius: 50%; animation: blink 1.4s infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }

  h1 { font-family:'Syne',sans-serif; font-size:clamp(2rem,5vw,3.2rem); font-weight:800; line-height:1.1; letter-spacing:-1px; }
  h1 span { background:linear-gradient(135deg,#25d366,#00d4ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .sub { color:var(--muted); font-size:15px; margin-top:10px; }

  /* ── Tabs ── */
  .tabs {
    display:flex; gap:4px; background:rgba(255,255,255,0.04); border:1px solid var(--border);
    border-radius:14px; padding:4px; margin-bottom:28px; width:100%; max-width:680px;
  }
  .tab {
    flex:1; padding:10px; border-radius:10px; border:none; background:transparent;
    font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; color:var(--muted);
    cursor:pointer; transition:all 0.2s; letter-spacing:0.3px;
  }
  .tab.active { background:rgba(37,211,102,0.12); color:var(--green); border:1px solid rgba(37,211,102,0.25); }

  /* ── Card ── */
  .card {
    background:var(--surface); border:1px solid var(--border);
    border-radius:20px; padding:30px; width:100%; max-width:680px;
    backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);
  }

  .slabel { font-size:11px; text-transform:uppercase; letter-spacing:2px; color:rgba(37,211,102,0.65); font-weight:700; margin-bottom:6px; }
  .stitle { font-family:'Syne',sans-serif; font-size:20px; font-weight:700; color:#fff; margin-bottom:22px; }

  /* ── Category grid ── */
  .catgrid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-bottom:22px; }
  @media(min-width:420px){.catgrid{grid-template-columns:repeat(3,1fr);}}
  @media(min-width:580px){.catgrid{grid-template-columns:repeat(4,1fr);}}

  .catbtn {
    background:rgba(255,255,255,0.03); border:1.5px solid var(--border);
    border-radius:12px; padding:13px 8px; cursor:pointer; text-align:center;
    font-family:'DM Sans',sans-serif; font-size:12px; color:var(--muted);
    transition:all 0.18s; font-weight:500; line-height:1.4;
  }
  .catbtn:hover { border-color:rgba(255,255,255,0.18); color:#fff; transform:translateY(-2px); }
  .catbtn.sel { color:#fff; }
  .catbtn.cyber-sel { animation:glitch 3s infinite; }
  @keyframes glitch {
    0%,91%,100%{text-shadow:none;}
    92%{text-shadow:-2px 0 #ff0055, 2px 0 #ff4444;}
    94%{text-shadow:2px 0 #ff0055;}
    96%{text-shadow:none;}
  }

  /* ── Input ── */
  .igroup { margin-bottom:18px; }
  .ilabel { display:block; font-size:12px; color:var(--muted); margin-bottom:7px; font-weight:500; }
  .ifield {
    width:100%; background:rgba(255,255,255,0.05); border:1.5px solid rgba(255,255,255,0.09);
    border-radius:11px; padding:13px 15px; font-family:'DM Sans',sans-serif; font-size:14px;
    color:#fff; outline:none; transition:border-color 0.2s;
  }
  .ifield:focus { border-color:rgba(37,211,102,0.45); }
  .ifield::placeholder { color:rgba(255,255,255,0.2); }

  .row { display:flex; gap:8px; }

  .count-btns { display:flex; gap:7px; }
  .cbtn {
    flex:1; padding:10px; border-radius:9px; border:1.5px solid rgba(255,255,255,0.08);
    background:rgba(255,255,255,0.03); color:var(--muted); cursor:pointer;
    font-family:'DM Sans',sans-serif; font-size:14px; font-weight:700; transition:all 0.15s;
  }
  .cbtn.active { background:rgba(37,211,102,0.13); border-color:rgba(37,211,102,0.45); color:var(--green); }

  /* ── Buttons ── */
  .btn-main {
    width:100%; padding:15px; background:linear-gradient(135deg,#25d366,#128c7e);
    border:none; border-radius:13px; font-family:'Syne',sans-serif; font-size:15px;
    font-weight:700; color:#fff; cursor:pointer; transition:all 0.2s;
    display:flex; align-items:center; justify-content:center; gap:10px;
  }
  .btn-main:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 12px 30px rgba(37,211,102,0.28); }
  .btn-main:disabled { opacity:0.35; cursor:not-allowed; }

  .btn-ghost {
    padding:11px 18px; background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.1); border-radius:11px;
    font-family:'DM Sans',sans-serif; font-size:13px; color:var(--muted);
    cursor:pointer; transition:all 0.2s; font-weight:500;
  }
  .btn-ghost:hover { background:rgba(255,255,255,0.09); color:#fff; }

  .btn-wa {
    display:flex; align-items:center; gap:8px;
    padding:12px 20px; background:rgba(37,211,102,0.1);
    border:1.5px solid rgba(37,211,102,0.28); border-radius:11px;
    font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600;
    color:var(--green); cursor:pointer; transition:all 0.2s; text-decoration:none; flex:1;
    justify-content:center;
  }
  .btn-wa:hover { background:rgba(37,211,102,0.18); transform:translateY(-1px); }

  /* ── Divider ── */
  .div { height:1px; background:var(--border); margin:22px 0; }

  /* ── News cards ── */
  .news-list { display:flex; flex-direction:column; gap:12px; margin-bottom:22px; }

  .ncard {
    border-radius:14px; padding:18px; border:1px solid;
    animation:fadeUp 0.35s ease both;
  }
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }

  .nmeta { display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap; }
  .sev-badge {
    font-size:10px; font-weight:700; padding:3px 10px; border-radius:100px;
    letter-spacing:0.5px; text-transform:uppercase; font-family:'JetBrains Mono',monospace;
  }
  .cat-tag { font-size:11px; color:var(--muted); font-weight:500; }
  .source-tag {
    margin-left:auto; font-size:10px; color:var(--muted); font-family:'JetBrains Mono',monospace;
    background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:6px;
  }

  .nhead { font-family:'Syne',sans-serif; font-size:15px; font-weight:700; color:#fff; margin-bottom:8px; line-height:1.4; }
  .nsummary { font-size:13px; color:rgba(255,255,255,0.55); line-height:1.65; margin-bottom:10px; }

  .tag-row { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
  .tag {
    font-size:10px; padding:2px 9px; border-radius:6px; font-family:'JetBrains Mono',monospace;
    font-weight:600; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.45);
    border:1px solid rgba(255,255,255,0.08);
  }
  .tag.cyber { background:rgba(255,0,85,0.1); color:#ff6688; border-color:rgba(255,0,85,0.2); }

  .read-link { font-size:12px; color:rgba(37,211,102,0.7); text-decoration:none; font-weight:500; }
  .read-link:hover { color:var(--green); }

  /* ── Loader ── */
  .loader { text-align:center; padding:56px 0; }
  .spinner {
    width:52px; height:52px; margin:0 auto 22px;
    border:3px solid rgba(37,211,102,0.12); border-top-color:var(--green);
    border-radius:50%; animation:spin 0.85s linear infinite;
  }
  @keyframes spin{to{transform:rotate(360deg)}}
  .ltitle { font-family:'Syne',sans-serif; font-size:18px; font-weight:700; color:#fff; margin-bottom:6px; }
  .lsub { color:var(--muted); font-size:13px; }

  /* ── Sources row ── */
  .sources-row { display:flex; gap:8px; margin-bottom:22px; flex-wrap:wrap; }
  .src-chip {
    font-size:11px; padding:4px 12px; border-radius:8px; font-weight:600;
    font-family:'JetBrains Mono',monospace;
    background:rgba(37,211,102,0.08); border:1px solid rgba(37,211,102,0.2); color:var(--green);
  }

  /* ── Stats bar ── */
  .stats { display:flex; gap:12px; margin-bottom:22px; flex-wrap:wrap; }
  .stat {
    flex:1; min-width:100px; background:rgba(255,255,255,0.03);
    border:1px solid var(--border); border-radius:12px; padding:14px;
    text-align:center;
  }
  .stat-val { font-family:'JetBrains Mono',monospace; font-size:22px; font-weight:700; }
  .stat-lbl { font-size:11px; color:var(--muted); margin-top:3px; }

  /* ── Preview ── */
  .preview {
    background:rgba(0,0,0,0.35); border-radius:12px; padding:16px;
    font-size:12px; color:rgba(255,255,255,0.5); font-family:'JetBrains Mono',monospace;
    white-space:pre-wrap; line-height:1.6; border:1px solid rgba(255,255,255,0.06);
    max-height:220px; overflow-y:auto; margin-top:14px;
  }

  /* ── Scheduler ── */
  .sched-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:18px; }
  @media(max-width:400px){.sched-grid{grid-template-columns:1fr;}}
  .sched-btn {
    padding:12px; border-radius:11px; border:1.5px solid var(--border);
    background:rgba(255,255,255,0.03); color:var(--muted); cursor:pointer;
    font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; transition:all 0.15s;
    text-align:left;
  }
  .sched-btn:hover { border-color:rgba(255,255,255,0.2); color:#fff; }
  .sched-btn.sel { border-color:rgba(37,211,102,0.45); background:rgba(37,211,102,0.08); color:var(--green); }
  .mono { font-family:'JetBrains Mono',monospace; font-size:11px; display:block; color:var(--muted); margin-top:2px; }

  /* ── History ── */
  .hitem {
    background:rgba(255,255,255,0.03); border:1px solid var(--border);
    border-radius:12px; padding:16px; margin-bottom:10px;
  }
  .hitem-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px; }
  .hitem-time { font-size:12px; color:var(--muted); font-family:'JetBrains Mono',monospace; }
  .hitem-cats { display:flex; gap:5px; flex-wrap:wrap; }
  .hcat { font-size:10px; padding:2px 9px; border-radius:6px; background:rgba(255,255,255,0.06); color:var(--muted); }

  /* ── Error ── */
  .err { background:rgba(231,76,60,0.1); border:1px solid rgba(231,76,60,0.25); border-radius:11px; padding:13px 16px; color:#e74c3c; font-size:13px; margin-bottom:16px; }

  /* ── Status indicator ── */
  .online { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--green); }
  .offline { color:#e74c3c; }

  /* ── Sched status ── */
  .sched-status {
    background:rgba(37,211,102,0.07); border:1px solid rgba(37,211,102,0.2);
    border-radius:11px; padding:14px; font-size:13px; color:rgba(255,255,255,0.7);
    margin-top:16px;
  }
  .sched-status strong { color:var(--green); font-family:'JetBrains Mono',monospace; }
`;

// ─── WhatsApp message builder ─────────────────────────────────────
function buildWAMessage(articles, categories) {
  const date = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });
  let msg = `📰 *AI News Digest — ${date}*\n`;
  msg += `🔖 ${categories.join(" · ")}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  articles.forEach((a, i) => {
    const sevEmoji = { critical:"🔴", high:"🟠", medium:"🟡", low:"🟢", info:"ℹ️" }[a.severity] || "📌";
    msg += `${sevEmoji} *${i + 1}. ${a.headline}*\n`;
    msg += `${a.summary}\n`;
    if (a.tags?.length) msg += `🏷️ ${a.tags.join(" · ")}\n`;
    if (a.origin === "hackernews" && a.score) msg += `🔶 HN: ▲${a.score} pts · 💬${a.comments} comments\n`;
    if (a.url) msg += `🔗 ${a.url}\n`;
    msg += `\n`;
  });
  msg += `━━━━━━━━━━━━━━━━━━━━\n_AI News Agent v2 · Powered by NVIDIA NIM + 3 sources_ 🤖`;
  return msg;
}

// ─── App ─────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]               = useState("fetch");   // fetch | schedule | history
  const [step, setStep]             = useState("prefs");   // prefs | loading | results
  const [selectedCats, setCats]     = useState([]);
  const [newsCount, setCount]       = useState(5);
  const [phone, setPhone]           = useState("");
  const [articles, setArticles]     = useState([]);
  const [sources, setSources]       = useState([]);
  const [error, setError]           = useState("");
  const [waMsg, setWaMsg]           = useState("");
  const [showPreview, setShowPrev]  = useState(false);
  const [fetchedAt, setFetchedAt]   = useState(null);

  // Scheduler state
  const [schedCron, setSchedCron]   = useState("");
  const [schedActive, setSchedAct]  = useState(false);
  const [schedMsg, setSchedMsg]     = useState("");
  const [autoSend, setAutoSend]     = useState(true);

  // Recipients
  const [recipients, setRecipients] = useState([]);
  const [newPhone, setNewPhone]     = useState("");
  const [newName, setNewName]       = useState("");
  const [recipMsg, setRecipMsg]     = useState("");
  const [testPhone, setTestPhone]   = useState("");
  const [testMsg, setTestMsg]       = useState("");
  const [testing, setTesting]       = useState(false);

  // History
  const [history, setHistory]       = useState([]);

  // Server status
  const [serverOk, setServerOk]     = useState(null);

  // Check server on mount
  useEffect(() => {
    fetch(`${SERVER}/`)
      .then(r => r.json())
      .then(d => { setServerOk(true); setSources(d.sources || []); })
      .catch(() => setServerOk(false));
  }, []);

  const toggleCat = (id) =>
    setCats(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id]);

  const catLabels = selectedCats.map(id => CATEGORIES.find(c => c.id === id)?.label.replace(/[^ -~]+/g,"").trim() || id);

  // ── Fetch news ────────────────────────────────────────────────
  const fetchNews = async () => {
    if (!selectedCats.length) return;
    setStep("loading"); setError(""); setArticles([]);

    try {
      const res  = await fetch(`${SERVER}/api/news`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: catLabels, count: newsCount, autoSend: autoSend && recipients.filter(r=>r.active).length > 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");

      setArticles(data.articles);
      setSources(data.sources || []);
      setFetchedAt(data.fetchedAt);
      setWaMsg(buildWAMessage(data.articles, catLabels));
      setStep("results");
    } catch (e) {
      setError(e.message || "Could not connect to server. Is it running?");
      setStep("prefs");
    }
  };

  // ── Load history ──────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      const res  = await fetch(`${SERVER}/api/history`);
      const data = await res.json();
      setHistory(data.digests || []);
    } catch { setHistory([]); }
  }, []);

  const loadRecipients = useCallback(async () => {
    try {
      const res  = await fetch(`${SERVER}/api/recipients`);
      const data = await res.json();
      setRecipients(data.recipients || []);
    } catch { setRecipients([]); }
  }, []);

  useEffect(() => { if (tab === "history")    loadHistory(); },    [tab, loadHistory]);
  useEffect(() => { if (tab === "recipients") loadRecipients(); }, [tab, loadRecipients]);

  // ── Schedule ──────────────────────────────────────────────────
  const submitSchedule = async () => {
    if (!schedCron || !selectedCats.length) return;
    try {
      const res  = await fetch(`${SERVER}/api/schedule`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cronExpr: schedCron, categories: catLabels, count: newsCount, enabled: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSchedAct(true); setSchedMsg(data.message);
    } catch (e) { setSchedMsg(`Error: ${e.message}`); }
  };

  const stopSchedule = async () => {
    await fetch(`${SERVER}/api/schedule`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    setSchedAct(false); setSchedMsg("Scheduler stopped.");
  };

  const openWA = () => {
    const enc  = encodeURIComponent(waMsg);
    const url  = phone && PHONE_REGEX.test(phone.replace(/\s/g,""))
      ? `https://wa.me/${phone.replace(/[\s+]/g,"")}?text=${enc}`
      : `https://wa.me/?text=${enc}`;
    window.open(url, "_blank");
  };

  const critical = articles.filter(a => a.severity === "critical").length;
  const high     = articles.filter(a => a.severity === "high").length;

  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* Header */}
        <div className="header z1">
          <div className="pill"><div className="dot" />AI News Agent v2</div>
          <h1>Real News → <span>WhatsApp</span></h1>
          <p className="sub">
            3 live sources · NVIDIA NIM analysis · auto-severity tagging
            {serverOk === true && <span className="online" style={{ marginLeft:12 }}>● server online</span>}
            {serverOk === false && <span style={{ marginLeft:12, fontSize:12, color:"#e74c3c" }}>● server offline — start server.js</span>}
          </p>
        </div>

        {/* Tabs */}
        <div className="tabs z1">
          {[["fetch","📡 Fetch"],["schedule","⏰ Schedule"],["recipients","📱 Recipients"],["history","📂 History"]].map(([id, lbl]) => (
            <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{lbl}</button>
          ))}
        </div>

        {/* ── FETCH TAB ── */}
        {tab === "fetch" && (
          <div className="card z1">

            {step === "prefs" && <>
              <div className="slabel">Step 1</div>
              <div className="stitle">Choose your news topics</div>

              {error && <div className="err">⚠️ {error}</div>}

              <div className="catgrid">
                {CATEGORIES.map(cat => {
                  const sel = selectedCats.includes(cat.id);
                  const isCyber = cat.id === "cybersecurity" || cat.id === "hacking";
                  return (
                    <button key={cat.id}
                      className={`catbtn ${sel ? "sel" : ""} ${sel && isCyber ? "cyber-sel" : ""}`}
                      style={sel ? { borderColor: cat.color, background:`rgba(${cat.rgb},0.1)`, boxShadow:`0 0 18px rgba(${cat.rgb},0.15)` } : {}}
                      onClick={() => toggleCat(cat.id)}
                    >{cat.label}</button>
                  );
                })}
              </div>

              <div className="igroup">
                <span className="ilabel">Number of articles</span>
                <div className="count-btns">
                  {[3,5,7,10,15].map(n => (
                    <button key={n} className={`cbtn ${newsCount===n?"active":""}`} onClick={() => setCount(n)}>{n}</button>
                  ))}
                </div>
              </div>

              <div className="igroup">
                <span className="ilabel">WhatsApp number (optional)</span>
                <input className="ifield" placeholder="+1 234 567 8900" value={phone} onChange={e=>setPhone(e.target.value)} />
              </div>

              <div className="div" />
              <button className="btn-main" disabled={!selectedCats.length || serverOk === false} onClick={fetchNews}>
                {serverOk === false ? "⚠️ Server Offline" : "🚀 Fetch & Analyze News"}
              </button>
              {!selectedCats.length && <p style={{textAlign:"center",fontSize:12,color:"var(--muted)",marginTop:10}}>Select at least one topic</p>}
            </>}

            {step === "loading" && (
              <div className="loader">
                <div className="spinner" />
                <div className="ltitle">Querying 3 news sources…</div>
                <div className="lsub">Deduplicating → NVIDIA NIM analysis → severity tagging</div>
              </div>
            )}

            {step === "results" && <>
              <div className="slabel">Results</div>
              <div className="stitle">Your AI-Analyzed Digest</div>

              {/* Sources */}
              <div className="sources-row">
                {sources.map(s => (
                  <span key={s} className="src-chip"
                    style={s === "hackernews" ? {background:"rgba(255,102,0,0.1)",borderColor:"rgba(255,102,0,0.3)",color:"#ff6600"} : {}}>
                    {s === "hackernews" ? "🔶 hacker news" : s}
                  </span>
                ))}
                {KEYS.nvidia !== false && <span className="src-chip" style={{background:"rgba(0,212,255,0.08)",borderColor:"rgba(0,212,255,0.2)",color:"#00d4ff"}}>🧠 nvidia nim</span>}
              </div>

              {/* Stats */}
              <div className="stats">
                <div className="stat">
                  <div className="stat-val" style={{color:"#fff"}}>{articles.length}</div>
                  <div className="stat-lbl">Total</div>
                </div>
                <div className="stat">
                  <div className="stat-val" style={{color:"#ff0044"}}>{critical}</div>
                  <div className="stat-lbl">Critical</div>
                </div>
                <div className="stat">
                  <div className="stat-val" style={{color:"#ff6600"}}>{high}</div>
                  <div className="stat-lbl">High</div>
                </div>
                <div className="stat">
                  <div className="stat-val" style={{color:"#ff6600"}}>
                    {articles.filter(a => a.origin === "hackernews").length}
                  </div>
                  <div className="stat-lbl">From HN</div>
                </div>
                <div className="stat">
                  <div className="stat-val" style={{color:"var(--green)"}}>{sources.length}</div>
                  <div className="stat-lbl">Sources</div>
                </div>
              </div>

              {/* Articles */}
              <div className="news-list">
                {articles.map((a, i) => {
                  const sev = SEV[a.severity] || SEV.info;
                  const isCyber = ["critical","high"].includes(a.severity);
                  return (
                    <div key={i} className="ncard"
                      style={{ borderColor: sev.border, background: sev.bg, animationDelay:`${i*55}ms` }}>
                      <div className="nmeta">
                        <span className="sev-badge" style={{background:`rgba(${a.severity==="critical"?"255,0,68":a.severity==="high"?"255,102,0":a.severity==="medium"?"255,204,0":a.severity==="low"?"37,211,102":"108,117,125"},0.18)`,color:sev.color}}>
                          {SEV[a.severity]?.label || "INFO"}
                        </span>
                        <span className="cat-tag">{a.category}</span>
                        <span className="source-tag">{a.origin || a.source}</span>
                      </div>
                      <div className="nhead">{a.headline}</div>
                      <div className="nsummary">{a.summary}</div>
                      {a.tags?.length > 0 && (
                        <div className="tag-row">
                          {a.tags.map((t,ti) => (
                            <span key={ti} className={`tag ${isCyber ? "cyber" : ""}`}>{t}</span>
                          ))}
                        </div>
                      )}
                      {/* HN-specific metadata */}
                      {a.origin === "hackernews" && (
                        <div style={{display:"flex",gap:12,marginBottom:8,fontSize:12,color:"rgba(255,102,0,0.8)",fontFamily:"'JetBrains Mono',monospace"}}>
                          <span>▲ {a.score} pts</span>
                          <span>💬 {a.comments} comments</span>
                          <span>👤 {a.author}</span>
                        </div>
                      )}
                      {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="read-link">
                        {a.origin === "hackernews" ? "🔶 View on HN →" : "Read full article →"}
                      </a>}
                    </div>
                  );
                })}
              </div>

              {/* Preview toggle */}
              <button onClick={()=>setShowPrev(!showPreview)}
                style={{background:"none",border:"none",color:"var(--muted)",fontSize:12,cursor:"pointer",marginBottom:12,padding:0}}>
                {showPreview ? "▲ Hide" : "▼ Preview"} WhatsApp message
              </button>
              {showPreview && <div className="preview">{waMsg}</div>}

              <div className="div" />

              <div className="row">
                <button className="btn-wa" onClick={openWA}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#25d366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Send to WhatsApp
                </button>
                <button className="btn-ghost" onClick={()=>{setStep("prefs");setArticles([]);}}>↺ New Fetch</button>
              </div>
            </>}
          </div>
        )}

        {/* ── SCHEDULE TAB ── */}
        {tab === "schedule" && (
          <div className="card z1">
            <div className="slabel">Auto-Messenger</div>
            <div className="stitle">Schedule News Delivery</div>

            <div className="igroup">
              <span className="ilabel">Select topics (uses same selection)</span>
              <div className="catgrid">
                {CATEGORIES.map(cat => {
                  const sel = selectedCats.includes(cat.id);
                  return (
                    <button key={cat.id}
                      className={`catbtn ${sel ? "sel" : ""}`}
                      style={sel ? { borderColor:cat.color, background:`rgba(${cat.rgb},0.1)` } : {}}
                      onClick={()=>toggleCat(cat.id)}
                    >{cat.label}</button>
                  );
                })}
              </div>
            </div>

            <div className="igroup">
              <span className="ilabel">Fetch interval</span>
              <div className="sched-grid">
                {CRON_PRESETS.map(p => (
                  <button key={p.expr} className={`sched-btn ${schedCron===p.expr?"sel":""}`}
                    onClick={()=>setSchedCron(p.expr)}>
                    {p.label}
                    <span className="mono">{p.expr}</span>
                  </button>
                ))}
              </div>
            </div>


            <div className="igroup">
              <span className="ilabel">Or enter custom cron expression</span>
              <input className="ifield" placeholder="e.g.  0 */3 * * *"
                value={schedCron} onChange={e=>setSchedCron(e.target.value)}
                style={{fontFamily:"'JetBrains Mono',monospace"}} />
            </div>

            {/* Auto-send toggle */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px",background:"rgba(37,211,102,0.06)",border:"1px solid rgba(37,211,102,0.15)",borderRadius:12,marginBottom:18}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,color:"#fff",fontSize:14}}>📱 Auto-send to WhatsApp</div>
                <div style={{fontSize:12,color:"var(--muted)",marginTop:3}}>
                  {recipients.filter(r=>r.active).length > 0
                    ? `Will send to ${recipients.filter(r=>r.active).length} active recipient(s) on each fetch`
                    : "Add recipients in the Recipients tab first"}
                </div>
              </div>
              <button onClick={()=>setAutoSend(!autoSend)}
                style={{width:44,height:24,borderRadius:100,border:"none",cursor:"pointer",
                  background:autoSend?"#25d366":"rgba(255,255,255,0.1)",transition:"all 0.2s",position:"relative",flexShrink:0}}>
                <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",
                  position:"absolute",top:3,transition:"all 0.2s",left:autoSend?23:3}}/>
              </button>
            </div>

            <div className="div" />
            <div className="row">
              <button className="btn-main" style={{flex:1}} disabled={!schedCron||!selectedCats.length||schedActive} onClick={submitSchedule}>
                ⏰ Start Scheduler
              </button>
              {schedActive && <button className="btn-ghost" onClick={stopSchedule}>■ Stop</button>}
            </div>

            {schedMsg && (
              <div className="sched-status">
                {schedActive?"✅":"ℹ️"} {schedMsg}<br/>
                {schedActive&&schedCron&&<><strong>{schedCron}</strong> · topics: {catLabels.join(", ")}</>}
              </div>
            )}

            <div className="div" />
            <p style={{fontSize:12,color:"var(--muted)",lineHeight:1.7}}>
              Scheduler runs on your <strong style={{color:"#fff"}}>server.js</strong> backend. Keep it running for auto-delivery.
            </p>
          </div>
        )}

        {/* ── RECIPIENTS TAB ── */}
        {tab === "recipients" && (
          <div className="card z1">
            <div className="slabel">WhatsApp Recipients</div>
            <div className="stitle">Manage Auto-Send List</div>

            <div style={{background:"rgba(255,102,0,0.08)",border:"1px solid rgba(255,102,0,0.2)",borderRadius:12,padding:"14px 16px",marginBottom:20,fontSize:13,color:"rgba(255,255,255,0.7)",lineHeight:1.7}}>
              <strong style={{color:"#ff6600"}}>📋 Twilio Sandbox (Testing)</strong><br/>
              Each recipient must send <code style={{background:"rgba(255,255,255,0.08)",padding:"1px 6px",borderRadius:4}}>"join &lt;sandbox-word&gt;"</code> to <strong style={{color:"#fff"}}>WhatsApp +1 415 523 8886</strong> once.<br/>
              Find your sandbox word at <strong style={{color:"#fff"}}>console.twilio.com → Messaging → Try WhatsApp</strong>
            </div>

            {/* Add form */}
            <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
              <div className="igroup" style={{flex:"2 1 160px",marginBottom:0}}>
                <span className="ilabel">Phone (with country code)</span>
                <input className="ifield" placeholder="+91 98765 43210" value={newPhone}
                  onChange={e=>setNewPhone(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addRecipient()} />
              </div>
              <div className="igroup" style={{flex:"1 1 120px",marginBottom:0}}>
                <span className="ilabel">Name (optional)</span>
                <input className="ifield" placeholder="My Phone" value={newName}
                  onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addRecipient()} />
              </div>
            </div>
            <button className="btn-main" style={{marginBottom:16}} onClick={addRecipient} disabled={!newPhone.trim()}>
              ➕ Add Recipient
            </button>

            {recipMsg && (
              <div style={{fontSize:13,color:recipMsg.startsWith("✅")?"#25d366":"#e74c3c",marginBottom:12,
                padding:"10px 14px",background:"rgba(255,255,255,0.04)",borderRadius:10}}>
                {recipMsg}
              </div>
            )}

            {recipients.length === 0 ? (
              <p style={{color:"var(--muted)",fontSize:14,textAlign:"center",padding:"32px 0"}}>
                No recipients yet. Add a number above.
              </p>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                {recipients.map((r,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",
                    background:r.active?"rgba(37,211,102,0.06)":"rgba(255,255,255,0.03)",
                    border:`1px solid ${r.active?"rgba(37,211,102,0.2)":"rgba(255,255,255,0.07)"}`,
                    borderRadius:12,transition:"all 0.2s"}}>
                    <div style={{width:36,height:36,borderRadius:"50%",flexShrink:0,
                      background:r.active?"rgba(37,211,102,0.15)":"rgba(255,255,255,0.07)",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
                      {r.active?"📱":"😴"}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,color:"#fff",fontSize:14}}>{r.name}</div>
                      <div style={{fontSize:12,color:"var(--muted)",fontFamily:"'JetBrains Mono',monospace"}}>{r.phone}</div>
                      {r.lastSent&&<div style={{fontSize:11,color:"rgba(37,211,102,0.6)",marginTop:2}}>
                        Last sent: {new Date(r.lastSent).toLocaleString()} · {r.sentCount||0} total
                      </div>}
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button onClick={()=>toggleRecipient(r.phone)}
                        style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",
                          background:"rgba(255,255,255,0.05)",color:r.active?"#ffcc00":"var(--green)",
                          fontSize:12,cursor:"pointer",fontWeight:600}}>
                        {r.active?"Pause":"Resume"}
                      </button>
                      <button onClick={()=>removeRecipient(r.phone)}
                        style={{padding:"6px 10px",borderRadius:8,border:"1px solid rgba(255,0,85,0.2)",
                          background:"rgba(255,0,85,0.08)",color:"#ff4466",fontSize:12,cursor:"pointer"}}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="div" />

            {/* Test ping */}
            <div className="slabel" style={{marginBottom:8}}>Send Test Ping</div>
            <div style={{display:"flex",gap:8}}>
              <input className="ifield" style={{flex:1}} placeholder="+91 98765 43210"
                value={testPhone} onChange={e=>setTestPhone(e.target.value)} />
              <button className="btn-main" style={{width:"auto",padding:"12px 18px",whiteSpace:"nowrap"}}
                onClick={sendTestPing} disabled={!testPhone.trim()||testing}>
                {testing?"Sending...":"📤 Test"}
              </button>
            </div>
            {testMsg&&(
              <div style={{fontSize:13,marginTop:10,padding:"10px 14px",borderRadius:10,
                background:"rgba(255,255,255,0.04)",
                color:testMsg.startsWith("✅")?"#25d366":"#e74c3c"}}>
                {testMsg}
              </div>
            )}

            <div className="div" />
            <button className="btn-ghost" style={{width:"100%"}} onClick={loadRecipients}>↺ Refresh</button>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div className="card z1">
            <div className="slabel">Past Digests</div>
            <div className="stitle">Fetch History ({history.length})</div>

            {history.length === 0 && (
              <p style={{color:"var(--muted)",fontSize:14}}>No digests yet. Fetch some news first!</p>
            )}

            {history.map(d => (
              <div key={d.id} className="hitem">
                <div className="hitem-head">
                  <div>
                    <span style={{fontWeight:700,color:"#fff",fontSize:14}}>{d.count} articles</span>
                    <span style={{marginLeft:8,fontSize:12}}>
                      {d.articles?.filter(a=>a.severity==="critical").length > 0 &&
                        <span style={{color:"#ff0044"}}>🔴 {d.articles.filter(a=>a.severity==="critical").length} critical</span>}
                    </span>
                    {d.sent&&<span style={{marginLeft:8,fontSize:12,color:"#25d366"}}>✅ sent</span>}
                  </div>
                  <span className="hitem-time">{new Date(d.timestamp).toLocaleString()}</span>
                </div>
                <div className="hitem-cats">
                  {d.categories?.map((c,i)=><span key={i} className="hcat">{c}</span>)}
                </div>
              </div>
            ))}

            {history.length > 0 && (
              <button className="btn-ghost" style={{marginTop:12,width:"100%"}} onClick={loadHistory}>↺ Refresh</button>
            )}
          </div>
        )}

      </div>
    </>
  );
}
