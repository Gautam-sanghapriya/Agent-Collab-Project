import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check, AlertCircle, Loader2, Download, Users, ClipboardList,
  ShieldCheck, Search, Pencil, Trash2, X, ArrowUp, ArrowDown,
  ArrowUpDown, Plus, Calendar, LogOut, Mail, Send, Image as ImageIcon, UploadCloud
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./utils/supabase";

const SESSIONS_KEY  = "ai-ready-sessions-1782870003";
const ADMIN_KEY     = "ai-ready-admins-1782870003";
const regKey = (sid) => `ai-ready-reg-1782870003-${sid}`;

const BOOTSTRAP_PASSCODE = "aiready2026";
const EMAIL_CFG_KEY  = "ai-ready-emailcfg-1782870003";
const EMAIL_TEMPLATES_KEY = "ai-ready-emailtpl-1782870003";
const ADMIN_SESSION_KEY = "ai-ready-adminsession-1782870003";
const ACTIVITY_KEY = "ai-ready-activity-1782870003";
const ACTIVITY_MAX = 500; // keep the most recent N entries

// Feature permissions the superuser can grant to other admins.
const PERMISSIONS = [
  ["sessions",      "Manage sessions",        "Create, edit, activate/deactivate and delete sessions"],
  ["registrations", "Manage registrations",   "View, edit, delete and export registrants"],
  ["activity",      "View activity log",       "See the admin audit trail"],
  ["emails",        "Manage emails",           "Configure confirmation emails and send bulk emails"],
  ["settings",      "Email / OTP settings",    "Configure the Apps Script URL and OTP verification"],
];
const DEFAULT_PERMS = { sessions:true, registrations:true, activity:true, emails:false, settings:false };

// The bootstrap owner is the superuser. Legacy data may predate the `super`
// flag, so if nobody is flagged, the first admin in the list is treated as super.
function isSuperAdmin(admin, admins){
  if(!admin) return false;
  if(admin.super) return true;
  if(Array.isArray(admins) && admins.length>0 && !admins.some(a=>a.super) && admins[0].id===admin.id) return true;
  return false;
}
function permsOf(admin){ return (admin && admin.perms) || {}; }

// Remember the signed-in admin for the browser session (survives reloads,
// clears when the tab is closed). Stores identity only — never the passcode.
function loadAdminSession(){
  try{ const raw = sessionStorage.getItem(ADMIN_SESSION_KEY); return raw ? JSON.parse(raw) : null; }
  catch{ return null; }
}
function saveAdminSession(me){
  try{ sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(me)); }catch{}
}
function clearAdminSession(){
  try{ sessionStorage.removeItem(ADMIN_SESSION_KEY); }catch{}
}

// Shri Tech Partners brand tokens
const C = {
  bg:"#1b3a5c", bgPanel:"#0d1b2a", border:"rgba(0,174,239,0.10)",
  text:"#FFFFFF", textDim:"rgba(255,255,255,0.70)", textFaint:"rgba(255,255,255,0.40)",
  accent:"#00aeef", accentHover:"rgba(0,174,239,0.90)",
  error:"#F87171", success:"#34D399", warn:"#FBBF24",
};
const glass = {
  background:"rgba(13,27,42,0.6)", backdropFilter:"blur(16px)",
  WebkitBackdropFilter:"blur(16px)", border:"1px solid rgba(0,174,239,0.1)",
  borderRadius:16,
};
const iSty = { width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"12px 16px", fontSize:13, color:C.text, outline:"none", transition:"all 300ms cubic-bezier(0.4,0,0.2,1)" };
const fi = (e)=>{ e.target.style.borderColor="rgba(0,174,239,0.40)"; e.target.style.background="rgba(0,174,239,0.03)"; e.target.style.boxShadow="0 0 20px rgba(0,174,239,0.08)"; };
const fo = (e)=>{ e.target.style.borderColor="rgba(255,255,255,0.06)"; e.target.style.background="rgba(255,255,255,0.03)"; e.target.style.boxShadow="none"; };
const ctaHover = (e)=>{ e.currentTarget.style.background=C.accentHover; e.currentTarget.style.boxShadow="0 0 20px rgba(0,174,239,0.30)"; };
const ctaLeave = (e)=>{ e.currentTarget.style.background=C.accent; e.currentTarget.style.boxShadow=""; };
const secHover = (e)=>{ e.currentTarget.style.color="#fff"; e.currentTarget.style.borderColor="rgba(0,174,239,0.40)"; e.currentTarget.style.background="rgba(0,174,239,0.05)"; e.currentTarget.style.boxShadow="0 0 20px rgba(0,174,239,0.10)"; };
const secLeave = (e)=>{ e.currentTarget.style.color=C.textFaint; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.background="transparent"; e.currentTarget.style.boxShadow="none"; };

async function safeGet(key){
  try{
    if(isSupabaseConfigured && supabase){
      const { data, error } = await supabase
        .from("app_storage")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if(error) throw error;
      if(data) return { value: JSON.stringify(data.value) };
      return null;
    }
    if(window.storage?.get) return await window.storage.get(key,true);
    const value = window.localStorage.getItem(key);
    return value === null ? null : { value };
  }catch{ return null; }
}
async function safeSave(key,val){
  try{
    if(isSupabaseConfigured && supabase){
      const { error } = await supabase
        .from("app_storage")
        .upsert({ key, value: val, updated_at: new Date().toISOString() });
      if(error) throw error;
      return true;
    }
    const value = JSON.stringify(val);
    if(window.storage?.set){
      const r=await window.storage.set(key,value,true);
      return !!r;
    }
    window.localStorage.setItem(key,value);
    return true;
  }catch{ return false; }
}
async function hashPC(text){ const e=new TextEncoder().encode(text); const d=await crypto.subtle.digest("SHA-256",e); return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,"0")).join(""); }
const uid=()=>crypto.randomUUID();
const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
async function copyToClipboard(text){
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text); return true;
    }
  }catch(e){}
  // Fallback: textarea + execCommand
  try{
    const ta=document.createElement("textarea");
    ta.value=text; ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok=document.execCommand("copy");
    document.body.removeChild(ta); return ok;
  }catch(e){ return false; }
}

const fmt=(iso)=>iso?new Date(iso).toLocaleString():"—";

// Append-only admin audit log. Records who did what and when.
async function logActivity(actor, action, detail){
  try{
    const r = await safeGet(ACTIVITY_KEY);
    const list = r ? JSON.parse(r.value) : [];
    list.push({ id: uid(), at: new Date().toISOString(), actor: actor || "Unknown", action, detail: detail || "" });
    const trimmed = list.length > ACTIVITY_MAX ? list.slice(list.length - ACTIVITY_MAX) : list;
    await safeSave(ACTIVITY_KEY, trimmed);
  }catch{}
}

export default function App(){
  const [view,setView]=useState("register");
  return(
    <div style={{minHeight:"100vh",width:"100%",background:C.bg,color:C.text,display:"flex",flexDirection:"column",fontFamily:"Arial, Helvetica, sans-serif",position:"relative",overflow:"hidden"}}>
      <style>{`*,*::before,*::after{box-sizing:border-box}@media (max-width:640px){.rpad{padding:20px 16px !important}}
.reg-card{display:flex;flex-direction:column;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.35),0 0 0 1px rgba(0,174,239,0.05);}
.reg-poster{position:relative;overflow:hidden;}
.reg-poster img{display:block;width:100%;height:auto;transition:transform 700ms cubic-bezier(0.4,0,0.2,1);}
.reg-poster::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom, rgba(13,27,42,0) 58%, rgba(13,27,42,0.60) 100%);pointer-events:none;}
.reg-card:hover .reg-poster img{transform:scale(1.03);}
.reg-form{padding:30px 26px;width:100%;position:relative;}
.reg-eyebrow{display:flex;align-items:center;gap:8px;margin-bottom:14px;}
.reg-eyebrow::before{content:"";display:block;width:20px;height:2px;background:${C.accent};border-radius:2px;flex-shrink:0;}
@media (min-width:860px){
.reg-card.has-poster{flex-direction:row;align-items:stretch}
.reg-card.has-poster .reg-poster{width:56%;flex-shrink:0;overflow:hidden;background:${C.bgPanel};display:flex;align-items:center;justify-content:center;}
.reg-card.has-poster .reg-poster img{width:100%;height:100%;object-fit:contain}
.reg-card.has-poster .reg-poster::after{background:linear-gradient(to right, rgba(13,27,42,0) 62%, rgba(13,27,42,0.68) 100%)}
.reg-card.has-poster .reg-form{width:44%;display:flex;flex-direction:column;justify-content:center;padding:48px 42px;box-shadow:inset 1px 0 0 rgba(0,174,239,0.10);}
}
.rfs::-webkit-scrollbar{height:6px;width:6px}.rfs::-webkit-scrollbar-track{background:transparent}.rfs::-webkit-scrollbar-thumb{background:rgba(63,196,245,.35);border-radius:999px}.rfs::-webkit-scrollbar-thumb:hover{background:rgba(63,196,245,.6)}.rfs{scrollbar-width:thin;scrollbar-color:rgba(63,196,245,.35) transparent}input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.20)}@keyframes neon-pulse{0%,100%{box-shadow:0 0 20px rgba(0,174,239,0.15),0 0 60px rgba(0,174,239,0.05)}50%{box-shadow:0 0 30px rgba(0,174,239,0.25),0 0 80px rgba(0,174,239,0.10)}}.neon-glow{animation:neon-pulse 3s ease-in-out infinite}`}</style>
      <div style={{position:"absolute",top:"-10%",left:"-10%",width:420,height:420,borderRadius:"50%",background:C.accent,opacity:.18,filter:"blur(90px)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:"-15%",right:"-10%",width:480,height:480,borderRadius:"50%",background:C.accentHover,opacity:.14,filter:"blur(100px)",pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        <div style={{borderBottom:`1px solid ${C.border}`,background:"rgba(11,37,71,.8)",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:10}}>
          <div style={{maxWidth:980,margin:"0 auto",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:C.accent}}/>
              <span style={{fontFamily:"monospace",fontSize:12,letterSpacing:"0.15em",color:C.textFaint,textTransform:"uppercase"}}>AI Ready</span>
            </div>
            <button data-testid="toggle-view" onClick={()=>setView(v=>v==="register"?"admin":"register")} style={{fontFamily:"monospace",fontSize:12,color:C.textFaint,background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
              {view==="register"?<><ShieldCheck size={14}/>Admin</>:<>← Registration</>}
            </button>
          </div>
        </div>
        <div style={{flex:1,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"48px 16px 32px"}}>
          {view==="register"?<RegisterView/>:<AdminView/>}
        </div>
        <div style={{textAlign:"center",paddingBottom:20,fontSize:10,fontFamily:"monospace",color:C.textFaint}}>
          Registrations are stored securely and never shared with third parties.
        </div>
      </div>
    </div>
  );
}

// ── Apps Script helper ──────────────────────────────────────────────────────
async function sendOtpEmail(cfg, toEmail, toName, otpCode, sessionTitle) {
  if (!cfg || !cfg.url) throw new Error("Apps Script URL not set. Add it in Admin → Settings.");
  // Image-pixel GET: loading an <img> whose src is the Apps Script /exec URL
  // fires a GET request with no CORS restrictions. Apps Script handles it in
  // doGet() and sends the email. We can't read the response (it's an image
  // load, not a fetch), so a resolved load/error both mean "request dispatched".
  return new Promise((resolve, reject) => {
    try {
      const params = new URLSearchParams({
        to_email:       toEmail,
        to_name:        toName,
        otp_code:       otpCode,
        session_title:  sessionTitle,
        expiry_minutes: "5",
      });
      const img = new Image();
      img.onload  = () => resolve();
      img.onerror = () => resolve(); // Apps Script returns JSON, not an image,
                                     // so onerror is expected — the GET still ran.
      img.src = cfg.url + "?" + params.toString();
      setTimeout(resolve, 3000); // Fallback: proceed after 3s regardless
    } catch (err) {
      reject(err);
    }
  });
}

function buildOtpEmailHtml(toName, otpCode, sessionTitle, expiryMinutes) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <style>
    @media only screen and (max-width:480px){
      .eo{padding:12px 6px!important}.ec{width:100%!important;border-radius:12px!important}
      .px{padding-left:16px!important;padding-right:16px!important}
      .oc{font-size:30px!important;letter-spacing:6px!important;text-indent:6px!important}
      .op{padding:18px 12px!important}.h1{font-size:20px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#1b3a5c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="eo" style="background-color:#1b3a5c;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ec"
  style="max-width:460px;width:100%;table-layout:fixed;background-color:#0d1b2a;border:1px solid #14344d;border-radius:16px;overflow:hidden;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td class="px" style="padding:22px 24px 0 24px;">
    <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;letter-spacing:2px;color:rgba(255,255,255,0.45);text-transform:uppercase;">&#9679;&nbsp; AI READY</p>
  </td></tr>
  <tr><td class="px" style="padding:20px 24px 0 24px;">
    <p style="margin:0 0 8px 0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;color:#00aeef;text-transform:uppercase;">Email Verification</p>
    <h1 class="h1" style="margin:0;font-size:24px;font-weight:700;color:#FFFFFF;line-height:1.3;">Enter your OTP</h1>
  </td></tr>
  <tr><td class="px" style="padding:20px 24px 0 24px;font-size:15px;color:#FFFFFF;line-height:1.6;">
    Hi <strong>\${toName}</strong>,<br/>
    <span style="font-size:14px;color:rgba(255,255,255,0.60);">Thanks for registering for <strong style="color:#FFFFFF;">\${sessionTitle}</strong>. Enter the code below to verify your email and confirm your spot.</span>
  </td></tr>
  <tr><td class="px" style="padding:24px 24px 0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#14344d;border:1px solid #1f5a7a;border-left:4px solid #00aeef;border-radius:10px;">
      <tr><td class="op" style="padding:24px;text-align:center;">
        <p style="margin:0 0 12px 0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.45);text-transform:uppercase;">4-Digit Code</p>
        <p class="oc" style="margin:0 0 12px 0;font-family:'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:#00aeef;line-height:1.1;text-indent:8px;word-break:break-all;">\${otpCode}</p>
        <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.45);">Expires in <strong style="color:rgba(255,255,255,0.60);">\${expiryMinutes} minutes</strong></p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td class="px" style="padding:24px 24px 0 24px;">
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.60);line-height:1.6;">Enter this code on the registration page to complete your sign-up. If you didn't request this, you can safely ignore this email.</p>
  </td></tr>
  <tr><td class="px" style="padding:20px 24px 24px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="border-top:1px solid #14344d;padding-top:18px;">
        <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.6;">For your security, this code can only be used once and expires in \${expiryMinutes} minutes. AI Ready will never ask for your password or payment details by email.</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td class="px" style="background-color:#1b3a5c;padding:16px 24px;">
    <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;color:rgba(255,255,255,0.45);text-align:center;letter-spacing:0.5px;">Registrations are stored securely and never shared with third parties.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
function gen4DigitOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// ── Generic email send via Apps Script (doPost) ──────────────────────────────
// Used for confirmation + bulk emails, which carry a configurable subject/body
// too large for the OTP image-GET. A no-cors POST can't be read back, but Apps
// Script still runs doPost (and sends the mail) before issuing its redirect, so
// this reliably triggers the send even though we can't confirm delivery.
async function postToAppsScript(cfg, payload){
  if(!cfg || !cfg.url) throw new Error("Apps Script URL not set. Add it in Admin → Settings.");
  const body = new URLSearchParams(payload);
  try{
    await fetch(cfg.url, { method:"POST", mode:"no-cors", body });
  }catch(e){ /* opaque response / network — best effort, ignore */ }
  return true;
}

// Replace {{name}}, {{email}}, {{session_title}}, {{session_date}} etc.
function renderTemplate(str, vars){
  return String(str==null?"":str).replace(/\{\{(\w+)\}\}/g, (_,k)=> (vars[k]!=null ? String(vars[k]) : ""));
}

const EMAIL_PLACEHOLDERS = ["name","email","session_title","session_date"];

// Wrap a message in the AI Ready branded email shell (matches app.jsx tokens).
// Frosted glass, email-safely: a navy base with cyan accent glows, and a
// translucent card. backdrop-filter gives real frost on WebKit clients (Apple
// Mail) and in the in-app preview; the rgba fill keeps it glassy on Gmail; the
// bgcolor attribute degrades to a solid navy panel on Outlook.
function buildBrandedEmail(opts){
  var o = opts || {};
  var bodyHtml = o.bodyHtml || "";
  var eyebrow = o.eyebrow || "AI Ready";
  var sessionTitle = o.sessionTitle || "";
  var sessionDate = o.sessionDate || "";
  // Session detail — simple frost-glass panel (fonts kept; no cyan accent).
  var sessionCard = sessionTitle ? (
    '<tr><td style="padding:22px 26px 0 26px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1c3e5e" style="background-color:rgba(255,255,255,0.05);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.12);border-radius:12px;">' +
        '<tr><td style="padding:16px 18px;">' +
          '<p style="margin:0;font-family:monospace;font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.50);text-transform:uppercase;">Session</p>' +
          '<p style="margin:6px 0 0 0;font-size:15px;font-weight:700;color:#FFFFFF;">' + sessionTitle + '</p>' +
          (sessionDate ? '<p style="margin:5px 0 0 0;font-size:13px;color:rgba(255,255,255,0.65);">' + sessionDate + '</p>' : '') +
        '</td></tr>' +
      '</table>' +
    '</td></tr>'
  ) : '';
  return '' +
  '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>' +
  '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>' +
  '<meta name="color-scheme" content="dark"/>' +
  '<style>html{scrollbar-width:thin;scrollbar-color:rgba(63,196,245,.35) transparent}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(63,196,245,.35);border-radius:999px}::-webkit-scrollbar-thumb:hover{background:rgba(63,196,245,.6)}</style></head>' +
  '<body style="margin:0;padding:0;background-color:#1b3a5c;">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1b3a5c" style="background-color:#1b3a5c;background-image:radial-gradient(circle at 12% -5%, rgba(0,174,239,0.30), rgba(0,174,239,0) 42%), radial-gradient(circle at 92% 108%, rgba(0,174,239,0.22), rgba(0,174,239,0) 48%);padding:40px 16px;">' +
  '<tr><td align="center">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#173a5b" style="max-width:480px;width:100%;background-color:rgba(19,39,62,0.72);background-image:linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 140px);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border:1px solid rgba(0,174,239,0.26);border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,0.35), 0 0 46px rgba(0,174,239,0.12);overflow:hidden;font-family:Arial,Helvetica,sans-serif;">' +
    // eyebrow label only (no brand row, no subject heading)
    '<tr><td style="padding:26px 26px 0 26px;"><p style="margin:0;font-family:monospace;font-size:11px;letter-spacing:2px;color:#00aeef;text-transform:uppercase;">' + eyebrow + '</p></td></tr>' +
    // body
    '<tr><td style="padding:16px 26px 0 26px;font-size:14px;color:rgba(255,255,255,0.82);line-height:1.7;">' + bodyHtml + '</td></tr>' +
    sessionCard +
    // footer
    '<tr><td style="padding:24px 26px 0 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid rgba(0,174,239,0.15);padding-top:16px;"><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.6;">You are receiving this because you registered with AI Ready.</p></td></tr></table></td></tr>' +
    '<tr><td style="padding:16px 26px 24px 26px;"><p style="margin:0;font-family:monospace;font-size:10px;color:rgba(255,255,255,0.40);text-align:center;letter-spacing:0.5px;">Registrations are stored securely and never shared with third parties.</p></td></tr>' +
  '</table>' +
  '</td></tr></table></body></html>';
}

const DEFAULT_TEMPLATES = {
  confirmation: {
    enabled: false,
    subject: "You're registered for {{session_title}}",
    body: "Hi {{name}},\n\nThanks for registering — your spot is confirmed. We look forward to seeing you there!"
  },
  bulk: {
    subject: "An update about {{session_title}}",
    body: "Hi {{name}},\n\n(Write your message here.)"
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// REGISTER VIEW  (public-facing) — 3 steps: form → otp → success
// ═══════════════════════════════════════════════════════════════════════════
function RegisterView(){
  const [sessions,  setSessions]  = useState([]);
  const [sess,      setSess]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [emailCfg,  setEmailCfg]  = useState(null); // { url, otpRequired }
  const [otpRequired, setOtpRequired] = useState(false);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  // Step 1 — form
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [nameErr,   setNameErr]   = useState("");
  const [emailErr,  setEmailErr]  = useState("");

  // Step 2 — OTP
  const [step,      setStep]      = useState("form"); // form | otp | success
  const [otp,       setOtp]       = useState("");          // stored OTP (memory only)
  const [otpSentAt, setOtpSentAt] = useState(null);
  const [otpInput,  setOtpInput]  = useState("");
  const [otpErr,    setOtpErr]    = useState("");
  const [attempts,  setAttempts]  = useState(0);
  const [sending,   setSending]   = useState(false);
  const [sendErr,   setSendErr]   = useState("");
  const [cooldown,  setCooldown]  = useState(0);   // seconds until resend allowed
  const [timeLeft,  setTimeLeft]  = useState(300); // seconds until OTP expires

  useEffect(()=>{
    (async()=>{
      const r  = await safeGet(SESSIONS_KEY);
      const all = r ? JSON.parse(r.value) : [];
      const list = all.filter(s => s.active); // only active sessions show publicly
      setSessions(list);
      if(list.length === 1) setSess(list[0]);
      // Load email config { url, otpRequired }
      const er = await safeGet(EMAIL_CFG_KEY);
      if(er){ const cfg = JSON.parse(er.value); setEmailCfg(cfg); setOtpRequired(!!cfg.otpRequired); }
      const tr = await safeGet(EMAIL_TEMPLATES_KEY);
      if(tr){ setTemplates({...DEFAULT_TEMPLATES, ...JSON.parse(tr.value)}); }
      setLoading(false);
    })();
  },[]);

  // Countdown timers
  useEffect(()=>{
    if(step !== "otp") return;
    const id = setInterval(()=>{
      const elapsed = Math.floor((Date.now() - otpSentAt) / 1000);
      setTimeLeft(Math.max(0, 300 - elapsed));
      setCooldown(c => Math.max(0, c - 1));
    }, 1000);
    return ()=> clearInterval(id);
  },[step, otpSentAt]);

  const validateForm = () => {
    let ok = true;
    if(!name.trim()){ setNameErr("Required"); ok=false; } else setNameErr("");
    if(!email.trim()){ setEmailErr("Required"); ok=false; }
    else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){ setEmailErr("Enter a valid email"); ok=false; }
    else setEmailErr("");
    return ok;
  };

  // Writes the registration to storage. Returns true on success.
  const saveRegistration = async (verified) => {
    const key  = regKey(sess.id);
    const ex   = await safeGet(key);
    const list = ex ? JSON.parse(ex.value) : [];
    const norm = email.trim().toLowerCase();
    if(list.some(r => r.email === norm)){
      setSendErr("This email is already registered for this session.");
      return false;
    }
    list.push({ name: name.trim(), email: norm, registeredAt: new Date().toISOString(), verified: !!verified });
    const ok = await safeSave(key, list);
    if(!ok){ setSendErr("Something went wrong. Please try again."); return false; }
    // Confirmation email (best effort — never blocks or fails the registration).
    try{
      const conf = templates && templates.confirmation;
      if(conf && conf.enabled && emailCfg && emailCfg.url){
        const vars = { name:name.trim(), email:norm, session_title:sess.title, session_date:sess.date||"" };
        const subject = renderTemplate(conf.subject, vars);
        const inner = renderTemplate(conf.body, vars).replace(/\n/g,"<br>");
        const html = buildBrandedEmail({ subject, bodyHtml:inner, eyebrow:"Registration confirmed", sessionTitle:sess.title, sessionDate:sess.date||"" });
        postToAppsScript(emailCfg, { type:"confirmation", to_email:norm, to_name:name.trim(), subject, html }).catch(()=>{});
      }
    }catch(e){ /* ignore — registration already saved */ }
    return true;
  };

  // Called by the Register / Send OTP button
  const handleRegister = async () => {
    if(!validateForm() || !sess) return;
    setSending(true); setSendErr("");
    // Duplicate check up front
    const key = regKey(sess.id);
    const ex  = await safeGet(key);
    const list = ex ? JSON.parse(ex.value) : [];
    if(list.some(r => r.email === email.trim().toLowerCase())){
      setSendErr("This email is already registered for this session.");
      setSending(false); return;
    }

    // ── OTP DISABLED: register immediately, no email needed ──
    if(!otpRequired){
      const ok = await saveRegistration(false);
      if(ok) setStep("success");
      setSending(false);
      return;
    }

    // ── OTP ENABLED: send the code, move to verification step ──
    if(!emailCfg || !emailCfg.url){
      setSendErr("OTP is enabled but no Apps Script URL is configured. Please contact the organiser.");
      setSending(false); return;
    }
    const code = gen4DigitOtp();
    try {
      await sendOtpEmail(emailCfg, email.trim(), name.trim(), code, sess.title);
      setOtp(code);
      setOtpSentAt(Date.now());
      setOtpInput(""); setOtpErr(""); setAttempts(0);
      setTimeLeft(300); setCooldown(60);
      setStep("otp");
    } catch(e) {
      const detail = (e && e.message) ? String(e.message).slice(0,200) : "Unknown error";
      setSendErr("Failed to send OTP: " + detail);
    }
    setSending(false);
  };

  const verifyOtp = async () => {
    if(timeLeft <= 0){ setOtpErr("OTP expired. Please request a new one."); return; }
    if(otpInput.trim() !== otp){
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if(newAttempts >= 3) setOtpErr("Too many wrong attempts. Please request a new OTP.");
      else setOtpErr(`Incorrect code. ${3 - newAttempts} attempt${3-newAttempts===1?"":"s"} left.`);
      return;
    }
    // OTP correct — complete registration
    setSending(true);
    const ok = await saveRegistration(true);
    if(ok) setStep("success");
    else setOtpErr(sendErr || "Registration failed. Please try again.");
    setSending(false);
  };

  const resendOtp = async () => {
    if(cooldown > 0 || sending) return;
    setSending(true); setSendErr("");
    const code = gen4DigitOtp();
    try {
      await sendOtpEmail(emailCfg, email.trim(), name.trim(), code, sess.title);
      setOtp(code); setOtpSentAt(Date.now());
      setOtpInput(""); setOtpErr(""); setAttempts(0);
      setTimeLeft(300); setCooldown(60);
    } catch(e) { const detail=(e&&e.message)?String(e.message).slice(0,200):"Unknown error"; setSendErr("Failed to resend: "+detail); }
    setSending(false);
  };

  const fmtTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const inpStyle = (err) => ({...iSty, border:`1px solid ${err?C.error+"CC":"rgba(255,255,255,0.06)"}`, fontSize:14, padding:"12px 16px", borderRadius:12, marginBottom: err?2:12});
  const lbl = (t) => <label style={{display:"block",fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em",marginBottom:6}}>{t} <span style={{color:C.accent}}>*</span></label>;

  if(loading) return(
    <div style={{display:"flex",alignItems:"center",gap:8,color:C.textFaint,marginTop:60}}>
      <Loader2 size={16} className="animate-spin"/>Loading...
    </div>
  );

  if(sessions.length === 0) return(
    <div className="rpad" style={{maxWidth:420,padding:36,textAlign:"center",...glass,marginTop:20}}>
      <Calendar size={28} color={C.textFaint} style={{margin:"0 auto 12px"}}/>
      <h2 style={{fontSize:18,fontWeight:600,marginBottom:8}}>No sessions available</h2>
      <p style={{fontSize:14,color:C.textDim,lineHeight:1.6}}>There are no open sessions right now. Check back soon.</p>
    </div>
  );

  // ── Session picker ────────────────────────────────────────────────────────
  if(!sess) return(
    <div style={{width:"100%",maxWidth:480,marginTop:20}}>
      <div className="rpad" style={{padding:"28px 32px 24px",...glass,marginBottom:16}}>
        <p style={{fontFamily:"monospace",fontSize:11,letterSpacing:"0.15em",color:C.accent,textTransform:"uppercase",marginBottom:8}}>AI Ready · Registration</p>
        <h1 style={{fontSize:22,fontWeight:700,marginBottom:6}}>Select your session</h1>
        <p style={{fontSize:13,color:C.textDim}}>Choose the session you'd like to register for.</p>
      </div>
      <div style={{display:"grid",gap:10}}>
        {sessions.map(s=>(
          <button key={s.id} data-testid={"session-option-"+s.id} onClick={()=>setSess(s)}
            style={{...glass,borderRadius:12,padding:"16px 20px",cursor:"pointer",textAlign:"left",width:"100%",transition:"border-color .2s",minHeight:84,boxSizing:"border-box"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent}
            onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(0,174,239,0.1)"}>
            {s.banner&&<img src={s.banner} alt="" style={{display:"block",width:"100%",height:96,objectFit:"cover",objectPosition:`${(s.bannerPos&&s.bannerPos.x)??50}% ${(s.bannerPos&&s.bannerPos.y)??50}%`,borderRadius:10,border:`1px solid ${C.border}`,marginBottom:12}}/>}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.4,margin:"0 0 5px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.title}</p>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:10,fontFamily:"monospace",color:C.accent,background:`${C.accent}18`,border:`1px solid ${C.accent}44`,borderRadius:4,padding:"2px 7px",flexShrink:0,whiteSpace:"nowrap"}}>{s.id}</span>
                  {s.date&&<span style={{fontSize:11,color:C.textFaint,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.date}</span>}
                </div>
              </div>
              <span style={{fontSize:14,color:C.accent,flexShrink:0}}>→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Success ───────────────────────────────────────────────────────────────
  if(step === "success") return(
    <div data-testid="register-success" className="rpad" style={{maxWidth:440,padding:36,textAlign:"center",...glass,marginTop:20}}>
      <div style={{width:52,height:52,margin:"0 auto 16px",borderRadius:"50%",background:`${C.accent}1A`,border:`1px solid ${C.accent}4D`,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Check color={C.accent} size={24}/>
      </div>
      <h2 style={{fontSize:20,fontWeight:700,marginBottom:8}}>You're registered!</h2>
      <p style={{fontSize:14,color:C.textDim,lineHeight:1.6,marginBottom:4}}><span style={{color:C.text,fontWeight:600}}>{sess.title}</span></p>
      {sess.date&&<p style={{fontSize:13,color:C.textFaint,marginBottom:16}}>{sess.date}</p>}
      <p style={{fontSize:13,color:C.textDim}}>Your email <span style={{color:C.text}}>{email}</span> has been verified and your spot is confirmed.</p>
      <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:20,flexWrap:"wrap"}}>
        <button onClick={()=>{setName("");setEmail("");setOtpInput("");setStep("form");}} style={{fontFamily:"monospace",fontSize:12,color:C.accent,background:"transparent",border:"none",cursor:"pointer",textDecoration:"underline"}}>Register another person</button>
        {sessions.length>1&&<button onClick={()=>{setName("");setEmail("");setOtpInput("");setStep("form");setSess(null);}} style={{fontFamily:"monospace",fontSize:12,color:C.textFaint,background:"transparent",border:"none",cursor:"pointer",textDecoration:"underline"}}>← Back to sessions</button>}
      </div>
    </div>
  );

  // ── OTP Verification step ─────────────────────────────────────────────────
  if(step === "otp") return(
    <div className="rpad" style={{width:"100%",maxWidth:420,padding:36,...glass,marginTop:20}}>
      {sessions.length>1&&(
        <button onClick={()=>setStep("form")} style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,background:"transparent",border:"none",cursor:"pointer",marginBottom:16,padding:0,display:"flex",alignItems:"center",gap:4}}>← Back</button>
      )}
      <p style={{fontFamily:"monospace",fontSize:11,letterSpacing:"0.15em",color:C.accent,textTransform:"uppercase",marginBottom:8}}>Email Verification</p>
      <h1 style={{fontSize:20,fontWeight:700,lineHeight:1.3,marginBottom:12}}>Enter your OTP</h1>
      <div style={{background:"rgba(0,174,239,0.08)",border:"1px solid rgba(0,174,239,0.25)",borderRadius:12,padding:"12px 14px",marginBottom:20}}>
        <p style={{fontSize:13,color:C.textDim,lineHeight:1.5,margin:0}}>
          A 4-digit code was sent to <span style={{color:C.text,fontWeight:600}}>{email}</span>. Enter it below to confirm your registration.
        </p>
      </div>

      {/* Timer */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontSize:12,color:timeLeft<60?C.error:C.textFaint}}>
          {timeLeft > 0 ? <>Expires in <span style={{fontFamily:"monospace",fontWeight:600}}>{fmtTime(timeLeft)}</span></> : "OTP expired"}
        </span>
        <button data-testid="otp-resend" onClick={resendOtp} disabled={cooldown>0||sending}
          style={{fontSize:12,color:cooldown>0||sending?C.textFaint:C.accent,background:"transparent",border:"none",cursor:cooldown>0||sending?"default":"pointer",textDecoration:"underline",padding:0}}>
          {cooldown>0?`Resend in ${cooldown}s`:"Resend OTP"}
        </button>
      </div>

      {/* OTP input */}
      <label style={{display:"block",fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em",marginBottom:6}}>4-DIGIT CODE</label>
      <div onKeyDown={e=>{if(e.key==="Enter"&&!sending&&attempts<3&&timeLeft>0) verifyOtp();}}>
        <input
          data-testid="otp-input"
          type="text" inputMode="numeric" maxLength={4}
          value={otpInput} onChange={e=>{ setOtpInput(e.target.value.replace(/\D/g,"")); setOtpErr(""); }}
          placeholder="••••"
          style={{...iSty, fontSize:28, padding:"12px 14px", borderRadius:12, letterSpacing:"0.4em", textAlign:"center", marginBottom: otpErr?4:12,
            border:`1px solid ${otpErr?C.error+"CC":"rgba(255,255,255,0.06)"}`}}
          onFocus={fi} onBlur={fo}
          autoFocus
        />
        {otpErr&&<p style={{fontSize:12,color:C.error,marginBottom:12}}>{otpErr}</p>}
        {sendErr&&<p style={{fontSize:12,color:C.error,marginBottom:12}}>{sendErr}</p>}
        <button data-testid="otp-verify" onClick={verifyOtp} disabled={otpInput.length!==4||sending||attempts>=3||timeLeft<=0}
          className={otpInput.length!==4||sending||attempts>=3||timeLeft<=0?"":"neon-glow"}
          style={{width:"100%",background:C.accent,color:C.bg,fontWeight:700,fontSize:14,border:"none",borderRadius:12,padding:"12px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:otpInput.length!==4||sending||attempts>=3||timeLeft<=0?"default":"pointer",opacity:otpInput.length!==4||attempts>=3||timeLeft<=0?.5:1,transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}
          onMouseEnter={e=>{if(otpInput.length===4&&!sending&&attempts<3&&timeLeft>0)ctaHover(e);}}
          onMouseLeave={ctaLeave}>
          {sending?<><Loader2 size={14} className="animate-spin"/>Verifying...</>:"Verify & Register"}
        </button>
      </div>
    </div>
  );

  // ── Step 1: Registration form (with optional side poster) ─────────────────
  const hasPoster = !!sess.banner;
  return(
    <div style={{width:"100%",maxWidth: hasPoster?980:440, marginTop:20}}>
      {sessions.length>1&&(
        <button onClick={()=>setSess(null)} style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,background:"transparent",border:"none",cursor:"pointer",marginBottom:12,padding:0,display:"flex",alignItems:"center",gap:4}}>
          ← All sessions
        </button>
      )}
      <div className={"reg-card"+(hasPoster?" has-poster":"")} style={{...glass,borderRadius:20}}>
        {hasPoster&&(
          <div className="reg-poster">
            <img src={sess.banner} alt={sess.title} style={{objectPosition:`${(sess.bannerPos&&sess.bannerPos.x)??50}% ${(sess.bannerPos&&sess.bannerPos.y)??50}%`}}/>
          </div>
        )}
        <div className="reg-form">
      <p className="reg-eyebrow" style={{fontFamily:"monospace",fontSize:11,letterSpacing:"0.15em",color:C.accent,textTransform:"uppercase"}}>Registration · {sess.id}</p>
      <h1 style={{fontSize:24,fontWeight:700,lineHeight:1.32,letterSpacing:"-0.01em",marginBottom:6}}>{sess.title}</h1>
      {sess.date&&<p style={{fontSize:13,color:C.textFaint,marginBottom:sess.description?10:4}}>{sess.date}</p>}
      {sess.description&&<p style={{fontSize:13,color:C.textDim,lineHeight:1.6,marginBottom:22}}>{sess.description}</p>}
      <div style={{height:1,background:"linear-gradient(to right, rgba(0,174,239,0.18), rgba(255,255,255,0))",marginBottom:22}}/>
      <div onKeyDown={e=>{if(e.key==="Enter"&&!sending) handleRegister();}}>
        {lbl("FULL NAME")}
        <input data-testid="register-name-input" type="text" value={name} onChange={e=>{setName(e.target.value);setNameErr("");}} placeholder="Ada Lovelace" style={inpStyle(nameErr)} onFocus={fi} onBlur={fo}/>
        {nameErr&&<p style={{fontSize:11,color:C.error,margin:"2px 0 8px"}}>{nameErr}</p>}
        {lbl("EMAIL ADDRESS")}
        <input data-testid="register-email-input" type="email" value={email} onChange={e=>{setEmail(e.target.value);setEmailErr("");}} placeholder="ada@company.com" style={inpStyle(emailErr)} onFocus={fi} onBlur={fo}/>
        {emailErr&&<p style={{fontSize:11,color:C.error,margin:"2px 0 8px"}}>{emailErr}</p>}
        {sendErr&&<div style={{display:"flex",gap:8,fontSize:13,color:C.error,background:`${C.error}1A`,border:`1px solid ${C.error}4D`,borderRadius:12,padding:"9px 12px",marginBottom:12}}><AlertCircle size={14} style={{flexShrink:0,marginTop:2}}/>{sendErr}</div>}
        <button data-testid="register-submit" onClick={handleRegister} disabled={sending}
          className={sending?"":"neon-glow"}
          style={{width:"100%",background:C.accent,color:C.bg,fontWeight:700,fontSize:14,border:"none",borderRadius:12,padding:"12px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:sending?"default":"pointer",opacity:sending?.6:1,marginTop:4,transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}
          onMouseEnter={e=>{if(!sending)ctaHover(e);}}
          onMouseLeave={ctaLeave}>
          {sending
            ? <><Loader2 size={14} className="animate-spin"/>{otpRequired?"Sending OTP...":"Registering..."}</>
            : (otpRequired ? "Send OTP" : "Register")}
        </button>
        <p style={{fontSize:11,color:C.textFaint,textAlign:"center",marginTop:10}}>
          {otpRequired
            ? "A 4-digit code will be sent to your email to verify your registration."
            : "Your details will be recorded for this session."}
        </p>
      </div>
        </div>
      </div>
    </div>
  );
}


function AdminView(){
  const __restored = loadAdminSession();
  const [authed,setAuthed]=useState(!!__restored);
  const [aName,setAName]=useState(""); const [pc,setPc]=useState("");
  const [authErr,setAuthErr]=useState(""); const [authBusy,setAuthBusy]=useState(false);
  const [admins,setAdmins]=useState([]); const [me,setMe]=useState(__restored);
  const [tab,setTab]=useState("sessions");
  const [sessions,setSessions]=useState([]);
  const [selSid,setSelSid]=useState(null);
  const [allRegs,setAllRegs]=useState({});
  const [dl,setDl]=useState(true);

  const loadAll=useCallback(async()=>{
    setDl(true);
    const sr=await safeGet(SESSIONS_KEY);
    const list=sr?JSON.parse(sr.value):[];
    setSessions(list);
    const map={};
    for(const s of list){const r=await safeGet(regKey(s.id));map[s.id]=r?JSON.parse(r.value):[];}
    setAllRegs(map);
    if(list.length>0) setSelSid(s=>(s&&list.find(x=>x.id===s))?s:(list.find(x=>x.active)||list[0]).id);
    setDl(false);
  },[]);

  const loadAdmins=useCallback(async()=>{const r=await safeGet(ADMIN_KEY);const l=r?JSON.parse(r.value):[];setAdmins(l);return l;},[]);
  useEffect(()=>{if(authed){loadAll();loadAdmins();}},[authed]);

  // Effective permissions — read from the live admins list so changes apply
  // without needing a re-login; fall back to the persisted session before load.
  const meAdmin = admins.find(a=>a.id===me?.id);
  const isSuper = meAdmin ? isSuperAdmin(meAdmin, admins) : !!me?.super;
  const perms   = meAdmin ? permsOf(meAdmin) : (me?.perms || {});
  const can = (k)=> isSuper || !!perms[k];

  const visibleTabs=[];
  if(can("sessions"))      visibleTabs.push(["sessions","Sessions"]);
  if(can("registrations")) visibleTabs.push(["registrations","Registrations"]);
  if(can("activity"))      visibleTabs.push(["activity","Activity"]);
  if(can("emails"))        visibleTabs.push(["emails","Emails"]);
  if(isSuper)              visibleTabs.push(["permissions","Permissions"]);
  visibleTabs.push(["settings","Settings"]); // always available (self-service passcode)

  // Keep the selected tab within what this admin may access. Declared here (a
  // hook) BEFORE any early return so hook order stays stable across renders.
  useEffect(()=>{
    if(!authed) return;
    const ids = visibleTabs.map(t=>t[0]);
    if(!ids.includes(tab)) setTab(ids[0]||"settings");
  },[authed, tab, isSuper, JSON.stringify(perms)]);

  const handleAuth=async()=>{
    setAuthBusy(true);setAuthErr("");
    const hash=await hashPC(pc);
    let list=await loadAdmins();
    if(list.length===0){
      if(pc===BOOTSTRAP_PASSCODE){
        const owner={id:uid(),name:aName.trim()||"Owner",passcodeHash:hash,super:true};
        await safeSave(ADMIN_KEY,[owner]);setAdmins([owner]);
        const meObj={id:owner.id,name:owner.name,super:true,perms:{}};
        setMe(meObj);saveAdminSession(meObj);
        await logActivity(meObj.name,"Signed in","Bootstrapped owner account");
        setAuthed(true);setPc("");setAName("");setAuthBusy(false);return;
      }
      setAuthErr("Incorrect admin name or passcode.");setAuthBusy(false);return;
    }
    const nl=aName.trim().toLowerCase();
    const match=list.find(a=>a.name.toLowerCase()===nl&&a.passcodeHash===hash);
    if(match){const meObj={id:match.id,name:match.name,super:isSuperAdmin(match,list),perms:match.perms||{}};setMe(meObj);saveAdminSession(meObj);await logActivity(meObj.name,"Signed in","");setAuthed(true);setPc("");setAName("");}
    else setAuthErr("Incorrect admin name or passcode.");
    setAuthBusy(false);
  };

  if(!authed) return(
    <div className="rpad" style={{width:"100%",maxWidth:380,padding:32,...glass,marginTop:20}}>
      <p style={{fontFamily:"monospace",fontSize:11,letterSpacing:"0.15em",color:C.accent,textTransform:"uppercase",marginBottom:10}}>Admin</p>
      <h1 style={{fontSize:20,fontWeight:600,marginBottom:20}}>Sign in</h1>
      <div onKeyDown={e=>{if(e.key==="Enter")handleAuth();}}>
        <label style={{display:"block",fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em",marginBottom:6}}>ADMIN NAME</label>
        <input data-testid="admin-name-input" type="text" value={aName} onChange={e=>setAName(e.target.value)} placeholder="e.g. Owner" autoFocus style={{...iSty,marginBottom:12,fontSize:14}} onFocus={fi} onBlur={fo}/>
        <label style={{display:"block",fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em",marginBottom:6}}>PASSCODE</label>
        <input data-testid="admin-passcode-input" type="password" value={pc} onChange={e=>setPc(e.target.value)} placeholder="••••••••" style={{...iSty,marginBottom:12,fontSize:14}} onFocus={fi} onBlur={fo}/>
        {authErr&&<p style={{fontSize:11,color:C.error,marginBottom:12}}>{authErr}</p>}
        <button data-testid="admin-signin" type="button" onClick={handleAuth} disabled={authBusy}
          style={{width:"100%",background:C.accent,color:C.bg,fontWeight:700,fontSize:14,border:"none",borderRadius:12,padding:"10px",cursor:authBusy?"default":"pointer",opacity:authBusy?.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}
          onMouseEnter={e=>{if(!authBusy)ctaHover(e);}} onMouseLeave={ctaLeave}>
          {authBusy?<><Loader2 size={14} className="animate-spin"/>Checking...</>:"Sign in"}
        </button>
      </div>
    </div>
  );

  const handleLogout=async()=>{ await logActivity(me?.name,"Signed out",""); clearAdminSession(); setAuthed(false); setMe(null); setTab("sessions"); };
  return(
    <div style={{width:"100%",maxWidth:980,marginTop:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <p style={{fontFamily:"monospace",fontSize:11,letterSpacing:"0.15em",color:C.accent,textTransform:"uppercase",marginBottom:4}}>Admin · {me?.name}</p>
          <h1 style={{fontSize:20,fontWeight:700}}>Dashboard</h1>
        </div>
        <div className="rfs" style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",maxWidth:"100%",overflowX:"auto",paddingBottom:2}}>
          {visibleTabs.map(([t,l])=>(
            <button key={t} data-testid={"tab-"+t} onClick={()=>setTab(t)} style={{fontFamily:"monospace",fontSize:12,border:`1px solid ${tab===t?C.accent:C.border}`,color:tab===t?C.accent:C.textFaint,background:"transparent",borderRadius:8,padding:"7px 12px",cursor:"pointer"}}>{l}</button>
          ))}
          <button data-testid="admin-logout" onClick={handleLogout} title="Log out" style={{fontFamily:"monospace",fontSize:12,border:`1px solid ${C.error}66`,color:C.error,background:"transparent",borderRadius:8,padding:"7px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            <LogOut size={13}/>Logout
          </button>
        </div>
      </div>
      {tab==="sessions"&&can("sessions")&&<SessionsTab me={me} sessions={sessions} setSessions={setSessions} allRegs={allRegs} selSid={selSid} setSelSid={setSelSid} setTab={setTab} reload={loadAll}/>}
      {tab==="registrations"&&can("registrations")&&<RegistrationsTab me={me} sessions={sessions} allRegs={allRegs} setAllRegs={setAllRegs} selSid={selSid} setSelSid={setSelSid} loading={dl} reload={loadAll}/>}
      {tab==="activity"&&can("activity")&&<ActivityTab me={me} isSuper={isSuper}/>}
      {tab==="emails"&&can("emails")&&<EmailsTab me={me} sessions={sessions} allRegs={allRegs}/>}
      {tab==="permissions"&&isSuper&&<PermissionsTab me={me} admins={admins} setAdmins={setAdmins} reload={loadAll}/>}
      {tab==="settings"&&<SettingsTab admins={admins} setAdmins={setAdmins} me={me} isSuper={isSuper} perms={perms} setAuthed={setAuthed} setMe={setMe}/>}
    </div>
  );
}

// ── DateTimePicker — frost-glass date & time picker matching the app style ──
// The input stays freely editable; the calendar button opens a themed popover.
// Applies the app's standard format: "15 Aug 2026 · 3:00 PM IST".
const DTP_MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DTP_TIMEZONES=["IST","UTC","GMT","BST","CET","CEST","EET","GST","SGT","HKT","JST","KST","AEST","AEDT","NZST","EST","EDT","CST","CDT","MST","MDT","PST","PDT","BRT"];
function DateTimePicker({value,onChange,placeholder,testid,inputStyle}){
  const [open,setOpen]=useState(false);
  const [view,setView]=useState(()=>{const n=new Date();return {y:n.getFullYear(),m:n.getMonth()};});
  const [selDay,setSelDay]=useState(null);   // {y,m,d}
  const [hh,setHh]=useState(3); const [mm,setMm]=useState(0); const [ap,setAp]=useState("PM");
  const [tz,setTz]=useState("IST");

  // When opening, try to prefill from the current value if it matches our format.
  const openPicker=()=>{
    const m=/^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) · (\d{1,2}):(\d{2}) (AM|PM)(?: ([A-Z]{2,5}))?/.exec((value||"").trim());
    if(m){
      const y=+m[3], mo=DTP_MONTHS.indexOf(m[2]), d=+m[1];
      setView({y,m:mo}); setSelDay({y,m:mo,d});
      setHh(+m[4]); setMm(+m[5]); setAp(m[6]);
      if(m[7]&&DTP_TIMEZONES.includes(m[7])) setTz(m[7]);
    } else {
      const n=new Date(); setView({y:n.getFullYear(),m:n.getMonth()}); setSelDay(null);
    }
    setOpen(true);
  };

  const daysIn=(y,m)=>new Date(y,m+1,0).getDate();
  const firstDow=(y,m)=>new Date(y,m,1).getDay(); // 0=Sun
  const nav=(d)=>setView(v=>{let m=v.m+d,y=v.y; if(m<0){m=11;y--;} if(m>11){m=0;y++;} return {y,m};});
  const apply=()=>{
    if(!selDay) return;
    const str=`${selDay.d} ${DTP_MONTHS[selDay.m]} ${selDay.y} · ${hh}:${String(mm).padStart(2,"0")} ${ap} ${tz}`;
    onChange(str); setOpen(false);
  };
  const clear=()=>{ onChange(""); setOpen(false); };
  const today=new Date();
  const isToday=(d)=>view.y===today.getFullYear()&&view.m===today.getMonth()&&d===today.getDate();
  const isSel=(d)=>selDay&&selDay.y===view.y&&selDay.m===view.m&&selDay.d===d;
  const selBtn={background:"rgba(255,255,255,0.07)",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 8px",fontSize:12,color:C.text,outline:"none",cursor:"pointer"};

  const grid=[];
  const lead=firstDow(view.y,view.m);
  for(let i=0;i<lead;i++) grid.push(null);
  for(let d=1;d<=daysIn(view.y,view.m);d++) grid.push(d);

  return(
    <div style={{position:"relative"}}>
      <div style={{position:"relative"}}>
        <input data-testid={testid} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          style={{...(inputStyle||iSty),paddingRight:38}} onFocus={fi} onBlur={fo}/>
        <button type="button" data-testid={testid?testid+"-toggle":undefined} onClick={()=>open?setOpen(false):openPicker()}
          title="Pick date & time"
          style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",cursor:"pointer",color:open?C.accent:C.textFaint,display:"flex",alignItems:"center",padding:6}}>
          <Calendar size={15}/>
        </button>
      </div>
      {open&&(
        <div data-testid={testid?testid+"-backdrop":undefined} onClick={()=>setOpen(false)}
          style={{position:"fixed",inset:0,zIndex:40,display:"flex",alignItems:"center",justifyContent:"center",padding:16,
            background:"rgba(13,27,42,0.25)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
        <div data-testid={testid?testid+"-popover":undefined} className="rfs" onClick={e=>e.stopPropagation()}
          style={{zIndex:41,width:290,maxWidth:"100%",maxHeight:"min(480px, calc(100vh - 32px))",overflowY:"auto",padding:14,...glass,background:"rgba(13,27,42,0.92)",boxShadow:"0 12px 40px rgba(0,0,0,0.45), 0 0 30px rgba(0,174,239,0.10)"}}>
          {/* month nav */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <button type="button" onClick={()=>nav(-1)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textFaint,borderRadius:6,padding:"3px 9px",cursor:"pointer",fontSize:13}}>‹</button>
            <span style={{fontFamily:"monospace",fontSize:12,letterSpacing:"0.08em",color:C.text}}>{DTP_MONTHS[view.m]} {view.y}</span>
            <button type="button" onClick={()=>nav(1)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textFaint,borderRadius:6,padding:"3px 9px",cursor:"pointer",fontSize:13}}>›</button>
          </div>
          {/* dow header */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
            {["S","M","T","W","T","F","S"].map((d,i)=><span key={i} style={{textAlign:"center",fontFamily:"monospace",fontSize:10,color:C.textFaint}}>{d}</span>)}
          </div>
          {/* day grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:12}}>
            {grid.map((d,i)=> d===null
              ? <span key={i}/>
              : <button key={i} type="button" onClick={()=>setSelDay({y:view.y,m:view.m,d})}
                  style={{aspectRatio:"1",border:isSel(d)?`1px solid ${C.accent}`:isToday(d)?`1px solid ${C.accent}55`:"1px solid transparent",
                    background:isSel(d)?C.accent:"transparent",color:isSel(d)?C.bg:C.text,fontWeight:isSel(d)?700:400,
                    borderRadius:8,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}
                  onMouseEnter={e=>{if(!isSel(d)){e.currentTarget.style.background="rgba(0,174,239,0.12)";}}}
                  onMouseLeave={e=>{if(!isSel(d)){e.currentTarget.style.background="transparent";}}}>
                  {d}
                </button>
            )}
          </div>
          {/* time */}
          <label style={{display:"block",fontFamily:"monospace",fontSize:10,color:C.textFaint,letterSpacing:"0.08em",marginBottom:6}}>TIME</label>
          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:12}}>
            <select value={hh} onChange={e=>setHh(+e.target.value)} style={selBtn}>
              {Array.from({length:12},(_,i)=>i+1).map(h=><option key={h} value={h} style={{background:C.bgPanel}}>{h}</option>)}
            </select>
            <span style={{color:C.textFaint}}>:</span>
            <select value={mm} onChange={e=>setMm(+e.target.value)} style={selBtn}>
              {[0,5,10,15,20,25,30,35,40,45,50,55].map(m=><option key={m} value={m} style={{background:C.bgPanel}}>{String(m).padStart(2,"0")}</option>)}
            </select>
            <div style={{display:"flex",gap:4,marginLeft:4}}>
              {["AM","PM"].map(p=>(
                <button key={p} type="button" onClick={()=>setAp(p)} style={{fontFamily:"monospace",fontSize:11,border:`1px solid ${ap===p?C.accent:C.border}`,color:ap===p?C.accent:C.textFaint,background:ap===p?"rgba(0,174,239,0.10)":"transparent",borderRadius:6,padding:"6px 9px",cursor:"pointer"}}>{p}</button>
              ))}
            </div>
            <select data-testid={testid?testid+"-tz":undefined} value={tz} onChange={e=>setTz(e.target.value)} style={{...selBtn,marginLeft:"auto",fontFamily:"monospace",fontSize:11}} title="Timezone">
              {DTP_TIMEZONES.map(z=><option key={z} value={z} style={{background:C.bgPanel}}>{z}</option>)}
            </select>
          </div>
          {/* actions */}
          <div style={{display:"flex",gap:8}}>
            <button type="button" data-testid={testid?testid+"-apply":undefined} onClick={apply} disabled={!selDay}
              onMouseEnter={e=>{if(selDay)ctaHover(e);}} onMouseLeave={ctaLeave}
              style={{flex:1,background:C.accent,color:C.bg,fontWeight:700,fontSize:13,border:"none",borderRadius:10,padding:"8px",cursor:selDay?"pointer":"default",opacity:selDay?1:.5,transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}>Apply</button>
            <button type="button" onClick={clear} onMouseEnter={secHover} onMouseLeave={secLeave}
              style={{background:"transparent",color:C.textFaint,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 12px",cursor:"pointer",fontSize:13,transition:"all 500ms cubic-bezier(0.4,0,0.2,1)"}}>Clear</button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

// ── BannerUpload — themed image uploader for a session banner ───────────────
// Stores the image as a data-URL string so it travels with the session record
// through the app's existing storage (Supabase/localStorage/in-memory) unchanged.
const BANNER_MAX_BYTES = 2.5 * 1024 * 1024; // 2.5 MB
function BannerUpload({value,pos,onChange,onPosChange,testid}){
  const [err,setErr]=useState("");
  const [drag,setDrag]=useState(false);        // file drag-over state
  const inputRef = React.useRef(null);
  const frameRef = React.useRef(null);
  const natRef   = React.useRef({w:0,h:0});    // image natural size
  const dragRef  = React.useRef(null);         // active reposition drag
  const [grabbing,setGrabbing]=useState(false);
  const p = pos || {x:50,y:50};

  const handleFile=(file)=>{
    setErr("");
    if(!file) return;
    if(!/^image\//.test(file.type)){ setErr("Please choose an image file."); return; }
    if(file.size>BANNER_MAX_BYTES){ setErr("Image is too large (max 2.5 MB). Try a smaller/compressed one."); return; }
    const reader=new FileReader();
    reader.onload=()=>{ onChange(String(reader.result||"")); onPosChange&&onPosChange({x:50,y:50}); };
    reader.onerror=()=>setErr("Couldn't read that file. Please try again.");
    reader.readAsDataURL(file);
  };

  const clamp=(v)=>Math.max(0,Math.min(100,v));
  const onImgLoad=e=>{ natRef.current={w:e.target.naturalWidth||0,h:e.target.naturalHeight||0}; };
  // Drag to reposition: map pointer movement to object-position %, using the
  // amount the covered image overflows the frame on each axis.
  const startDrag=(e)=>{
    if(!onPosChange||!frameRef.current) return;
    const r=frameRef.current.getBoundingClientRect();
    const {w:nw,h:nh}=natRef.current;
    if(!nw||!nh||!r.width||!r.height) return;
    const scale=Math.max(r.width/nw, r.height/nh);
    const overX=Math.max(0, nw*scale - r.width);
    const overY=Math.max(0, nh*scale - r.height);
    if(overX<=0 && overY<=0) return; // nothing to pan
    dragRef.current={ sx:e.clientX, sy:e.clientY, px:p.x, py:p.y, overX, overY };
    setGrabbing(true);
    try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(_){}
  };
  const moveDrag=(e)=>{
    const d=dragRef.current; if(!d) return;
    const nx = d.overX>0 ? clamp(d.px - ((e.clientX-d.sx)/d.overX)*100) : d.px;
    const ny = d.overY>0 ? clamp(d.py - ((e.clientY-d.sy)/d.overY)*100) : d.py;
    onPosChange({x:nx,y:ny});
  };
  const endDrag=(e)=>{ if(!dragRef.current) return; dragRef.current=null; setGrabbing(false); try{ e.currentTarget.releasePointerCapture(e.pointerId); }catch(_){} };

  const chipBtn={background:"rgba(13,27,42,0.8)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"5px 9px",cursor:"pointer",fontSize:11,fontFamily:"monospace",display:"flex",alignItems:"center",gap:5};

  return(
    <div>
      <input ref={inputRef} data-testid={testid?testid+"-file":undefined} type="file" accept="image/*"
        onChange={e=>{handleFile(e.target.files&&e.target.files[0]); e.target.value="";}}
        style={{display:"none"}}/>
      {value ? (
        <div ref={frameRef} data-testid={testid?testid+"-frame":undefined} style={{position:"relative",marginTop:5,height:180,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`,touchAction:"none"}}>
          <img src={value} alt="Session poster" draggable={false} onLoad={onImgLoad}
            data-testid={testid?testid+"-img":undefined}
            onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
            style={{display:"block",width:"100%",height:"100%",objectFit:"cover",objectPosition:`${p.x}% ${p.y}%`,cursor:grabbing?"grabbing":"grab",userSelect:"none"}}/>
          {/* reposition hint */}
          <div style={{position:"absolute",left:8,bottom:8,display:"flex",alignItems:"center",gap:5,background:"rgba(13,27,42,0.8)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 9px",fontFamily:"monospace",fontSize:10,color:C.textFaint,pointerEvents:"none"}}>
            <ArrowUpDown size={11}/> Drag image to reposition
          </div>
          <div style={{position:"absolute",top:8,right:8,display:"flex",gap:6}}>
            <button type="button" data-testid={testid?testid+"-recenter":undefined} onClick={()=>onPosChange&&onPosChange({x:50,y:50})} title="Recenter" style={chipBtn}>
              Recenter
            </button>
            <button type="button" data-testid={testid?testid+"-replace":undefined} onClick={()=>inputRef.current&&inputRef.current.click()} style={chipBtn}>
              <UploadCloud size={12}/>Replace
            </button>
            <button type="button" data-testid={testid?testid+"-remove":undefined} onClick={()=>{onChange("");setErr("");onPosChange&&onPosChange({x:50,y:50});}}
              style={{...chipBtn,border:`1px solid ${C.error}66`,color:C.error,padding:"5px 7px"}} title="Remove poster">
              <X size={13}/>
            </button>
          </div>
        </div>
      ) : (
        <button type="button" data-testid={testid} onClick={()=>inputRef.current&&inputRef.current.click()}
          onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files&&e.dataTransfer.files[0]);}}
          style={{marginTop:5,width:"100%",background:drag?"rgba(0,174,239,0.06)":"rgba(255,255,255,0.03)",border:`1px dashed ${drag?C.accent:"rgba(0,174,239,0.28)"}`,borderRadius:12,padding:"20px 16px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:8,transition:"all 200ms cubic-bezier(0.4,0,0.2,1)",color:C.textFaint}}>
          <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(0,174,239,0.10)",border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",color:C.accent}}>
            <ImageIcon size={18}/>
          </div>
          <span style={{fontSize:13,color:C.textDim}}>Click or drop an image to upload a session poster</span>
          <span style={{fontSize:11,color:C.textFaint}}>Shown beside the form · PNG, JPG or WEBP · up to 2.5 MB</span>
        </button>
      )}
      {err&&<p style={{fontSize:12,color:C.error,margin:"6px 0 0"}}>{err}</p>}
    </div>
  );
}

function StatCard({label,value,small}){
  return(
    <div style={{...glass,padding:"16px 20px"}}>
      <p style={{fontFamily:"monospace",fontSize:10,color:C.textFaint,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>{label}</p>
      <p style={{fontSize:small?14:24,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</p>
    </div>
  );
}

function SessionsTab({me,sessions,setSessions,allRegs,selSid,setSelSid,setTab,reload}){
  const [showForm,setShowForm]=useState(false);
  const [title,setTitle]=useState(""); const [desc,setDesc]=useState(""); const [date,setDate]=useState(""); const [banner,setBanner]=useState(""); const [bannerPos,setBannerPos]=useState({x:50,y:50});
  const [fErr,setFErr]=useState(""); const [busy,setBusy]=useState(false);
  const [confDel,setConfDel]=useState(null);
  const [editSid,setEditSid]=useState(null);    // session being edited
  const [editDraft,setEditDraft]=useState({});   // { title, date, description }
  const [editErr,setEditErr]=useState("");
  const [editBusy,setEditBusy]=useState(false);

  const create=async()=>{
    if(!title.trim()){setFErr("Session title is required.");return;}
    setBusy(true);setFErr("");
    const s={id:"session-"+Date.now(),title:title.trim(),description:desc.trim(),date:date.trim(),banner:banner||"",bannerPos,active:true,createdAt:new Date().toISOString()};
    const next=[...sessions,s];
    const ok=await safeSave(SESSIONS_KEY,next);
    if(ok){await logActivity(me?.name,"Created session",`${s.title} [${s.id}]`);setSessions(next);setTitle("");setDesc("");setDate("");setBanner("");setBannerPos({x:50,y:50});setShowForm(false);}
    else setFErr("Failed to save.");
    setBusy(false);
  };

  const startEdit=(s)=>{
    setEditSid(s.id);
    setEditDraft({title:s.title,date:s.date||"",description:s.description||"",banner:s.banner||"",bannerPos:s.bannerPos||{x:50,y:50}});
    setEditErr("");
    setConfDel(null);
  };
  const cancelEdit=()=>{ setEditSid(null); setEditDraft({}); setEditErr(""); };

  const saveEdit=async()=>{
    if(!editDraft.title?.trim()){setEditErr("Title is required.");return;}
    setEditBusy(true);setEditErr("");
    const next=sessions.map(s=>s.id===editSid?{...s,title:editDraft.title.trim(),date:editDraft.date.trim(),description:editDraft.description.trim(),banner:editDraft.banner||"",bannerPos:editDraft.bannerPos||{x:50,y:50}}:s);
    const ok=await safeSave(SESSIONS_KEY,next);
    if(ok){await logActivity(me?.name,"Edited session",`${editDraft.title.trim()} [${editSid}]`);setSessions(next);cancelEdit();}
    else setEditErr("Failed to save. Try again.");
    setEditBusy(false);
  };

  const toggleActive=async(s)=>{
    const next=sessions.map(x=>x.id===s.id?{...x,active:!x.active}:x);
    const ok=await safeSave(SESSIONS_KEY,next);
    if(ok){await logActivity(me?.name,s.active?"Deactivated session":"Activated session",`${s.title} [${s.id}]`);setSessions(next);}
  };

  const del=async(sid)=>{
    const gone=sessions.find(s=>s.id===sid);
    const next=sessions.filter(s=>s.id!==sid);
    if(await safeSave(SESSIONS_KEY,next)){
      await logActivity(me?.name,"Deleted session",gone?`${gone.title} [${sid}]`:sid);
      setSessions(next);setConfDel(null);
      if(selSid===sid&&next.length>0) setSelSid(next[0].id);
    }
  };

  const totalRegs=Object.values(allRegs).reduce((a,b)=>a+b.length,0);
  const uniqueUsers=new Set(Object.values(allRegs).flat().map(r=>r.email)).size;

  return(
    <div style={{display:"grid",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
        <StatCard label="Total Sessions" value={sessions.length}/>
        <StatCard label="Total Registrations" value={totalRegs}/>
        <StatCard label="Unique Attendees" value={uniqueUsers}/>
      </div>

      <div style={{...glass,padding:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <h2 style={{fontSize:15,fontWeight:600}}>All sessions</h2>
          <button data-testid="session-new-btn" onClick={()=>{setShowForm(f=>!f);cancelEdit();}} onMouseEnter={ctaHover} onMouseLeave={ctaLeave} style={{background:C.accent,color:C.bg,fontWeight:600,fontSize:12,border:"none",borderRadius:12,padding:"7px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}>
            <Plus size={14}/>New session
          </button>
        </div>

        {showForm&&(
          <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:14,display:"grid",gap:10}}>
            <h3 style={{fontSize:13,fontWeight:600,color:C.textDim}}>Create new session</h3>
            <div>
              <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>SESSION TITLE *</label>
              <input data-testid="session-title-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. AI Basics for Teams" style={{...iSty,marginTop:5}} onFocus={fi} onBlur={fo}/>
            </div>
            <div>
              <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>DATE / TIME</label>
              <div style={{marginTop:5}}><DateTimePicker testid="session-date-input" value={date} onChange={setDate} placeholder="e.g. 15 Aug 2026 · 3:00 PM IST"/></div>
            </div>
            <div>
              <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>DESCRIPTION</label>
              <textarea className="rfs" data-testid="session-desc-input" value={desc} onChange={e=>setDesc(e.target.value)} rows={2} placeholder="Short description shown on the registration form..." style={{...iSty,marginTop:5,resize:"vertical",fontFamily:"inherit"}} onFocus={fi} onBlur={fo}/>
            </div>
            <div>
              <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>BANNER IMAGE</label>
              <BannerUpload testid="session-banner" value={banner} pos={bannerPos} onChange={setBanner} onPosChange={setBannerPos}/>
            </div>
            {fErr&&<p style={{fontSize:12,color:C.error}}>{fErr}</p>}
            <div style={{display:"flex",gap:8}}>
              <button data-testid="session-create-btn" onClick={create} disabled={busy} onMouseEnter={e=>{if(!busy)ctaHover(e);}} onMouseLeave={ctaLeave} style={{background:C.accent,color:C.bg,fontWeight:600,fontSize:13,border:"none",borderRadius:12,padding:"8px 14px",cursor:busy?"default":"pointer",opacity:busy?.6:1,display:"flex",alignItems:"center",gap:6,transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}>
                {busy?<><Loader2 size={13} className="animate-spin"/>Creating...</>:"Create session"}
              </button>
              <button onClick={()=>{setShowForm(false);setFErr("");}} onMouseEnter={secHover} onMouseLeave={secLeave} style={{background:"transparent",color:C.textFaint,border:`1px solid ${C.border}`,borderRadius:12,padding:"8px 12px",cursor:"pointer",fontSize:13,transition:"all 500ms cubic-bezier(0.4,0,0.2,1)"}}>Cancel</button>
            </div>
          </div>
        )}

        {sessions.length===0?(
          <div style={{textAlign:"center",padding:"40px 0",color:C.textFaint,fontSize:14}}>No sessions yet. Create your first one above.</div>
        ):(
          <div style={{display:"grid",gap:8}}>
            {sessions.map(s=>{
              const count=(allRegs[s.id]||[]).length;
              const isDel=confDel===s.id;
              const isEdit=editSid===s.id;
              return(
                <div key={s.id} data-testid={"session-card-"+s.id} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${isEdit?C.accent+"99":s.active?C.accent+"44":C.border}`,borderRadius:12,padding:"14px 16px",display:"grid",gap:10}}>
                  {isEdit?(
                    /* ── Edit mode ── */
                    <div style={{display:"grid",gap:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                        <span style={{fontSize:10,fontFamily:"monospace",color:C.accent}}>Editing · {s.id}</span>
                      </div>
                      <div>
                        <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>SESSION TITLE *</label>
                        <input data-testid="session-edit-title" value={editDraft.title} onChange={e=>setEditDraft(d=>({...d,title:e.target.value}))} style={{...iSty,marginTop:5,fontSize:14}} onFocus={fi} onBlur={fo}/>
                      </div>
                      <div>
                        <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>DATE / TIME</label>
                        <div style={{marginTop:5}}><DateTimePicker testid="session-edit-date" value={editDraft.date} onChange={v=>setEditDraft(d=>({...d,date:v}))} placeholder="e.g. 15 Aug 2026 · 3:00 PM IST"/></div>
                      </div>
                      <div>
                        <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>DESCRIPTION</label>
                        <textarea className="rfs" value={editDraft.description} onChange={e=>setEditDraft(d=>({...d,description:e.target.value}))} rows={2} style={{...iSty,marginTop:5,resize:"vertical",fontFamily:"inherit"}} onFocus={fi} onBlur={fo}/>
                      </div>
                      <div>
                        <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>BANNER IMAGE</label>
                        <BannerUpload testid="session-edit-banner" value={editDraft.banner} pos={editDraft.bannerPos} onChange={v=>setEditDraft(d=>({...d,banner:v}))} onPosChange={v=>setEditDraft(d=>({...d,bannerPos:v}))}/>
                      </div>
                      {editErr&&<p style={{fontSize:12,color:C.error}}>{editErr}</p>}
                      <div style={{display:"flex",gap:8}}>
                        <button data-testid="session-edit-save" onClick={saveEdit} disabled={editBusy} onMouseEnter={e=>{if(!editBusy)ctaHover(e);}} onMouseLeave={ctaLeave} style={{background:C.accent,color:C.bg,fontWeight:600,fontSize:13,border:"none",borderRadius:12,padding:"7px 14px",cursor:editBusy?"default":"pointer",opacity:editBusy?.6:1,display:"flex",alignItems:"center",gap:6,transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}>
                          {editBusy?<><Loader2 size={13} className="animate-spin"/>Saving...</>:"Save changes"}
                        </button>
                        <button onClick={cancelEdit} onMouseEnter={secHover} onMouseLeave={secLeave} style={{background:"transparent",color:C.textFaint,border:`1px solid ${C.border}`,borderRadius:12,padding:"7px 12px",cursor:"pointer",fontSize:13,transition:"all 500ms cubic-bezier(0.4,0,0.2,1)"}}>Cancel</button>
                      </div>
                    </div>
                  ):(
                    /* ── View mode ── */
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          {s.active
                            ? <span style={{fontSize:10,fontFamily:"monospace",background:C.accent,color:C.bg,fontWeight:700,borderRadius:4,padding:"2px 7px",textTransform:"uppercase"}}>Active</span>
                            : <span style={{fontSize:10,fontFamily:"monospace",background:"rgba(255,255,255,0.08)",color:C.textFaint,fontWeight:700,borderRadius:4,padding:"2px 7px",textTransform:"uppercase"}}>Inactive</span>}
                          <span style={{fontSize:10,fontFamily:"monospace",color:C.textFaint}}>{s.id}</span>
                        </div>
                        <p style={{fontSize:14,fontWeight:600,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.title}</p>
                        <p style={{fontSize:12,color:C.textFaint}}>{s.date||"No date set"} · {count} registrant{count!==1?"s":""}</p>
                        {s.description&&<p style={{fontSize:12,color:C.textDim,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.description}</p>}
                      </div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                        <button data-testid={"session-toggle-"+s.id} onClick={()=>toggleActive(s)} role="switch" aria-checked={s.active}
                          title={s.active?"Active — visible on the registration page. Click to hide.":"Inactive — hidden from the registration page. Click to show."}
                          style={{position:"relative",width:38,height:22,borderRadius:11,border:"none",cursor:"pointer",flexShrink:0,background:s.active?C.accent:"rgba(255,255,255,0.18)",transition:"background .2s",marginRight:2}}>
                          <span style={{position:"absolute",top:3,left:s.active?19:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
                        </button>
                        <button data-testid={"session-edit-"+s.id} onClick={()=>startEdit(s)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textFaint,borderRadius:6,padding:"5px 7px",cursor:"pointer",display:"flex",alignItems:"center"}} title="Edit session">
                          <Pencil size={13}/>
                        </button>
                        <button data-testid={"session-view-"+s.id} onClick={()=>{setSelSid(s.id);setTab("registrations");}} style={{fontSize:12,background:"transparent",border:`1px solid ${C.border}`,color:C.textFaint,borderRadius:6,padding:"5px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><Users size={12}/>View</button>
                        {isDel?(
                          <><span style={{fontSize:12,color:C.error}}>Delete?</span>
                          <button data-testid={"session-delete-confirm-"+s.id} onClick={()=>del(s.id)} style={{fontSize:12,background:C.error,color:"#fff",fontWeight:600,border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer"}}>Confirm</button>
                          <button onClick={()=>setConfDel(null)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textFaint,borderRadius:6,padding:"5px 7px",cursor:"pointer",display:"flex"}}><X size={12}/></button></>
                        ):(
                          <button data-testid={"session-delete-"+s.id} onClick={()=>{setConfDel(s.id);cancelEdit();}} style={{background:"transparent",border:`1px solid ${C.error}66`,color:C.error,borderRadius:6,padding:"5px 7px",cursor:"pointer",display:"flex"}}><Trash2 size={13}/></button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RegistrationsTab({me,sessions,allRegs,setAllRegs,selSid,setSelSid,loading,reload}){
  const [query,setQuery]=useState("");
  const [sk,setSk]=useState("registeredAt"); const [sd,setSd]=useState("desc");
  const [editEmail,setEditEmail]=useState(null); const [draft,setDraft]=useState({});
  const [editErr,setEditErr]=useState("");
  const [confDel,setConfDel]=useState(null);
  const [actErr,setActErr]=useState("");
  const [saving,setSaving]=useState(false);

  const sess=sessions.find(s=>s.id===selSid);
  const regs=allRegs[selSid]||[];

  const emailSessMap=useMemo(()=>{
    const m={};
    for(const[sid,list] of Object.entries(allRegs)){
      for(const r of list){const e=(r.email||"").toLowerCase();if(!m[e])m[e]=[];if(!m[e].includes(sid))m[e].push(sid);}
    }
    return m;
  },[allRegs]);

  const getSt=(email,sid)=>{
    const e=email.toLowerCase();
    const prev=(emailSessMap[e]||[]).filter(s=>s!==sid);
    if(prev.length===0) return{label:"New",color:C.success};
    return{label:`Returning (${prev.length})`,color:C.warn};
  };

  const display=useMemo(()=>{
    const q=query.trim().toLowerCase();
    let l=regs;
    if(q) l=l.filter(r=>r.name?.toLowerCase().includes(q)||r.email?.toLowerCase().includes(q));
    return[...l].sort((a,b)=>{
      const av=(a[sk]||"").toString().toLowerCase(),bv=(b[sk]||"").toString().toLowerCase();
      if(av<bv) return sd==="asc"?-1:1; if(av>bv) return sd==="asc"?1:-1; return 0;
    });
  },[regs,query,sk,sd]);

  const tSort=(k)=>{if(sk===k)setSd(d=>d==="asc"?"desc":"asc");else{setSk(k);setSd("asc");}};
  const sIcon=(k)=>sk!==k?<ArrowUpDown size={11} style={{opacity:.5}}/>:sd==="asc"?<ArrowUp size={11}/>:<ArrowDown size={11}/>;

  const persist=async(next)=>{
    setSaving(true);setActErr("");
    const ok=await safeSave(regKey(selSid),next);
    if(ok) setAllRegs(p=>({...p,[selSid]:next}));
    else setActErr("Couldn't save. Please try again.");
    setSaving(false);return ok;
  };

  const saveEdit=async()=>{
    const n=(draft.name||"").trim(),e=(draft.email||"").trim().toLowerCase();
    if(!n){setEditErr("Name is required.");return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){setEditErr("Enter a valid email.");return;}
    if(regs.some(r=>r.email!==editEmail&&r.email===e)){setEditErr("Email already in use.");return;}
    const next=regs.map(r=>r.email===editEmail?{...r,...draft,email:e}:r);
    const ok=await persist(next);
    if(ok){await logActivity(me?.name,"Edited registration",`${e} in ${selSid}`);setEditEmail(null);setDraft({});setEditErr("");}
  };

  const delReg=async(email)=>{
    const ok=await persist(regs.filter(r=>r.email!==email));
    if(ok){await logActivity(me?.name,"Deleted registration",`${email} from ${selSid}`);setConfDel(null);}
  };

  const exportCsv=()=>{
    logActivity(me?.name,"Exported registrations",`${selSid} (${display.length} rows)`);
    const hdr=["Name","Email","Registered At","Status"];
    const rows=display.map(r=>{const st=getSt(r.email,selSid);return[r.name,r.email,fmt(r.registeredAt),st.label];});
    const csv = [hdr,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations-${selSid}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if(loading) return<div style={{...glass,padding:28,display:"flex",alignItems:"center",gap:8,color:C.textFaint,justifyContent:"center"}}><Loader2 size={16} className="animate-spin"/>Loading...</div>;

  const newCount=regs.filter(r=>getSt(r.email,selSid).label==="New").length;
  const retCount=regs.length-newCount;

  return(
    <div style={{...glass,padding:24}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <select data-testid="reg-session-select" value={selSid||""} onChange={e=>setSelSid(e.target.value)} style={{background:"rgba(255,255,255,0.07)",border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px",fontSize:13,color:C.text,outline:"none",cursor:"pointer",flex:1,minWidth:200}}>
          {sessions.map(s=><option key={s.id} value={s.id} style={{background:C.bgPanel}}>{s.active?"● ":""}{s.title} [{s.id}]</option>)}
        </select>
        <button data-testid="reg-refresh" onClick={reload} style={{fontFamily:"monospace",fontSize:12,border:`1px solid ${C.border}`,color:C.textFaint,background:"transparent",borderRadius:8,padding:"7px 12px",cursor:"pointer"}}>Refresh</button>
        <button data-testid="reg-export" onClick={exportCsv} disabled={display.length===0} onMouseEnter={e=>{if(display.length>0)ctaHover(e);}} onMouseLeave={ctaLeave} style={{fontFamily:"monospace",fontSize:12,background:C.accent,color:C.bg,fontWeight:600,border:"none",borderRadius:12,padding:"7px 12px",display:"flex",alignItems:"center",gap:6,cursor:display.length===0?"default":"pointer",opacity:display.length===0?.4:1,transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}>
          <Download size={13}/>Export
        </button>
      </div>

      {sess&&(
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"8px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <span style={{fontSize:13,fontWeight:600,color:C.textDim}}>{sess.title}</span>
            {sess.date&&<span style={{fontSize:11,color:C.textFaint,marginLeft:8}}>{sess.date}</span>}
          </div>
          <div style={{display:"flex",gap:14,fontSize:12}}>
            <span style={{color:C.textFaint}}>Total <span style={{color:C.text,fontWeight:700}}>{regs.length}</span></span>
            <span style={{color:C.textFaint}}>New <span style={{color:C.success,fontWeight:700}}>{newCount}</span></span>
            <span style={{color:C.textFaint}}>Returning <span style={{color:C.warn,fontWeight:700}}>{retCount}</span></span>
          </div>
        </div>
      )}

      <div style={{position:"relative",marginBottom:12}}>
        <Search size={13} color={C.textFaint} style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)"}}/>
        <input data-testid="reg-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name or email..." style={{...iSty,paddingLeft:32}}/>
      </div>

      {actErr&&<div style={{display:"flex",gap:8,fontSize:13,color:C.error,background:`${C.error}1A`,border:`1px solid ${C.error}4D`,borderRadius:8,padding:"8px 12px",marginBottom:10}}><AlertCircle size={14} style={{flexShrink:0,marginTop:1}}/>{actErr}</div>}

      {regs.length===0?(
        <div style={{textAlign:"center",padding:"48px 0",border:`1px dashed ${C.border}`,borderRadius:12}}>
          <ClipboardList size={22} color={C.border} style={{margin:"0 auto 10px"}}/>
          <p style={{fontSize:14,color:C.textFaint}}>No registrations yet for this session.</p>
        </div>
      ):display.length===0?(
        <div style={{textAlign:"center",padding:"32px 0",color:C.textFaint,fontSize:14}}>No results match "{query}".</div>
      ):(
        <div className="rfs" style={{border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,overflow:"hidden",overflowX:"auto",background:"rgba(255,255,255,0.03)"}}>
          <table data-testid="reg-table" style={{width:"100%",fontSize:13,borderCollapse:"collapse",minWidth:580}}>
            <thead>
              <tr style={{background:"rgba(255,255,255,0.06)"}}>
                {[["name","Name"],["email","Email"],["registeredAt","Registered"],["status","Status"]].map(([k,l])=>(
                  <th key={k} onClick={()=>k!=="status"&&tSort(k)} style={{padding:"9px 14px",fontFamily:"monospace",fontSize:10,color:C.textFaint,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",textAlign:"left",cursor:k!=="status"?"pointer":"default",userSelect:"none"}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4}}>{l}{k!=="status"&&sIcon(k)}</span>
                  </th>
                ))}
                <th style={{padding:"9px 14px",fontFamily:"monospace",fontSize:10,color:C.textFaint,textTransform:"uppercase"}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {display.map(reg=>{
                const st=getSt(reg.email,selSid);
                const isEd=editEmail===reg.email;
                const isDel=confDel===reg.email;
                return(
                  <tr key={reg.email} data-testid={"reg-row-"+reg.email} style={{borderTop:`1px solid ${C.border}`,background:isEd?"rgba(0,174,239,0.07)":"transparent"}}>
                    <td style={{padding:"9px 14px",whiteSpace:"nowrap"}}>
                      {isEd?<input value={draft.name||""} onChange={e=>setDraft(d=>({...d,name:e.target.value}))} style={{...iSty,padding:"4px 8px",borderRadius:6,width:130}}/>:reg.name}
                    </td>
                    <td style={{padding:"9px 14px",whiteSpace:"nowrap",color:C.textDim}}>
                      {isEd?<input type="email" value={draft.email||""} onChange={e=>setDraft(d=>({...d,email:e.target.value}))} style={{...iSty,padding:"4px 8px",borderRadius:6,width:170}}/>:reg.email}
                    </td>
                    <td style={{padding:"9px 14px",whiteSpace:"nowrap",fontFamily:"monospace",fontSize:11,color:C.textFaint}}>{fmt(reg.registeredAt)}</td>
                    <td style={{padding:"9px 14px",whiteSpace:"nowrap"}}>
                      <span style={{fontSize:11,fontWeight:600,fontFamily:"monospace",color:st.color,background:`${st.color}1A`,borderRadius:4,padding:"2px 8px"}}>{st.label}</span>
                    </td>
                    <td style={{padding:"9px 14px",whiteSpace:"nowrap"}}>
                      {isEd?(
                        <div style={{display:"flex",gap:6}}>
                          <button data-testid="reg-edit-save" onClick={saveEdit} disabled={saving} style={{fontSize:12,background:C.accent,color:C.bg,fontWeight:600,border:"none",borderRadius:6,padding:"4px 10px",cursor:saving?"default":"pointer",opacity:saving?.6:1}}>Save</button>
                          <button onClick={()=>{setEditEmail(null);setEditErr("");}} style={{fontSize:12,background:"transparent",color:C.textFaint,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 7px",cursor:"pointer",display:"flex"}}><X size={12}/></button>
                        </div>
                      ):isDel?(
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <span style={{fontSize:12,color:C.error}}>Delete?</span>
                          <button data-testid={"reg-delete-confirm-"+reg.email} onClick={()=>delReg(reg.email)} disabled={saving} style={{fontSize:12,background:C.error,color:"#fff",fontWeight:600,border:"none",borderRadius:6,padding:"4px 10px",cursor:saving?"default":"pointer"}}>Confirm</button>
                          <button onClick={()=>setConfDel(null)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textFaint,borderRadius:6,padding:"4px 7px",cursor:"pointer",display:"flex"}}><X size={12}/></button>
                        </div>
                      ):(
                        <div style={{display:"flex",gap:6}}>
                          <button data-testid={"reg-edit-"+reg.email} onClick={()=>{setEditEmail(reg.email);setDraft({...reg});setEditErr("");setConfDel(null);}} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textFaint,borderRadius:6,padding:"4px 7px",cursor:"pointer",display:"flex"}}><Pencil size={12}/></button>
                          <button data-testid={"reg-delete-"+reg.email} onClick={()=>{setConfDel(reg.email);setEditEmail(null);}} style={{background:"transparent",border:`1px solid ${C.error}66`,color:C.error,borderRadius:6,padding:"4px 7px",cursor:"pointer",display:"flex"}}><Trash2 size={12}/></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {editErr&&<p style={{fontSize:12,color:C.error,padding:"8px 14px"}}>{editErr}</p>}
        </div>
      )}
    </div>
  );
}

function ActivityTab({me,isSuper}){
  const [log,setLog]=useState([]);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState("");
  const [confClear,setConfClear]=useState(false);
  const [busy,setBusy]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    const r=await safeGet(ACTIVITY_KEY);
    setLog(r?JSON.parse(r.value):[]);
    setLoading(false);
  },[]);
  useEffect(()=>{ load(); },[load]);

  const display=useMemo(()=>{
    const rev=[...log].reverse(); // newest first
    const q=query.trim().toLowerCase();
    if(!q) return rev;
    return rev.filter(e=>[e.actor,e.action,e.detail].some(v=>(v||"").toLowerCase().includes(q)));
  },[log,query]);

  const exportCsv=()=>{
    const hdr=["Time","Admin","Action","Detail"];
    const rows=display.map(e=>[fmt(e.at),e.actor,e.action,e.detail]);
    const csv=[hdr,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=`activity-log-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const clearLog=async()=>{
    setBusy(true);
    await safeSave(ACTIVITY_KEY,[]);
    await logActivity(me?.name,"Cleared activity log","");
    setConfClear(false);
    await load();
    setBusy(false);
  };

  if(loading) return <div style={{...glass,padding:28,display:"flex",alignItems:"center",gap:8,color:C.textFaint,justifyContent:"center"}}><Loader2 size={16} className="animate-spin"/>Loading...</div>;

  return(
    <div style={{...glass,padding:24}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:180}}>
          <p style={{fontSize:15,fontWeight:600,margin:0}}>Activity log</p>
          <p style={{fontSize:12,color:C.textFaint,margin:"3px 0 0"}}>{log.length} event{log.length!==1?"s":""} recorded{log.length>=ACTIVITY_MAX?` (showing latest ${ACTIVITY_MAX})`:""}</p>
        </div>
        <button data-testid="activity-refresh" onClick={load} style={{fontFamily:"monospace",fontSize:12,border:`1px solid ${C.border}`,color:C.textFaint,background:"transparent",borderRadius:8,padding:"7px 12px",cursor:"pointer"}}>Refresh</button>
        <button data-testid="activity-export" onClick={exportCsv} disabled={display.length===0} onMouseEnter={e=>{if(display.length>0)ctaHover(e);}} onMouseLeave={ctaLeave} style={{fontFamily:"monospace",fontSize:12,background:C.accent,color:C.bg,fontWeight:600,border:"none",borderRadius:12,padding:"7px 12px",display:"flex",alignItems:"center",gap:6,cursor:display.length===0?"default":"pointer",opacity:display.length===0?.4:1,transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}>
          <Download size={13}/>Export
        </button>
        {confClear?(
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:12,color:C.error}}>Clear all?</span>
            <button data-testid="activity-clear-confirm" onClick={clearLog} disabled={busy} style={{fontSize:12,background:C.error,color:"#fff",fontWeight:600,border:"none",borderRadius:8,padding:"7px 10px",cursor:busy?"default":"pointer"}}>Confirm</button>
            <button onClick={()=>setConfClear(false)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textFaint,borderRadius:8,padding:"7px 8px",cursor:"pointer",display:"flex"}}><X size={12}/></button>
          </div>
        ):(
          isSuper&&<button data-testid="activity-clear" onClick={()=>setConfClear(true)} disabled={log.length===0} style={{fontFamily:"monospace",fontSize:12,border:`1px solid ${C.error}66`,color:C.error,background:"transparent",borderRadius:8,padding:"7px 12px",cursor:log.length===0?"default":"pointer",opacity:log.length===0?.4:1}} title="Superuser only">Clear</button>
        )}
      </div>

      <div style={{position:"relative",marginBottom:12}}>
        <Search size={13} color={C.textFaint} style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)"}}/>
        <input data-testid="activity-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by admin, action, or detail..." style={{...iSty,paddingLeft:32}} onFocus={fi} onBlur={fo}/>
      </div>

      {log.length===0?(
        <div style={{textAlign:"center",padding:"48px 0",border:`1px dashed ${C.border}`,borderRadius:12}}>
          <ClipboardList size={22} color={C.border} style={{margin:"0 auto 10px"}}/>
          <p style={{fontSize:14,color:C.textFaint}}>No activity recorded yet.</p>
        </div>
      ):display.length===0?(
        <div style={{textAlign:"center",padding:"32px 0",color:C.textFaint,fontSize:14}}>No results match "{query}".</div>
      ):(
        <div className="rfs" style={{border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,overflow:"hidden",overflowX:"auto",background:"rgba(255,255,255,0.03)"}}>
          <table data-testid="activity-table" style={{width:"100%",fontSize:13,borderCollapse:"collapse",minWidth:620}}>
            <thead>
              <tr style={{background:"rgba(255,255,255,0.06)"}}>
                {["When","Admin","Action","Detail"].map(h=>(
                  <th key={h} style={{padding:"9px 14px",fontFamily:"monospace",fontSize:10,color:C.textFaint,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",textAlign:"left"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {display.map(e=>(
                <tr key={e.id} data-testid="activity-row" style={{borderTop:`1px solid ${C.border}`}}>
                  <td style={{padding:"9px 14px",whiteSpace:"nowrap",fontFamily:"monospace",fontSize:11,color:C.textFaint}}>{fmt(e.at)}</td>
                  <td style={{padding:"9px 14px",whiteSpace:"nowrap",fontWeight:600}}>{e.actor}</td>
                  <td style={{padding:"9px 14px",whiteSpace:"nowrap"}}>
                    <span style={{fontSize:11,fontWeight:600,fontFamily:"monospace",color:C.accent,background:`${C.accent}1A`,borderRadius:4,padding:"2px 8px"}}>{e.action}</span>
                  </td>
                  <td style={{padding:"9px 14px",color:C.textDim,maxWidth:320,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.detail||"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmailsTab({me,sessions,allRegs}){
  const [loading,setLoading]=useState(true);
  const [cfgUrl,setCfgUrl]=useState("");
  const [tpl,setTpl]=useState(DEFAULT_TEMPLATES);
  const [otpOn,setOtpOn]=useState(false);
  const [otpBusy,setOtpBusy]=useState(false);
  const [otpErr,setOtpErr]=useState("");
  const [otpTestTo,setOtpTestTo]=useState("");
  const [otpTesting,setOtpTesting]=useState(false);
  const [otpTestMsg,setOtpTestMsg]=useState("");

  // Confirmation template
  const [cEnabled,setCEnabled]=useState(false);
  const [cSubject,setCSubject]=useState("");
  const [cBody,setCBody]=useState("");
  const [cBusy,setCBusy]=useState(false);
  const [cMsg,setCMsg]=useState(""); const [cErr,setCErr]=useState("");
  const [testTo,setTestTo]=useState(""); const [testMsg,setTestMsg]=useState(""); const [testBusy,setTestBusy]=useState(false);

  // Bulk send
  const [bSid,setBSid]=useState(sessions[0]?.id||"");
  const [checked,setChecked]=useState(()=>new Set());
  const [bSubject,setBSubject]=useState("");
  const [bBody,setBBody]=useState("");
  const [sending,setSending]=useState(false);
  const [progress,setProgress]=useState({done:0,total:0});
  const [bMsg,setBMsg]=useState(""); const [bErr,setBErr]=useState("");

  useEffect(()=>{(async()=>{
    const er=await safeGet(EMAIL_CFG_KEY); if(er){ try{ const cfg=JSON.parse(er.value); setCfgUrl(cfg.url||""); setOtpOn(!!cfg.otpRequired); }catch(e){} }
    const tr=await safeGet(EMAIL_TEMPLATES_KEY);
    const t = tr ? {...DEFAULT_TEMPLATES, ...JSON.parse(tr.value)} : DEFAULT_TEMPLATES;
    setTpl(t);
    setCEnabled(!!(t.confirmation&&t.confirmation.enabled));
    setCSubject((t.confirmation&&t.confirmation.subject)||"");
    setCBody((t.confirmation&&t.confirmation.body)||"");
    setBSubject((t.bulk&&t.bulk.subject)||"");
    setBBody((t.bulk&&t.bulk.body)||"");
    setLoading(false);
  })();},[]);

  const recips = allRegs[bSid] || [];
  useEffect(()=>{ setChecked(new Set()); },[bSid]);
  const allChecked = recips.length>0 && checked.size===recips.length;
  const toggleAll=()=> setChecked(allChecked ? new Set() : new Set(recips.map(r=>r.email)));
  const toggleOne=(email)=> setChecked(prev=>{ const n=new Set(prev); n.has(email)?n.delete(email):n.add(email); return n; });

  const toggleOtp=async()=>{
    setOtpErr("");
    const next=!otpOn;
    if(next && !cfgUrl){ setOtpErr("Configure the Apps Script URL in Settings before enabling OTP verification."); return; }
    setOtpBusy(true);
    // Merge with the latest stored config so we never clobber the URL.
    let url=cfgUrl;
    try{ const r=await safeGet(EMAIL_CFG_KEY); if(r){ const cfg=JSON.parse(r.value); url=cfg.url||url; } }catch(e){}
    const ok=await safeSave(EMAIL_CFG_KEY,{ url, otpRequired: next });
    if(ok){ setOtpOn(next); await logActivity(me?.name,"Updated OTP verification",next?"ON":"OFF"); }
    else setOtpErr("Couldn't save. Please try again.");
    setOtpBusy(false);
  };

  const sendOtpTest=async()=>{
    setOtpTestMsg("");setOtpErr("");
    if(!cfgUrl){ setOtpErr("Configure the Apps Script URL in Settings first."); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpTestTo.trim())){ setOtpErr("Enter a valid email address to send the test to."); return; }
    setOtpTesting(true);
    try{
      const code=gen4DigitOtp();
      await sendOtpEmail({url:cfgUrl}, otpTestTo.trim(), me?.name||"Admin", code, "Connection Test");
      await logActivity(me?.name,"Sent test OTP",otpTestTo.trim());
      setOtpTestMsg("Test OTP dispatched to "+otpTestTo.trim()+". Check that inbox (and Spam). Delivery can't be confirmed from the browser — see your Apps Script → Executions log.");
    }catch(e){ setOtpErr("Could not dispatch the request: "+(e.message||"unknown error")); }
    setOtpTesting(false);
  };

  const saveConfirmation=async()=>{
    setCBusy(true);setCErr("");setCMsg("");
    const next={...tpl, confirmation:{enabled:cEnabled,subject:cSubject,body:cBody}};
    const ok=await safeSave(EMAIL_TEMPLATES_KEY,next);
    if(ok){ setTpl(next); setCMsg("Saved." + (cEnabled?" Confirmation emails are ON.":" Confirmation emails are OFF.")); await logActivity(me?.name,"Updated confirmation email",cEnabled?"enabled":"disabled"); }
    else setCErr("Couldn't save. Try again.");
    setCBusy(false);
  };

  const sendTest=async()=>{
    setTestMsg("");setCErr("");
    if(!cfgUrl){ setCErr("No Apps Script URL configured. Set it in Settings first."); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo.trim())){ setCErr("Enter a valid test email address."); return; }
    setTestBusy(true);
    const vars={ name:"Test User", email:testTo.trim(), session_title:"Sample Session", session_date:"1 Jan 2026 · 10:00 AM" };
    const subject=renderTemplate(cSubject,vars);
    const inner=renderTemplate(cBody,vars).replace(/\n/g,"<br>");
    const html=buildBrandedEmail({subject,bodyHtml:inner,eyebrow:"Registration confirmed",sessionTitle:vars.session_title,sessionDate:vars.session_date});
    try{ await postToAppsScript({url:cfgUrl},{type:"confirmation",to_email:testTo.trim(),to_name:"Test User",subject,html}); await logActivity(me?.name,"Sent confirmation test email",testTo.trim());
      setTestMsg("Test dispatched to "+testTo.trim()+". Delivery can't be confirmed from the browser — check your Apps Script executions.");
    }catch(e){ setCErr("Could not dispatch the test."); }
    setTestBusy(false);
  };

  const sendBulk=async()=>{
    setBErr("");setBMsg("");
    if(!cfgUrl){ setBErr("No Apps Script URL configured. Set it in Settings first."); return; }
    const targets=recips.filter(r=>checked.has(r.email));
    if(targets.length===0){ setBErr("Select at least one recipient."); return; }
    if(!bSubject.trim()){ setBErr("Enter a subject."); return; }
    const next={...tpl, bulk:{subject:bSubject,body:bBody}};
    await safeSave(EMAIL_TEMPLATES_KEY,next); setTpl(next);
    const sess=sessions.find(s=>s.id===bSid);
    setSending(true); setProgress({done:0,total:targets.length});
    for(let i=0;i<targets.length;i++){
      const r=targets[i];
      const vars={ name:r.name, email:r.email, session_title:(sess&&sess.title)||"", session_date:(sess&&sess.date)||"" };
      const subject=renderTemplate(bSubject,vars);
      const inner=renderTemplate(bBody,vars).replace(/\n/g,"<br>");
      const html=buildBrandedEmail({subject,bodyHtml:inner,eyebrow:"Announcement",sessionTitle:vars.session_title,sessionDate:vars.session_date});
      try{ await postToAppsScript({url:cfgUrl},{type:"bulk",to_email:r.email,to_name:r.name,subject,html}); }catch(e){}
      setProgress({done:i+1,total:targets.length});
      await new Promise(res=>setTimeout(res,250)); // gentle pacing for Apps Script quotas
    }
    await logActivity(me?.name,"Sent bulk email",`${targets.length} recipient(s) · ${sess?sess.title:bSid}`);
    setSending(false);
    setBMsg(`Dispatched ${targets.length} email(s). Delivery can't be confirmed from the browser — check your Apps Script executions.`);
  };

  const sec={...glass,padding:24,display:"grid",gap:12};
  const slbl={fontSize:15,fontWeight:600,margin:0};
  const hint=(
    <p style={{fontSize:11,color:C.textFaint,lineHeight:1.6,margin:0}}>
      Placeholders: {EMAIL_PLACEHOLDERS.map(p=>(<span key={p} style={{fontFamily:"monospace",color:C.accent,marginRight:8}}>{`{{${p}}}`}</span>))}
    </p>
  );

  if(loading) return <div style={{...glass,padding:28,display:"flex",alignItems:"center",gap:8,color:C.textFaint,justifyContent:"center"}}><Loader2 size={16} className="animate-spin"/>Loading...</div>;

  // Live previews (sample data filled into placeholders, wrapped in brand shell)
  const sampleSess = sessions[0] || {};
  const confVars = { name:"Ada Lovelace", email:"ada@example.com", session_title:sampleSess.title||"AI Basics for Teams", session_date:sampleSess.date||"15 Aug 2026 · 3:00 PM IST" };
  const confPreview = buildBrandedEmail({ subject:renderTemplate(cSubject,confVars), bodyHtml:renderTemplate(cBody,confVars).replace(/\n/g,"<br>"), eyebrow:"Registration confirmed", sessionTitle:confVars.session_title, sessionDate:confVars.session_date });
  const bulkSess = sessions.find(s=>s.id===bSid) || {};
  const bulkVars = { name:(recips[0]&&recips[0].name)||"Ada Lovelace", email:(recips[0]&&recips[0].email)||"ada@example.com", session_title:bulkSess.title||"", session_date:bulkSess.date||"" };
  const bulkPreview = buildBrandedEmail({ subject:renderTemplate(bSubject,bulkVars), bodyHtml:renderTemplate(bBody,bulkVars).replace(/\n/g,"<br>"), eyebrow:"Announcement", sessionTitle:bulkVars.session_title, sessionDate:bulkVars.session_date });
  const previewLabel = (t)=>(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}><label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>{t}</label><span style={{fontSize:10,color:C.textFaint}}>sample data</span></div>);

  return(
    <div data-testid="emails-tab" style={{display:"grid",gap:16}}>
      {!cfgUrl && (
        <div style={{display:"flex",gap:8,fontSize:13,color:C.warn,background:`${C.warn}1A`,border:`1px solid ${C.warn}4D`,borderRadius:10,padding:"10px 14px"}}>
          <AlertCircle size={15} style={{flexShrink:0,marginTop:1}}/>No Apps Script URL is set yet. Add it under <strong>&nbsp;Settings&nbsp;</strong> so emails can be sent.
        </div>
      )}

      {/* ── OTP verification ── */}
      <div style={sec}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <ShieldCheck size={16} color={C.accent}/>
          <p style={slbl}>OTP verification</p>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
          <div>
            <p style={{fontSize:13,fontWeight:600,color:C.text,margin:0}}>Require OTP verification</p>
            <p style={{fontSize:11,color:C.textFaint,margin:"3px 0 0",lineHeight:1.5}}>
              {otpOn
                ? "ON — registrants must verify their email with a 4-digit code before their spot is confirmed."
                : "OFF — registrants are added instantly without email verification."}
            </p>
          </div>
          <button data-testid="otp-toggle" onClick={toggleOtp} disabled={otpBusy} role="switch" aria-checked={otpOn}
            style={{position:"relative",width:46,height:26,borderRadius:13,border:"none",cursor:otpBusy?"default":"pointer",flexShrink:0,opacity:otpBusy?.6:1,background:otpOn?C.accent:"rgba(255,255,255,0.18)",transition:"background .2s"}}>
            <span style={{position:"absolute",top:3,left:otpOn?23:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
          </button>
        </div>
        {otpErr&&<p style={{fontSize:12,color:C.error,margin:0}}>{otpErr}</p>}
        {otpTestMsg&&<p style={{fontSize:12,color:C.textDim,lineHeight:1.5,background:"rgba(0,174,239,0.08)",border:"1px solid rgba(0,174,239,0.2)",borderRadius:8,padding:"8px 12px",margin:0}}>{otpTestMsg}</p>}
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <input data-testid="otp-test-input" value={otpTestTo} onChange={e=>{setOtpTestTo(e.target.value);setOtpTestMsg("");setOtpErr("");}} placeholder="you@example.com" style={{...iSty,flex:1,minWidth:150,maxWidth:240,padding:"8px 12px",fontSize:12}} onFocus={fi} onBlur={fo}/>
          <button data-testid="otp-test-btn" onClick={sendOtpTest} disabled={otpTesting||!cfgUrl||!otpTestTo.trim()} onMouseEnter={e=>{if(!otpTesting&&cfgUrl&&otpTestTo.trim())secHover(e);}} onMouseLeave={secLeave} style={{background:"transparent",color:C.textFaint,fontWeight:600,fontSize:13,border:`1px solid ${C.border}`,borderRadius:12,padding:"8px 14px",cursor:(otpTesting||!cfgUrl||!otpTestTo.trim())?"default":"pointer",opacity:(otpTesting||!cfgUrl||!otpTestTo.trim())?.5:1,display:"flex",alignItems:"center",gap:6,transition:"all 500ms cubic-bezier(0.4,0,0.2,1)"}}>
            {otpTesting?<><Loader2 size={13} className="animate-spin"/>Sending...</>:"Send test OTP"}
          </button>
        </div>
      </div>

      {/* ── Confirmation email ── */}
      <div style={sec}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <Mail size={16} color={C.accent}/>
          <p style={slbl}>Confirmation email</p>
        </div>
        <p style={{fontSize:12,color:C.textFaint,margin:0,lineHeight:1.6}}>Sent automatically to a registrant once their sign-up is complete.</p>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
          <div>
            <p style={{fontSize:13,fontWeight:600,color:C.text,margin:0}}>Send confirmation emails</p>
            <p style={{fontSize:11,color:C.textFaint,margin:"3px 0 0",lineHeight:1.5}}>{cEnabled?"ON — each new registrant receives this email.":"OFF — no confirmation is sent."}</p>
          </div>
          <button data-testid="email-confirm-toggle" onClick={()=>{setCEnabled(v=>!v);setCMsg("");setCErr("");}} role="switch" aria-checked={cEnabled}
            style={{position:"relative",width:46,height:26,borderRadius:13,border:"none",cursor:"pointer",flexShrink:0,background:cEnabled?C.accent:"rgba(255,255,255,0.18)",transition:"background .2s"}}>
            <span style={{position:"absolute",top:3,left:cEnabled?23:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
          </button>
        </div>

        <div>
          <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>SUBJECT</label>
          <input data-testid="email-confirm-subject" value={cSubject} onChange={e=>{setCSubject(e.target.value);setCMsg("");}} style={{...iSty,marginTop:5}} onFocus={fi} onBlur={fo}/>
        </div>
        <div>
          <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>BODY</label>
          <textarea className="rfs" data-testid="email-confirm-body" value={cBody} onChange={e=>{setCBody(e.target.value);setCMsg("");}} rows={7} style={{...iSty,marginTop:5,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}} onFocus={fi} onBlur={fo}/>
        </div>
        {hint}
        {cErr&&<p style={{fontSize:12,color:C.error,margin:0}}>{cErr}</p>}
        {cMsg&&<p style={{fontSize:12,color:C.success,margin:0}}>{cMsg}</p>}
        {testMsg&&<p style={{fontSize:12,color:C.textDim,lineHeight:1.5,background:"rgba(0,174,239,0.08)",border:"1px solid rgba(0,174,239,0.2)",borderRadius:8,padding:"8px 12px",margin:0}}>{testMsg}</p>}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <button data-testid="email-confirm-save" onClick={saveConfirmation} disabled={cBusy} onMouseEnter={e=>{if(!cBusy)ctaHover(e);}} onMouseLeave={ctaLeave} style={{background:C.accent,color:C.bg,fontWeight:600,fontSize:13,border:"none",borderRadius:12,padding:"8px 14px",cursor:cBusy?"default":"pointer",opacity:cBusy?.6:1,display:"flex",alignItems:"center",gap:6,transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}>
            {cBusy?<><Loader2 size={13} className="animate-spin"/>Saving...</>:"Save confirmation"}
          </button>
          <div style={{display:"flex",gap:6,alignItems:"center",marginLeft:"auto",flexWrap:"wrap",minWidth:0}}>
            <input data-testid="email-confirm-test-input" value={testTo} onChange={e=>{setTestTo(e.target.value);setTestMsg("");}} placeholder="you@example.com" style={{...iSty,flex:1,minWidth:150,maxWidth:220,padding:"8px 12px"}} onFocus={fi} onBlur={fo}/>
            <button data-testid="email-confirm-test-btn" onClick={sendTest} disabled={testBusy||!cfgUrl} onMouseEnter={e=>{if(!testBusy&&cfgUrl)secHover(e);}} onMouseLeave={secLeave} style={{background:"transparent",color:C.textFaint,fontWeight:600,fontSize:13,border:`1px solid ${C.border}`,borderRadius:12,padding:"8px 14px",cursor:(testBusy||!cfgUrl)?"default":"pointer",opacity:(testBusy||!cfgUrl)?.5:1,display:"flex",alignItems:"center",gap:6,transition:"all 500ms cubic-bezier(0.4,0,0.2,1)"}}>
              {testBusy?<><Loader2 size={13} className="animate-spin"/>Sending...</>:"Send test"}
            </button>
          </div>
        </div>
        <div>
          {previewLabel("PREVIEW")}
          <iframe data-testid="email-confirm-preview" title="Confirmation email preview" srcDoc={confPreview} style={{width:"100%",height:440,border:`1px solid ${C.border}`,borderRadius:12,background:"#1b3a5c"}}/>
        </div>
      </div>

      {/* ── Bulk send ── */}
      <div style={sec}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <Send size={15} color={C.accent}/>
          <p style={slbl}>Bulk email</p>
        </div>
        <p style={{fontSize:12,color:C.textFaint,margin:0,lineHeight:1.6}}>Compose a message and send it to the registrants you select below.</p>

        <div>
          <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>SESSION</label>
          <select data-testid="bulk-session-select" value={bSid} onChange={e=>setBSid(e.target.value)} style={{...iSty,marginTop:5,cursor:"pointer"}}>
            {sessions.length===0 && <option value="">No sessions</option>}
            {sessions.map(s=><option key={s.id} value={s.id} style={{background:C.bgPanel}}>{s.title} [{s.id}]</option>)}
          </select>
        </div>

        {/* Recipients */}
        <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"10px 14px",background:"rgba(255,255,255,0.05)"}}>
            <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.textDim,cursor:recips.length?"pointer":"default"}}>
              <input data-testid="bulk-select-all" type="checkbox" checked={allChecked} onChange={toggleAll} disabled={recips.length===0} style={{accentColor:C.accent,width:15,height:15,cursor:recips.length?"pointer":"default"}}/>
              Select all
            </label>
            <span style={{fontSize:12,color:C.textFaint}}>{checked.size} of {recips.length} selected</span>
          </div>
          <div className="rfs" style={{maxHeight:220,overflowY:"auto"}}>
            {recips.length===0?(
              <div style={{textAlign:"center",padding:"28px 0",color:C.textFaint,fontSize:13}}>No registrants for this session.</div>
            ):recips.map(r=>(
              <label key={r.email} data-testid={"bulk-recipient-"+r.email} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderTop:`1px solid ${C.border}`,cursor:"pointer"}}>
                <input type="checkbox" checked={checked.has(r.email)} onChange={()=>toggleOne(r.email)} style={{accentColor:C.accent,width:15,height:15,cursor:"pointer"}}/>
                <span style={{fontSize:13,fontWeight:600,flexShrink:0}}>{r.name}</span>
                <span style={{fontSize:12,color:C.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.email}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>SUBJECT</label>
          <input data-testid="bulk-subject" value={bSubject} onChange={e=>{setBSubject(e.target.value);setBMsg("");}} style={{...iSty,marginTop:5}} onFocus={fi} onBlur={fo}/>
        </div>
        <div>
          <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>BODY</label>
          <textarea className="rfs" data-testid="bulk-body" value={bBody} onChange={e=>{setBBody(e.target.value);setBMsg("");}} rows={7} style={{...iSty,marginTop:5,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}} onFocus={fi} onBlur={fo}/>
        </div>
        {hint}
        {bErr&&<p style={{fontSize:12,color:C.error,margin:0}}>{bErr}</p>}
        {bMsg&&<p style={{fontSize:12,color:C.textDim,lineHeight:1.5,background:"rgba(0,174,239,0.08)",border:"1px solid rgba(0,174,239,0.2)",borderRadius:8,padding:"8px 12px",margin:0}}>{bMsg}</p>}
        {sending&&(
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:8,height:8,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${progress.total?Math.round(progress.done/progress.total*100):0}%`,background:C.accent,transition:"width .2s"}}/>
          </div>
        )}
        <div>
          {previewLabel("PREVIEW")}
          <iframe data-testid="bulk-preview" title="Bulk email preview" srcDoc={bulkPreview} style={{width:"100%",height:440,border:`1px solid ${C.border}`,borderRadius:12,background:"#1b3a5c"}}/>
        </div>
        <button data-testid="bulk-send-btn" onClick={sendBulk} disabled={sending||!cfgUrl||checked.size===0}
          className={(sending||!cfgUrl||checked.size===0)?"":"neon-glow"}
          style={{background:C.accent,color:C.bg,fontWeight:700,fontSize:14,border:"none",borderRadius:12,padding:"11px 16px",cursor:(sending||!cfgUrl||checked.size===0)?"default":"pointer",opacity:(sending||!cfgUrl||checked.size===0)?.5:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"fit-content",transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}
          onMouseEnter={e=>{if(!sending&&cfgUrl&&checked.size>0)ctaHover(e);}} onMouseLeave={ctaLeave}>
          {sending?<><Loader2 size={14} className="animate-spin"/>Sending {progress.done}/{progress.total}...</>:<><Send size={14}/>Send to {checked.size} selected</>}
        </button>
      </div>
    </div>
  );
}

function PermissionsTab({me,admins,setAdmins,reload}){
  const [busyId,setBusyId]=useState(null);
  const [err,setErr]=useState("");

  const others = admins.filter(a=>!isSuperAdmin(a,admins));

  const setPerm=async(admin,key,value)=>{
    setBusyId(admin.id);setErr("");
    const nextPerms={...DEFAULT_PERMS,...permsOf(admin),[key]:value};
    const next=admins.map(a=>a.id===admin.id?{...a,perms:nextPerms}:a);
    const ok=await safeSave(ADMIN_KEY,next);
    if(ok){
      setAdmins(next);
      const on=Object.entries(nextPerms).filter(([,v])=>v).map(([k])=>k);
      await logActivity(me?.name,"Updated permissions",`${admin.name}: ${on.length?on.join(", "):"none"}`);
    } else setErr("Couldn't save. Please try again.");
    setBusyId(null);
  };

  const Toggle=({on,onClick,disabled,testid})=>(
    <button data-testid={testid} onClick={onClick} disabled={disabled} role="switch" aria-checked={on}
      style={{position:"relative",width:42,height:24,borderRadius:12,border:"none",cursor:disabled?"default":"pointer",flexShrink:0,opacity:disabled?.5:1,background:on?C.accent:"rgba(255,255,255,0.18)",transition:"background .2s"}}>
      <span style={{position:"absolute",top:3,left:on?21:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
    </button>
  );

  return(
    <div style={{...glass,padding:24}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:180}}>
          <p style={{fontSize:15,fontWeight:600,margin:0}}>Permissions</p>
          <p style={{fontSize:12,color:C.textFaint,margin:"3px 0 0"}}>Control what each admin can access. The superuser always has full access.</p>
        </div>
        <button data-testid="perm-refresh" onClick={reload} style={{fontFamily:"monospace",fontSize:12,border:`1px solid ${C.border}`,color:C.textFaint,background:"transparent",borderRadius:8,padding:"7px 12px",cursor:"pointer"}}>Refresh</button>
      </div>

      {/* Legend */}
      <div style={{display:"grid",gap:4,margin:"14px 0 18px"}}>
        {PERMISSIONS.map(([k,label,desc])=>(
          <p key={k} style={{fontSize:12,color:C.textFaint,margin:0}}>
            <span style={{fontFamily:"monospace",color:C.accent}}>{label}</span> — {desc}
          </p>
        ))}
      </div>

      {err&&<div style={{display:"flex",gap:8,fontSize:13,color:C.error,background:`${C.error}1A`,border:`1px solid ${C.error}4D`,borderRadius:8,padding:"8px 12px",marginBottom:12}}><AlertCircle size={14} style={{flexShrink:0,marginTop:1}}/>{err}</div>}

      {/* Superuser row (read-only) */}
      {admins.filter(a=>isSuperAdmin(a,admins)).map(a=>(
        <div key={a.id} style={{background:"rgba(0,174,239,0.06)",border:`1px solid ${C.accent}44`,borderRadius:12,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:14,fontWeight:600}}>{a.name}</span>
            <span style={{fontSize:10,fontFamily:"monospace",background:C.accent,color:C.bg,fontWeight:700,borderRadius:4,padding:"2px 7px",textTransform:"uppercase"}}>Superuser</span>
            {me?.id===a.id&&<span style={{fontSize:11,color:C.accent}}>(you)</span>}
          </div>
          <span style={{fontSize:12,color:C.textDim}}>Full access — cannot be restricted</span>
        </div>
      ))}

      {others.length===0?(
        <div style={{textAlign:"center",padding:"36px 0",border:`1px dashed ${C.border}`,borderRadius:12}}>
          <ShieldCheck size={22} color={C.border} style={{margin:"0 auto 10px"}}/>
          <p style={{fontSize:14,color:C.textFaint}}>No other admins yet. Add one in Settings to assign permissions.</p>
        </div>
      ):(
        <div className="rfs" style={{border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,overflow:"hidden",overflowX:"auto",background:"rgba(255,255,255,0.03)"}}>
          <table style={{width:"100%",fontSize:13,borderCollapse:"collapse",minWidth:560}}>
            <thead>
              <tr style={{background:"rgba(255,255,255,0.06)"}}>
                <th style={{padding:"9px 14px",fontFamily:"monospace",fontSize:10,color:C.textFaint,textTransform:"uppercase",letterSpacing:"0.05em",textAlign:"left"}}>Admin</th>
                {PERMISSIONS.map(([k,label])=>(
                  <th key={k} style={{padding:"9px 14px",fontFamily:"monospace",fontSize:10,color:C.textFaint,textTransform:"uppercase",letterSpacing:"0.05em",textAlign:"center",whiteSpace:"nowrap"}}>{label.replace(/^Manage |^Email \/ /,"").replace("registrations","Regs.")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {others.map(a=>{
                const p={...DEFAULT_PERMS,...permsOf(a)};
                const rowBusy=busyId===a.id;
                return(
                  <tr key={a.id} data-testid={"perm-row-"+a.id} style={{borderTop:`1px solid ${C.border}`,opacity:rowBusy?.6:1}}>
                    <td style={{padding:"10px 14px",whiteSpace:"nowrap",fontWeight:600}}>
                      {a.name}{me?.id===a.id&&<span style={{fontSize:11,color:C.accent,marginLeft:6}}>(you)</span>}
                    </td>
                    {PERMISSIONS.map(([k])=>(
                      <td key={k} style={{padding:"10px 14px",textAlign:"center"}}>
                        <div style={{display:"flex",justifyContent:"center"}}>
                          <Toggle on={!!p[k]} disabled={rowBusy} testid={"perm-toggle-"+a.id+"-"+k} onClick={()=>setPerm(a,k,!p[k])}/>
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettingsTab({admins,setAdmins,me,isSuper,perms,setAuthed,setMe}){
  const [nn,setNn]=useState(""); const [np,setNp]=useState(""); const [npc,setNpc]=useState("");
  const [aErr,setAErr]=useState(""); const [aBusy,setABusy]=useState(false);
  const [cp,setCp]=useState(""); const [chp,setChp]=useState(""); const [chpc,setChpc]=useState("");
  const [cErr,setCErr]=useState(""); const [cOk,setCOk]=useState(""); const [cBusy,setCBusy]=useState(false);
  const [confDel,setConfDel]=useState(null);

  // Apps Script email config + OTP toggle
  const [asUrl,       setAsUrl]       = useState("");    // Apps Script URL
  const [asErr,       setAsErr]       = useState("");
  const [asOk,        setAsOk]        = useState("");
  const [asBusy,      setAsBusy]      = useState(false);
  const [asLoaded,    setAsLoaded]    = useState(false);

  useEffect(()=>{
    (async()=>{
      const r = await safeGet(EMAIL_CFG_KEY);
      if(r){ const cfg=JSON.parse(r.value); setAsUrl(cfg.url||""); }
      setAsLoaded(true);
    })();
  },[]);

  const saveAs = async () => {
    setAsErr(""); setAsOk("");
    if(asUrl.trim() && !asUrl.includes("script.google.com")){ setAsErr("That doesn't look like an Apps Script URL."); return; }
    setAsBusy(true);
    // Preserve the OTP flag (managed from the Emails tab) — merge, don't clobber.
    let otpRequired=false;
    try{ const r=await safeGet(EMAIL_CFG_KEY); if(r) otpRequired=!!JSON.parse(r.value).otpRequired; }catch(e){}
    const ok = await safeSave(EMAIL_CFG_KEY, { url: asUrl.trim(), otpRequired });
    if(ok){ await logActivity(me?.name,"Updated Apps Script URL",""); setAsOk("Settings saved."); }
    else setAsErr("Failed to save. Try again.");
    setAsBusy(false);
  };

  const save=async(next)=>{const ok=await safeSave(ADMIN_KEY,next);if(ok)setAdmins(next);return ok;};

  const addAdmin=async()=>{
    setAErr("");
    if(!nn.trim()){setAErr("Name is required.");return;}
    if(np.length<6){setAErr("Passcode must be at least 6 characters.");return;}
    if(np!==npc){setAErr("Passcodes don't match.");return;}
    setABusy(true);
    const h=await hashPC(np);
    if(admins.some(a=>a.passcodeHash===h)){setAErr("That passcode is already in use.");setABusy(false);return;}
    const newName=nn.trim();
    const ok=await save([...admins,{id:uid(),name:newName,passcodeHash:h,super:false,perms:{...DEFAULT_PERMS}}]);
    if(ok){await logActivity(me?.name,"Added admin",newName);setNn("");setNp("");setNpc("");}
    else setAErr("Failed to save.");
    setABusy(false);
  };

  const delAdmin=async(id)=>{
    if(admins.length<=1){setAErr("Can't remove the last admin.");setConfDel(null);return;}
    const gone=admins.find(a=>a.id===id);
    if(gone&&isSuperAdmin(gone,admins)){setAErr("The superuser can't be removed.");setConfDel(null);return;}
    const ok=await save(admins.filter(a=>a.id!==id));
    if(ok){await logActivity(me?.name,"Removed admin",gone?gone.name:id);setConfDel(null);if(me?.id===id){clearAdminSession();setAuthed(false);setMe(null);}}
  };

  const changePass=async()=>{
    setCErr("");setCOk("");
    if(chp.length<6){setCErr("New passcode must be at least 6 chars.");return;}
    if(chp!==chpc){setCErr("New passcodes don't match.");return;}
    setCBusy(true);
    const ch=await hashPC(cp),m=admins.find(a=>a.id===me?.id);
    if(!m||m.passcodeHash!==ch){setCErr("Current passcode is incorrect.");setCBusy(false);return;}
    const nh=await hashPC(chp);
    const ok=await save(admins.map(a=>a.id===me.id?{...a,passcodeHash:nh}:a));
    if(ok){await logActivity(me?.name,"Changed own passcode","");setCp("");setChp("");setChpc("");setCOk("Passcode updated successfully.");}
    else setCErr("Failed to save.");
    setCBusy(false);
  };

  const sec={...glass,padding:20,display:"grid",gap:10};
  const slbl={fontSize:13,fontWeight:600,color:C.textDim};

  const canSettings = isSuper || !!(perms&&perms.settings);
  return(
    <div style={{display:"grid",gap:16,width:"100%",maxWidth:1000, margin:"0 auto"}}>
      {isSuper && (<>
      <div style={sec}>
        <p style={slbl}>Admins ({admins.length})</p>
        {admins.map(a=>(
          <div key={a.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:8}}>
            <span style={{fontSize:14,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>{a.name}
              {isSuperAdmin(a,admins)&&<span style={{fontSize:10,fontFamily:"monospace",background:C.accent,color:C.bg,fontWeight:700,borderRadius:4,padding:"2px 7px",textTransform:"uppercase"}}>Superuser</span>}
              {me?.id===a.id&&<span style={{fontSize:11,color:C.accent}}>(you)</span>}</span>
            {confDel===a.id?(
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontSize:12,color:C.error}}>Remove?</span>
                <button data-testid={"admin-remove-confirm-"+a.id} onClick={()=>delAdmin(a.id)} style={{fontSize:12,background:C.error,color:"#fff",fontWeight:600,border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>Confirm</button>
                <button onClick={()=>setConfDel(null)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textFaint,borderRadius:6,padding:"4px 7px",cursor:"pointer",display:"flex"}}><X size={12}/></button>
              </div>
            ):(
              <button data-testid={"admin-remove-"+a.id} onClick={()=>setConfDel(a.id)} disabled={admins.length<=1||isSuperAdmin(a,admins)} title={isSuperAdmin(a,admins)?"The superuser can't be removed":"Remove admin"} style={{background:"transparent",border:`1px solid ${C.error}66`,color:C.error,borderRadius:6,padding:"4px 7px",cursor:(admins.length<=1||isSuperAdmin(a,admins))?"default":"pointer",opacity:(admins.length<=1||isSuperAdmin(a,admins))?.3:1,display:"flex"}}><Trash2 size={13}/></button>
            )}
          </div>
        ))}
        {aErr&&<p style={{fontSize:12,color:C.error}}>{aErr}</p>}
      </div>

      <div style={sec}>
        <p style={slbl}>Add new admin</p>
        <input data-testid="add-admin-name" value={nn} onChange={e=>setNn(e.target.value)} placeholder="Name" style={iSty} onFocus={fi} onBlur={fo}/>
        <input data-testid="add-admin-passcode" type="password" value={np} onChange={e=>setNp(e.target.value)} placeholder="Passcode (min 6 chars)" style={iSty} onFocus={fi} onBlur={fo}/>
        <input data-testid="add-admin-confirm" type="password" value={npc} onChange={e=>setNpc(e.target.value)} placeholder="Confirm passcode" style={iSty} onFocus={fi} onBlur={fo}/>
        <button data-testid="add-admin-btn" onClick={addAdmin} disabled={aBusy} onMouseEnter={e=>{if(!aBusy)ctaHover(e);}} onMouseLeave={ctaLeave} style={{background:C.accent,color:C.bg,fontWeight:600,fontSize:13,border:"none",borderRadius:12,padding:"8px 14px",cursor:aBusy?"default":"pointer",opacity:aBusy?.6:1,display:"flex",alignItems:"center",gap:6,width:"fit-content",transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}>
          {aBusy?<><Loader2 size={13} className="animate-spin"/>Adding...</>:<><Plus size={13}/>Add admin</>}
        </button>
      </div>
      </>)}

      <div style={sec}>
        <p style={slbl}>Change my passcode</p>
        <input data-testid="changepass-current" type="password" value={cp} onChange={e=>setCp(e.target.value)} placeholder="Current passcode" style={iSty} onFocus={fi} onBlur={fo}/>
        <input data-testid="changepass-new" type="password" value={chp} onChange={e=>setChp(e.target.value)} placeholder="New passcode (min 6 chars)" style={iSty} onFocus={fi} onBlur={fo}/>
        <input data-testid="changepass-confirm" type="password" value={chpc} onChange={e=>setChpc(e.target.value)} placeholder="Confirm new passcode" style={iSty} onFocus={fi} onBlur={fo}/>
        {cErr&&<p style={{fontSize:12,color:C.error}}>{cErr}</p>}
        {cOk&&<p style={{fontSize:12,color:C.success}}>{cOk}</p>}
        <button data-testid="changepass-btn" onClick={changePass} disabled={cBusy} onMouseEnter={e=>{if(!cBusy)ctaHover(e);}} onMouseLeave={ctaLeave} style={{background:C.accent,color:C.bg,fontWeight:600,fontSize:13,border:"none",borderRadius:12,padding:"8px 14px",cursor:cBusy?"default":"pointer",opacity:cBusy?.6:1,display:"flex",alignItems:"center",gap:6,width:"fit-content",transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}>
          {cBusy?<><Loader2 size={13} className="animate-spin"/>Updating...</>:"Update passcode"}
        </button>
      </div>

      {/* Apps Script email sender configuration */}
      {canSettings && (
      <div style={sec}>
        <p style={slbl}>Email sender (Google Apps Script)</p>
        <p style={{fontSize:12,color:C.textFaint,lineHeight:1.6,marginBottom:10}}>
          All app emails (OTP, confirmation, bulk) are sent through your own Gmail via a Google Apps Script web app.
          Deploy the provided <span style={{fontFamily:"monospace",fontSize:11,color:C.accent}}>email-sender.gs</span> at&nbsp;
          <a href="https://script.google.com" target="_blank" rel="noreferrer" style={{color:C.accent}}>script.google.com</a>
          &nbsp;(Deploy → Web app → Execute as: Me → Access: Anyone), then paste the <span style={{color:C.text}}>/exec</span> URL below.
          OTP verification itself is turned on/off in the <span style={{color:C.text}}>Emails</span> tab.
        </p>
        {!asLoaded ? <p style={{fontSize:12,color:C.textFaint}}>Loading...</p> : (
          <>
            <div>
              <label style={{fontFamily:"monospace",fontSize:11,color:C.textFaint,letterSpacing:"0.08em"}}>APPS SCRIPT WEB APP URL</label>
              <input
                data-testid="appsscript-url-input"
                value={asUrl}
                onChange={e=>{setAsUrl(e.target.value);setAsErr("");setAsOk("");}}
                placeholder="https://script.google.com/macros/s/.../exec"
                style={{...iSty,marginTop:5,fontSize:12}}
                onFocus={fi} onBlur={fo}
              />
            </div>
            {asErr&&<p style={{fontSize:12,color:C.error}}>{asErr}</p>}
            {asOk&&<p style={{fontSize:12,color:C.success}}>{asOk}</p>}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button data-testid="settings-save-btn" onClick={saveAs} disabled={asBusy} onMouseEnter={e=>{if(!asBusy)ctaHover(e);}} onMouseLeave={ctaLeave} style={{background:C.accent,color:C.bg,fontWeight:600,fontSize:13,border:"none",borderRadius:12,padding:"8px 14px",cursor:asBusy?"default":"pointer",opacity:asBusy?.6:1,display:"flex",alignItems:"center",gap:6,transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"}}>
                {asBusy?<><Loader2 size={13} className="animate-spin"/>Saving...</>:"Save settings"}
              </button>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}