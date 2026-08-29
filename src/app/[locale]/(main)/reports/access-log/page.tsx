'use client';
import { usePermissions } from '@/hooks/use-permissions';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Loader2, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateAccessLogReport, listAccessLogs, type AccessLogEntry } from './actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/protected-page';

// Helper to parse YYYY-MM-DD as a local date to avoid timezone issues.
function parseLocalDate(dateString: string): Date | null {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
    const parts = dateString.split('-').map(Number);
    // new Date(year, monthIndex, day)
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(date.getTime())) return null;
    return date;
}

export default function AccessLogPage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
  const t = useTranslations('AccessLogPage');
  const tCommon = useTranslations('ProtectedPage');
  const router = useRouter();
  // Try to get locale from router or fallback to 'en'
  const appLocale = (router && (router.locale || router.defaultLocale)) || 'en';
  const [isClient, setIsClient] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  // Removed reportMode and related logic (rollback to previous state)
  const [log, setLog] = useState<AccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clientTimezone, setClientTimezone] = useState('UTC');

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const fetchLogs = async () => {
        try {
            setLoading(true);
            const logs = await listAccessLogs();
            setLog(logs);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error fetching logs',
                description: 'Could not fetch access logs.',
            });
        } finally {
            setLoading(false);
        }
    };
    fetchLogs();
  }, [toast]);

  const { allFilteredRecords, filterTitle } = useMemo(() => {
    let result = log;
    let titleParts: string[] = [];

    const formatDateForTitle = (dateString: string) => {
        const d = parseLocalDate(dateString);
        return d ? format(d, 'MMM-dd-yy') : '';
    }

    if (startDate) {
        titleParts.push(`${t('report.filters.from')}: ${formatDateForTitle(startDate)}`);
    }
    if (endDate) {
        titleParts.push(`${t('report.filters.to')}: ${formatDateForTitle(endDate)}`);
    }

    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);

    if (start) {
        start.setHours(0,0,0,0);
        result = result.filter(r => new Date(r.accessedAt) >= start);
    }
    if (end) {
        end.setHours(23,59,59,999);
        result = result.filter(r => new Date(r.accessedAt) <= end);
    }

    return {
        allFilteredRecords: result.sort((a,b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime()),
        filterTitle: titleParts.join(' | ')
    };
  }, [log, startDate, endDate, t]);

  const displayedRecords = useMemo(() => allFilteredRecords.slice(0, 30), [allFilteredRecords]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const translations = {
        title: t('report.title'),
        accesses: t('report.accesses'),
        noRecords: t('report.noRecords'),
        headerNote: t('report.headerNote'),
        timeHeader: t('table.time'),
        emailHeader: t('table.userEmail'),
        summaryTitle: t('report.summaryTitle'),
        dateHeader: t('table.date'),
        countHeader: t('table.count'),
      };
      console.log('Calling generateAccessLogReport', { allFilteredRecords, filterTitle, clientTimezone, reportMode });
      const result = await generateAccessLogReport(allFilteredRecords, filterTitle, clientTimezone, translations, reportMode);
      console.log('generateAccessLogReport result:', result);
      if (result.success && result.reportContent) {
        const reportWindow = window.open('', '_blank');
        reportWindow?.document.write(result.reportContent);
        reportWindow?.document.close();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'An unknown error occurred.',
        });
      }
    } catch (err) {
      console.error('Error generating report:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (permissionLoading || !isClient) {
    return (
      <ProtectedPage pageName="reports.accessLog" pageTitle={t('title')}>
        <div className="space-y-8">
          <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
          <Card>
            <CardHeader>
              <CardTitle>{t('logTitle')}</CardTitle>
              <CardDescription>{t('logDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      </ProtectedPage>
    );
  }

  if (!hasAccess('reports.accessLog')) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{tCommon('accessDenied.title')}</h1>
        <Alert variant="destructive">
          <AlertTitle>{tCommon('accessDenied.title')}</AlertTitle>
          <AlertDescription>
            {tCommon('accessDenied.description')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('filterTitle')}</CardTitle>
        </CardHeader>
        <CardContent>

          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="space-y-2 md:mr-4 w-full">
              <label htmlFor="start-date" className="text-sm font-medium">{t('startDateLabel')}</label>
              <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full" />
            </div>
            <div className="space-y-2 md:mr-4 w-full">
              <label htmlFor="end-date" className="text-sm font-medium">{t('endDateLabel')}</label>
              <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full" />
            </div>
            <div className="mt-4 md:mt-0">
              <Button type="button" onClick={handleGenerateReport} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                {t('generateButton')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>{t('logTitle')}</CardTitle>
            <CardDescription>
                {t('logDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.date')}</TableHead>
                    <TableHead>{t('table.time')}</TableHead>
                    <TableHead>{t('table.userEmail')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                      <TableRow>
                          <TableCell colSpan={3} className="h-24 text-center">
                              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                          </TableCell>
                      </TableRow>
                  ) : displayedRecords.length > 0 ? (
                    displayedRecords.map((rec) => {
                      const accessedAtDate = new Date(rec.accessedAt);
                      const userTimezone = rec.timezone || clientTimezone;
                      let dateStr, timeStr;

                      try {
                          dateStr = formatInTimeZone(accessedAtDate, userTimezone, 'MMM-dd-yy');
                          timeStr = formatInTimeZone(accessedAtDate, userTimezone, 'p');
                      } catch (e) {
                          dateStr = format(accessedAtDate, 'MMM-dd-yy');
                          timeStr = format(accessedAtDate, 'p');
                      }
                      return (
                        <TableRow key={rec.id}>
                          <TableCell>{dateStr}</TableCell>
                          <TableCell>{timeStr}</TableCell>
                          <TableCell className="font-medium">{rec.email}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        {t('empty')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}