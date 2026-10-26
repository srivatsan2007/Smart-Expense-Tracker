import React, { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator"; // npm i qrcode-generator

/**
 * AtmSplitReceipt - handheld card machine (SBI Payments style).
 * The bill prints out of the TOP of the machine; pressing "Split the bill"
 * tears it along a zigzag line into two shares.
 * No extra dependencies. All styles are scoped under .atm-app.
 */

const W = 200, ROW = 88, FOOT = 108, TITLE_H = 96, ITEMS_PAD = 22, ITEM_H = 15, AMP = 4, PAD = 70;
const MIN_MEMBERS = 2, MAX_MEMBERS = 6, MIN_ITEMS = 1, MAX_ITEMS = 5;

// n = number of members (pieces), m = number of expense lines in the table
const headFor = (m) => TITLE_H + ITEMS_PAD + ITEM_H * m;
const heightFor = (n, m) => headFor(m) + ROW * n + FOOT;
const tearY = (k, m) => headFor(m) + ROW * k; // tear line between member k-1 and k

// Zigzag tear line; neighbouring pieces share the same points so they match
const zigAt = (y) => {
  const p = [];
  for (let x = 0; x <= W; x += 10) p.push([x, y + ((x / 10) % 2 ? AMP : -AMP)]);
  return p;
};
const pts = (a) => a.map(([x, y]) => `${x}px ${y}px`).join(",");

// Clip shape + motion targets for piece i
const pieceStyle = (i, n, m) => {
  const H = heightFor(n, m);
  const top = i === 0 ? [[0, 0], [W, 0]] : zigAt(tearY(i, m));
  const bot = i === n - 1 ? [[W, H], [0, H]] : zigAt(tearY(i + 1, m)).reverse();
  const y0 = i === 0 ? 0 : tearY(i, m);
  const y1 = i === n - 1 ? H : tearY(i + 1, m);
  const s = i % 2 === 0 ? -1 : 1;
  const lift = n - 1 - i;
  const step = 60 / (n - 1);
  return {
    clipPath: `polygon(${pts([...top, ...bot])})`,
    transformOrigin: `${W / 2}px ${(y0 + y1) / 2}px`,
    "--tear": `translate(${s * 8}px,${-lift * 5}px) rotate(${s * 3}deg)`,
    "--apart": `translate(${s * (52 + (i % 3) * 8)}px,${-lift * step - 8}px) rotate(${s * (8 + (i % 3) * 3)}deg)`,
  };
};

const TODAY = new Date()
  .toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  .toUpperCase();

const fmt = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const STATUS = {
  reset: "Starting…",
  idle: "Starting…",
  print: "Printing bill…",
  ready: "Bill ready. Tap Split",
  tear: "Splitting…",
  apart: "Split done",
};

const MENU = [
  ["↺", "Void"], ["▦", "QR"], ["✔", "Pre-Auth"],
  ["▤", "Settlement"], ["⚙", "Maintenance"], ["☎", "Call Help"],
  ["₹", "Adjust"], ["⇩", "DCC Download"],
];

const MONO = 'ui-monospace, Menlo, "Courier New", monospace';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- QR code -------------------------------------------------------------
if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"]; // names with any letters
}

function safeQR(text) {
  try {
    const q = qrcode(0, "L");
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    let path = "";
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) if (q.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return { n, path, isDark: (r, c) => q.isDark(r, c) };
  } catch (e) {
    return null;
  }
}

// What a scanner shows: the purpose, the total and each person's share
const qrPayload = ({ items, total, names }, shares) =>
  [
    "RupeeRise",
    "For: " + items.map((it) => `${it.label} ${it.amt}`).join(", "),
    `Total: Rs ${total}`,
    ...names.map((nm, i) => `${nm}: Rs ${shares[i]}`),
  ].join("\n");

function Qr({ qr }) {
  const pad = 2, size = qr.n + pad * 2;
  return (
    <svg className="atm-qr" viewBox={`${-pad} ${-pad} ${size} ${size}`} shapeRendering="crispEdges"
      role="img" aria-label="QR code with the bill details">
      <rect x={-pad} y={-pad} width={size} height={size} fill="#fff" />
      <path d={qr.path} fill="#111" />
    </svg>
  );
}

// Draws the whole bill (brand, spent-on table, total, shares, QR) as one PNG for sharing
function drawBill({ total, items, names, shares, qr }) {
  const S = 2, pw = 340, pad = 28, rowH = 54, QR = 120;
  const ph = 432 + 20 * items.length + 54 * names.length;
  const cw = pw + pad * 2, ch = ph + pad * 2;
  const c = document.createElement("canvas");
  c.width = cw * S;
  c.height = ch * S;
  const x = c.getContext("2d");
  x.scale(S, S);
  x.fillStyle = "#10172a";
  x.fillRect(0, 0, cw, ch);

  // paper with torn zigzag top and bottom edges
  const L = pad, B = pad + ph, T = pad;
  x.save();
  x.shadowColor = "rgba(0,0,0,.45)";
  x.shadowBlur = 18;
  x.shadowOffsetY = 6;
  x.fillStyle = "#fffdf6";
  x.beginPath();
  x.moveTo(L, T);
  for (let i = 0; i <= pw; i += 10) x.lineTo(L + i, T + ((i / 10) % 2 ? 5 : 0));
  for (let i = pw; i >= 0; i -= 10) x.lineTo(L + i, B - ((i / 10) % 2 ? 0 : 5));
  x.closePath();
  x.fill();
  x.restore();

  const cx = pad + pw / 2, xl = pad + 22, xr = pad + pw - 22;
  const txt = (str, X, Y, font, color, align = "center") => {
    x.font = font; x.fillStyle = color; x.textAlign = align; x.fillText(str, X, Y);
  };
  const dash = (Y) => {
    x.save(); x.setLineDash([5, 4]); x.strokeStyle = "#bbb"; x.lineWidth = 1;
    x.beginPath(); x.moveTo(xl, Y); x.lineTo(xr, Y); x.stroke(); x.restore();
  };

  let y = pad + 44;
  txt("★ SPLIT BILL ★", cx, y, `14px ${MONO}`, "#555");
  y += 50; txt("RupeeRise", cx, y, `bold 42px ${MONO}`, "#0b2a6b");
  y += 28; txt(TODAY, cx, y, `13px ${MONO}`, "#777");
  y += 20; dash(y);

  y += 22; txt("SPENT ON", xl, y, `bold 11px ${MONO}`, "#7a869f", "left");
  items.forEach((it) => {
    y += 20;
    txt(it.label, xl, y, `14px ${MONO}`, "#333", "left");
    txt(fmt(it.amt), xr, y, `14px ${MONO}`, "#333", "right");
  });
  y += 14; dash(y);
  y += 32;
  txt("TOTAL BILL", xl, y, `bold 14px ${MONO}`, "#333", "left");
  txt(fmt(total), xr, y, `bold 22px ${MONO}`, "#222", "right");
  y += 18; dash(y);
  y += 16;
  names.forEach((nm, i) => {
    x.save();
    rr(x, xl, y, xr - xl, 38, 8);
    x.fillStyle = "#eef3ff"; x.fill();
    x.setLineDash([4, 3]); x.strokeStyle = "#0b2a6b"; x.stroke();
    x.restore();
    txt(nm, xl + 12, y + 25, `bold 16px ${MONO}`, "#0b2a6b", "left");
    txt(fmt(shares[i]), xr - 12, y + 25, `bold 16px ${MONO}`, "#0b2a6b", "right");
    y += rowH;
  });
  dash(y - 6);
  y += 14; txt(`Split equally between ${names.length}`, cx, y, `13px ${MONO}`, "#666");
  y += 14;
  if (qr) {
    const cell = Math.floor((QR * S) / (qr.n + 4)) / S;
    const size = cell * (qr.n + 4), qx = cx - size / 2;
    x.fillStyle = "#fff"; x.fillRect(qx, y, size, size);
    x.fillStyle = "#111";
    for (let r = 0; r < qr.n; r++)
      for (let k = 0; k < qr.n; k++)
        if (qr.isDark(r, k)) x.fillRect(qx + (k + 2) * cell, y + (r + 2) * cell, cell, cell);
  }
  y += QR + 18; txt("Scan for bill details", cx, y, `11px ${MONO}`, "#888");

  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("Could not render the bill"))), "image/png")
  );
}

// Saves a file: uses the host's download capability when present, else a normal download
async function saveBlob(blob, filename) {
  const dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
  if (dl) return dl.save({ filename, data: blob });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const CATEGORIES = [
  "Vegetables", "Grocery", "Petrol", "Food & Dining", "Rent",
  "Electricity", "Travel", "Shopping", "Medical", "Entertainment", "Other",
];

const INIT = {
  items: [
    { cat: "Grocery", custom: "", amt: "1200" },
    { cat: "Petrol", custom: "", amt: "770" },
  ],
  names: ["You", "Friend"],
};

const labelOf = (it) => (it.cat === "Other" ? it.custom.trim() || "Other" : it.cat);
const amtOf = (it) => Math.max(0, parseFloat(it.amt) || 0);
const sumItems = (items) => Math.round(items.reduce((t, it) => t + amtOf(it), 0) * 100) / 100;

const parse = (f) => ({
  items: f.items.map((it) => ({ label: labelOf(it), amt: amtOf(it) })),
  total: sumItems(f.items),
  names: f.names.map((nm, i) => nm.trim() || `Person ${i + 1}`),
});

// Equal shares in paise; any leftover paise go to the first people
const splitShares = (total, n) => {
  const paise = Math.round(total * 100);
  const base = Math.floor(paise / n);
  const extra = paise - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
};

function Receipt({ total, items, names, shares, qr }) {
  const n = names.length, m = items.length;
  const forText = items.map((it) => it.label).join(", ");
  return (
    <div className="atm-receipt" style={{ height: heightFor(n, m) }}>
      <div className="atm-r-head" style={{ height: headFor(m) }}>
        <div className="atm-r-title">
          <div>★ SPLIT BILL ★</div>
          <b>RupeeRise</b>
          <div>{TODAY}</div>
        </div>
        <div className="atm-r-items">
          <small>SPENT ON</small>
          {items.map((it, i) => (
            <div className="atm-row" key={i}><span>{it.label}</span><span>{fmt(it.amt)}</span></div>
          ))}
        </div>
      </div>
      {/* Every piece carries the brand, what it was for, the full total and one share */}
      {names.map((nm, i) => (
        <div className="atm-r-row" key={i}>
          <div className="atm-brandline">RupeeRise</div>
          <div className="atm-for">FOR: {forText}</div>
          <div className="atm-row atm-total"><span>TOTAL BILL</span><span>{fmt(total)}</span></div>
          <div className="atm-share"><span>{nm}</span><span>{fmt(shares[i])}</span></div>
        </div>
      ))}
      <div className="atm-r-foot">
        <div className="atm-row"><span>Split between</span><span>{n}</span></div>
        {qr && <Qr qr={qr} />}
      </div>
    </div>
  );
}

export default function AtmSplitReceipt() {
  const [phase, setPhase] = useState("reset");
  const [run, setRun] = useState(0);
  const [form, setForm] = useState(INIT);
  const [cfg, setCfg] = useState(parse(INIT));
  const [shareMsg, setShareMsg] = useState("");

  const n = cfg.names.length;
  const m = cfg.items.length;
  const H = heightFor(n, m);
  const dur = 2.4 + H / 250; // taller bills print for longer

  // reset -> idle -> print -> ready (then waits for the button)
  useEffect(() => {
    const t = [];
    const at = (ms, p) => t.push(setTimeout(() => setPhase(p), ms));
    at(60, "idle");
    at(250, "print");
    at(250 + dur * 1000 + 150, "ready");
    return () => t.forEach(clearTimeout);
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  // tear -> apart
  useEffect(() => {
    if (phase !== "tear") return;
    const id = setTimeout(() => setPhase("apart"), 900);
    return () => clearTimeout(id);
  }, [phase]);

  const restart = () => { setPhase("reset"); setRun((r) => r + 1); };

  // Text / amount edits show live on the printed bill until it is split
  const edit = (next) => {
    setForm(next);
    if (phase !== "tear" && phase !== "apart") setCfg(parse(next));
  };
  // Adding or removing a member or an expense line changes the paper size: reprint
  const changeLayout = (next) => {
    setForm(next);
    if (phase === "ready") { setCfg(parse(next)); restart(); }
  };

  const setName = (i) => (e) =>
    edit({ ...form, names: form.names.map((x, j) => (j === i ? e.target.value : x)) });
  const addMember = () =>
    changeLayout({ ...form, names: [...form.names, `Member ${form.names.length + 1}`] });
  const removeMember = (i) =>
    changeLayout({ ...form, names: form.names.filter((_, j) => j !== i) });

  const setItem = (i, key) => (e) =>
    edit({ ...form, items: form.items.map((it, j) => (j === i ? { ...it, [key]: e.target.value } : it)) });
  const addItem = () => {
    const cat = CATEGORIES.find((c) => c !== "Other" && !form.items.some((it) => it.cat === c)) || "Other";
    changeLayout({ ...form, items: [...form.items, { cat, custom: "", amt: "" }] });
  };
  const removeItem = (i) =>
    changeLayout({ ...form, items: form.items.filter((_, j) => j !== i) });

  const canEditLayout = phase === "ready" || phase === "apart";
  const busy = phase === "reset" || phase === "idle" || phase === "print" || phase === "tear";
  const onPress = () => {
    if (phase === "ready") return setPhase("tear");
    if (phase === "apart") { setCfg(parse(form)); restart(); }
  };

  const shares = splitShares(cfg.total, n);
  const payload = qrPayload(cfg, shares);
  const qr = useMemo(() => safeQR(payload), [payload]);
  const rp = { total: cfg.total, items: cfg.items, names: cfg.names, shares, qr };
  const hasBill = phase === "ready" || phase === "apart";

  const billText = () =>
    [
      "*RupeeRise*",
      "Spent on:",
      ...cfg.items.map((it) => `• ${it.label}: ${fmt(it.amt)}`),
      `Total bill: ${fmt(cfg.total)}`,
      "Each person pays:",
      ...cfg.names.map((nm, i) => `• ${nm}: ${fmt(shares[i])}`),
    ].join("\n");

  // Share sheet with the bill image (WhatsApp shows the picture to the other side);
  // falls back to a WhatsApp message with the bill as text.
  const shareWhatsApp = async () => {
    const text = billText();
    setShareMsg("");
    try {
      const blob = await drawBill(rp);
      const file = new File([blob], "rupeerise-split.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "RupeeRise", text });
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return; // share sheet closed
    }
    const w = window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    if (w) w.opener = null;
    else setShareMsg("Pop-up blocked. Use Save image and send it on WhatsApp.");
  };

  const saveImage = async () => {
    setShareMsg("");
    try {
      await saveBlob(await drawBill(rp), "rupeerise-split.png");
    } catch (err) {
      if (!err || err.code !== "declined") setShareMsg("Could not save the image.");
    }
  };

  const slotY = PAD + H - 12;

  return (
    <div className="atm-app">
      <style>{CSS}</style>
      <h2 className="atm-heading">RupeeRise</h2>
      <div className="atm-sub">Split the bill with friends &amp; family</div>

      <div className="atm-stage" style={{ height: slotY + 438 }}>
        {/* Paper comes out of the top slot and tears into one piece per member */}
        <div className={`atm-tray ${phase}`} style={{ top: PAD, height: H, "--dur": `${dur}s` }}>
          <div className="atm-wrap">
            {cfg.names.map((_, i) => (
              <div key={i} className="atm-half" style={pieceStyle(i, n, m)}><Receipt {...rp} /></div>
            ))}
          </div>
        </div>

        {/* Handheld terminal */}
        <div className="atm-machine" style={{ top: slotY }}>
          <div className="atm-cap"><div className="atm-slot" /><i className="atm-led" /></div>
          <div className="atm-bezel">
            <div className="atm-screen">
              <div className="atm-statusbar"><span>9:41</span><span>▮▮▮</span></div>
              <div className="atm-brand"><span className="atm-logo" />SBI Payments</div>
              <div className="atm-banner"><em>{STATUS[phase]}</em></div>
              <div className="atm-sale"><small>SALE</small><strong>{fmt(cfg.total)}</strong></div>
              <div className="atm-menu">
                {MENU.map(([g, l]) => (
                  <div key={l}><b>{g}</b><span>{l}</span></div>
                ))}
              </div>
            </div>
          </div>
          <div className="atm-nav"><span>☰</span><span>⌂</span><span>↩</span></div>
        </div>
      </div>

      <div className="atm-form">
        {/* What the money was spent on */}
        <div className="atm-items">
          <div className="atm-items-head"><span>Spent on</span><span>Amount (₹)</span><span /></div>
          {form.items.map((it, i) => (
            <div className="atm-item" key={i}>
              <div className="atm-cat">
                <select value={it.cat} onChange={setItem(i, "cat")} aria-label={`Expense ${i + 1} category`}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c === "Other" ? "Other (type your own)" : c}</option>)}
                </select>
                {it.cat === "Other" && (
                  <input maxLength={14} placeholder="e.g. Gift" value={it.custom}
                    onChange={setItem(i, "custom")} aria-label={`Expense ${i + 1} name`} />
                )}
              </div>
              <input type="number" min="0" inputMode="decimal" value={it.amt}
                onChange={setItem(i, "amt")} aria-label={`Expense ${i + 1} amount`} />
              <button type="button" className="atm-x" aria-label={`Remove expense ${i + 1}`}
                disabled={!canEditLayout || form.items.length <= MIN_ITEMS}
                onClick={() => removeItem(i)}>×</button>
            </div>
          ))}
          <div className="atm-items-foot">
            <button type="button" className="atm-add" onClick={addItem}
              disabled={!canEditLayout || form.items.length >= MAX_ITEMS}>+ Add item</button>
            <span className="atm-sum">Total {fmt(sumItems(form.items))}</span>
          </div>
        </div>

        {/* Who shares it */}
        <div className="atm-items-head"><span>Split between</span></div>
        <div className="atm-members">
          {form.names.map((nm, i) => (
            <div className="atm-member" key={i}>
              <input maxLength={10} value={nm} onChange={setName(i)} aria-label={`Member ${i + 1} name`} />
              <button type="button" className="atm-x" aria-label={`Remove member ${i + 1}`}
                disabled={!canEditLayout || form.names.length <= MIN_MEMBERS}
                onClick={() => removeMember(i)}>×</button>
            </div>
          ))}
        </div>

        <div className="atm-actions">
          <button type="button" className="atm-add" onClick={addMember}
            disabled={!canEditLayout || form.names.length >= MAX_MEMBERS}>
            + Add member
          </button>
          <button type="button" className="atm-go" onClick={onPress} disabled={busy}>
            {phase === "apart" ? "↻ New bill" : "✂ Split the bill"}
          </button>
        </div>
        <div className="atm-actions">
          <button type="button" className="atm-wa" onClick={shareWhatsApp} disabled={!hasBill}>
            Share on WhatsApp
          </button>
          <button type="button" className="atm-add" onClick={saveImage} disabled={!hasBill}>
            Save image
          </button>
        </div>
        {shareMsg && <div className="atm-hint">{shareMsg}</div>}
        <div className="atm-hint">
          {phase === "apart"
            ? "Edit the items or members, then tap New bill."
            : `Up to ${MAX_ITEMS} items and ${MAX_MEMBERS} members. Adding one reprints the bill.`}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.atm-app{--text:#1b2540;--btn:#2a1f8f;--btntext:#fff;color:var(--text);display:flex;flex-direction:column;align-items:center;padding:20px 8px 40px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;overflow-x:hidden}
@media (prefers-color-scheme:dark){.atm-app{--text:#dbe4ff;--btn:#5b4be0}}
.atm-heading{font-size:18px;margin:0 0 6px;text-align:center}
.atm-sub{margin:0 0 8px;font-size:13px;opacity:.75;text-align:center}
.atm-stage{position:relative;width:340px}

/* Terminal */
.atm-machine{position:absolute;left:50px;width:240px;height:430px;border-radius:30px 30px 34px 34px;background:linear-gradient(90deg,#e9edf3,#fff 30%,#f4f6fa 70%,#d9dfe8);box-shadow:0 24px 40px rgba(0,0,0,.35),inset 0 0 0 1px #c7cfdb;z-index:1}
.atm-cap{position:absolute;top:0;left:0;right:0;height:62px;border-radius:30px 30px 0 0;background:linear-gradient(180deg,#5ec0ff,#2f9be8)}
.atm-slot{position:absolute;top:6px;left:15px;right:15px;height:9px;border-radius:5px;background:#06223d;box-shadow:inset 0 2px 3px #000}
.atm-led{position:absolute;top:34px;left:50%;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:#8dffd0;box-shadow:0 0 6px #8dffd0}
.atm-bezel{position:absolute;top:66px;left:12px;right:12px;height:302px;border-radius:14px;background:#0b0c10;padding:5px;box-sizing:border-box}
.atm-screen{height:100%;border-radius:8px;background:#fff;overflow:hidden;display:flex;flex-direction:column;color:#222}
.atm-statusbar{display:flex;justify-content:space-between;padding:2px 6px;font-size:7px;background:#eceef5;color:#555}
.atm-brand{display:flex;align-items:center;gap:6px;padding:5px 8px;font-weight:700;font-size:15px;color:#2a1f8f}
.atm-logo{width:14px;height:14px;border-radius:50%;background:#1d8be0;box-shadow:inset 0 0 0 3px #fff,0 0 0 2px #1d8be0}
.atm-banner{height:58px;background:linear-gradient(110deg,#6a5acd 0 30%,#d98a5b 30% 60%,#6fae5b 60%);display:flex;align-items:flex-end;padding:4px 6px}
.atm-banner em{font-style:normal;font-size:10px;font-weight:600;color:#fff;background:rgba(20,10,60,.75);padding:3px 7px;border-radius:10px}
.atm-sale{background:#2a1a7a;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:6px 10px}
.atm-sale small{font-size:9px}
.atm-sale strong{font-size:19px}
.atm-menu{flex:1;display:grid;grid-template-columns:repeat(3,1fr);align-content:space-evenly;padding:2px 4px;text-align:center}
.atm-menu div{display:flex;flex-direction:column;align-items:center;gap:1px}
.atm-menu b{font-size:16px;line-height:1.1;color:#333}
.atm-menu span{font-size:7.5px;color:#444}
.atm-nav{position:absolute;bottom:0;left:0;right:0;height:52px;display:flex;justify-content:space-around;align-items:center;color:#666;font-size:15px}

/* Paper */
.atm-tray{position:absolute;left:70px;width:200px;z-index:2}
.atm-tray.reset,.atm-tray.idle,.atm-tray.print,.atm-tray.ready{clip-path:inset(-800px -400px 0 -400px)}
.atm-wrap{position:absolute;inset:0;transform:translateY(102%)}
.atm-tray.print .atm-wrap,.atm-tray.ready .atm-wrap,.atm-tray.tear .atm-wrap,.atm-tray.apart .atm-wrap{transform:translateY(0)}
.atm-tray.print .atm-wrap{transition:transform var(--dur,3.2s) cubic-bezier(.45,.05,.25,1)}
.atm-tray.reset .atm-wrap{transition:none}
.atm-half{position:absolute;inset:0;transition:transform 1.1s cubic-bezier(.3,.8,.25,1);filter:drop-shadow(0 6px 8px rgba(0,0,0,.3))}
.atm-tray.tear .atm-half{transform:var(--tear);transition-duration:1.3s}
.atm-tray.apart .atm-half{transform:var(--apart);transition-duration:1.3s}
@media (prefers-reduced-motion:reduce){.atm-tray.print .atm-wrap{transition-duration:.01s}}

.atm-receipt{width:200px;background:#fffdf6;color:#222;font-family:ui-monospace,Menlo,"Courier New",monospace;font-size:11px;display:flex;flex-direction:column;box-sizing:border-box}
.atm-r-head{box-sizing:border-box;border-bottom:1px dashed #bbb}
.atm-r-title{height:96px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;line-height:1.5;color:#555}
.atm-r-title b{font-size:25px;line-height:1.3;letter-spacing:1px;color:#0b2a6b}
.atm-r-title strong{font-size:15px;letter-spacing:.5px;color:#0b2a6b;margin-bottom:4px}
.atm-r-items{padding:0 14px}
.atm-r-items small{display:block;font-size:8px;letter-spacing:1.5px;color:#7a869f;line-height:16px;margin-bottom:6px}
.atm-r-items .atm-row{font-size:10px;line-height:15px;color:#333;gap:8px}
.atm-r-items .atm-row span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.atm-r-row{height:88px;padding:0 14px;display:flex;flex-direction:column;justify-content:center;box-sizing:border-box}
.atm-brandline{font-size:11px;font-weight:700;letter-spacing:1.5px;color:#0b2a6b;text-align:center;line-height:1.4}
.atm-for{font-size:9px;color:#555;text-align:center;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.atm-r-row .atm-total{font-size:11px;line-height:1.5;font-weight:700;color:#333}
.atm-share{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:3px;padding:5px 8px;border:1px dashed #0b2a6b;border-radius:6px;background:#eef3ff;color:#0b2a6b;font-weight:700;font-size:12px}
.atm-share span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.atm-r-foot{height:108px;padding:8px 14px;box-sizing:border-box;line-height:1.5;border-top:1px dashed #bbb;font-size:10px;color:#666;display:flex;flex-direction:column;align-items:center}
.atm-r-foot .atm-row{width:100%}
.atm-qr{width:72px;height:72px;margin-top:4px;display:block}
.atm-row{display:flex;justify-content:space-between}
.atm-bar{margin-top:4px;height:14px;background:repeating-linear-gradient(90deg,#222 0 2px,#fffdf6 2px 4px,#222 4px 5px,#fffdf6 5px 8px)}

/* Controls */
.atm-form{display:flex;flex-direction:column;gap:10px;width:100%;max-width:340px}
.atm-label{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px}
.atm-form input,.atm-form select{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #8ea6d8;background:transparent;color:var(--text);font-size:14px;min-width:0}
.atm-amt{width:130px}
.atm-members{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.atm-member{display:flex;gap:4px;min-width:0}
.atm-member input{flex:1;width:100%}
.atm-form button{font-size:14px;font-weight:600;cursor:pointer;border-radius:999px;border:0}
.atm-form button:disabled{opacity:.4;cursor:default}
.atm-x{width:32px;background:transparent;color:var(--text);border:1px solid #8ea6d8!important;font-size:16px;flex:none}
.atm-actions{display:flex;gap:8px;justify-content:space-between}
.atm-add{padding:10px 16px;background:transparent;color:var(--text);border:1px solid var(--btn)!important}
.atm-go{padding:10px 22px;background:var(--btn);color:var(--btntext)}
.atm-wa{padding:10px 16px;background:#168a46;color:#fff}
.atm-form select option{color:#111;background:#fff}
.atm-items{display:flex;flex-direction:column;gap:6px}
.atm-items-head{display:grid;grid-template-columns:1fr 96px 32px;gap:6px;font-size:12px;opacity:.75}
.atm-item{display:grid;grid-template-columns:1fr 96px 32px;gap:6px;align-items:start}
.atm-cat{display:flex;flex-direction:column;gap:4px;min-width:0}
.atm-items-foot{display:flex;justify-content:space-between;align-items:center;margin-top:2px}
.atm-sum{font-weight:700;font-size:14px}
.atm-hint{font-size:12px;opacity:.7;text-align:center}
`;
