
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { getReportLayout } from '@/lib/report-layout';

export type AccessLogEntry = {
  id: string;
  uid: string;
  email: string;
  accessedAt: string;
  timezone?: string;
};

/* ---------------- HTML GENERATOR ---------------- */


function groupRecordsByDay(records: AccessLogEntry[], clientTimezone: string) {
  return records.reduce((acc, record) => {
    const dayKey = formatInTimeZone(new Date(record.accessedAt), clientTimezone, 'yyyy-MM-dd');
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push(record);
    return acc;
  }, {} as Record<string, AccessLogEntry[]>);
}

function generateSummarySection(records: AccessLogEntry[], clientTimezone: string, t: any) {
  const groupedByDay = groupRecordsByDay(records, clientTimezone);
  const sortedDays = Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));
  if (sortedDays.length === 0) {
    return `<p style="text-align: center; color: #6b7280; padding: 2rem 0;">${t.noRecords}</p>`;
  }
  return `
    <div class="section">
      <h2 style="color:#3560AD;">${t.summaryTitle || 'Resumen de Accesos por Día'}</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 60%;">${t.dateHeader || 'Fecha'}</th>
            <th style="width: 40%;">${t.countHeader || 'Accesos'}</th>
          </tr>
        </thead>
        <tbody>
          ${sortedDays.map(dayKey => {
            const dateForDay = new Date(dayKey + 'T00:00:00');
            const formattedDate = format(dateForDay, 'MMMM dd, yyyy');
            return `<tr><td>${formattedDate}</td><td style="font-weight:bold; color:#3560AD;">${groupedByDay[dayKey].length}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function generateDetailedSection(records: AccessLogEntry[], clientTimezone: string, t: any) {
  const groupedByDay = groupRecordsByDay(records, clientTimezone);
  const sortedDays = Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));
  if (sortedDays.length === 0) {
    return `<p style="text-align: center; color: #6b7280; padding: 2rem 0;">${t.noRecords}</p>`;
  }
  return sortedDays.map(dayKey => {
    const dayRecords = groupedByDay[dayKey];
    const dateForDay = new Date(dayKey + 'T00:00:00');
    const formattedDate = format(dateForDay, 'MMMM dd, yyyy');
    return `
      <div class="section">
        <h2>${formattedDate} (${dayRecords.length} ${t.accesses})</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">${t.timeHeader}</th>
              <th>${t.emailHeader}</th>
            </tr>
          </thead>
          <tbody>
            ${dayRecords.map(r => `
              <tr>
                <td>${formatInTimeZone(new Date(r.accessedAt), clientTimezone, 'p')}</td>
                <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${r.email}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('');
}

// mode: 'summary' | 'detailed-with-summary'
function generateHtmlBody(records: AccessLogEntry[], clientTimezone: string, t: any, mode: 'summary' | 'detailed-with-summary' = 'detailed-with-summary') {
  if (mode === 'summary') {
    return generateSummarySection(records, clientTimezone, t);
  } else {
    return generateSummarySection(records, clientTimezone, t) + generateDetailedSection(records, clientTimezone, t);
  }
}



/* ---------------- DATA ---------------- */

export async function listAccessLogs(): Promise<AccessLogEntry[]> {
  if (!adminDb) return [];

  const snap = await adminDb
    .collection('access_logs')
    .orderBy('accessedAt', 'desc')
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      uid: data.uid,
      email: data.email,
      accessedAt: data.accessedAt.toDate().toISOString(),
      timezone: data.timezone,
    };
  });
}

/* ---------------- REPORT ---------------- */

// mode: 'summary' | 'detailed-with-summary'
export async function generateAccessLogReport(records: AccessLogEntry[], filterTitle: string, clientTimezone: string, translations: any, mode: 'summary' | 'detailed-with-summary' = 'detailed-with-summary') {
  const t = translations;
  const bodyContent = generateHtmlBody(records, clientTimezone, t, mode);
  const reportHtml = getReportLayout({
    title: t.title,
    subtitle: filterTitle,
    body: bodyContent,
    clientTimezone,
  });

  return {
    success: true,
    reportContent: reportHtml,
  };
}
