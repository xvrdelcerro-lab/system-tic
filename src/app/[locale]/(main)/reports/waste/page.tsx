'use client';
import { usePermissions } from '@/hooks/use-permissions';


import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProduction } from "@/hooks/use-production";
import { format } from "date-fns";
import { useMemo, useState, useEffect } from "react";
import { useProducts } from '@/hooks/use-products';
import type { WasteEntry } from "@/hooks/use-production";
import { formatNumber } from "@/lib/utils";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { generateWasteReport } from "@/ai/flows/generate-waste-report-with-llm";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { usePhases } from "@/hooks/use-phases";
import { useTranslations } from "next-intl";
import { ProtectedPage } from '@/components/protected-page';

const WasteTable = ({ wasteData }: { wasteData: WasteEntry[] }) => {
    const t = useTranslations('WastePage');
    const { products } = useProducts();
    const getProductName = (productId: string) => {
        const product = products.find(p => p.id === productId);
    return product ? product.name : t('table.unknownProduct');
    };

    return (
        <ScrollArea>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('table.date')}</TableHead>
                        <TableHead>{t('table.time')}</TableHead>
                        <TableHead>{t('table.phase')}</TableHead>
                        <TableHead>{t('table.product')}</TableHead>
                        <TableHead className="text-right">{t('table.damaged')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {wasteData.length > 0 ? (
                        wasteData.map((entry) => (
                        <TableRow key={entry.id}>
                            <TableCell>{format(entry.date, "MMM-dd-yy")}</TableCell>
                            <TableCell>{format(entry.date, "HH:mm")}</TableCell>
                            <TableCell>{entry.phaseName}</TableCell>
                            <TableCell className="font-medium">{getProductName(entry.productId)}</TableCell>
                            <TableCell className="text-right">{formatNumber(entry.damagedQuantity)}</TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                            {t('empty')}
                        </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}

function parseLocalDate(dateString: string): Date | null {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
    const parts = dateString.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(date.getTime())) return null;
    return date;
}

export default function WastePage() {
  const { hasAccess, loading: permissionLoading } = usePermissions();
    const t = useTranslations('WastePage');
  const tCommon = useTranslations('ProtectedPage');
  const { toast } = useToast();
  const { wasteLog } = useProduction();
  const { phases, loading: phasesLoading } = usePhases();
  const [isClient, setIsClient] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [selectedPrintPhase, setSelectedPrintPhase] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clientTimezone, setClientTimezone] = useState('UTC');

  const phaseNames = useMemo(() => phases.map(p => p.name), [phases]);

  useEffect(() => {
    setIsClient(true);
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const wasteByPhase = useMemo(() => {
    const grouped: { [key: string]: WasteEntry[] } = {};
    phases.forEach(phase => {
        grouped[phase.name] = [];
    });
    wasteLog.forEach(entry => {
        if (grouped[entry.phaseName]) {
            grouped[entry.phaseName].push(entry);
        }
    });
    // Sort entries within each phase
    for (const phaseName in grouped) {
        grouped[phaseName].sort((a,b) => b.date.getTime() - a.date.getTime());
    }
    return grouped;
  }, [wasteLog, phases]);
  
  const printReportData = useMemo(() => {
    let rawWasteLog = wasteLog;
    
    if (selectedPrintPhase !== 'all') {
        rawWasteLog = rawWasteLog.filter(entry => entry.phaseName === selectedPrintPhase);
    }
    
    if (startDate) {
        const start = parseLocalDate(startDate);
        if (start) {
            start.setHours(0, 0, 0, 0);
            rawWasteLog = rawWasteLog.filter(entry => entry.date >= start);
        }
    }
    if (endDate) {
        const end = parseLocalDate(endDate);
        if (end) {
            end.setHours(23, 59, 59, 999);
            rawWasteLog = rawWasteLog.filter(entry => entry.date <= end);
        }
    }

    return rawWasteLog;
  }, [wasteLog, selectedPrintPhase, startDate, endDate]);

  const handlePrint = async () => {
    setIsGenerating(true);

    try {
      if (printReportData.length === 0) {
        toast({
            variant: "destructive",
            title: t('toasts.noRecordsTitle'),
            description: t('toasts.noRecordsDescription'),
        });
        setIsGenerating(false);
        return;
      }
      
      const filtersForReport = {
          phase: selectedPrintPhase,
          startDate,
          endDate,
      };

      const result = await generateWasteReport({
        rawWasteLog: printReportData,
        filters: filtersForReport,
        clientTimezone,
        translations: {
            title: t('dialog.title'),
            totalDamaged: t('report.totalDamaged'),
            loggedDate: t('table.date'),
            time: t('table.time'),
            phase: t('table.phase'),
            productName: t('table.product'),
            damaged: t('table.damaged'),
            noRecords: t('empty')
        }
      });
      
      if (result.reportContent) {
        const reportWindow = window.open('', '_blank');
        reportWindow?.document.write(result.reportContent);
        reportWindow?.document.close();
      } else {
        throw new Error('No content received from report generator.');
      }

    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        variant: "destructive",
        title: t('toasts.errorTitle'),
        description: error instanceof Error ? error.message : "An unknown error occurred."
      });
    } finally {
      setIsGenerating(false);
      setIsPrintDialogOpen(false);
    }
  };

  if (permissionLoading || !isClient) {
    return (
    <ProtectedPage pageName="reports.waste" pageTitle={t('title')}>

      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('cardTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    
    </ProtectedPage>
  );
  }

  if (!hasAccess('reports.waste')) {
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
    <ProtectedPage pageName="reports.waste" pageTitle={t('title')}>
<div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('cardTitle')}</CardTitle>
            <CardDescription>
              {t('cardDescription')}
            </CardDescription>
          </div>
          <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
              <DialogTrigger asChild>
                  <Button>
                      <Printer className="mr-2 h-4 w-4" />
                      {t('printButton')}
                  </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                      <DialogTitle>{t('dialog.title')}</DialogTitle>
                      <DialogDescription>
                          {t('dialog.description')}
                      </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-6">
                      <div className="space-y-2">
                          <Label htmlFor="phase-select">{t('dialog.phaseLabel')}</Label>
                          <Select value={selectedPrintPhase} onValueChange={setSelectedPrintPhase}>
                              <SelectTrigger id="phase-select">
                                  <SelectValue placeholder={t('dialog.phasePlaceholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">{t('dialog.allPhases')}</SelectItem>
                                  {phaseNames.map(phase => (
                                      <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-3">
                        <Label>{t('dialog.dateFilterLabel')}</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label htmlFor="start-date" className="text-xs">{t('dialog.startDateLabel')}</Label>
                                <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="end-date" className="text-xs">{t('dialog.endDateLabel')}</Label>
                                <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                        </div>
                      </div>
                  </div>
                  <DialogFooter>
                      <Button onClick={handlePrint} disabled={isGenerating}>
                      {isGenerating ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                          <Printer className="mr-2 h-4 w-4" />
                      )}
                      {t('dialog.generateButton')}
                      </Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {phasesLoading ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : (
            <Tabs defaultValue={phases.length > 0 ? phases[0].name : ''}>
                <ScrollArea className="w-full whitespace-nowrap">
                  <TabsList className="bg-transparent p-0 mb-4 gap-2 inline-flex">
                  {phaseNames.map(phase => (
                      <TabsTrigger key={phase} value={phase} className="data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground rounded-lg">
                      {phase}
                      </TabsTrigger>
                  ))}
                  </TabsList>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
                {phaseNames.map(phase => (
                    <TabsContent key={phase} value={phase} className="mt-0">
                        <WasteTable wasteData={wasteByPhase[phase] || []} />
                    </TabsContent>
                ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
    </ProtectedPage>
  );
}