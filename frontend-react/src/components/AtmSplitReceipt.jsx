import React, { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";

/**
 * AtmSplitReceipt - RupeeRise Handheld ATM Split Terminal
 * Prints realistic receipt slips that tear apart into individual, complete bills.
 * Each split slip contains:
 * 1. RupeeRise Branding & Date
 * 2. Full itemized breakdown (What was spent & how much)
 * 3. Total bill
 * 4. Individual member name and their exact payable share
 * 5. 100% Working Scannable UPI Payment QR Code (GPay / PhonePe / Paytm / BHIM)
 * Downloads both split slip PNGs automatically when clicking Download!
 */

const W = 190;
const AMP = 4;
const PAD = 6;
const MIN_MEMBERS = 2, MAX_MEMBERS = 6, MIN_ITEMS = 1, MAX_ITEMS = 5;

// Each member gets their own full slip with header, items, share box, and working QR code
const slipH = (m) => 218 + m * 14;
const heightFor = (n, m) => n * slipH(m);
const tearY = (k, m) => k * slipH(m);

// Zigzag tear line between consecutive slips
const zigAt = (y) => {
  const p = [];
  for (let x = 0; x <= W; x += 10) {
    p.push([x, y + ((x / 10) % 2 ? AMP : -AMP)]);
  }
  return p;
};
const pts = (a) => a.map(([x, y]) => `${x}px ${y}px`).join(",");

// Polygon clip path and tear motion for each slip piece
const pieceStyle = (i, n, m) => {
  const H = heightFor(n, m);
  const sh = slipH(m);
  const top = i === 0 ? [[0, 0], [W, 0]] : zigAt(tearY(i, m));
  const bot = i === n - 1 ? [[W, H], [0, H]] : zigAt(tearY(i + 1, m)).reverse();
  const y0 = tearY(i, m);
  const y1 = tearY(i + 1, m);
  const s = i % 2 === 0 ? -1 : 1;
  const lift = n - 1 - i;
  const step = 45 / Math.max(1, n - 1);
  return {
    clipPath: `polygon(${pts([...top, ...bot])})`,
    transformOrigin: `${W / 2}px ${(y0 + y1) / 2}px`,
    "--tear": `translate(${s * 8}px,${-lift * 4}px) rotate(${s * 2.5}deg)`,
    "--apart": `translate(${s * (46 + (i % 3) * 6)}px,${-lift * step + (s > 0 ? 14 : -14)}px) rotate(${s * (6 + (i % 3) * 2)}deg)`,
  };
};

const TODAY = new Date()
  .toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  .toUpperCase();

const fmt = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const STATUS = {
  reset: "Starting…",
  idle: "Starting…",
  print: "Printing bills…",
  ready: "Bills ready. Tap Split",
  tear: "Splitting slips…",
  apart: "Split complete",
};

const MENU = [
  ["↺", "Void"], ["▦", "QR"], ["✔", "Pre-Auth"],
  ["▤", "Settlement"], ["⚙", "Config"], ["☎", "Help"],
  ["₹", "Adjust"], ["⇩", "Download"],
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

// ---- QR Code & UPI URL ---------------------------------------------------
if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
}

// Official NPCI UPI QR code payment format
export function makeUpiUrl(upiId, payeeName, amount, memberName) {
  const cleanId = (upiId || "").trim() || "rupeerise@upi";
  const cleanName = encodeURIComponent(payeeName || "RupeeRise");
  const amtStr = Number(amount || 0).toFixed(2);
  const note = encodeURIComponent(`Bill Share - ${memberName || "Friend"}`);
  return `upi://pay?pa=${cleanId}&pn=${cleanName}&am=${amtStr}&cu=INR&tn=${note}`;
}

function safeQR(text) {
  try {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    let path = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (q.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
      }
    }
    return { n, path, isDark: (r, c) => q.isDark(r, c) };
  } catch (e) {
    return null;
  }
}

function Qr({ qr }) {
  if (!qr) return null;
  const pad = 2, size = qr.n + pad * 2;
  return (
    <svg className="atm-qr" viewBox={`${-pad} ${-pad} ${size} ${size}`} shapeRendering="crispEdges"
      role="img" aria-label="100% Scannable UPI Payment QR Code">
      <rect x={-pad} y={-pad} width={size} height={size} fill="#fff" />
      <path d={qr.path} fill="#111" />
    </svg>
  );
}

// Draws a complete, high-resolution individual split slip for a specific member
function drawSingleSlip({ total, items, memberName, memberIndex, totalMembers, shareAmt, qr, upiId }) {
  const S = 2; // 2x Retina resolution
  const pw = 340;
  const pad = 24;
  const rowH = 22;
  const ph = 540 + items.length * rowH;
  const cw = pw + pad * 2, ch = ph + pad * 2;
  const c = document.createElement("canvas");
  c.width = cw * S;
  c.height = ch * S;
  const x = c.getContext("2d");
  x.scale(S, S);

  // Dark background backdrop
  x.fillStyle = "#0f172a";
  x.fillRect(0, 0, cw, ch);

  // Receipt paper with torn zigzag top and bottom
  const L = pad, B = pad + ph, T = pad;
  x.save();
  x.shadowColor = "rgba(0,0,0,.5)";
  x.shadowBlur = 16;
  x.shadowOffsetY = 6;
  x.fillStyle = "#fffdf6";
  x.beginPath();
  x.moveTo(L, T);
  for (let i = 0; i <= pw; i += 10) x.lineTo(L + i, T + ((i / 10) % 2 ? 4 : 0));
  for (let i = pw; i >= 0; i -= 10) x.lineTo(L + i, B - ((i / 10) % 2 ? 0 : 4));
  x.closePath();
  x.fill();
  x.restore();

  const cx = pad + pw / 2;
  const xl = pad + 20, xr = pad + pw - 20;
  const txt = (str, X, Y, font, color, align = "center") => {
    x.font = font; x.fillStyle = color; x.textAlign = align; x.fillText(str, X, Y);
  };
  const dash = (Y) => {
    x.save(); x.setLineDash([4, 3]); x.strokeStyle = "#cbd5e1"; x.lineWidth = 1;
    x.beginPath(); x.moveTo(xl, Y); x.lineTo(xr, Y); x.stroke(); x.restore();
  };

  let y = pad + 32;
  txt("★ RUPEERISE SPLIT BILL ★", cx, y, `bold 12px ${MONO}`, "#64748b");
  y += 34; txt("RupeeRise", cx, y, `bold 32px ${MONO}`, "#0b2a6b");
  y += 22; txt(TODAY, cx, y, `12px ${MONO}`, "#64748b");
  y += 16; dash(y);

  // SPENT ON breakdown
  y += 22; txt("SPENT ON", xl, y, `bold 11px ${MONO}`, "#7a869f", "left");
  items.forEach((it) => {
    y += 22;
    txt(it.label, xl, y, `14px ${MONO}`, "#1e293b", "left");
    txt(fmt(it.amt), xr, y, `14px ${MONO}`, "#1e293b", "right");
  });
  y += 14; dash(y);

  // Total bill
  y += 24;
  txt("TOTAL BILL", xl, y, `bold 14px ${MONO}`, "#0f172a", "left");
  txt(fmt(total), xr, y, `bold 20px ${MONO}`, "#0f172a", "right");
  y += 16; dash(y);

  // Member Share Box
  y += 16;
  const boxH = 74;
  x.save();
  rr(x, xl, y, xr - xl, boxH, 10);
  x.fillStyle = "#EDF5E5"; x.fill();
  x.setLineDash([4, 3]); x.strokeStyle = "#355E3B"; x.lineWidth = 1.5; x.stroke();
  x.restore();

  txt("MEMBER SHARE", xl + 12, y + 22, `bold 11px ${MONO}`, "#647067", "left");
  txt(`Split ${memberIndex + 1} of ${totalMembers}`, xr - 12, y + 22, `11px ${MONO}`, "#355E3B", "right");
  txt(memberName, xl + 12, y + 52, `bold 18px ${MONO}`, "#1F3328", "left");
  txt(fmt(shareAmt), xr - 12, y + 52, `bold 22px ${MONO}`, "#355E3B", "right");

  y += boxH + 16;
  dash(y);

  // Scannable UPI QR Code
  y += 18;
  const QR_SIZE = 130;
  if (qr) {
    const cell = Math.floor((QR_SIZE * S) / (qr.n + 4)) / S;
    const size = cell * (qr.n + 4);
    const qx = cx - size / 2;
    x.fillStyle = "#fff";
    x.fillRect(qx, y, size, size);
    x.fillStyle = "#111";
    for (let r = 0; r < qr.n; r++) {
      for (let k = 0; k < qr.n; k++) {
        if (qr.isDark(r, k)) x.fillRect(qx + (k + 2) * cell, y + (r + 2) * cell, cell, cell);
      }
    }
  }

  y += QR_SIZE + 22;
  txt(`Scan to Pay ${fmt(shareAmt)} via UPI`, cx, y, `bold 13px ${MONO}`, "#0f172a");
  y += 18;
  txt("Google Pay • PhonePe • Paytm • BHIM", cx, y, `11px ${MONO}`, "#64748b");
  if (upiId && upiId.trim()) {
    y += 16;
    txt(`UPI ID: ${upiId.trim()}`, cx, y, `bold 10px ${MONO}`, "#355E3B");
  }

  y += 24;
  txt("— RupeeRise Smart Bill Split —", cx, y, `10px ${MONO}`, "#94a3b8");

  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("Could not render the bill"))), "image/png")
  );
}

// Download helper
async function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const CATEGORIES = [
  "Grocery", "Petrol", "Food & Dining", "Vegetables", "Rent",
  "Electricity", "Travel", "Shopping", "Medical", "Entertainment", "Other",
];

const INIT = {
  items: [
    { cat: "Grocery", custom: "", amt: "1200" },
    { cat: "Petrol", custom: "", amt: "770" },
  ],
  names: ["Srivatsan", "Sanjay"],
  upiId: "",
};

const labelOf = (it) => (it.cat === "Other" ? it.custom.trim() || "Other" : it.cat);
const amtOf = (it) => Math.max(0, parseFloat(it.amt) || 0);
const sumItems = (items) => Math.round(items.reduce((t, it) => t + amtOf(it), 0) * 100) / 100;

const parse = (f) => ({
  items: f.items.map((it) => ({ label: labelOf(it), amt: amtOf(it) })),
  total: sumItems(f.items),
  names: f.names.map((nm, i) => nm.trim() || `Person ${i + 1}`),
});

const splitShares = (total, n) => {
  const paise = Math.round(total * 100);
  const base = Math.floor(paise / n);
  const extra = paise - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
};

// Continuous bill rendered inside the machine; clips into individual complete slips
function Receipt({ total, items, names, shares, qrs }) {
  const m = items.length;
  const sh = slipH(m);
  return (
    <div className="atm-receipt" style={{ height: heightFor(names.length, m) }}>
      {names.map((nm, i) => (
        <div className="atm-single-slip" key={i} style={{ height: sh }}>
          <div className="atm-slip-head">
            <div className="atm-slip-star">★ SPLIT BILL ★</div>
            <b className="atm-slip-brand">RupeeRise</b>
            <div className="atm-slip-date">{TODAY}</div>
          </div>

          <div className="atm-slip-items">
            <small>SPENT ON</small>
            {items.map((it, j) => (
              <div className="atm-row" key={j}>
                <span>{it.label}</span>
                <span>{fmt(it.amt)}</span>
              </div>
            ))}
            <div className="atm-row atm-slip-total">
              <span>TOTAL BILL</span>
              <span>{fmt(total)}</span>
            </div>
          </div>

          <div className="atm-slip-sharebox">
            <div className="atm-slip-share-head">
              <span>SHARE FOR</span>
              <span className="atm-slip-pill">Split {i + 1} of {names.length}</span>
            </div>
            <div className="atm-slip-share-name">{nm}</div>
            <div className="atm-slip-share-amt">{fmt(shares[i])}</div>
          </div>

          <div className="atm-slip-qr-sec">
            {qrs[i] && <Qr qr={qrs[i]} />}
            <span className="atm-slip-qr-label">Scan to pay {fmt(shares[i])}</span>
            <span className="atm-slip-qr-apps">GPay • PhonePe • Paytm</span>
          </div>

          {i < names.length - 1 && <div className="atm-slip-tear-guide" />}
        </div>
      ))}
    </div>
  );
}

export default function AtmSplitReceipt() {
  const [phase, setPhase] = useState("reset");
  const [run, setRun] = useState(0);
  const [form, setForm] = useState(INIT);
  const [cfg, setCfg] = useState(parse(INIT));
  const [shareMsg, setShareMsg] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  const n = cfg.names.length;
  const m = cfg.items.length;
  const H = heightFor(n, m);
  const dur = 2.2 + H / 300;

  // Animation cycle
  useEffect(() => {
    const t = [];
    const at = (ms, p) => t.push(setTimeout(() => setPhase(p), ms));
    at(60, "idle");
    at(250, "print");
    at(250 + dur * 1000 + 150, "ready");
    return () => t.forEach(clearTimeout);
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "tear") return;
    const id = setTimeout(() => setPhase("apart"), 950);
    return () => clearTimeout(id);
  }, [phase]);

  const restart = () => {
    setPhase("reset");
    setRun((r) => r + 1);
  };

  const edit = (next) => {
    setForm(next);
    if (phase !== "tear" && phase !== "apart") setCfg(parse(next));
  };

  const changeLayout = (next) => {
    setForm(next);
    if (phase === "ready") {
      setCfg(parse(next));
      restart();
    }
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
    if (phase === "apart") {
      setCfg(parse(form));
      restart();
    }
  };

  const shares = splitShares(cfg.total, n);

  // Each member gets their own 100% working scannable UPI QR code
  const qrs = useMemo(() => {
    return cfg.names.map((nm, i) => {
      const upiUrl = makeUpiUrl(form.upiId, "RupeeRise", shares[i], nm);
      return safeQR(upiUrl);
    });
  }, [cfg, shares, form.upiId]);

  const rp = { total: cfg.total, items: cfg.items, names: cfg.names, shares, qrs };
  const hasBill = phase === "ready" || phase === "apart";

  // Download both split papers as individual PNG images
  const downloadAllSlips = async () => {
    setIsDownloading(true);
    setShareMsg("Generating split slips...");
    try {
      for (let i = 0; i < cfg.names.length; i++) {
        const nm = cfg.names[i];
        const blob = await drawSingleSlip({
          total: cfg.total,
          items: cfg.items,
          memberName: nm,
          memberIndex: i,
          totalMembers: cfg.names.length,
          shareAmt: shares[i],
          qr: qrs[i],
          upiId: form.upiId,
        });
        const safeName = nm.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const filename = `rupeerise-slip-${i + 1}-${safeName}.png`;
        await saveBlob(blob, filename);

        // Small delay between downloads so browser triggers both cleanly
        if (i < cfg.names.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      setShareMsg(`✓ Downloaded all ${cfg.names.length} split slips!`);
    } catch (err) {
      setShareMsg("Could not save the images. Please check permissions.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Download a single specific member's slip
  const downloadMemberSlip = async (i) => {
    const nm = cfg.names[i];
    setShareMsg(`Generating slip for ${nm}...`);
    try {
      const blob = await drawSingleSlip({
        total: cfg.total,
        items: cfg.items,
        memberName: nm,
        memberIndex: i,
        totalMembers: cfg.names.length,
        shareAmt: shares[i],
        qr: qrs[i],
        upiId: form.upiId,
      });
      const safeName = nm.toLowerCase().replace(/[^a-z0-9]/g, "_");
      await saveBlob(blob, `rupeerise-slip-${i + 1}-${safeName}.png`);
      setShareMsg(`✓ Slip for ${nm} downloaded!`);
    } catch (err) {
      setShareMsg("Could not save the image.");
    }
  };

  // WhatsApp share message with item breakdown and UPI payment link
  const shareWhatsApp = async () => {
    const lines = [
      "*★ RupeeRise Split Bill ★*",
      `Date: ${TODAY}`,
      "",
      "*Spent on:*",
      ...cfg.items.map((it) => `• ${it.label}: ${fmt(it.amt)}`),
      `*Total Bill: ${fmt(cfg.total)}*`,
      "",
      `*Split equally between ${cfg.names.length} people:*`,
      ...cfg.names.map((nm, i) => `• *${nm}*: ${fmt(shares[i])}`),
      "",
      form.upiId && form.upiId.trim()
        ? `*Pay via UPI to:* ${form.upiId.trim()}`
        : "Scan the QR code on your slip to pay via GPay / PhonePe / Paytm",
    ];
    const text = lines.join("\n");
    const w = window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    if (w) w.opener = null;
    else setShareMsg("Pop-up blocked. Please enable pop-ups for WhatsApp.");
  };

  const slotY = PAD + H - 10;

  return (
    <div className="atm-app">
      <style>{CSS}</style>

      <div className="atm-layout">
        {/* Left Column: Handheld ATM Machine Stage */}
        <div className="atm-stage-wrapper">
          <div className="atm-stage" style={{ height: slotY + 280 }}>
            {/* Paper prints out and tears into separate complete slips per member */}
            <div className={`atm-tray ${phase}`} style={{ top: PAD, height: H, "--dur": `${dur}s` }}>
              <div className="atm-wrap">
                {cfg.names.map((_, i) => (
                  <div key={i} className="atm-half" style={pieceStyle(i, n, m)}>
                    <Receipt {...rp} />
                  </div>
                ))}
              </div>
            </div>

            {/* Handheld terminal machine */}
            <div className="atm-machine" style={{ top: slotY }}>
              <div className="atm-cap"><div className="atm-slot" /><i className="atm-led" /></div>
              <div className="atm-bezel">
                <div className="atm-screen">
                  <div className="atm-statusbar"><span>9:41</span><span>▮▮▮</span></div>
                  <div className="atm-brand"><span className="atm-logo" />RupeeRise Pay</div>
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
        </div>

        {/* Right Column: Interactive Bill Controls */}
        <div className="atm-form">
          <div className="atm-panel-title">
            <h4>Split Bill Details</h4>
            <span>Item breakdown, member shares & scannable UPI QR codes</span>
          </div>

          {/* What the money was spent on */}
          <div className="atm-items">
            <div className="atm-items-head"><span>Spent on</span><span>Amount (₹)</span><span /></div>
            {form.items.map((it, i) => (
              <div className="atm-item" key={i}>
                <div className="atm-cat">
                  <select value={it.cat} onChange={setItem(i, "cat")} aria-label={`Expense ${i + 1} category`}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c === "Other" ? "Other (custom)" : c}</option>)}
                  </select>
                  {it.cat === "Other" && (
                    <input maxLength={14} placeholder="e.g. Snacks" value={it.custom}
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
              <button type="button" className="atm-add-btn" onClick={addItem}
                disabled={!canEditLayout || form.items.length >= MAX_ITEMS}>+ Add item</button>
              <span className="atm-sum">Total {fmt(sumItems(form.items))}</span>
            </div>
          </div>

          {/* Who shares it */}
          <div className="atm-items-head" style={{ marginTop: 6 }}><span>Split between</span></div>
          <div className="atm-members">
            {form.names.map((nm, i) => (
              <div className="atm-member" key={i}>
                <input maxLength={12} value={nm} onChange={setName(i)} aria-label={`Member ${i + 1} name`} />
                <button type="button" className="atm-x" aria-label={`Remove member ${i + 1}`}
                  disabled={!canEditLayout || form.names.length <= MIN_MEMBERS}
                  onClick={() => removeMember(i)}>×</button>
              </div>
            ))}
          </div>

          {/* Optional UPI ID for direct bank account QR payments */}
          <div className="atm-upi-box">
            <div className="atm-upi-head">
              <span>Your UPI ID (Optional)</span>
              <small>Scan to receive money directly</small>
            </div>
            <input
              placeholder="e.g. srivatsan@oksbi or yourname@paytm"
              value={form.upiId}
              onChange={(e) => edit({ ...form, upiId: e.target.value })}
              aria-label="Your UPI ID"
            />
          </div>

          {/* Primary Split Button */}
          <div className="atm-actions">
            <button type="button" className="atm-add-btn" onClick={addMember}
              disabled={!canEditLayout || form.names.length >= MAX_MEMBERS}>
              + Add member
            </button>
            <button type="button" className="atm-go" onClick={onPress} disabled={busy}>
              {phase === "apart" ? "↻ New bill" : "✂ Split the bill"}
            </button>
          </div>

          {/* Download Both Slips (User Requirement) */}
          <div className="atm-download-box">
            <button
              type="button"
              className="atm-download-all"
              onClick={downloadAllSlips}
              disabled={!hasBill || isDownloading}
            >
              📥 {isDownloading ? "Downloading..." : `Download Both Slips (${cfg.names.length} PNGs)`}
            </button>

            {/* Individual member slip downloads */}
            <div className="atm-member-downloads">
              {cfg.names.map((nm, i) => (
                <button
                  key={i}
                  type="button"
                  className="atm-member-dl-btn"
                  onClick={() => downloadMemberSlip(i)}
                  disabled={!hasBill || isDownloading}
                >
                  📥 {nm} ({fmt(shares[i])})
                </button>
              ))}
            </div>
          </div>

          {/* WhatsApp share */}
          <div className="atm-actions">
            <button type="button" className="atm-wa" onClick={shareWhatsApp} disabled={!hasBill}>
              Share on WhatsApp
            </button>
          </div>

          {shareMsg && <div className="atm-hint atm-msg">{shareMsg}</div>}
          <div className="atm-hint">
            {phase === "apart"
              ? "✓ Slips separated! Each person has their items, share & 100% scannable UPI QR code."
              : `Tap 'Split the bill' to tear the receipt into ${n} individual payment slips.`}
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.atm-app {
  --text: #1F3328;
  --btn: #355E3B;
  --btntext: #fff;
  color: var(--text);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 4px 12px;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  overflow-x: hidden;
  width: 100%;
}
@media (prefers-color-scheme: dark) {
  .atm-app {
    --text: #F3F8F3;
    --btn: #80A66A;
  }
}

.atm-layout {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: center;
  gap: 20px;
  width: 100%;
}
@media (max-width: 680px) {
  .atm-layout {
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
}

.atm-stage-wrapper {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  flex-shrink: 0;
}

.atm-stage {
  position: relative;
  width: 230px;
  transform: scale(0.92);
  transform-origin: top center;
  margin-bottom: -5%;
}

/* Handheld Terminal Machine */
.atm-machine {
  position: absolute;
  left: 5px;
  width: 220px;
  height: 280px;
  border-radius: 24px 24px 28px 28px;
  background: linear-gradient(90deg, #e9edf3, #fff 30%, #f4f6fa 70%, #d9dfe8);
  box-shadow: 0 16px 30px rgba(0,0,0,.28), inset 0 0 0 1px #c7cfdb;
  z-index: 1;
}
.atm-cap {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  border-radius: 24px 24px 0 0;
  background: linear-gradient(180deg, #355E3B, #1F3328);
}
.atm-slot {
  position: absolute;
  top: 6px;
  left: 14px;
  right: 14px;
  height: 7px;
  border-radius: 4px;
  background: #06223d;
  box-shadow: inset 0 2px 3px #000;
}
.atm-led {
  position: absolute;
  top: 25px;
  left: 50%;
  width: 5px;
  height: 5px;
  margin-left: -2.5px;
  border-radius: 50%;
  background: #8dffd0;
  box-shadow: 0 0 6px #8dffd0;
}
.atm-bezel {
  position: absolute;
  top: 50px;
  left: 10px;
  right: 10px;
  height: 192px;
  border-radius: 12px;
  background: #0b0c10;
  padding: 4px;
  box-sizing: border-box;
}
.atm-screen {
  height: 100%;
  border-radius: 7px;
  background: #fff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: #222;
}
.atm-statusbar {
  display: flex;
  justify-content: space-between;
  padding: 2px 5px;
  font-size: 7px;
  background: #eceef5;
  color: #555;
}
.atm-brand {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 6px;
  font-weight: 700;
  font-size: 13px;
  color: #1e3a8a;
}
.atm-logo {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #355E3B;
  box-shadow: inset 0 0 0 2px #fff, 0 0 0 2px #355E3B;
}
.atm-banner {
  height: 32px;
  background: linear-gradient(110deg, #4f46e5 0 30%, #ea580c 30% 60%, #16a34a 60%);
  display: flex;
  align-items: flex-end;
  padding: 3px 5px;
}
.atm-banner em {
  font-style: normal;
  font-size: 9px;
  font-weight: 600;
  color: #fff;
  background: rgba(15, 23, 42, 0.8);
  padding: 2px 6px;
  border-radius: 8px;
}
.atm-sale {
  background: #1e3a8a;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 8px;
}
.atm-sale small {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.atm-sale strong {
  font-size: 14px;
}
.atm-menu {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-content: space-evenly;
  padding: 2px 3px;
  text-align: center;
}
.atm-menu div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}
.atm-menu b {
  font-size: 12px;
  line-height: 1.1;
  color: #334155;
}
.atm-menu span {
  font-size: 7px;
  color: #64748b;
}
.atm-nav {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 36px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  color: #64748b;
  font-size: 13px;
}

/* Paper Container */
.atm-tray {
  position: absolute;
  left: 20px;
  width: 190px;
  z-index: 2;
}
.atm-tray.reset, .atm-tray.idle, .atm-tray.print, .atm-tray.ready {
  clip-path: inset(-800px -400px 0 -400px);
}
.atm-wrap {
  position: absolute;
  inset: 0;
  transform: translateY(102%);
}
.atm-tray.print .atm-wrap, .atm-tray.ready .atm-wrap, .atm-tray.tear .atm-wrap, .atm-tray.apart .atm-wrap {
  transform: translateY(0);
}
.atm-tray.print .atm-wrap {
  transition: transform var(--dur, 2.8s) cubic-bezier(.45, .05, .25, 1);
}
.atm-tray.reset .atm-wrap {
  transition: none;
}
.atm-half {
  position: absolute;
  inset: 0;
  transition: transform 1.1s cubic-bezier(.3, .8, .25, 1);
  filter: drop-shadow(0 4px 6px rgba(0,0,0,.25));
}
.atm-tray.tear .atm-half {
  transform: var(--tear);
  transition-duration: 1.2s;
}
.atm-tray.apart .atm-half {
  transform: var(--apart);
  transition-duration: 1.2s;
}
@media (prefers-reduced-motion: reduce) {
  .atm-tray.print .atm-wrap {
    transition-duration: .01s;
  }
}

.atm-receipt {
  width: 190px;
  background: #fffdf6;
  color: #1e293b;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* Individual Full Slip */
.atm-single-slip {
  width: 190px;
  background: #fffdf6;
  color: #1e293b;
  font-family: ui-monospace, Menlo, "Courier New", monospace;
  font-size: 10px;
  display: flex;
  flex-direction: column;
  padding: 6px 10px 8px;
  box-sizing: border-box;
  position: relative;
}
.atm-slip-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-bottom: 4px;
  border-bottom: 1px dashed #cbd5e1;
  margin-bottom: 4px;
}
.atm-slip-star {
  font-size: 8px;
  color: #64748b;
  letter-spacing: 1px;
}
.atm-slip-brand {
  font-size: 16px;
  color: #0b2a6b;
  line-height: 1.2;
  letter-spacing: 0.5px;
}
.atm-slip-date {
  font-size: 8px;
  color: #64748b;
}
.atm-slip-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 4px;
  border-bottom: 1px dashed #cbd5e1;
  margin-bottom: 4px;
}
.atm-slip-items small {
  font-size: 7px;
  letter-spacing: 1px;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 2px;
}
.atm-row {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  line-height: 13px;
  color: #334155;
}
.atm-row span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.atm-slip-total {
  font-weight: 700;
  font-size: 10px;
  color: #0f172a;
  margin-top: 2px;
  padding-top: 2px;
  border-top: 1px dotted #e2e8f0;
}
.atm-slip-sharebox {
  background: #EDF5E5;
  border: 1px dashed #355E3B;
  border-radius: 6px;
  padding: 4px 6px;
  margin-bottom: 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.atm-slip-share-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 7px;
  color: #64748b;
  font-weight: 700;
}
.atm-slip-pill {
  background: #dbeafe;
  color: #1d4ed8;
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 7px;
}
.atm-slip-share-name {
  font-weight: 700;
  font-size: 11px;
  color: #1e3a8a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.atm-slip-share-amt {
  font-weight: 800;
  font-size: 14px;
  color: #1d4ed8;
  text-align: right;
  line-height: 1.1;
}
.atm-slip-qr-sec {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1px;
}
.atm-slip-qr-sec .atm-qr {
  width: 52px;
  height: 52px;
  display: block;
}
.atm-slip-qr-label {
  font-size: 8px;
  font-weight: 700;
  color: #0f172a;
}
.atm-slip-qr-apps {
  font-size: 6.5px;
  color: #64748b;
  letter-spacing: 0.3px;
}
.atm-slip-tear-guide {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  border-bottom: 1px dashed #94a3b8;
}

/* Controls Form */
.atm-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 360px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.04);
  box-sizing: border-box;
}
.atm-panel-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f1f5f9;
}
.atm-panel-title h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}
.atm-panel-title span {
  font-size: 11px;
  color: #64748b;
}
.atm-form input, .atm-form select {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #1e293b;
  font-size: 12px;
  min-width: 0;
  transition: border-color .15s ease;
}
.atm-form input:focus, .atm-form select:focus {
  outline: none;
  border-color: #355E3B;
  background: #fff;
}
.atm-members {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.atm-member {
  display: flex;
  gap: 4px;
  min-width: 0;
}
.atm-member input {
  flex: 1;
  width: 100%;
}
.atm-form button {
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  border: 0;
  transition: all .15s ease;
}
.atm-form button:disabled {
  opacity: .4;
  cursor: not-allowed;
}
.atm-x {
  width: 26px;
  height: 28px;
  background: transparent;
  color: #ef4444;
  border: 1px solid #fca5a5!important;
  font-size: 14px;
  flex: none;
  border-radius: 6px!important;
  display: flex;
  align-items: center;
  justify-content: center;
}
.atm-x:hover:not(:disabled) {
  background: #fee2e2;
}
.atm-actions {
  display: flex;
  gap: 8px;
  justify-content: space-between;
}
.atm-add-btn {
  padding: 8px 12px;
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #cbd5e1!important;
  flex: 1;
}
.atm-add-btn:hover:not(:disabled) {
  background: #e2e8f0;
}
.atm-go {
  padding: 8px 16px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: #fff;
  flex: 1.2;
  box-shadow: 0 2px 8px rgba(37,99,235,0.25);
}
.atm-go:hover:not(:disabled) {
  filter: brightness(1.08);
}
.atm-upi-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.atm-upi-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}
.atm-upi-head small {
  color: #94a3b8;
  font-size: 10px;
  font-weight: normal;
}
.atm-download-box {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.atm-download-all {
  padding: 10px 14px;
  background: #16a34a;
  color: #fff;
  border-radius: 8px;
  font-weight: 700;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(22,163,74,0.3);
}
.atm-download-all:hover:not(:disabled) {
  background: #15803d;
}
.atm-member-downloads {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.atm-member-dl-btn {
  padding: 6px 8px;
  background: #ffffff;
  color: #166534;
  border: 1px solid #86efac!important;
  font-size: 11px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.atm-member-dl-btn:hover:not(:disabled) {
  background: #dcfce7;
}
.atm-wa {
  padding: 8px 12px;
  background: #25d366;
  color: #fff;
  flex: 1;
  box-shadow: 0 2px 8px rgba(37,211,102,0.25);
}
.atm-wa:hover:not(:disabled) {
  background: #1eb857;
}
.atm-items {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.atm-items-head {
  display: grid;
  grid-template-columns: 1fr 80px 26px;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.atm-item {
  display: grid;
  grid-template-columns: 1fr 80px 26px;
  gap: 6px;
  align-items: start;
}
.atm-cat {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.atm-items-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}
.atm-sum {
  font-weight: 700;
  font-size: 13px;
  color: #1e293b;
}
.atm-hint {
  font-size: 11px;
  opacity: .75;
  text-align: center;
  line-height: 1.3;
}
.atm-msg {
  color: #16a34a;
  font-weight: 600;
}
`;
