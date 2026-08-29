
'use server';
/**
 * @fileOverview Generates a report with a dynamic date and time logo using an LLM.
 *
 * - generateReport - A function that generates the report with a logo.
 * - ReportInput - The input type for the generateReport function
 * - ReportOutput - The return type for the generateReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { format } from 'date-fns';

const ReportInputSchema = z.object({
  reportType: z.string().describe('The type of report to generate (e.g., inventory, sales).'),
  reportData: z.string().describe('The data to include in the report (e.g., as a JSON string).'),
});
export type ReportInput = z.infer<typeof ReportInputSchema>;

const ReportOutputSchema = z.object({
  reportContent: z.string().describe('The generated report content as a full HTML document.'),
});
export type ReportOutput = z.infer<typeof ReportOutputSchema>;

function getReportStyles() {
    return `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; }
      @page { size: letter; margin: 1in; }
      .container { width: 100%; margin: 0 auto; }
      .header { text-align: center; margin-bottom: 2rem; }
      .header h1 { font-size: 2rem; margin: 0; color: #1a202c; }
      .header p { font-size: 0.9rem; color: #718096; margin: 0; }
      .summary { margin-bottom: 2rem; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 1.5rem 0; }
      .summary h2 { font-size: 1.2rem; font-weight: 600; margin-top: 0; margin-bottom: 1rem; color: #2d3748; }
      .summary p { margin: 0; font-size: 0.9rem; }
      .report-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      .report-table th, .report-table td { border: 1px solid #e2e8f0; padding: 0.75rem; text-align: left; }
      .report-table th { background-color: #f7fafc; font-weight: 600; color: #4a5568; }
      .report-table td { color: #2d3748; }
      .report-table .text-right { text-align: right; }
      .report-table .font-mono { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; }
      .empty-state { text-align: center; padding: 2rem; color: #718096; }
      pre { background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 0.25rem; padding: 1rem; white-space: pre-wrap; word-wrap: break-word; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; font-size: 0.85rem;}
    </style>
  `;
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function formatLineItems(items: any): string {
    if (!items) return "";
    const arr = Array.isArray(items) ? items : (typeof items === "string" ? safeJsonParse(items) : []);
    const names = (arr || [])
        .map((it: any) => it?.productName || it?.name || it?.description || it?.product || "")
        .filter((s: any) => typeof s === "string" && s.trim().length > 0);
    // de-duplicate
    return Array.from(new Set(names)).join(", ");
}

function generateReportHtml(title: string, summary: string, rawData: string, reportType: string) {
    const styles = getReportStyles();
    const generatedDate = format(new Date(), 'PPP');

    let dataSection;
    try {
        const jsonData = JSON.parse(rawData);
        if (Array.isArray(jsonData) && jsonData.length > 0) {
            let headers = Object.keys(jsonData[0]);
            
            if (reportType === 'Invoices') {
                headers = headers.filter(h => h !== 'id' && h !== 'customerId');
            }

            dataSection = `
                <table class="report-table">
                    <thead>
                        <tr>
                            ${headers.map(header => `<th>${header.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${jsonData.map(row => `
                            <tr>
                                ${headers.map(header => {
                                    let cellData = row[header];
                                    if (header === 'lineItems' && reportType === 'Invoices') {
                                        cellData = formatLineItems(cellData);
                                    } else if (typeof cellData === 'object' && cellData !== null) {
                                        cellData = JSON.stringify(cellData);
                                    }
                                    return `<td>${cellData}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            throw new Error("Data is not an array or is empty.");
        }
    } catch (e) {
        dataSection = `<pre>${rawData}</pre>`;
    }
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        ${styles}
      </head>
      <body>
        <div class="container">
            <div class="header">
                <h1>${title}</h1>
                <p>Generated on ${generatedDate}</p>
            </div>
            <div class="summary">
                <h2>Summary</h2>
                <p>${summary}</p>
            </div>
            ${dataSection}
        </div>
      </body>
      </html>
    `;
}

const summaryPrompt = ai.definePrompt({
    name: 'reportSummaryPrompt',
    input: { schema: z.object({ reportData: z.string(), reportType: z.string() }) },
    output: { schema: z.object({ summary: z.string() }) },
    prompt: `Analyze the following data for a {{{reportType}}} report and provide a concise, one-paragraph summary. Focus on key insights, totals, and trends. Do not include any HTML or markdown formatting.

Data:
\`\`\`json
{{{reportData}}}
\`\`\`
`,
});

const generateReportFlow = ai.defineFlow(
  {
    name: 'generateReportFlow',
    inputSchema: ReportInputSchema,
    outputSchema: ReportOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await summaryPrompt(input);
      if (!output?.summary) {
        throw new Error("Failed to get a summary from the AI prompt.");
      }

      const reportTitle = `${input.reportType} Report`;
      const finalHtml = generateReportHtml(reportTitle, output.summary, input.reportData, input.reportType);

      return { reportContent: finalHtml };

    } catch (error) {
      console.error("Error in generateReportFlow:", error);
      const reportTitle = `${input.reportType} Report`;
      const fallbackSummary = "Could not generate AI summary. The raw data is provided below.";
      const finalHtml = generateReportHtml(reportTitle, fallbackSummary, input.reportData, input.reportType);
      return { reportContent: finalHtml };
    }
  }
);


export async function generateReport(input: ReportInput): Promise<ReportOutput> {
  return generateReportFlow(input);
}
