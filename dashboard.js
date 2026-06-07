(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  const [jobsRes, rollsRes, inspRes, defectsRes] = await Promise.all([
    sb.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    sb.from('fabric_rolls').select('id', { count: 'exact', head: true }),
    sb.from('inspections').select('id', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().split('T')[0]),
    sb.from('defect_logs').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  document.getElementById('stat-jobs').textContent = jobsRes.count ?? 0;
  document.getElementById('stat-rolls').textContent = rollsRes.count ?? 0;
  document.getElementById('stat-inspections').textContent = inspRes.count ?? 0;
  document.getElementById('stat-defects').textContent = defectsRes.count ?? 0;

  const { data: jobs } = await sb
    .from('jobs')
    .select('job_number, title, status, category_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  const tbody = document.getElementById('recent-jobs-body');
  if (!jobs || jobs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center muted">No jobs yet</td></tr>';
  } else {
    tbody.innerHTML = jobs.map(j => `
      <tr>
        <td>${j.job_number || '—'}</td>
        <td>${j.title}</td>
        <td><span class="badge badge-${j.status}">${j.status}</span></td>
        <td>${j.category_id || '—'}</td>
        <td>${new Date(j.created_at).toLocaleDateString()}</td>
      </tr>
    `).join('');
  }
})();