/**
 * ═══════════════════════════════════════════════════════════
 *  여누솔루션 J.A.R.V.I.S — Google Apps Script v3
 *  ▶ AI 프록시 + DB 통합 (CORS 완전 해결)
 *  ▶ Anthropic API 키를 Apps Script에 보관 → 보안 강화
 *  ▶ 붙여넣기: Apps Script 편집기 기존 코드 전체 교체
 *  ▶ 배포: 웹 앱 → 액세스: "모든 사용자" → 새 배포
 * ═══════════════════════════════════════════════════════════
 *
 *  [구글시트 시트명 - 정확히 맞춰야 함]
 *  고객DB / 협력사DB / 문의DB / 발송이력
 *
 *  [각 시트 1행 헤더]
 *  고객DB·협력사DB : 회사명, 담당자, 이메일, 전화, 업종, 카테고리, 등록일, 메모
 *  문의DB          : 날짜, 문의자, 이메일, 문의유형, 내용, 처리상태, 답변
 *  발송이력        : 발송일, 수신자, 이메일, 제목, 카테고리, 결과, 본문요약
 */

// ★★ 아래 두 값을 반드시 입력하세요 ★★
var SHEET_ID        = 'YOUR_GOOGLE_SHEET_ID_HERE';   // 구글시트 ID
var ANTHROPIC_KEY   = 'YOUR_ANTHROPIC_API_KEY_HERE'; // sk-ant-... 형식

var SHEETS = {
  customer : '고객DB',
  partner  : '협력사DB',
  inquiry  : '문의DB',
  maillog  : '발송이력'
};

// ─────────────────────────────────────────────
// 응답 헬퍼 (JSONP / JSON 자동 선택)
// ─────────────────────────────────────────────
function respond(data, callback) {
  var json = JSON.stringify(data);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────
// GET 라우터
// ─────────────────────────────────────────────
function doGet(e) {
  var p        = e.parameter || {};
  var action   = p.action   || 'ping';
  var callback = p.callback || '';
  var result;

  try {
    if      (action === 'ping')          result = { success: true, message: 'J.A.R.V.I.S 연결 성공!' };
    else if (action === 'getContacts')   result = getContacts(p.category || '', p.industry || '');
    else if (action === 'searchContact') result = searchContact(p.keyword || '');
    else if (action === 'getInquiries')  result = getInquiries(p.status || '');
    else if (action === 'getMailLog')    result = getMailLog();
    else result = { success: false, error: '알 수 없는 action: ' + action };
  } catch (err) {
    result = { success: false, error: err.toString() };
  }

  return respond(result, callback);
}

// ─────────────────────────────────────────────
// POST 라우터
// ─────────────────────────────────────────────
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (_) {}

  var callback = body.callback || '';
  var result;

  try {
    if      (body.action === 'chat')          result = proxyChat(body.messages, body.system);
    else if (body.action === 'addContact')    result = addContact(body.data);
    else if (body.action === 'saveInquiry')   result = saveInquiry(body.data);
    else if (body.action === 'sendBulkMail')  result = sendBulkMail(body.category, body.subject, body.body, body.industry);
    else if (body.action === 'updateInquiry') result = updateInquiry(body.row, body.status, body.answer);
    else result = { success: false, error: '알 수 없는 action: ' + body.action };
  } catch (err) {
    result = { success: false, error: err.toString() };
  }

  return respond(result, callback);
}

// ═════════════════════════════════════════════
// AI 프록시 — Anthropic API 중계
// ═════════════════════════════════════════════
function proxyChat(messages, systemPrompt) {
  if (!ANTHROPIC_KEY || ANTHROPIC_KEY === 'YOUR_ANTHROPIC_API_KEY_HERE') {
    return { success: false, error: 'Apps Script에 Anthropic API 키가 설정되지 않았습니다.' };
  }

  var payload = {
    model      : 'claude-haiku-4-5-20251001',
    max_tokens : 1000,
    messages   : messages || []
  };
  if (systemPrompt) payload.system = systemPrompt;

  var options = {
    method      : 'post',
    contentType : 'application/json',
    headers     : {
      'x-api-key'         : ANTHROPIC_KEY,
      'anthropic-version' : '2023-06-01'
    },
    payload     : JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var res  = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
  var data = JSON.parse(res.getContentText());

  if (data.error) return { success: false, error: data.error.message };
  if (data.content && data.content[0]) {
    return { success: true, reply: data.content[0].text };
  }
  return { success: false, error: '응답을 받지 못했습니다.' };
}

// ═════════════════════════════════════════════
// 연락처 조회
// ═════════════════════════════════════════════
function getContacts(category, industry) {
  var ss  = SpreadsheetApp.openById(SHEET_ID);
  var out = [];

  ['customer', 'partner'].forEach(function(type) {
    var sheet = ss.getSheetByName(SHEETS[type]);
    if (!sheet) return;
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row[0] && !row[2]) continue;
      var cat = String(row[5] || '');
      var ind = String(row[4] || '');
      var tp  = type === 'customer' ? '고객' : '협력사';
      if (category && cat !== category && tp !== category) continue;
      if (industry && ind !== industry) continue;
      out.push({
        rowIndex : i + 1,
        type     : tp,
        company  : String(row[0] || ''),
        contact  : String(row[1] || ''),
        email    : String(row[2] || ''),
        phone    : String(row[3] || ''),
        industry : ind,
        category : cat,
        createdAt: row[6] ? Utilities.formatDate(new Date(row[6]), 'Asia/Seoul', 'yyyy-MM-dd') : '',
        memo     : String(row[7] || '')
      });
    }
  });

  return { success: true, count: out.length, data: out };
}

// ═════════════════════════════════════════════
// 연락처 검색
// ═════════════════════════════════════════════
function searchContact(keyword) {
  if (!keyword) return getContacts('', '');
  var kw  = keyword.toLowerCase();
  var all = getContacts('', '');
  var filtered = all.data.filter(function(c) {
    return (c.company + c.contact + c.email + c.industry).toLowerCase().indexOf(kw) >= 0;
  });
  return { success: true, count: filtered.length, data: filtered };
}

// ═════════════════════════════════════════════
// 연락처 추가
// ═════════════════════════════════════════════
function addContact(data) {
  if (!data || !data.email) return { success: false, error: '이메일은 필수입니다.' };
  var ss        = SpreadsheetApp.openById(SHEET_ID);
  var sheetName = (data.type === '협력사') ? SHEETS.partner : SHEETS.customer;
  var sheet     = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: '"' + sheetName + '" 시트를 찾을 수 없습니다.' };
  sheet.appendRow([
    data.company || '', data.contact || '', data.email,
    data.phone || '', data.industry || '',
    data.category || data.type || '기타',
    new Date(), data.memo || ''
  ]);
  return { success: true, message: (data.company || data.email) + ' 등록 완료' };
}

// ═════════════════════════════════════════════
// 문의 저장
// ═════════════════════════════════════════════
function saveInquiry(data) {
  if (!data) return { success: false, error: '데이터가 없습니다.' };
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.inquiry);
  if (!sheet) return { success: false, error: '"문의DB" 시트를 찾을 수 없습니다.' };
  sheet.appendRow([
    new Date(), data.name || '미입력', data.email || '',
    data.type || '일반문의', data.content || '', '접수', ''
  ]);
  return { success: true, message: '문의가 저장되었습니다.' };
}

// ═════════════════════════════════════════════
// 문의 목록 조회
// ═════════════════════════════════════════════
function getInquiries(status) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.inquiry);
  if (!sheet) return { success: false, error: '"문의DB" 시트가 없습니다.' };
  var rows = sheet.getDataRange().getValues();
  var out  = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    if (status && String(r[5]) !== status) continue;
    out.push({
      rowIndex : i + 1,
      date     : Utilities.formatDate(new Date(r[0]), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
      name     : String(r[1] || ''), email   : String(r[2] || ''),
      type     : String(r[3] || ''), content : String(r[4] || ''),
      status   : String(r[5] || '접수'), answer: String(r[6] || '')
    });
  }
  return { success: true, count: out.length, data: out };
}

// ═════════════════════════════════════════════
// 문의 상태 업데이트
// ═════════════════════════════════════════════
function updateInquiry(rowIndex, status, answer) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.inquiry);
  if (!sheet) return { success: false, error: '시트 없음' };
  sheet.getRange(rowIndex, 6).setValue(status || '처리완료');
  if (answer) sheet.getRange(rowIndex, 7).setValue(answer);
  return { success: true, message: '업데이트 완료' };
}

// ═════════════════════════════════════════════
// 대량 메일 발송
// ═════════════════════════════════════════════
function sendBulkMail(category, subject, body, industry) {
  if (!subject || !body) return { success: false, error: '제목과 본문은 필수입니다.' };
  var contacts = getContacts(category || '', industry || '');
  if (!contacts.success || contacts.count === 0)
    return { success: false, error: '발송 대상이 없습니다.' };

  var sent = [], failed = [];
  contacts.data.forEach(function(c) {
    if (!c.email) return;
    try {
      var personalBody = body
        .replace(/\{회사명\}/g, c.company)
        .replace(/\{담당자\}/g, c.contact || '담당자')
        .replace(/\{업종\}/g,   c.industry);
      GmailApp.sendEmail(c.email, subject, personalBody, {
        name    : '황순주 (여누솔루션)',
        htmlBody: personalBody.replace(/\n/g, '<br>')
      });
      sent.push(c.email);
      logMail({ to: c.contact + '/' + c.company, email: c.email,
                subject: subject, category: category || '전체',
                result: '성공', summary: body.substring(0, 60) });
    } catch (err) {
      failed.push({ email: c.email, error: err.toString() });
    }
  });
  return {
    success     : true,
    sentCount   : sent.length,
    failedCount : failed.length,
    message     : '총 ' + contacts.count + '명 중 ' + sent.length + '명 발송 완료'
  };
}

// ═════════════════════════════════════════════
// 발송 이력 기록
// ═════════════════════════════════════════════
function logMail(data) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.maillog);
  if (!sheet) return;
  sheet.appendRow([
    new Date(), data.to || '', data.email || '',
    data.subject || '', data.category || '', data.result || '성공', data.summary || ''
  ]);
}

// ═════════════════════════════════════════════
// 발송 이력 조회
// ═════════════════════════════════════════════
function getMailLog() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.maillog);
  if (!sheet) return { success: false, error: '"발송이력" 시트가 없습니다.' };
  var rows = sheet.getDataRange().getValues();
  var out  = rows.slice(1).filter(function(r){ return r[0]; })
    .reverse().slice(0, 50)
    .map(function(r) {
      return {
        date    : Utilities.formatDate(new Date(r[0]), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
        to      : String(r[1]||''), email   : String(r[2]||''),
        subject : String(r[3]||''), category: String(r[4]||''),
        result  : String(r[5]||''), summary : String(r[6]||'')
      };
    });
  return { success: true, count: out.length, data: out };
}
