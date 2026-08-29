
import { formatInTimeZone } from 'date-fns-tz';

type ReportLayoutProps = {
  title: string;
  subtitle?: string;
  body: string;
  clientTimezone?: string;
};

export function getReportLayout({ title, subtitle, body, clientTimezone }: ReportLayoutProps) {
  const tz = clientTimezone || 'UTC';
  const generatedAt = formatInTimeZone(new Date(), tz, "PPP 'at' HH:mm");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>

  <style>
    @page {
      size: letter;
      margin: 1in;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #1f2937;
      line-height: 1.5;
    }

    .container {
      width: 100%;
    }

    /* HEADER */
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 2px solid #002774;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }

    .logo {
      width: 50px;
      height: 50px;
    }

    .company {
      flex: 1;
    }

    .company h1 {
      margin: 0;
      font-size: 22px;
      color: #002774;
    }

    .company p {
      margin: 2px 0 0;
      font-size: 13px;
      color: #6b7280;
    }

    /* REPORT TITLE */
    .report-title {
      margin: 24px 0 8px;
      font-size: 20px;
      font-weight: 600;
      color: #111827;
    }

    .report-subtitle {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 24px;
    }

    /* SECTIONS */
    .section {
      margin-bottom: 28px;
    }

    .section h2 {
      font-size: 16px;
      margin-bottom: 10px;
      color: #002774;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
    }

    /* TABLES */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      page-break-inside: auto;
    }

    thead {
      display: table-header-group;
    }

    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }

    th, td {
      border: 1px solid #e5e7eb;
      padding: 8px;
      font-size: 13px;
      text-align: left;
    }

    th {
      background: #f9fafb;
      font-weight: 600;
    }

    /* FOOTER */
    .footer {
      margin-top: 40px;
      font-size: 12px;
      color: #6b7280;
      text-align: right;
    }
  </style>
</head>

<body>
  <div class="container">

    <div class="header">
      <img src="/logo.png" class="logo" />
      <div class="company">
        <h1>System@ic</h1>
        <p>Internal Control System</p>
      </div>
    </div>

    <div class="report-title">${title}</div>
    ${subtitle ? `<div class="report-subtitle">${subtitle}</div>` : ''}

    ${body}

    <div class="footer">
      Generated on ${generatedAt}
    </div>

  </div>
  <script>
    window.onload = function() {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>
`;
}
