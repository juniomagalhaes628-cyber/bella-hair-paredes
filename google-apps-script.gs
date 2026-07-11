/**
 * BELLA HAIR PAREDES — Google Apps Script Backend
 * ─────────────────────────────────────────────────
 * COMO INSTALAR (5 minutos):
 *
 * 1. Abra: https://script.google.com
 * 2. Clique "Novo projeto"
 * 3. Apague o código existente e cole este ficheiro inteiro
 * 4. Clique em "Implementar" → "Nova implementação"
 *    • Tipo: Aplicação web
 *    • Executar como: Eu mesmo
 *    • Quem tem acesso: Qualquer pessoa
 * 5. Copie o URL gerado
 * 6. Em marcacoes.html, substitua 'COLE_AQUI_O_URL_DO_APPS_SCRIPT' pelo URL
 *
 * A folha de cálculo é criada automaticamente na primeira execução.
 */

const SHEET_NAME = 'Marcações';
const SHEET_ID   = '';  // Deixe vazio para criar automaticamente

function getSheet() {
  let ss;
  if (SHEET_ID) {
    ss = SpreadsheetApp.openById(SHEET_ID);
  } else {
    const files = DriveApp.getFilesByName('Bella Hair — Marcações');
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      ss = SpreadsheetApp.create('Bella Hair — Marcações');
      const sheet = ss.getActiveSheet();
      sheet.setName(SHEET_NAME);
      sheet.appendRow(['Data', 'Horário', 'Nome', 'Telemóvel', 'Serviço', 'Estado', 'Timestamp']);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#c9a84c').setFontColor('#000000');
    }
  }
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

/**
 * GET ?date=2026-07-15
 * Devolve os horários já reservados para essa data.
 */
function doGet(e) {
  const date = e.parameter.date;
  const result = { booked: [], date: date };

  if (date) {
    const sheet = getSheet();
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const rowDate   = Utilities.formatDate(new Date(data[i][0]), 'GMT', 'yyyy-MM-dd');
      const rowStatus = data[i][5] || '';
      if (rowDate === date && rowStatus !== 'Cancelado') {
        result.booked.push(data[i][1]);
      }
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST { date, time, name, phone, service }
 * Regista nova marcação e envia email de notificação.
 */
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch {
    return jsonResponse({ success: false, error: 'JSON inválido' });
  }

  const { date, time, name, phone, service } = body;
  if (!date || !time) {
    return jsonResponse({ success: false, error: 'Data e horário são obrigatórios' });
  }

  const sheet  = getSheet();
  const data   = sheet.getDataRange().getValues();

  // Verificar se horário já está ocupado
  for (let i = 1; i < data.length; i++) {
    const rowDate   = Utilities.formatDate(new Date(data[i][0]), 'GMT', 'yyyy-MM-dd');
    const rowTime   = data[i][1];
    const rowStatus = data[i][5] || '';
    if (rowDate === date && rowTime === time && rowStatus !== 'Cancelado') {
      return jsonResponse({ success: false, error: 'Horário já reservado', slot: time });
    }
  }

  // Registar marcação
  sheet.appendRow([
    new Date(date + 'T12:00:00'),
    time,
    name  || '',
    phone || '',
    service || '',
    'Pendente',
    new Date(),
  ]);

  // Notificação por email ao salão
  try {
    MailApp.sendEmail({
      to: 'juniomagalhaes628@gmail.com',
      subject: `✂️ Nova marcação — ${name} — ${date} ${time}`,
      htmlBody: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0d0d0d;color:#eef1f4;padding:32px;border-radius:8px">
          <h2 style="color:#c9a84c;margin:0 0 24px">Nova Marcação — Bella Hair</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#aaa;width:120px">Nome</td><td style="padding:8px 0">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#aaa">Telemóvel</td><td style="padding:8px 0"><a href="tel:${phone}" style="color:#c9a84c">${phone}</a></td></tr>
            <tr><td style="padding:8px 0;color:#aaa">Serviço</td><td style="padding:8px 0">${service || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#aaa">Data</td><td style="padding:8px 0">${date}</td></tr>
            <tr><td style="padding:8px 0;color:#aaa">Horário</td><td style="padding:8px 0">${time}</td></tr>
          </table>
          <div style="margin-top:24px;padding:16px;background:#1a1a1a;border-left:3px solid #c9a84c;border-radius:4px">
            <p style="margin:0;font-size:12px;color:#888">Aceda à folha de cálculo para confirmar ou cancelar esta marcação.</p>
          </div>
        </div>
      `
    });
  } catch (mailErr) {
    Logger.log('Erro no email: ' + mailErr.message);
  }

  return jsonResponse({ success: true, message: 'Marcação registada com sucesso' });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
