import { formatInTimeZone } from 'date-fns-tz';

type ReportLayoutProps = {
  title: string;
  subtitle?: string;
  body: string;
  clientTimezone?: string;
  includePrintScript?: boolean;
};

export function getReportLayout({ title, subtitle, body, clientTimezone, includePrintScript = true }: ReportLayoutProps) {
  const tz = clientTimezone || 'UTC';
  const generatedAt = formatInTimeZone(new Date(), tz, "PPP 'at' p");
  const BRAND_BLUE = "#3560AD";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>

  <style>
    @page { size: letter; margin: 0.75in; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1f2937; line-height: 1.5; font-size: 11px; }
    .container { width: 100%; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid ${BRAND_BLUE}; padding-bottom: 12px; margin-bottom: 24px; }
    .logo { width: 45px; height: 45px; object-fit: contain; }
    .title-section { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; }
    .title-group h2 { margin: 0; font-size: 20px; font-weight: bold; color: #111827; }
    .title-group p { margin: 4px 0 0; font-size: 11px; color: #6b7280; }
    .subtitle-group { font-size: 13px; font-weight: bold; color: #0f172a; text-transform: uppercase; }
    .section { margin-bottom: 25px; }
    .section h2 { font-size: 13px; font-weight: bold; color: ${BRAND_BLUE}; border-left: 4px solid ${BRAND_BLUE}; padding-left: 10px; text-transform: uppercase; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; page-break-inside: auto; }
    thead { display: table-header-group; }
    tr { page-break-after: auto; }
    th { text-align: left; font-size: 9px; text-transform: uppercase; background: #f9fafb; color: #475569; border: 1px solid #e2e8f0; padding: 10px; }
    td { padding: 10px; border: 1px solid #e2e8f0; font-size: 11px; vertical-align: top; }
    tfoot td { font-weight: bold; background-color: #f9fafb; }
    td strong { color: #1e293b; font-weight: 600; }
    .text-right { text-align: right; }
    .font-mono { font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 10px;">
      <button onclick="window.print()" style="background:#3560AD;color:#fff;border:none;padding:8px 18px;border-radius:5px;font-size:13px;cursor:pointer;">Print</button>
    </div>
    <div class="header">
      <img src="/logo.png" class="logo" alt="Logo">
      <div class="company">
        <h1>System@ic</h1>
      </div>
    </div>
    <div class="title-section">
      <div class="title-group">
        <h2>${title}</h2>
        <p>${generatedAt}</p>
      </div>
      ${subtitle ? `<div class="subtitle-group">${subtitle}</div>` : ''}
    </div>
    ${body}
  </div>
    <!-- Print button moved to top -->
    ${includePrintScript ? '' : ''}
</body>
</html>
`;
}
