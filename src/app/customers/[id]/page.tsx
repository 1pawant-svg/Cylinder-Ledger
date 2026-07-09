
"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useLedger } from "@/lib/ledger-context";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, MapPin, Phone, Share2, Edit2, MoreVertical, AlertTriangle, UserX, UserCheck, Loader2, Plus, Filter, Eraser, Hash, Trash2, RefreshCw, ClipboardList
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getCurrentADDate, adToBs, bsToAd, toMillis, BS_MONTHS, getBSYears } from "@/lib/date-utils";
import { useI18n } from "@/lib/i18n-context";
import { useFirestore } from "@/firebase";
import { getSettings } from "@/lib/services/settings-service";
import { generateCustomerLedgerPDF, sharePDF } from "@/lib/services/pdf-service";
import { TransactionType, Setting } from "@/lib/types";

const getTransactionColor = (type: TransactionType) => {
  const t = type.toUpperCase();
  if (t === 'OUT' || t === 'OUT_FULL') return 'text-primary';
  if (t === 'IN' || t === 'IN_EMPTY') return 'text-emerald-500';
  if (t === 'LEAKAGE') return 'text-amber-500';
  if (t === 'LOST') return 'text-destructive';
  return 'text-muted-foreground';
};

const getTransactionImpact = (type: TransactionType): number => {
  const t = type.toUpperCase();
  if (t === 'OUT' || t === 'OUT_FULL') return 1;
  if (t === 'IN' || t === 'IN_EMPTY') return -1;
  if (t === 'LEAKAGE') return -1;
  if (t === 'LOST') return -1;
  if (t === 'ADJUSTMENT') return -1;
  return 0;
};

const safePad = (val: string | number): string => {
  const s = String(val || "");
  if (s.length >= 2) return s;
  return ('0' + s).slice(-2);
};

export default function CustomerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const db = useFirestore();
  const { 
    customers, 
    getCustomerTransactions, 
    deleteTransaction, 
    updateCustomer, 
    updateCustomerStatus, 
    recalculateBalance 
  } = useLedger();
  
  const customer = customers.find(c => c.id === id);
  const transactions = getCustomerTransactions(id);
  const balance = customer?.balance || 0;
  const isInactive = customer?.status === 'inactive';

  const [settings, setSettings] = useState<Setting | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  const [filterDates, setFilterDates] = useState({
    from: { year: '', month: '', day: '' },
    to: { year: '', month: '', day: '' }
  });
  const [activeFilter, setActiveFilter] = useState<{ from: string, to: string } | null>(null);

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editProfileData, setEditProfileData] = useState({
    name: '',
    phone: '',
    altPhone: '',
    address: '',
    pan: '',
    remarks: '',
    specialInstructions: ''
  });

  const getTransactionLabel = (type: TransactionType) => {
    const tLabel = type.toUpperCase();
    switch(tLabel) {
      case 'OUT_FULL': return t('labelOut');
      case 'IN_EMPTY': return t('labelIn');
      case 'LEAKAGE': return t('leakageReturn');
      case 'LOST': return t('cylinderLost');
      case 'ADJUSTMENT': return t('balanceAdjustment');
      default: return tLabel;
    }
  };

  useEffect(() => {
    if (db) getSettings(db).then(setSettings);
  }, [db]);

  useEffect(() => {
    if (customer) {
      setEditProfileData({
        name: customer.name,
        phone: customer.phone,
        altPhone: customer.altPhone || '',
        address: customer.address,
        pan: customer.pan || '',
        remarks: customer.remarks || '',
        specialInstructions: customer.specialInstructions || ''
      });
    }
  }, [customer]);

  useEffect(() => {
    const todayStr = getCurrentADDate();
    const todayBS = adToBs(todayStr).split('-');
    
    const d = new Date(todayStr);
    d.setMonth(d.getMonth() - 1);
    const agoStr = d.toISOString().split('T')[0];
    const agoBS = adToBs(agoStr).split('-');

    if (todayBS.length === 3 && agoBS.length === 3) {
      setFilterDates({
        from: { year: agoBS[0], month: agoBS[1], day: agoBS[2] },
        to: { year: todayBS[0], month: todayBS[1], day: todayBS[2] }
      });
    }
  }, []);

  const transactionsWithBalance = useMemo(() => {
    const chronological = [...transactions].sort((a, b) => toMillis(a.date) - toMillis(b.date));
    let running = 0;
    
    const enriched = chronological.map(txn => {
      running += (txn.quantity * getTransactionImpact(txn.type));
      return { ...txn, runningBalance: running };
    });

    let result = enriched;
    if (activeFilter) {
      const fromAD = bsToAd(activeFilter.from.split('-')[0], activeFilter.from.split('-')[1], activeFilter.from.split('-')[2]);
      const toAD = bsToAd(activeFilter.to.split('-')[0], activeFilter.to.split('-')[1], activeFilter.to.split('-')[2]);
      result = enriched.filter(t => {
        const adDate = typeof t.date === 'string' ? t.date : (t.date as any).toDate().toISOString().split('T')[0];
        return adDate >= fromAD && adDate <= toAD;
      });
    }

    return result.reverse(); 
  }, [transactions, activeFilter]);

  const openingBalance = useMemo(() => {
    if (!activeFilter) return 0;
    const fromAD = bsToAd(activeFilter.from.split('-')[0], activeFilter.from.split('-')[1], activeFilter.from.split('-')[2]);
    return transactions
      .filter(t => {
        const adDate = typeof t.date === 'string' ? t.date : (t.date as any).toDate().toISOString().split('T')[0];
        return adDate < fromAD;
      })
      .reduce((sum, t) => sum + (t.quantity * getTransactionImpact(t.type)), 0);
  }, [transactions, activeFilter]);

  const calculatedTotal = useMemo(() => {
    return transactions.reduce((acc, t) => acc + (t.quantity * getTransactionImpact(t.type)), 0);
  }, [transactions]);

  const hasBalanceDiscrepancy = Math.abs(calculatedTotal - balance) > 0.001;

  const handleApplyFilter = () => {
    if (filterDates.from.year && filterDates.from.month && filterDates.from.day && 
        filterDates.to.year && filterDates.to.month && filterDates.to.day) {
      setActiveFilter({
        from: `${filterDates.from.year}-${filterDates.from.month}-${filterDates.from.day}`,
        to: `${filterDates.to.year}-${filterDates.to.month}-${filterDates.to.day}`
      });
    } else {
      toast({ variant: "destructive", title: t('error'), description: t('incompleteForm') });
    }
  };

  const handleClearFilter = () => {
    setFilterDates({
      from: { year: '', month: '', day: '' },
      to: { year: '', month: '', day: '' }
    });
    setActiveFilter(null);
  };

  const handleRecalculate = async () => {
    if (!customer) return;
    setIsRecalculating(true);
    try {
      await recalculateBalance(customer.id);
      toast({ title: t('success'), description: `Synced to ${calculatedTotal} PCS` });
    } catch (err) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSharePDF = async () => {
    if (!customer) return;
    setIsGeneratingPDF(true);
    try {
      const displayTxns = transactionsWithBalance;
      const totalOut = displayTxns.filter(t => getTransactionImpact(t.type) === 1).reduce((s, t) => s + t.quantity, 0);
      const totalIn = displayTxns.filter(t => getTransactionImpact(t.type) === -1).reduce((s, t) => s + t.quantity, 0);
      
      const closingBalance = openingBalance + totalOut - totalIn;

      const doc = await generateCustomerLedgerPDF(
        t,
        customer, 
        displayTxns, 
        settings, 
        { 
          totalIn, 
          totalOut, 
          balance: closingBalance,
          isFiltered: !!activeFilter,
          openingBalance,
          dateRange: activeFilter ? `${activeFilter.from} to ${activeFilter.to} (BS)` : undefined
        }
      );
      await sharePDF(doc, `${customer.name.replace(/\s+/g, '_')}_Ledger.pdf`, customer.phone, customer.name);
      toast({ title: t('success') });
    } catch (err: any) {
      toast({ variant: "destructive", title: t('error'), description: err.message });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleEditProfileSave = async () => {
    if (!customer) return;
    try {
      await updateCustomer(customer.id, editProfileData);
      setIsEditProfileOpen(false);
      toast({ title: t('success') });
    } catch (err) {
      toast({ variant: "destructive", title: t('error') });
    }
  };

  if (!customer) return <div className="p-20 text-center">Not found</div>;

  const bsYears = getBSYears();
  const daysList = Array.from({ length: 32 }, (_, i) => safePad(i + 1));

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-700 pb-32 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-4 border-b pb-6 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
           <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full -ml-2 shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
           <h1 className="font-headline text-lg md:text-3xl font-bold truncate flex-1 min-w-0">{customer.name}</h1>
           <Badge variant={isInactive ? "secondary" : "default"} className="shrink-0 text-[10px] uppercase">{(customer.status || 'active').toUpperCase()}</Badge>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs min-w-0">
            <span className="flex items-center truncate max-w-[200px]"><MapPin className="h-3 w-3 mr-1 shrink-0" />{customer.address}</span>
            <div className="flex flex-wrap gap-3">
              <a href={`tel:${customer.phone}`} className="flex items-center shrink-0 hover:text-primary transition-colors hover:underline">
                <Phone className="h-3 w-3 mr-1 shrink-0" />
                {customer.phone}
              </a>
              {customer.altPhone && (
                <a href={`tel:${customer.altPhone}`} className="flex items-center shrink-0 hover:text-primary transition-colors hover:underline opacity-80">
                  <Phone className="h-3 w-3 mr-1 shrink-0" />
                  {customer.altPhone}
                </a>
              )}
            </div>
            {customer.pan && <span className="flex items-center shrink-0"><Hash className="h-3 w-3 mr-1 shrink-0" />PAN: {customer.pan}</span>}
          </div>
          
          <div className="flex flex-wrap gap-2 shrink-0">
            {hasBalanceDiscrepancy && (
              <Button size="sm" variant="destructive" onClick={handleRecalculate} disabled={isRecalculating} className="h-8 text-[9px] px-2 uppercase font-bold">
                {isRecalculating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                {t('fixBalance')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsEditProfileOpen(true)} className="h-8 text-[9px] px-2 uppercase font-bold flex-1 md:flex-none">
              <Edit2 className="h-3 w-3 mr-1" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-[9px] px-2 uppercase font-bold flex-1 md:flex-none" onClick={handleSharePDF} disabled={isGeneratingPDF}>
              {isGeneratingPDF ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Share2 className="h-3 w-3 mr-1" />}
              {t('shareStatement')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => updateCustomerStatus(customer.id, isInactive ? 'active' : 'inactive')} className="h-8 text-[9px] px-2 uppercase font-bold flex-1 md:flex-none">
              {isInactive ? <UserCheck className="h-3 w-3 mr-1" /> : <UserX className="h-3 w-3 mr-1" />}
              {isInactive ? t('activate') : t('deactivate')}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        <div className="lg:col-span-2 min-w-0 space-y-4">
          <Card className="border-none shadow-md bg-card/50 w-full overflow-hidden">
            <CardContent className="p-3 md:p-4 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-[9px] uppercase font-bold text-muted-foreground">{t('fromDate')} (BS)</Label>
                  <div className="grid grid-cols-3 gap-1">
                    <Select value={filterDates.from.year} onValueChange={(v) => setFilterDates(prev => ({...prev, from: {...prev.from, year: v}}))}>
                      <SelectTrigger className="h-8 text-[10px] px-1 overflow-hidden"><SelectValue placeholder="Y" /></SelectTrigger>
                      <SelectContent className="max-h-[300px]">{bsYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterDates.from.month} onValueChange={(v) => setFilterDates(prev => ({...prev, from: {...prev.from, month: v}}))}>
                      <SelectTrigger className="h-8 text-[10px] px-1 overflow-hidden"><SelectValue placeholder="M" /></SelectTrigger>
                      <SelectContent>{BS_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterDates.from.day} onValueChange={(v) => setFilterDates(prev => ({...prev, from: {...prev.from, day: v}}))}>
                      <SelectTrigger className="h-8 text-[10px] px-1 overflow-hidden"><SelectValue placeholder="D" /></SelectTrigger>
                      <SelectContent className="max-h-[300px]">{daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-[9px] uppercase font-bold text-muted-foreground">{t('toDate')} (BS)</Label>
                  <div className="grid grid-cols-3 gap-1">
                    <Select value={filterDates.to.year} onValueChange={(v) => setFilterDates(prev => ({...prev, to: {...prev.to, year: v}}))}>
                      <SelectTrigger className="h-8 text-[10px] px-1 overflow-hidden"><SelectValue placeholder="Y" /></SelectTrigger>
                      <SelectContent className="max-h-[300px]">{bsYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterDates.to.month} onValueChange={(v) => setFilterDates(prev => ({...prev, to: {...prev.to, month: v}}))}>
                      <SelectTrigger className="h-8 text-[10px] px-1 overflow-hidden"><SelectValue placeholder="M" /></SelectTrigger>
                      <SelectContent>{BS_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterDates.to.day} onValueChange={(v) => setFilterDates(prev => ({...prev, to: {...prev.to, day: v}}))}>
                      <SelectTrigger className="h-8 text-[10px] px-1 overflow-hidden"><SelectValue placeholder="D" /></SelectTrigger>
                      <SelectContent className="max-h-[300px]">{daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClearFilter} className="flex-1 h-9 text-[10px] font-bold uppercase"><Eraser className="h-3.5 w-3.5 mr-1" /> {t('clear')}</Button>
                <Button size="sm" onClick={handleApplyFilter} className="flex-1 h-9 text-[10px] font-bold uppercase"><Filter className="h-3.5 w-3.5 mr-1" /> {t('filter')}</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl overflow-hidden w-full">
             <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 md:px-6 pb-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg font-bold flex items-center gap-2 flex-wrap min-w-0">
                    <span className="truncate">{t('ledger')}</span>
                    {activeFilter && <Badge variant="outline" className="text-[9px] shrink-0">{activeFilter.from} - {activeFilter.to}</Badge>}
                  </CardTitle>
                  <CardDescription className="text-xs truncate">{t('transactionTimeline')}</CardDescription>
                </div>
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 mt-2 md:mt-0 w-full md:w-auto shrink-0 min-w-0">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">{t('statedBalance')}</p>
                  <Badge className={cn("text-[10px] font-bold shrink-0 truncate", balance > 0 ? "bg-primary text-primary-foreground" : balance < 0 ? "bg-emerald-500 text-emerald-foreground" : "bg-emerald-500 text-emerald-foreground")}>
                    {balance === 0 ? t('settled') : `${Math.abs(balance)} ${balance > 0 ? t('toReceiveSuffix') : t('toGiveSuffix')}`}
                  </Badge>
                </div>
             </CardHeader>
             <CardContent className="p-0 overflow-hidden">
                {activeFilter && (
                  <div className="px-4 md:px-6 py-2 bg-muted/20 border-b flex justify-between items-center text-xs font-bold min-w-0">
                    <span className="text-muted-foreground uppercase text-[10px] shrink-0 mr-2">{t('openingBalance')}</span>
                    <span className={cn("shrink-0", openingBalance >= 0 ? "text-primary" : "text-emerald-500")}>
                      {openingBalance} PCS
                    </span>
                  </div>
                )}
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[700px] w-full border-collapse">
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border/50">
                        <TableHead className="pl-4 md:pl-6 text-[13px] font-bold uppercase tracking-widest w-[180px] text-muted-foreground">{t('dateBs')}</TableHead>
                        <TableHead className="text-[13px] font-bold uppercase tracking-widest w-[100px] text-muted-foreground">{t('type')}</TableHead>
                        <TableHead className="text-[13px] font-bold uppercase tracking-widest w-[80px] text-muted-foreground">{t('qty')}</TableHead>
                        <TableHead className="text-[13px] font-bold uppercase tracking-widest w-[130px] text-muted-foreground">{t('running')}</TableHead>
                        <TableHead className="text-[13px] font-bold uppercase tracking-widest min-w-[150px] text-muted-foreground">{t('remarks')}</TableHead>
                        <TableHead className="text-right pr-4 md:pr-6 text-[13px] font-bold uppercase tracking-widest w-[60px] text-muted-foreground">{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionsWithBalance.map((txn) => (
                        <TableRow key={txn.id} className="hover:bg-muted/10 transition-colors border-b border-border/20 last:border-0">
                          <TableCell className="pl-4 md:pl-6 font-medium text-base py-5">{txn.bsDate}</TableCell>
                          <TableCell className="py-5">
                            <Badge variant="outline" className={cn("text-[12px] font-bold h-6 uppercase tracking-tighter", getTransactionColor(txn.type))}>
                              {getTransactionLabel(txn.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn("font-bold text-base py-5", getTransactionImpact(txn.type) > 0 ? "text-primary" : "text-emerald-500")}>
                            {getTransactionImpact(txn.type) > 0 ? '+' : '-'}{txn.quantity}
                          </TableCell>
                          <TableCell className="font-bold py-5">
                            {txn.runningBalance === 0 ? (
                              <span className="text-emerald-500 uppercase tracking-tighter text-sm font-bold">{t('settled')}</span>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <span className={cn("text-lg", txn.runningBalance > 0 ? "text-primary" : "text-emerald-500")}>
                                  {Math.abs(txn.runningBalance)}
                                </span>
                                <span className={cn(
                                  "text-[11px] font-bold leading-tight uppercase tracking-widest opacity-80",
                                  txn.runningBalance > 0 ? "text-primary" : "text-emerald-500"
                                )}>
                                  {txn.runningBalance > 0 ? t('toReceiveSuffix') : t('toGiveSuffix')}
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground italic truncate max-w-[200px] py-5">{txn.remark || "-"}</TableCell>
                          <TableCell className="text-right pr-4 md:pr-6 py-5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted/40 rounded-full transition-all"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/transactions?editId=${txn.id}&customerId=${id}`)}>
                                  <Edit2 className="h-3 w-3 mr-2" />Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => deleteTransaction(txn.id, "User requested delete")}>
                                  <Trash2 className="h-3 w-3 mr-2" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                      {transactionsWithBalance.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic text-xs">No transactions found for this selection.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
             </CardContent>
          </Card>
        </div>

        <div className="space-y-6 min-w-0">
          {!isInactive && (
            <Card className="border-none shadow-xl w-full">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">NEW TRANSACTION</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full h-12 bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20" onClick={() => router.push(`/transactions?customerId=${id}`)}>
                  <Plus className="h-5 w-5 mr-2" /> {t('newTransaction')}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center italic">Record movements like issues, returns, or adjustments</p>
              </CardContent>
            </Card>
          )}
          <Card className="bg-muted/20 border-none shadow-xl w-full overflow-hidden">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase tracking-widest flex gap-2 items-center text-muted-foreground shrink-0"><ClipboardList className="h-4 w-4 shrink-0" /> {t('documentation')}</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-xs min-w-0">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">{t('generalNotes')}</p>
                <div className="bg-card p-2 rounded border border-border/50 text-muted-foreground min-h-[40px] leading-relaxed break-words overflow-hidden">{customer.remarks || "N/A"}</div>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase text-primary mb-1">{t('instructions')}</p>
                <div className="bg-card p-2 rounded border border-primary/20 text-muted-foreground min-h-[40px] leading-relaxed break-words overflow-hidden">{customer.specialInstructions || "None"}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="sm:max-w-[500px] w-[95vw] rounded-lg">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Name</Label><Input value={editProfileData.name} onChange={e => setEditProfileData({...editProfileData, name: e.target.value})} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={editProfileData.phone} onChange={e => setEditProfileData({...editProfileData, phone: e.target.value.replace(/\D/g, '')})} /></div>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Alt Phone</Label><Input value={editProfileData.altPhone} onChange={e => setEditProfileData({...editProfileData, altPhone: e.target.value.replace(/\D/g, '')})} /></div>
                <div className="space-y-2"><Label>PAN</Label><Input value={editProfileData.pan} onChange={e => setEditProfileData({...editProfileData, pan: e.target.value.replace(/\D/g, '')})} /></div>
             </div>
             <div className="space-y-2"><Label>Address</Label><Input value={editProfileData.address} onChange={e => setEditProfileData({...editProfileData, address: e.target.value})} /></div>
             <div className="space-y-2"><Label>General Notes</Label><Textarea value={editProfileData.remarks} onChange={e => setEditProfileData({...editProfileData, remarks: e.target.value})} /></div>
             <div className="space-y-2"><Label>Special Instructions</Label><Textarea value={editProfileData.specialInstructions} onChange={e => setEditProfileData({...editProfileData, specialInstructions: e.target.value})} /></div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsEditProfileOpen(false)}>Cancel</Button>
            <Button onClick={handleEditProfileSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
