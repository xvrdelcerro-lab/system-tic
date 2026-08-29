export const reportStyles = `
<style>
  body {
    font-family: Arial, sans-serif;
    padding: 24px;
    color: #111;
  }

  /* ===== HEADER ===== */
  .report-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }

  .report-header img {
    height: 48px;
  }

  .report-header .company {
    line-height: 1.2;
  }

  .company-name {
    font-size: 16px;
    font-weight: bold;
  }

  .company-subtitle {
    font-size: 12px;
    color: #666;
  }

  .report-title {
    margin-top: 16px;
  }

  h1 {
    font-size: 22px;
    margin-bottom: 4px;
  }

  .subtitle {
    font-size: 14px;
    color: #555;
    margin-bottom: 4px;
  }

  .meta {
    font-size: 12px;
    color: #777;
    margin-bottom: 16px;
  }

  hr {
    border: none;
    border-top: 2px solid #333;
    margin: 16px 0;
  }

  /* ===== TABLE ===== */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  th {
    text-align: left;
    border-bottom: 2px solid #333;
    padding: 6px;
  }

  td {
    border-bottom: 1px solid #ccc;
    padding: 6px;
  }

  /* ===== PRINT ===== */
  @page {
    size: letter;
    margin: 20mm;
  }
</style>
`;
