/**
 * Email sender (Google Apps Script web app)
 * ---------------------------------------------------------------------------
 *   • doGet  — OTP verification emails (fired as an <img> GET)
 *   • doPost — confirmation + bulk emails, and email-schedule commands
 *   • processSchedules — time-driven trigger: sends scheduled emails
 *
 * DEPLOY:
 *   1. https://script.google.com → paste this file.
 *   2. Deploy → New deployment → "Web app"
 *        Execute as:     Me
 *        Who has access: Anyone
 *   3. Copy the /exec URL → Admin → Settings in the app.
 *   4. ONCE: in the editor pick "installScheduler" in the function dropdown
 *      and Run it (creates the every-5-minutes trigger for scheduled emails).
 *
 * IMPORTANT — reading the logs:
 *   Every run now records what happened (recipient, type, remaining quota, and
 *   any error) to the Execution log. A run marked "Completed" in the list can
 *   still have FAILED to send — open the run and read the log, or run the
 *   diagnose() function below. Send failures now also re-throw so they show as
 *   "Failed" in the Executions list instead of a misleading "Completed".
 */

function diagnose() {
  var remaining = MailApp.getRemainingDailyQuota();

  Logger.log('Remaining daily email quota: ' + remaining);

  if (remaining <= 0) {
    Logger.log('QUOTA EXHAUSTED');
    return;
  }

  var me = Session.getEffectiveUser().getEmail();

  GmailApp.sendEmail(
    me,
    'Diagnostic test',
    'It works. Sent ' + new Date(),
    {
      htmlBody: '<b>It works.</b><br>Sent ' + new Date(),
      name: 'Shri Tech Partners',
      from: 'admin@shritechpartners.com',
      replyTo: 'admin@shritechpartners.com'
    }
  );

  Logger.log(
    'Test email dispatched from admin@shritechpartners.com to ' + me
  );
}

function checkQuota() {
  Logger.log('Remaining daily email quota: ' + MailApp.getRemainingDailyQuota());
}

function checkAliases() {
  const aliases = GmailApp.getAliases();
  console.log(aliases);
}

// ── OTP email (GET) ──────────────────────────────────────────────────────────
function doGet(e) {
  var p = (e && e.parameter) || {};
  var remaining = MailApp.getRemainingDailyQuota();
  Logger.log('doGet type=%s to=%s quotaLeft=%s', p.type || 'otp', p.to_email, remaining);
  try {
    if (p.subject && p.html) {
      _send(p.to_email, p.subject, p.html);
      return _ok('sent');
    }
    if (!p.to_email || !p.otp_code) return _ok('missing params');
    var name    = p.to_name || 'there';
    var session = p.session_title || 'your session';
    var minutes = p.expiry_minutes || '5';
    _send(p.to_email, 'Your verification code: ' + p.otp_code, _otpHtml(name, p.otp_code, session, minutes));
    return _ok('otp sent');
  } catch (err) {
    Logger.log('doGet SEND FAILED: ' + err);
    throw err; // surface as "Failed" in Executions so the reason is visible
  }
}

// ── Confirmation + bulk email + scheduler commands (POST) ───────────────────
function doPost(e) {
  var p = (e && e.parameter) || {};
  var remaining = MailApp.getRemainingDailyQuota();
  Logger.log('doPost type=%s to=%s quotaLeft=%s attachment=%s', p.type || 'email', p.to_email, remaining, p.materials_url ? 'yes' : 'no');

  try {
    // ── Scheduler commands (no email sent now; stored for the trigger) ──
    if (p.type === 'schedule_upsert') { _schedUpsert(p); return _ok('schedule_upserted:' + p.id); }
    if (p.type === 'schedule_delete') { _schedDelete(p.id); return _ok('schedule_deleted:' + p.id); }

    if (!p.to_email || !p.subject) return _ok('missing params');
    _send(p.to_email, p.subject, p.html || p.body || '', _bannerBlob(p), p.materials_url, p.materials_name);
    return _ok('sent:' + (p.type || 'email'));
  } catch (err) {
    Logger.log('doPost SEND FAILED: ' + err);
    throw err; // surface as "Failed" in Executions
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function _send(to, subject, html, bannerBlob, attachmentUrl, attachmentName) {

  if (MailApp.getRemainingDailyQuota() <= 0) {
    throw new Error(
      'Daily email quota exhausted — cannot send to ' + to
    );
  }

  var options = {
    htmlBody: html,
    name: 'Shri Tech Partners',
    from: 'admin@shritechpartners.com',
    replyTo: 'admin@shritechpartners.com'
  };

  if (attachmentUrl) {
    var blob = _fetchAttachment(attachmentUrl, attachmentName);
    if (blob) options.attachments = [blob];
  }

  if (bannerBlob) {
    options.inlineImages = {
      banner: bannerBlob
    };
  }

  GmailApp.sendEmail(
    to,
    subject,
    'Please view this email in an HTML-compatible email client.',
    options
  );

  Logger.log(
    'Sent to ' +
    to +
    ' from admin@shritechpartners.com' +
    (bannerBlob ? ' (with banner)' : '') +
    (options.attachments ? ' (with attachment)' : '')
  );
}

// Decode a base64 banner from the request into an inline-image blob.
// Returns null on any problem — a bad banner must never block the email.
function _bannerBlob(p) {
  try {
    if (!p.banner_b64) return null;
    var bytes = Utilities.base64Decode(p.banner_b64);
    var blob = Utilities.newBlob(bytes, p.banner_mime || 'image/jpeg', 'banner');
    blob.setName('banner');
    Logger.log('banner attached: %s bytes', bytes.length);
    return blob;
  } catch (err) {
    Logger.log('banner decode failed (sending without it): ' + err);
    return null;
  }
}

// ── Email scheduler ───────────────────────────────────────────────────────────
// Schedules are stored in Script Properties as chunked JSON (each property value
// is capped at ~9KB, so large recipient lists are split across chunks):
//   sched_<id>_meta = number of chunks
//   sched_<id>_<n>  = JSON chunk n
// A time-driven trigger runs processSchedules() every 5 minutes and sends
// anything due. Run installScheduler() ONCE from the editor to create it.

var SCHED_CHUNK = 8000; // chars per property chunk (limit is ~9KB)

function _schedUpsert(p) {
  if (!p.id || !p.run_at || !p.subject || !p.html || !p.recipients) throw new Error('schedule_upsert: missing fields');
  var payload = JSON.stringify({
    id: p.id,
    run_at: Number(p.run_at),
    subject: p.subject,
    html: p.html,
    recipients: JSON.parse(p.recipients) // [{name,first_name,last_name,role,email}]
  });
  _schedDelete(p.id); // replace: clear any previous chunks first
  var props = PropertiesService.getScriptProperties();
  var n = Math.ceil(payload.length / SCHED_CHUNK);
  for (var i = 0; i < n; i++) {
    props.setProperty('sched_' + p.id + '_' + i, payload.substring(i * SCHED_CHUNK, (i + 1) * SCHED_CHUNK));
  }
  props.setProperty('sched_' + p.id + '_meta', String(n));
  Logger.log('schedule stored: %s (%s chunk(s), run_at=%s)', p.id, n, new Date(Number(p.run_at)));
}

function _schedDelete(id) {
  if (!id) return;
  var props = PropertiesService.getScriptProperties();
  var meta = props.getProperty('sched_' + id + '_meta');
  var n = meta ? Number(meta) : 0;
  for (var i = 0; i < n; i++) props.deleteProperty('sched_' + id + '_' + i);
  props.deleteProperty('sched_' + id + '_meta');
  if (meta) Logger.log('schedule deleted: %s', id);
}

function _schedRead(id) {
  var props = PropertiesService.getScriptProperties();
  var meta = props.getProperty('sched_' + id + '_meta');
  if (!meta) return null;
  var out = '';
  for (var i = 0; i < Number(meta); i++) {
    var c = props.getProperty('sched_' + id + '_' + i);
    if (c === null) return null; // corrupt/partial — treat as missing
    out += c;
  }
  try { return JSON.parse(out); } catch (e) { return null; }
}

// Fill the person placeholders the app left in the template.
function _fill(t, r) {
  return String(t || '')
    .replace(/\{\{\s*name\s*\}\}/g, r.name || '')
    .replace(/\{\{\s*first_name\s*\}\}/g, r.first_name || '')
    .replace(/\{\{\s*last_name\s*\}\}/g, r.last_name || '')
    .replace(/\{\{\s*role\s*\}\}/g, r.role || '')
    .replace(/\{\{\s*email\s*\}\}/g, r.email || '');
}

// Runs on the time-driven trigger. Sends every due schedule, then removes it.
function processSchedules() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log('processSchedules: another run holds the lock; skipping'); return; }
  try {
    var props = PropertiesService.getScriptProperties();
    var keys = props.getKeys();
    var now = Date.now();
    for (var k = 0; k < keys.length; k++) {
      var m = /^sched_(.+)_meta$/.exec(keys[k]);
      if (!m) continue;
      var sched = _schedRead(m[1]);
      if (!sched) { _schedDelete(m[1]); continue; } // unreadable — clean up
      if (sched.run_at > now) continue;             // not due yet
      var quota = MailApp.getRemainingDailyQuota();
      if (quota < sched.recipients.length) {
        Logger.log('SCHEDULE %s BLOCKED: needs %s sends, quota has %s. Will retry next run.', sched.id, sched.recipients.length, quota);
        continue; // leave stored; retried on a later run when quota allows
      }
      var sent = 0, failed = 0;
      for (var i = 0; i < sched.recipients.length; i++) {
        var r = sched.recipients[i];
        try {
          _send(r.email, _fill(sched.subject, r), _fill(sched.html, r));
          sent++;
        } catch (err) {
          failed++;
          Logger.log('schedule %s: send to %s FAILED: %s', sched.id, r.email, err);
        }
      }
      Logger.log('schedule %s done: %s sent, %s failed (scheduled for %s)', sched.id, sent, failed, new Date(sched.run_at));
      _schedDelete(sched.id); // one-shot: remove after the attempt
    }
  } finally {
    lock.releaseLock();
  }
}

// Run this ONCE from the Apps Script editor (Run > installScheduler) after
// deploying. It creates the every-5-minutes trigger. Safe to re-run: it
// removes existing processSchedules triggers first.
function installScheduler() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processSchedules') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('processSchedules').timeBased().everyMinutes(5).create();
  Logger.log('Scheduler installed: processSchedules will run every 5 minutes.');
}

// List pending schedules in the log (debug helper).
function listSchedules() {
  var keys = PropertiesService.getScriptProperties().getKeys();
  var found = 0;
  for (var k = 0; k < keys.length; k++) {
    var m = /^sched_(.+)_meta$/.exec(keys[k]);
    if (!m) continue;
    var s = _schedRead(m[1]);
    if (s) { found++; Logger.log('%s → %s | %s recipient(s) | "%s"', s.id, new Date(s.run_at), s.recipients.length, s.subject); }
  }
  Logger.log(found + ' schedule(s) pending.');
}

// Fetches a file from a public URL (e.g. a Supabase Storage public URL) and
// returns it as a Blob ready for MailApp's `attachments`. Never throws — if
// the fetch fails, the email still sends, just without the attachment; the
// reason is logged so it's visible in Executions.
function _fetchAttachment(url, name) {
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() >= 300) {
      Logger.log('Attachment fetch failed (' + res.getResponseCode() + ') for ' + url);
      return null;
    }
    var blob = res.getBlob();
    if (name) blob.setName(name);
    return blob;
  } catch (err) {
    Logger.log('Attachment fetch threw: ' + err);
    return null;
  }
}

function _ok(msg) {
  return ContentService.createTextOutput(JSON.stringify({ status: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function _otpHtml(name, code, session, minutes) {
  return '' +
  '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>' +
  '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>' +
  '<meta name="color-scheme" content="dark"/></head>' +
  '<body style="margin:0;padding:0;background-color:#1b3a5c;">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1b3a5c" style="background-color:#1b3a5c;background-image:radial-gradient(circle at 12% -5%, rgba(0,174,239,0.30), rgba(0,174,239,0) 42%), radial-gradient(circle at 92% 108%, rgba(0,174,239,0.22), rgba(0,174,239,0) 48%);padding:40px 16px;">' +
  '<tr><td align="center">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#173a5b" style="max-width:480px;width:100%;background-color:rgba(19,39,62,0.72);background-image:linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 140px);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border:1px solid rgba(0,174,239,0.26);border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,0.35), 0 0 46px rgba(0,174,239,0.12);overflow:hidden;font-family:Arial,Helvetica,sans-serif;">' +
    // eyebrow
    '<tr><td style="padding:26px 26px 0 26px;"><p style="margin:0;font-family:monospace;font-size:11px;letter-spacing:2px;color:#00aeef;text-transform:uppercase;">Email verification</p></td></tr>' +
    // body
    '<tr><td style="padding:16px 26px 0 26px;font-size:14px;color:rgba(255,255,255,0.82);line-height:1.7;">Hi <strong style="color:#FFFFFF;">' + name + '</strong>,<br/>Enter the code below to verify your email for <strong style="color:#FFFFFF;">' + session + '</strong>.</td></tr>' +
    // code box — simple frost glass (neutral border, cyan number kept)
    '<tr><td style="padding:22px 26px 0 26px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1c3e5e" style="background-color:rgba(255,255,255,0.05);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.12);border-radius:12px;">' +
        '<tr><td style="padding:22px 18px;text-align:center;">' +
          '<p style="margin:0 0 10px 0;font-family:monospace;font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.50);text-transform:uppercase;">4-Digit Code</p>' +
          '<p style="margin:0 0 10px 0;font-family:monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:#00aeef;line-height:1.1;">' + code + '</p>' +
          '<p style="margin:0;font-size:12px;color:rgba(255,255,255,0.55);">Expires in <strong style="color:rgba(255,255,255,0.75);">' + minutes + ' minutes</strong></p>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +
    // footer
    '<tr><td style="padding:24px 26px 0 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid rgba(0,174,239,0.15);padding-top:16px;"><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.6;">For your security this code can only be used once and expires in ' + minutes + ' minutes. We will never ask for your password or payment details by email.</p></td></tr></table></td></tr>' +
    '<tr><td style="padding:16px 26px 24px 26px;"><p style="margin:0;font-family:monospace;font-size:10px;color:rgba(255,255,255,0.40);text-align:center;letter-spacing:0.5px;">Registrations are stored securely and never shared with third parties.</p></td></tr>' +
  '</table>' +
  '</td></tr></table></body></html>';
}