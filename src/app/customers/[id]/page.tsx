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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getCurrentADDate, adToBs, bsToAd, toMillis, BS_MONTHS, getBSYears } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { getSettings } from "@/lib/services/settings-service";
import { generateCustomerLedgerPDF, sharePDF } from "@/lib/services/pdf-service";
import { TransactionType, Transaction, Setting } from "@/lib/types";
import { useI18n } from "@/lib/i18n-context";

const getTransactionLabel = (type: TransactionType) => {
  const t = type.toUpperCase();
  switch(t) {
    case 'OUT_FULL': return 'OUT';
    case 'IN_EMPTY': return 'IN';
    case 'LEAKAGE': return 'LEAKAGE';
    case 'LOST': return 'LOST';
    case 'ADJUSTMENT': return 'ADJ';
    default: return t;
  }
};

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

export default function CustomerProfile(props: { params: Promise<{ id: string }> }) {
  const { id } = React.use(props.params);
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
    updateTransaction,
    recalculateBalance 
  } = useLedger();
  
  const customer = customers.find(c => c.id === id);
  const transactions = getCustomerTransactions(id);
  const balance = customer?.balance || 0;
  const isInactive = customer?.status === 'inactive';

  const [settings, setSettings] = useState<Setting | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<any>({});
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  
  // Date Filter State (BS)
  const [filterDates, setFilterDates] = useState({
    from: { year: '', month: '', day: '' },
    to: { year: '', month: '', day: '' }
  });
  const [activeFilter, setActiveFilter] = useState<{ from: string, to: string } | null>(null);

  // Edit Profile State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editProfileData, setEditProfileData] = useState({
    name: '',
    phone: '',
    address: '',
    pan: '',
    remarks: '',
    specialInstructions: ''
  });

  useEffect(() => {
    if (db) getSettings(db).then(setSettings);
  }, [db]);

  useEffect(() => {
    if (customer) {
      setEditProfileData({
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        pan: customer.pan || '',
        remarks: customer.remarks || '',
        specialInstructions: customer.specialInstructions || ''
      });
    }
  }, [customer]);

  // Pre-populate date filters on mount
  useEffect(() => {
    const todayStr = getCurrentADDate();
    const todayBS = adToBs(todayStr).split('-');
    
    // Calculate one month ago
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

  const startInlineEdit = (txn: Transaction) => {
    setEditingId(txn.id);
    setEditFields({ bsDate: txn.bsDate, type: txn.type, quantity: txn.quantity, remark: txn.remark || '', customerId: txn.customerId });
  };

  const saveInlineEdit = async () => {
    if (!editingId) return;
    try {
      const parts = editFields.bsDate.split('-');
      const adDate = bsToAd(parts[0], parts[1], parts[2]);
      await updateTransaction(editingId, { ...editFields, date: adDate });
      setEditingId(null);
      toast({ title: t('success') });
    } catch (err: any) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setIsConfirmSaveOpen(false);
    }
  };

  if (!customer) return <div className="p-20 text-center">Not found</div>;

  const bsYears = getBSYears();
  const daysList = Array.from({ length: 32 }, (_, i) => safePad(i + 1));

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-700 pb-24">
      <div className="flex flex-col md:flex-row md:items-center gap-4 border-b pb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft className="h-6 w-6" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-2xl md:text-3xl font-bold truncate">{customer.name}</h1>
            <Badge variant={isInactive ? "secondary" : "default"}>{(customer.status || 'active').toUpperCase()}</Badge>
          </div>
          <div className="text-muted-foreground flex gap-4 text-xs mt-1">
            <span><MapPin className="h-3 w-3 inline mr-1" />{customer.address}</span>
            <span><Phone className="h-3 w-3 inline mr-1" />{customer.phone}</span>
            {customer.pan && <span><Hash className="h-3 w-3 inline mr-1" />PAN: {customer.pan}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasBalanceDiscrepancy && (
            <Button size="sm" variant="destructive" onClick={handleRecalculate} disabled={isRecalculating} className="animate-pulse">
              {isRecalculating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {t('fixBalance')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setIsEditProfileOpen(true)}>
            <Edit2 className="h-4 w-4 mr-1" /> Edit
          </Button>
          <Button variant="outline" size="sm" className="font-bold" onClick={handleSharePDF} disabled={isGeneratingPDF}>{isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4 mr-1" />}{t('shareStatement')}</Button>
          <Button size="sm" variant="outline" onClick={() => updateCustomerStatus(customer.id, isInactive ? 'active' : 'inactive')}>{isInactive ? <UserCheck className="h-4 w-4 mr-1" /> : <UserX className="h-4 w-4 mr-1" />}{isInactive ? t('activate') : t('deactivate')}</Button>
        </div>
      </div>

      {hasBalanceDiscrepancy && (
        <div className="bg-accent/10 border border-accent/20 p-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-accent text-xs font-bold">
            <AlertTriangle className="h-4 w-4" />
            Account balance is out of sync with transactions.
          </div>
          <Button variant="link" size="sm" onClick={handleRecalculate} className="text-accent h-auto p-0 font-bold text-xs underline">{t('fixBalance')}</Button>
        </div>
      )}

      {/* Date Filter Bar */}
      <Card className="border-none shadow-md bg-card/50">
        <CardContent className="p-4 flex flex-col lg:flex-row items-end gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 w-full">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">{t('fromDate')} (BS)</Label>
              <div className="grid grid-cols-3 gap-1">
                <Select value={filterDates.from.year} onValueChange={(v) => setFilterDates(prev => ({...prev, from: {...prev.from, year: v}}))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">{bsYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterDates.from.month} onValueChange={(v) => setFilterDates(prev => ({...prev, from: {...prev.from, month: v}}))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>{BS_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterDates.from.day} onValueChange={(v) => setFilterDates(prev => ({...prev, from: {...prev.from, day: v}}))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Day" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">{daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">{t('toDate')} (BS)</Label>
              <div className="grid grid-cols-3 gap-1">
                <Select value={filterDates.to.year} onValueChange={(v) => setFilterDates(prev => ({...prev, to: {...prev.to, year: v}}))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">{bsYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterDates.to.month} onValueChange={(v) => setFilterDates(prev => ({...prev, to: {...prev.to, month: v}}))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>{BS_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterDates.to.day} onValueChange={(v) => setFilterDates(prev => ({...prev, to: {...prev.to, day: v}}))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Day" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">{daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full lg:w-auto">
            <Button variant="outline" size="sm" onClick={handleClearFilter} className="flex-1 lg:flex-none"><Eraser className="h-4 w-4 mr-2" /> {t('clear')}</Button>
            <Button size="sm" onClick={handleApplyFilter} className="flex-1 lg:flex-none"><Filter className="h-4 w-4 mr-2" /> {t('filter')}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="border-none shadow-xl">
             <CardHeader className="flex flex-row items-center justify-between px-6">
                <div className="min-w-0">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    {t('ledger')} 
                    {activeFilter && <Badge variant="outline" className="text-[9px]">{activeFilter.from} - {activeFilter.to}</Badge>}
                  </CardTitle>
                  <CardDescription>{t('transactionTimeline')}</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">{t('statedBalance')}</p>
                  <Badge className={cn(balance > 0 ? "bg-primary" : balance < 0 ? "bg-accent" : "bg-emerald-500")}>
                    {balance === 0 ? t('settled') : `${Math.abs(balance)} ${balance > 0 ? t('toReceiveSuffix') : t('toGiveSuffix')}`}
                  </Badge>
                </div>
             </CardHeader>
             <CardContent className="p-0">
                {activeFilter && (
                  <div className="px-6 py-2 bg-muted/20 border-b flex justify-between items-center text-xs font-bold">
                    <span className="text-muted-foreground uppercase">{t('openingBalance')}</span>
                    <span className={cn(openingBalance >= 0 ? "text-primary" : "text-accent")}>
                      {openingBalance} PCS
                    </span>
                  </div>
                )}
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="pl-6 text-[10px] font-bold">{t('dateBs')}</TableHead>
                      <TableHead className="text-[10px] font-bold">{t('type')}</TableHead>
                      <TableHead className="text-[10px] font-bold">{t('qty')}</TableHead>
                      <TableHead className="text-[10px] font-bold">{t('running')}</TableHead>
                      <TableHead className="text-[10px] font-bold">{t('remarks')}</TableHead>
                      <TableHead className="text-right pr-6 text-[10px] font-bold">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsWithBalance.map((txn) => (
                      <TableRow key={txn.id} className={cn(editingId === txn.id && "bg-primary/5")}>
                        <TableCell className="pl-6 font-medium text-xs">{txn.bsDate}</TableCell>
                        <TableCell><Badge variant="outline" className={cn("text-[9px] font-bold", getTransactionColor(txn.type))}>{getTransactionLabel(txn.type)}</Badge></TableCell>
                        <TableCell className={cn("font-bold text-xs", getTransactionImpact(txn.type) > 0 ? "text-primary" : "text-emerald-500")}>{getTransactionImpact(txn.type) > 0 ? '+' : '-'}{txn.quantity}</TableCell>
                        <TableCell className="font-bold text-xs">{txn.runningBalance === 0 ? t('settled') : `${Math.abs(txn.runningBalance)} ${txn.runningBalance > 0 ? 'R' : 'G'}`}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">{txn.remark || "-"}</TableCell>
                        <TableCell className="text-right pr-6"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => startInlineEdit(txn)}><Edit2 className="h-3 w-3 mr-2" />Edit</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => deleteTransaction(txn.id, "User requested delete")}><Trash2 className="h-3 w-3 mr-2" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
                      </TableRow>
                    ))}
                    {transactionsWithBalance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">No transactions found for this selection.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
             </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {!isInactive && (
            <Card className="border-none shadow-xl">
              <CardHeader><CardTitle className="text-lg font-bold">{t('newEntry')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full h-12 bg-primary text-primary-foreground font-bold text-lg" onClick={() => router.push(`/transactions?customerId=${id}`)}>
                  <Plus className="h-5 w-5 mr-2" /> {t('newTransaction')}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">Log new cylinder movements for this customer</p>
              </CardContent>
            </Card>
          )}
          <Card className="bg-muted/20 border-none shadow-xl"><CardHeader><CardTitle className="text-sm font-bold flex gap-2 items-center"><ClipboardList className="h-4 w-4" /> {t('documentation')}</CardTitle></CardHeader><CardContent className="space-y-4 text-xs"><div><p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">{t('generalNotes')}</p><div className="bg-card p-2 rounded border">{customer.remarks || "N/A"}</div></div><div><p className="text-[10px] font-bold uppercase text-primary mb-1">{t('instructions')}</p><div className="bg-card p-2 rounded border">{customer.specialInstructions || "None"}</div></div></CardContent></Card>
        </div>
      </div>

      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Name</Label><Input value={editProfileData.name} onChange={e => setEditProfileData({...editProfileData, name: e.target.value})} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={editProfileData.phone} onChange={e => setEditProfileData({...editProfileData, phone: e.target.value})} /></div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Address</Label><Input value={editProfileData.address} onChange={e => setEditProfileData({...editProfileData, address: e.target.value})} /></div>
                <div className="space-y-2"><Label>PAN</Label><Input value={editProfileData.pan} onChange={e => setEditProfileData({...editProfileData, pan: e.target.value})} /></div>
             </div>
             <div className="space-y-2"><Label>General Notes</Label><Textarea value={editProfileData.remarks} onChange={e => setEditProfileData({...editProfileData, remarks: e.target.value})} /></div>
             <div className="space-y-2"><Label>Special Instructions</Label><Textarea value={editProfileData.specialInstructions} onChange={e => setEditProfileData({...editProfileData, specialInstructions: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditProfileOpen(false)}>Cancel</Button>
            <Button onClick={handleEditProfileSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={editingId !== null && isConfirmSaveOpen} onOpenChange={setIsConfirmSaveOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Save Changes?</AlertDialogTitle><AlertDialogDescription>This will update the ledger entry and adjust denormalized balances.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setEditingId(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={saveInlineEdit} className="bg-emerald-600">Save</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}