/**
 * AI Ready — email sender (Google Apps Script web app)
 * ---------------------------------------------------------------------------
 *   • doGet  — OTP verification emails (fired as an <img> GET)
 *   • doPost — confirmation + bulk emails (subject/body configured in the app)
 *
 * DEPLOY:
 *   1. https://script.google.com → paste this file.
 *   2. Deploy → New deployment → "Web app"
 *        Execute as:     Me
 *        Who has access: Anyone
 *   3. Copy the /exec URL → Admin → Settings in the app.
 *
 * IMPORTANT — reading the logs:
 *   Every run now records what happened (recipient, type, remaining quota, and
 *   any error) to the Execution log. A run marked "Completed" in the list can
 *   still have FAILED to send — open the run and read the log, or run the
 *   diagnose() function below. Send failures now also re-throw so they show as
 *   "Failed" in the Executions list instead of a misleading "Completed".
 */

// ── Run this manually from the editor to see WHY mail isn't arriving ─────────
function diagnose() {
  var remaining = MailApp.getRemainingDailyQuota();
  Logger.log('Remaining daily email quota: ' + remaining);
  if (remaining <= 0) {
    Logger.log('QUOTA EXHAUSTED — this is why emails are not being sent. It resets on a rolling 24h basis.');
    return;
  }
  var me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({ to: me, subject: 'AI Ready — diagnostic test', htmlBody: '<b>It works.</b> Sent ' + new Date(), name: 'AI Ready' });
  Logger.log('Test email dispatched to ' + me + '. Check that inbox (and Spam).');
}

function checkQuota() {
  Logger.log('Remaining daily email quota: ' + MailApp.getRemainingDailyQuota());
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
    _send(p.to_email, 'Your AI Ready verification code: ' + p.otp_code, _otpHtml(name, p.otp_code, session, minutes));
    return _ok('otp sent');
  } catch (err) {
    Logger.log('doGet SEND FAILED: ' + err);
    throw err; // surface as "Failed" in Executions so the reason is visible
  }
}

// ── Confirmation + bulk email (POST) ─────────────────────────────────────────
function doPost(e) {
  var p = (e && e.parameter) || {};
  var remaining = MailApp.getRemainingDailyQuota();
  Logger.log('doPost type=%s to=%s quotaLeft=%s', p.type || 'email', p.to_email, remaining);
  try {
    if (!p.to_email || !p.subject) return _ok('missing params');
    _send(p.to_email, p.subject, p.html || p.body || '');
    return _ok('sent:' + (p.type || 'email'));
  } catch (err) {
    Logger.log('doPost SEND FAILED: ' + err);
    throw err; // surface as "Failed" in Executions
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function _send(to, subject, html) {
  if (MailApp.getRemainingDailyQuota() <= 0) {
    throw new Error('Daily email quota exhausted — cannot send to ' + to);
  }
  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: 'AI Ready' });
  Logger.log('Sent to ' + to);
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
    '<tr><td style="padding:24px 26px 0 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid rgba(0,174,239,0.15);padding-top:16px;"><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.6;">For your security this code can only be used once and expires in ' + minutes + ' minutes. AI Ready will never ask for your password or payment details by email.</p></td></tr></table></td></tr>' +
    '<tr><td style="padding:16px 26px 24px 26px;"><p style="margin:0;font-family:monospace;font-size:10px;color:rgba(255,255,255,0.40);text-align:center;letter-spacing:0.5px;">Registrations are stored securely and never shared with third parties.</p></td></tr>' +
  '</table>' +
  '</td></tr></table></body></html>';
}