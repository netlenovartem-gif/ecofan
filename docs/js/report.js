document.addEventListener('DOMContentLoaded', () => {
  if (typeof initPage === 'function') {
    initPage();
  }

  const periodSelect = document.getElementById('period-select');
  const reportBody = document.getElementById('report-body');
  const totalKgEl = document.getElementById('total-kg');
  const totalCountEl = document.getElementById('total-count');
  const totalTypesEl = document.getElementById('total-types');

  async function loadReport(period = 'all') {
    reportBody.innerHTML = '<tr><td colspan="3" class="empty-state">Загрузка данных…</td></tr>';

    try {
      const res = await fetch(`/api/report?period=${period}`);
      if (!res.ok) throw new Error('Ошибка сети');
      const data = await res.json();

      totalKgEl.textContent = Number(data.totalStats.total_kg).toFixed(2);
      totalCountEl.textContent = data.totalStats.total_count;
      totalTypesEl.textContent = data.report.length;

      reportBody.innerHTML = '';
      if (data.report.length === 0) {
        reportBody.innerHTML = '<tr><td colspan="3" class="empty-state">Нет данных за выбранный период</td></tr>';
        return;
      }

      data.report.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${item.type}</strong></td>
          <td>${Number(item.total_weight).toFixed(2)} кг</td>
          <td>${item.total_deliveries} раз(а)</td>
        `;
        reportBody.appendChild(row);
      });
    } catch (err) {
      console.error('Ошибка загрузки отчёта:', err);
      reportBody.innerHTML = '<tr><td colspan="3" class="empty-state" style="color:#c62828;">Ошибка загрузки данных</td></tr>';
    }
  }

  periodSelect.addEventListener('change', (e) => {
    loadReport(e.target.value);
  });

  loadReport('all');
});