
"use client";

import { useState } from "react";
import { listUsers, generateUsersReport } from "./actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function PrintUsersButton() {
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();
  const t = useTranslations('UsersPage');

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
        // 1. Fetch the user list
        const users = await listUsers();

        // 2. Prepare the payload to match the new action structure
        const payload = {
            users,
            clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            translations: {
                reportTitle: t('report.title'),
                // We pass an empty string to {date} just to satisfy the translation requirement
generatedDateLabel: t('report.generatedDate', { date: '' }).replace(':', '').trim(),
                emailLabel: t('report.table.email'),
                createdLabel: t('report.table.created'),
            }
        };

        // 3. Call the updated action
        const result = await generateUsersReport(payload);

        if (result.success && result.reportContent) {
            const reportWindow = window.open('', '_blank');
            if (reportWindow) {
                reportWindow.document.write(result.reportContent);
                reportWindow.document.close();
                
                // Allow a small delay for styles to load before printing
                reportWindow.onload = () => {
                    reportWindow.focus();
                    reportWindow.print();
                };
            } else {
                toast({
                    variant: "destructive",
                    title: t('toasts.popupBlocked.title'),
                    description: t('toasts.popupBlocked.description'),
                });
            }
        } else {
          throw new Error(result.error || t('ReportErrors.failedToGenerate'));
        }
    } catch (error) {
        console.error("Print Error:", error);
        toast({
            variant: 'destructive',
            title: t('toasts.reportGenerationFailed.title'),
            description: error instanceof Error ? error.message : "An unknown error occurred",
        });
    } finally {
        setIsPrinting(false);
    }
  };

  return (
    <Button onClick={handlePrint} disabled={isPrinting}>
      {isPrinting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Printer className="mr-2 h-4 w-4" />
      )}
      {t('printButton')}
    </Button>
  );
}

    