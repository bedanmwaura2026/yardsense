// ============================================================
//  YardSense – Google Sheets → Supabase Sync
//  Version 2.0 — with Sync Status + Last Synced + ID writeback
//
//  SETUP:
//  1. Open your Google Sheet
//  2. Go to Extensions > Apps Script
//  3. Paste this entire file, replacing any existing code
//  4. Click Save, then Run > syncAll
//  5. Approve permissions when prompted
// ============================================================

const SUPABASE_URL = 'https://cmljobwhmdwjkpwvotsx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtbGpvYndobWR3amtwd3ZvdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTE0MzUsImV4cCI6MjA5NjMyNzQzNX0.i4ac31g2cA0M8NAZUR9FH3HuHYOiXrc-k1J1mcVurRY';

// Maps each Sheet tab name to its Supabase table
const TABLE_MAP = {
  'jobs':         'jobs',
  'fabric_rolls': 'fabric_rolls',
  'inspections':  'inspections',
  'defect_logs':  'defect_logs'
};

// These two columns are appended automatically — do NOT add them manually
const STATUS_COL_HEADER    = 'Sync Status';
const TIMESTAMP_COL_HEADER = 'Last Synced';


// ── MAIN ENTRY POINT ─────────────────────────────────────────
function syncAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summary = [];

  for (const [sheetName, tableName] of Object.entries(TABLE_MAP)) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      summary.push('⚠️  Sheet "' + sheetName + '" not found – skipped');
      continue;
    }
    ensureStatusColumns_(sheet);
    const result = syncSheet_(sheet, tableName);
    summary.push('✅ ' + sheetName + ': ' + result);
  }

  SpreadsheetApp.getUi().alert('YardSense Sync Complete\n\n' + summary.join('\n'));
}


// ── ENSURE STATUS COLUMNS EXIST ──────────────────────────────
// Adds "Sync Status" and "Last Synced" headers if not already present
function ensureStatusColumns_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (!headers.includes(STATUS_COL_HEADER)) {
    const nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue(STATUS_COL_HEADER);
    // Style the header
    sheet.getRange(1, nextCol)
      .setBackground('#1a73e8')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
  }

  const freshHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!freshHeaders.includes(TIMESTAMP_COL_HEADER)) {
    const nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue(TIMESTAMP_COL_HEADER);
    sheet.getRange(1, nextCol)
      .setBackground('#1a73e8')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
  }
}


// ── SYNC ONE SHEET TAB ────────────────────────────────────────
function syncSheet_(sheet, tableName) {
  const allData    = sheet.getDataRange().getValues();
  if (allData.length < 2) return 'No data rows – skipped';

  const headers    = allData[0].map(h => String(h).trim());
  const statusColIdx    = headers.indexOf(STATUS_COL_HEADER);
  const timestampColIdx = headers.indexOf(TIMESTAMP_COL_HEADER);

  // Data columns = everything except the two status columns
  const dataHeaders = headers.filter(h => h !== STATUS_COL_HEADER && h !== TIMESTAMP_COL_HEADER);

  let successCount = 0;
  let errorCount   = 0;

  // Process each data row individually so we can write status back per row
  for (let rowIdx = 1; rowIdx < allData.length; rowIdx++) {
    const row = allData[rowIdx];

    // Skip completely empty rows
    if (!row.some(cell => cell !== '' && cell !== null && cell !== undefined)) continue;

    // Build the record object from data columns only
    const record = {};
    dataHeaders.forEach(header => {
      const colIdx = headers.indexOf(header);
      if (colIdx === -1) return;
      const val = row[colIdx];
      if (val === '' || val === null || val === undefined) return;
      record[header] = val instanceof Date ? val.toISOString() : val;
    });

    if (Object.keys(record).length === 0) continue;

    // POST to Supabase with return=representation so we get the saved record back
    const response = UrlFetchApp.fetch(
      SUPABASE_URL + '/rest/v1/' + tableName,
      {
        method: 'POST',
        headers: {
          'apikey':        SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type':  'application/json',
          'Prefer':        'resolution=merge-duplicates,return=representation'
        },
        payload: JSON.stringify([record]),
        muteHttpExceptions: true
      }
    );

    const code = response.getResponseCode();
    const sheetRow = rowIdx + 1; // 1-indexed, +1 for header row

    if (code === 200 || code === 201) {
      successCount++;

      // Write back the Supabase-generated id to the id column (so future syncs update, not duplicate)
      try {
        const returned = JSON.parse(response.getContentText());
        if (returned && returned.length > 0 && returned[0].id) {
          const idColIdx = headers.indexOf('id');
          if (idColIdx !== -1 && !row[idColIdx]) {
            // Only write back if id was blank (don't overwrite existing)
            sheet.getRange(sheetRow, idColIdx + 1).setValue(returned[0].id);
          }
        }
      } catch(e) { /* ignore parse errors */ }

      // Write sync status: green ✓ Synced
      if (statusColIdx !== -1) {
        const statusCell = sheet.getRange(sheetRow, statusColIdx + 1);
        statusCell.setValue('✓ Synced');
        statusCell.setBackground('#e6f4ea');
        statusCell.setFontColor('#137333');
      }

      // Write timestamp
      if (timestampColIdx !== -1) {
        const tsCell = sheet.getRange(sheetRow, timestampColIdx + 1);
        tsCell.setValue(new Date());
        tsCell.setNumberFormat('yyyy-mm-dd hh:mm:ss');
        tsCell.setBackground('#e6f4ea');
      }

    } else {
      errorCount++;
      const errMsg = response.getContentText().substring(0, 80);

      // Write sync status: red ✗ Error
      if (statusColIdx !== -1) {
        const statusCell = sheet.getRange(sheetRow, statusColIdx + 1);
        statusCell.setValue('✗ Error: ' + errMsg);
        statusCell.setBackground('#fce8e6');
        statusCell.setFontColor('#c5221f');
      }
      if (timestampColIdx !== -1) {
        const tsCell = sheet.getRange(sheetRow, timestampColIdx + 1);
        tsCell.setValue(new Date());
        tsCell.setNumberFormat('yyyy-mm-dd hh:mm:ss');
        tsCell.setBackground('#fce8e6');
      }
    }
  }

  return successCount + ' synced, ' + errorCount + ' errors';
}


// ── AUTO-SYNC ON EDIT ─────────────────────────────────────────
// Automatically syncs the edited sheet tab whenever a cell is changed.
// Only syncs the tab that was edited (not all tabs).
function onEdit(e) {
  if (!e || !e.source) return;
  const editedSheet = e.range.getSheet();
  const sheetName   = editedSheet.getName();
  const tableName   = TABLE_MAP[sheetName];
  if (!tableName) return; // ignore edits to sheets not in TABLE_MAP
  ensureStatusColumns_(editedSheet);
  syncSheet_(editedSheet, tableName);
}


// ── TIMED AUTO-SYNC ───────────────────────────────────────────
// Run createTimedTrigger() ONCE to schedule syncAll every 10 minutes.
// Run deleteTimedTriggers() to stop it.
function createTimedTrigger() {
  ScriptApp.newTrigger('syncAll')
    .timeBased()
    .everyMinutes(10)
    .create();
  SpreadsheetApp.getUi().alert('Done! syncAll will now run automatically every 10 minutes.');
}

function deleteTimedTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncAll')
    .forEach(t => ScriptApp.deleteTrigger(t));
  SpreadsheetApp.getUi().alert('All timed triggers removed.');
}


// ── CLEAR SYNC STATUS (utility) ──────────────────────────────
// Clears the Sync Status and Last Synced columns on all tabs
// so you can re-sync from scratch.
function clearSyncStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const sheetName of Object.keys(TABLE_MAP)) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const statusIdx    = headers.indexOf(STATUS_COL_HEADER);
    const timestampIdx = headers.indexOf(TIMESTAMP_COL_HEADER);
    const lastRow = sheet.getLastRow();
    if (statusIdx !== -1 && lastRow > 1)
      sheet.getRange(2, statusIdx + 1, lastRow - 1).clearContent().setBackground(null);
    if (timestampIdx !== -1 && lastRow > 1)
      sheet.getRange(2, timestampIdx + 1, lastRow - 1).clearContent().setBackground(null);
  }
  SpreadsheetApp.getUi().alert('Sync status cleared on all tabs.');
}