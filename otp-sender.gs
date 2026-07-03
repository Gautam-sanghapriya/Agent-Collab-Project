function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var toEmail = String(params.to_email || "").trim();
  var toName = String(params.to_name || "there").trim();
  var otpCode = String(params.otp_code || "").trim();
  var sessionTitle = String(params.session_title || "AI Ready session").trim();
  var expiryMinutes = String(params.expiry_minutes || "5").trim();

  if (!toEmail || !otpCode) {
    return jsonResponse({
      ok: false,
      error: "Missing to_email or otp_code",
    });
  }

  var subject = "Your AI Ready verification code";
  var htmlBody = buildOtpEmailHtml(toName, otpCode, sessionTitle, expiryMinutes);
  var plainBody =
    "Hi " + toName + ",\n\n" +
    "Your verification code for " + sessionTitle + " is " + otpCode + ".\n" +
    "It expires in " + expiryMinutes + " minutes.\n\n" +
    "If you did not request this, you can ignore this email.";

  MailApp.sendEmail({
    to: toEmail,
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody,
    name: "AI Ready",
  });

  return jsonResponse({
    ok: true,
  });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildOtpEmailHtml(toName, otpCode, sessionTitle, expiryMinutes) {
  var safeName = escapeHtml(toName);
  var safeCode = escapeHtml(otpCode);
  var safeSession = escapeHtml(sessionTitle);
  var safeExpiry = escapeHtml(expiryMinutes);

  return '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
    '<meta charset="UTF-8"/>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>' +
    '<style>' +
    '@media only screen and (max-width:480px){' +
    '.eo{padding:12px 6px!important}.ec{width:100%!important;border-radius:12px!important}' +
    '.px{padding-left:16px!important;padding-right:16px!important}' +
    '.oc{font-size:30px!important;letter-spacing:6px!important;text-indent:6px!important}' +
    '.op{padding:18px 12px!important}.h1{font-size:20px!important}' +
    '}' +
    '</style>' +
    '</head>' +
    '<body style="margin:0;padding:0;background-color:#1b3a5c;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="eo" style="background-color:#1b3a5c;padding:32px 16px;">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ec" style="max-width:460px;width:100%;table-layout:fixed;background-color:#0d1b2a;border:1px solid #14344d;border-radius:16px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">' +
    '<tr><td class="px" style="padding:22px 24px 0 24px;">' +
    '<p style="margin:0;font-family:Courier New,monospace;font-size:12px;letter-spacing:2px;color:rgba(255,255,255,0.45);text-transform:uppercase;">&#9679;&nbsp; AI READY</p>' +
    '</td></tr>' +
    '<tr><td class="px" style="padding:20px 24px 0 24px;">' +
    '<p style="margin:0 0 8px 0;font-family:Courier New,monospace;font-size:11px;letter-spacing:2px;color:#00aeef;text-transform:uppercase;">Email Verification</p>' +
    '<h1 class="h1" style="margin:0;font-size:24px;font-weight:700;color:#FFFFFF;line-height:1.3;">Enter your OTP</h1>' +
    '</td></tr>' +
    '<tr><td class="px" style="padding:20px 24px 0 24px;font-size:15px;color:#FFFFFF;line-height:1.6;">' +
    'Hi <strong>' + safeName + '</strong>,<br/>' +
    '<span style="font-size:14px;color:rgba(255,255,255,0.60);">Thanks for registering for <strong style="color:#FFFFFF;">' + safeSession + '</strong>. Enter the code below to verify your email and confirm your spot.</span>' +
    '</td></tr>' +
    '<tr><td class="px" style="padding:24px 24px 0 24px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#14344d;border:1px solid #1f5a7a;border-left:4px solid #00aeef;border-radius:10px;">' +
    '<tr><td class="op" style="padding:24px;text-align:center;">' +
    '<p style="margin:0 0 12px 0;font-family:Courier New,monospace;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.45);text-transform:uppercase;">4-Digit Code</p>' +
    '<p class="oc" style="margin:0 0 12px 0;font-family:Courier New,monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:#00aeef;line-height:1.1;text-indent:8px;word-break:break-all;">' + safeCode + '</p>' +
    '<p style="margin:0;font-size:12px;color:rgba(255,255,255,0.45);">Expires in <strong style="color:rgba(255,255,255,0.60);">' + safeExpiry + ' minutes</strong></p>' +
    '</td></tr>' +
    '</table>' +
    '</td></tr>' +
    '<tr><td class="px" style="padding:24px 24px 0 24px;">' +
    '<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.60);line-height:1.6;">Enter this code on the registration page to complete your sign-up. If you did not request this, you can safely ignore this email.</p>' +
    '</td></tr>' +
    '<tr><td class="px" style="padding:20px 24px 24px 24px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    '<tr><td style="border-top:1px solid #14344d;padding-top:18px;">' +
    '<p style="margin:0;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.6;">For your security, this code can only be used once and expires in ' + safeExpiry + ' minutes.</p>' +
    '</td></tr>' +
    '</table>' +
    '</td></tr>' +
    '<tr><td class="px" style="background-color:#1b3a5c;padding:16px 24px;">' +
    '<p style="margin:0;font-family:Courier New,monospace;font-size:10px;color:rgba(255,255,255,0.45);text-align:center;letter-spacing:0.5px;">Registrations are stored securely and never shared with third parties.</p>' +
    '</td></tr>' +
    '</table>' +
    '</td></tr>' +
    '</table>' +
    '</body>' +
    '</html>';
}
