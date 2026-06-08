// inspections.js — Fabric Inspection Module for YardSense
// Reads from / writes to Supabase "inspections" table
// Requires: supabase.js (exposes `sb`), auth.js

(function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const tbody        = document.getElementById('insp-tbody');
  const loading      = document.getElementById('insp-loading');
  const tableWrap    = document.getElementById('insp-table-wrap');
  const emptyState   = document.getElementById('insp-empty');
  const searchInput  = document.getElementById('insp-search');
  const pfFilter     = document.getElementById('insp-filter-pf');
  const addBtn       = document.getElementById('add-insp-btn');
  const modal        = document.getElementById('insp-modal');
  const modalTitle   = document.getElementById('modal-title');
  const form         = document.getElementById('insp-form');
  const cancelBtn    = document.getElementById('modal-cancel-btn');

  // Stat cards
  const statTotal = document.getElementById('stat-total');
  const statKgs   = document.getElementById('stat-kgs');
  const statMtrs  = document.getElementById('stat-mtrs');
  const statPass  = document.getElementById('stat-pass');
  const statFail  = document.getElementById('stat-fail');

  // Form fields
  const fId        = document.getElementById('edit-id');
  const fBarcode   = document.getElementById('f-barcode');
  const fSupplier  = document.getElementById('f-supplier');
  const fFabCode   = document.getElementById('f-fabric-code');
  const fRollNo    = document.getElementById('f-roll-no');
  const fKgs       = document.getElementById('f-kgs');
  const fMtrs      = document.getElementById('f-mtrs');
  const fDefect    = document.getElementById('f-defect');
  const fDateRecv  = document.getElementById('f-date-recv');
  const fDateInsp  = document.getElementById('f-date-insp');
  const fPenalty   = document.getElementById('f-penalty');
  const fPF        = document.getElementById('f-pf');

  let allRows = [];

  // ── Load inspections ──────────────────────────────────────────────────────
  async function loadInspections() {
    loading.style.display = 'block';
    tableWrap.style.display = 'none';

    const { data, error } = await sb
      .from('inspections')
      .select('id,fabric_barcode,supplier_name,supplier_fabric_code,roll_no,kgs,mtrs,defect_type,date_received,date_inspected,penalty_points,pass_fail')
      .order('created_at', { ascending: false });

    loading.style.display = 'none';
    tableWrap.style.display = 'block';

    if (error) {
      console.error('Error loading inspections:', error);
      tbody.innerHTML = '<tr><td colspan="12" style="color:red;padding:16px">Error loading data: ' + error.message + '</td></tr>';
      return;
    }

    allRows = data || [];
    renderStats(allRows);
    renderTable(allRows);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  function renderStats(rows) {
    statTotal.textContent = rows.length;
    statKgs.textContent   = rows.reduce((s, r) => s + (parseFloat(r.kgs)  || 0), 0).toFixed(1);
    statMtrs.textContent  = rows.reduce((s, r) => s + (parseFloat(r.mtrs) || 0), 0).toFixed(1);
    statPass.textContent  = rows.filter(r => r.pass_fail === 'pass').length;
    statFail.textContent  = rows.filter(r => r.pass_fail === 'fail').length;
  }

  // ── Render table ──────────────────────────────────────────────────────────
  function renderTable(rows) {
    if (!rows.length) {
      emptyState.style.display = 'block';
      tbody.innerHTML = '';
      return;
    }
    emptyState.style.display = 'none';
    tbody.innerHTML = rows.map(r => {
      const pf = (r.pass_fail || '').toLowerCase();
      const badge = pf === 'pass'
        ? '<span class="badge badge-pass">Pass</span>'
        : pf === 'fail'
          ? '<span class="badge badge-fail">Fail</span>'
          : pf || '-';
      return `<tr>
        <td>${r.fabric_barcode || '-'}</td>
        <td>${r.supplier_name || '-'}</td>
        <td>${r.supplier_fabric_code || '-'}</td>
        <td>${r.roll_no || '-'}</td>
        <td>${r.kgs != null ? parseFloat(r.kgs).toFixed(2) : '-'}</td>
        <td>${r.mtrs != null ? parseFloat(r.mtrs).toFixed(2) : '-'}</td>
        <td>${r.defect_type || '-'}</td>
        <td>${r.date_received || '-'}</td>
        <td>${r.date_inspected || '-'}</td>
        <td>${r.penalty_points != null ? r.penalty_points : '-'}</td>
        <td>${badge}</td>
        <td>
          <button class="btn-sm btn-edit" onclick="editInspection('${r.id}')">Edit</button>
          <button class="btn-sm btn-del"  onclick="deleteInspection('${r.id}')">Delete</button>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Filter / Search ───────────────────────────────────────────────────────
  function applyFilters() {
    const q  = (searchInput.value || '').toLowerCase();
    const pf = pfFilter.value;
    let rows = allRows;
    if (q) {
      rows = rows.filter(r =>
        (r.fabric_barcode || '').toLowerCase().includes(q) ||
        (r.supplier_name  || '').toLowerCase().includes(q) ||
        (r.defect_type    || '').toLowerCase().includes(q)
      );
    }
    if (pf) {
      rows = rows.filter(r => (r.pass_fail || '').toLowerCase() === pf);
    }
    renderTable(rows);
    renderStats(rows);
  }

  searchInput.addEventListener('input', applyFilters);
  pfFilter.addEventListener('change', applyFilters);

  // ── Modal open / close ────────────────────────────────────────────────────
  function openModal(title = 'Add Inspection') {
    modalTitle.textContent = title;
    modal.classList.add('open');
  }

  function closeModal() {
    modal.classList.remove('open');
    form.reset();
    fId.value = '';
  }

  addBtn.addEventListener('click', () => openModal('Add Inspection'));
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // ── Edit ──────────────────────────────────────────────────────────────────
  window.editInspection = function (id) {
    const row = allRows.find(r => String(r.id) === String(id));
    if (!row) return;
    fId.value       = row.id;
    fBarcode.value  = row.fabric_barcode  || '';
    fSupplier.value = row.supplier_name   || '';
    fFabCode.value  = row.supplier_fabric_code || '';
    fRollNo.value   = row.roll_no         || '';
    fKgs.value      = row.kgs             != null ? row.kgs  : '';
    fMtrs.value     = row.mtrs            != null ? row.mtrs : '';
    fDefect.value   = row.defect_type     || '';
    fDateRecv.value = row.date_received   || '';
    fDateInsp.value = row.date_inspected  || '';
    fPenalty.value  = row.penalty_points  != null ? row.penalty_points : '';
    fPF.value       = row.pass_fail       || '';
    openModal('Edit Inspection');
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  window.deleteInspection = async function (id) {
    if (!confirm('Delete this inspection record?')) return;
    const { error } = await sb.from('inspections').delete().eq('id', id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    await loadInspections();
  };

  // ── Save (insert or update) ───────────────────────────────────────────────
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const saveBtn = document.getElementById('modal-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const payload = {
      fabric_barcode:       fBarcode.value.trim()  || null,
      supplier_name:        fSupplier.value.trim() || null,
      supplier_fabric_code: fFabCode.value.trim()  || null,
      roll_no:              fRollNo.value.trim()   || null,
      kgs:                  fKgs.value      !== '' ? parseFloat(fKgs.value)  : null,
      mtrs:                 fMtrs.value     !== '' ? parseFloat(fMtrs.value) : null,
      defect_type:          fDefect.value.trim()   || null,
      date_received:        fDateRecv.value || null,
      date_inspected:       fDateInsp.value || null,
      penalty_points:       fPenalty.value  !== '' ? parseInt(fPenalty.value, 10) : null,
      pass_fail:            fPF.value       || null,
    };

    let error;
    if (fId.value) {
      ({ error } = await sb.from('inspections').update(payload).eq('id', fId.value));
    } else {
      ({ error } = await sb.from('inspections').insert([payload]));
    }

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';

    if (error) { alert('Save failed: ' + error.message); return; }
    closeModal();
    await loadInspections();
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  // Wait for auth to be ready (auth.js sets window.currentUser or fires an event)
  function init() {
    if (window.sb) {
      loadInspections();
    } else {
      // sb may not be ready yet; retry after short delay
      setTimeout(init, 200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
