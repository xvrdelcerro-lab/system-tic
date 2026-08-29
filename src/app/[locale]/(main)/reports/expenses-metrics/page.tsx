'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/providers/auth-provider';
import { db } from '@/firebase/config';
import { collection, addDoc, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { Calculator, Lightbulb, Target, Award, Brain, Save, History, CalendarIcon, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { useTranslations, useLocale } from 'next-intl';
import { es } from 'date-fns/locale';
import { ProtectedPage } from '@/components/protected-page';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';

type MetricRecord = {
  id: string;
  date: Date;
  totalExpenses: number;
  totalRevenue: number;
  percentage: number;
  userId: string;
};

// Currency Input Component
function CurrencyInput({ 
  id, 
  value, 
  onChange, 
  placeholder 
}: { 
  id: string; 
  value: string; 
  onChange: (value: string) => void; 
  placeholder: string;
}) {
  const [displayValue, setDisplayValue] = useState('');

  const formatCurrencyInput = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (!digits) return '';
    const number = parseInt(digits);
    return number.toLocaleString('en-US');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const digits = input.replace(/\D/g, '');
    setDisplayValue(formatCurrencyInput(input));
    onChange(digits);
  };

  useEffect(() => {
    if (value) {
      setDisplayValue(formatCurrencyInput(value));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground z-10">
        $
      </span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        className="mt-2 text-lg pl-8 font-mono tabular-nums"
      />
    </div>
  );
}

export default function ExpensesMetricsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const t = useTranslations('ExpensesMetrics');
  const locale = useLocale();
  const dateFnsLocale = locale === 'es' ? es : undefined;

  const [totalExpenses, setTotalExpenses] = useState<string>('');
  const [totalRevenue, setTotalRevenue] = useState<string>('');
  const [result, setResult] = useState<number | null>(null);
  const [history, setHistory] = useState<MetricRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  async function loadHistory() {
    if (!user) return;

    try {
      const q = query(
        collection(db, 'expense_metrics'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );

      const snapshot = await getDocs(q);
      const records: MetricRecord[] = snapshot.docs.map(doc => ({
        id: doc.id,
        date: doc.data().date.toDate(),
        totalExpenses: doc.data().totalExpenses,
        totalRevenue: doc.data().totalRevenue,
        percentage: doc.data().percentage,
        userId: doc.data().userId,
      }));

      setHistory(records);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }

  // Filter history by date range
  const filteredHistory = history.filter(record => {
    if (!startDate && !endDate) return true;
    
    const recordDate = record.date;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return recordDate >= start && recordDate <= end;
    }
    
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      return recordDate >= start;
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return recordDate <= end;
    }
    
    return true;
  }).slice(0, 10); // Show max 10 filtered results

  function calculatePercentage() {
    const expenses = parseFloat(totalExpenses);
    const revenue = parseFloat(totalRevenue);

    if (isNaN(expenses) || isNaN(revenue)) {
      toast({
        variant: 'destructive',
        title: t('errors.invalidInput'),
        description: t('errors.invalidInputDesc'),
      });
      return;
    }

    if (revenue === 0) {
      toast({
        variant: 'destructive',
        title: t('errors.zeroRevenue'),
        description: t('errors.zeroRevenueDesc'),
      });
      return;
    }

    const percentage = (expenses / revenue) * 100;
    setResult(percentage);
  }

  async function saveResult() {
    if (!user || result === null) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'expense_metrics'), {
        userId: user.uid,
        date: Timestamp.now(),
        totalExpenses: parseFloat(totalExpenses),
        totalRevenue: parseFloat(totalRevenue),
        percentage: result,
      });

      toast({
        title: t('success.saved'),
        description: t('success.savedDesc'),
      });

      await loadHistory();

      setTotalExpenses('');
      setTotalRevenue('');
      setResult(null);
    } catch (error) {
      console.error('Error saving result:', error);
      toast({
        variant: 'destructive',
        title: t('errors.saveFailed'),
        description: String(error),
      });
    } finally {
      setLoading(false);
    }
  }

  function generateReport() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        variant: 'destructive',
        title: 'Popup Blocked',
        description: 'Please allow popups to print the report',
      });
      return;
    }

    const dateRangeText = startDate && endDate 
      ? `${format(startDate, 'PPP', { locale: dateFnsLocale })} - ${format(endDate, 'PPP', { locale: dateFnsLocale })}`
      : startDate 
      ? `From ${format(startDate, 'PPP', { locale: dateFnsLocale })}`
      : endDate
      ? `Until ${format(endDate, 'PPP', { locale: dateFnsLocale })}`
      : 'All Records';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Expenses Metrics Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #333;
          }
          .header {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #3560AD;
          }
          .logo {
            width: 50px;
            height: auto;
          }
          h1 {
            color: #3560AD;
            margin: 0;
            font-size: 20px;
          }
          .subtitle {
            color: #666;
            margin: 5px 0 0 0;
          }
          .date-range {
            font-weight: bold;
            margin-bottom: 20px;
            padding: 10px;
            background: #f0f4f8;
            border-left: 4px solid #3560AD;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            background: #3560AD;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #ddd;
          }
          tr:hover {
            background: #f9f9f9;
          }
          .text-right {
            text-align: right;
          }
          .percentage {
            color: #3560AD;
            font-weight: bold;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #3560AD;
            color: #666;
            font-size: 12px;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Logo" class="logo" onerror="this.style.display='none'" />
          <div>
            <h1>${t('history.reportTitle')}</h1>
            <p class="subtitle">${t('history.reportSubtitle')}</p>
          </div>
        </div>
        
        <div class="date-range">${dateRangeText}</div>
        
        <table>
          <thead>
            <tr>
              <th>${t('history.date')}</th>
              <th class="text-right">${t('history.expenses')}</th>
              <th class="text-right">${t('history.revenue')}</th>
              <th class="text-right">${t('history.percentage')}</th>
            </tr>
          </thead>
          <tbody>
            ${filteredHistory.map(record => `
              <tr>
                <td>${format(record.date, 'PPP p', { locale: dateFnsLocale })}</td>
                <td class="text-right">${formatCurrency(record.totalExpenses)}</td>
                <td class="text-right">${formatCurrency(record.totalRevenue)}</td>
                <td class="text-right percentage">${record.percentage.toFixed(2)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          Generated on ${format(new Date(), 'PPP p', { locale: dateFnsLocale })} | 
          Total Records: ${filteredHistory.length}
        </div>
        
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <ProtectedPage pageName="reports.expensesMetrics" pageTitle={t('title')}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
        </div>

        {/* Calculator Card */}
        <Card className="border-2" style={{ borderColor: '#3560AD' }}>
          <CardHeader style={{ backgroundColor: '#3560AD' }} className="text-white">
            <div className="flex items-center gap-3">
              <Calculator className="h-6 w-6" />
              <div>
                <CardTitle className="text-white">{t('calculator.title')}</CardTitle>
                <CardDescription className="text-blue-100">{t('calculator.description')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Formula Display */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-center text-lg font-mono font-semibold" style={{ color: '#3560AD' }}>
                {t('calculator.formula')}
              </p>
            </div>

            {/* Input Fields */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <Label htmlFor="expenses" className="text-base font-semibold">{t('calculator.totalExpenses')}</Label>
                <CurrencyInput
                  id="expenses"
                  value={totalExpenses}
                  onChange={setTotalExpenses}
                  placeholder="500,000"
                />
              </div>

              <div>
                <Label htmlFor="revenue" className="text-base font-semibold">{t('calculator.totalRevenue')}</Label>
                <CurrencyInput
                  id="revenue"
                  value={totalRevenue}
                  onChange={setTotalRevenue}
                  placeholder="1,000,000"
                />
              </div>
            </div>

            {/* Calculate Button */}
            <Button
              onClick={calculatePercentage}
              size="lg"
              className="w-full mb-6"
              style={{ backgroundColor: '#3560AD' }}
            >
              <Calculator className="mr-2 h-5 w-5" />
              {t('calculator.calculate')}
            </Button>

            {/* Result Display */}
            {result !== null && (
              <div className="border-2 border-blue-200 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-2">{t('calculator.result')}</p>
                    <div className="flex items-baseline gap-3">
                      <p className="text-5xl font-bold" style={{ color: '#203864' }}>
                        {result.toFixed(2)}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('calculator.resultExplanation')}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={saveResult}
                    disabled={loading}
                    style={{ backgroundColor: '#3560AD' }}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {t('calculator.save')}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('calculator.resultDetail', {
                    expenses: formatCurrency(parseFloat(totalExpenses)),
                    revenue: formatCurrency(parseFloat(totalRevenue))
                  })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History Card */}
        {history.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5" style={{ color: '#3560AD' }} />
                  <div>
                    <CardTitle>{t('history.title')}</CardTitle>
                    <CardDescription>{t('history.description')}</CardDescription>
                  </div>
                </div>
                <Button
                  onClick={generateReport}
                  disabled={filteredHistory.length === 0}
                  style={{ backgroundColor: '#3560AD', color: 'white' }}
                >
                  {t('history.printReport')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date Filter */}
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label className="text-sm font-medium">{t('history.startDate')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP", { locale: dateFnsLocale }) : <span>{t('history.pickDate')}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        locale={dateFnsLocale}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex-1">
                  <Label className="text-sm font-medium">{t('history.endDate')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP", { locale: dateFnsLocale }) : <span>{t('history.pickDate')}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        locale={dateFnsLocale}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {(startDate || endDate) && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setStartDate(undefined);
                      setEndDate(undefined);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('history.date')}</TableHead>
                    <TableHead className="text-right">{t('history.expenses')}</TableHead>
                    <TableHead className="text-right">{t('history.revenue')}</TableHead>
                    <TableHead className="text-right">{t('history.percentage')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{format(record.date, 'PPP p', { locale: dateFnsLocale })}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.totalExpenses)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.totalRevenue)}</TableCell>
                      <TableCell className="text-right font-bold" style={{ color: '#3560AD' }}>
                        {record.percentage.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {t('history.noRecords')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Guide Section */}
        <Card>
          <CardHeader style={{ backgroundColor: '#3560AD' }} className="text-white">
            <CardTitle className="text-white">{t('guide.title')}</CardTitle>
            <CardDescription className="text-blue-100">{t('guide.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Explanation */}
            <div>
              <h3 className="text-xl font-semibold mb-3">{t('guide.explanation.title')}</h3>
              <div className="space-y-3 text-muted-foreground">
                <p><strong>{t('guide.explanation.expensesLabel')}</strong> {t('guide.explanation.expensesText')}</p>
                <p><strong>{t('guide.explanation.revenueLabel')}</strong> {t('guide.explanation.revenueText')}</p>
                <p><strong>{t('guide.explanation.calculationLabel')}</strong> {t('guide.explanation.calculationText')}</p>
              </div>
            </div>

            {/* Example */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <h4 className="font-semibold mb-2">{t('guide.example.title')}</h4>
              <p className="text-muted-foreground">{t('guide.example.text')}</p>
            </div>

            {/* Importance */}
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Award className="h-6 w-6" style={{ color: '#3560AD' }} />
                {t('guide.importance.title')}
              </h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Target className="h-6 w-6 flex-shrink-0 mt-1" style={{ color: '#3560AD' }} />
                  <div>
                    <h4 className="font-semibold mb-1">{t('guide.importance.improvement.title')}</h4>
                    <p className="text-muted-foreground">{t('guide.importance.improvement.text')}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Lightbulb className="h-6 w-6 flex-shrink-0 mt-1" style={{ color: '#3560AD' }} />
                  <div>
                    <h4 className="font-semibold mb-1">{t('guide.importance.goals.title')}</h4>
                    <p className="text-muted-foreground">{t('guide.importance.goals.text')}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Award className="h-6 w-6 flex-shrink-0 mt-1" style={{ color: '#3560AD' }} />
                  <div>
                    <h4 className="font-semibold mb-1">{t('guide.importance.credibility.title')}</h4>
                    <p className="text-muted-foreground">{t('guide.importance.credibility.text')}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Brain className="h-6 w-6 flex-shrink-0 mt-1" style={{ color: '#3560AD' }} />
                  <div>
                    <h4 className="font-semibold mb-1">{t('guide.importance.decisions.title')}</h4>
                    <p className="text-muted-foreground">{t('guide.importance.decisions.text')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Strategies */}
            <div>
              <h3 className="text-xl font-semibold mb-4">{t('guide.strategies.title')}</h3>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold mb-2">{t('guide.strategies.streamline.title')}</h4>
                  <p className="text-muted-foreground">{t('guide.strategies.streamline.text')}</p>
                </div>

                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold mb-2">{t('guide.strategies.workforce.title')}</h4>
                  <p className="text-muted-foreground">{t('guide.strategies.workforce.text')}</p>
                </div>

                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold mb-2">{t('guide.strategies.revenue.title')}</h4>
                  <p className="text-muted-foreground">{t('guide.strategies.revenue.text')}</p>
                </div>

                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold mb-2">{t('guide.strategies.control.title')}</h4>
                  <p className="text-muted-foreground">{t('guide.strategies.control.text')}</p>
                </div>
              </div>
            </div>

            {/* Conclusion */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
              <p className="text-muted-foreground">
                {t('guide.conclusion')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}