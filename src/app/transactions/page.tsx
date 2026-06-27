
"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useLedger } from "@/lib/ledger-context";
import { 
  Calendar, 
  User, 
  Plus,
  Loader2,
  ArrowLeft,
  X,
  History,
  BellRing,
  Search,
  Check,
  ChevronsUpDown,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Package,
  TrendingUp,
  TrendingDown,
  Clock
} from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { adToBs, bsToAd, BS_MONTHS, getBSYears, getCurrentADDate, toMillis } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { TransactionType, Transaction, Customer } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";
import { useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n-context";

const safePad = (val: string | number): string => {
  const s = String(val || "").trim();
  if (s.length >= 2) return s;
  return ('0' + s).slice(-2);
};

const getTransactionImpact = (type: TransactionType): number => {
  const t = type.toUpperCase();
  if (t === 'OUT' || t === 'OUT_FULL') return 1;
  if (t === 'IN' || t === 'IN_EMPTY' || t === 'LEAKAGE' || t === 'LOST' || t === 'ADJUSTMENT') return -1;
  return 0;
};

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { t } = useI18n();
  const { customers, addCustomer, addTransaction, deleteTransaction, getCustomerTransactions } = useLedger();
  const { toast } = useToast();
  
  const urlCustomerId = searchParams?.get('customerId');
  const editTransactionId = searchParams?.get('editId');

  const getTodayBSParts = () => {
    const todayAD = getCurrentADDate();
    const bsDateStr = adToBs(todayAD);
    const parts = bsDateStr.split(/[-/]/);
    if (parts.length === 3) {
      return { 
        year: parts[0], 
        month: safePad(parts[1]), 
        day: safePad(parts[2]) 
      };
    }
    return { year: '2081', month: '01', day: '01' };
  };

  const getFutureBSParts = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const adStr = d.toISOString().split('T')[0];
    const bsDateStr = adToBs(adStr);
    const parts = bsDateStr.split(/[-/]/);
    if (parts.length === 3) {
      return { 
        year: parts[0], 
        month: safePad(parts[1]), 
        day: safePad(parts[2]) 
      };
    }
    return getTodayBSParts();
  };

  const [mounted, setMounted] = useState(false);
  const [bsParts, setBsParts] = useState({ year: '2081', month: '01', day: '01' });
  const [dueBsParts, setDueBsParts] = useState({ year: '2081', month: '01', day: '08' });
  
  const [useDueDate, setUseDueDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(!!editTransactionId);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  const [formData, setFormData] = useState({
    customerId: urlCustomerId || '',
    date: '', 
    type: 'OUT_FULL' as TransactionType,
    quantity: 1,
    returnQuantity: 0, 
    remark: '',
  });

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === formData.customerId);
  }, [customers, formData.customerId]);

  const customerHistory = useMemo(() => {
    if (!formData.customerId) return [];
    const txns = getCustomerTransactions(formData.customerId);
    const chronological = [...txns].sort((a, b) => toMillis(a.date) - toMillis(b.date));
    let running = 0;
    return chronological.map(txn => {
      running += (txn.quantity * getTransactionImpact(txn.type));
      return { ...txn, runningBalance: running };
    }).reverse();
  }, [formData.customerId, getCustomerTransactions]);

  const customerSummaryData = useMemo(() => {
    if (!formData.customerId) return null;
    const txns = getCustomerTransactions(formData.customerId);
    
    const totalToReceive = txns
      .filter(t => getTransactionImpact(t.type) === 1)
      .reduce((s, t) => s + t.quantity, 0);
      
    const totalToGive = txns
      .filter(t => getTransactionImpact(t.type) === -1)
      .reduce((s, t) => s + t.quantity, 0);

    const lastTxn = customerHistory[0] || null;

    return {
      totalToReceive,
      totalToGive,
      lastTxn,
      recent: customerHistory.slice(0, 2)
    };
  }, [formData.customerId, getCustomerTransactions, customerHistory]);

  useEffect(() => {
    const today = getTodayBSParts();
    setBsParts(today);
    setDueBsParts(getFutureBSParts(7));
    setFormData(prev => ({ 
      ...prev, 
      date: bsToAd(today.year, today.month, today.day) 
    }));
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchTxn() {
      if (!editTransactionId || !db) return;
      setLoading(true);
      try {
        const docRef = doc(db, 'transactions', editTransactionId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          const bsStr = data.bsDate || '';
          const parts = bsStr.split(/[-/]/);
          
          if (parts.length === 3) {
            setBsParts({
              year: parts[0],
              month: safePad(parts[1]),
              day: safePad(parts[2])
            });
          }

          if (data.dueDate) {
            const dbsStr = adToBs(data.dueDate);
            const dparts = dbsStr.split(/[-/]/);
            if (dparts.length === 3) {
              setDueBsParts({
                year: dparts[0],
                month: safePad(dparts[1]),
                day: safePad(dparts[2])
              });
              setUseDueDate(true);
            }
          } else {
            setUseDueDate(false);
          }

          setFormData({
            customerId: data.customerId,
            date: data.date,
            type: data.type as TransactionType,
            quantity: data.quantity,
            returnQuantity: 0,
            remark: data.remark || ''
          });
        }
      } catch (e) {
        toast({ variant: "destructive", title: "Load Failed" });
      } finally {
        setLoading(false);
      }
    }
    fetchTxn();
  }, [editTransactionId, db, toast]);

  const handleBSChange = (field: 'year' | 'month' | 'day', value: string) => {
    const newBS = { ...bsParts, [field]: value };
    setBsParts(newBS);
    if (newBS.year && newBS.month && newBS.day) {
      const adDate = bsToAd(newBS.year, newBS.month, newBS.day);
      setFormData(prev => ({ ...prev, date: adDate }));
    }
  };

  const handleDueBSChange = (field: 'year' | 'month' | 'day', value: string) => {
    setDueBsParts(prev => ({ ...prev, [field]: value }));
  };

  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', address: '', phone: '', notes: '' });

  const handleAddCustomer = async () => {
    if (!newCust.name || !newCust.phone) {
      toast({ variant: "destructive", title: t('incompleteForm') });
      return;
    }
    try {
      const customerId = await addCustomer({
        name: newCust.name,
        address: newCust.address,
        phone: newCust.phone,
        notes: newCust.notes,
        status: 'active'
      });
      setFormData(prev => ({ ...prev, customerId }));
      setIsAddCustomerOpen(false);
      setIsCustomerPopoverOpen(false);
      toast({ title: t('profileAdded') });
    } catch (err) {
      toast({ variant: "destructive", title: t('error'), description: "Could not create profile." });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) {
      toast({ variant: "destructive", title: t('incompleteForm') });
      return;
    }
    
    setSubmitting(true);
    const transactionDate = formData.date || getCurrentADDate();
    const bsDateStr = `${bsParts.year}-${bsParts.month}-${bsParts.day}`;
    
    let dueDateStr: string | undefined = undefined;
    if (useDueDate && (formData.type === 'OUT_FULL' || formData.type === 'OUT')) {
      dueDateStr = bsToAd(dueBsParts.year, dueBsParts.month, dueBsParts.day);
    }

    try {
      if (editTransactionId) {
        await deleteTransaction(editTransactionId, "Replaced by updated entry");
      }

      await addTransaction({
        customerId: formData.customerId,
        date: transactionDate,
        bsDate: bsDateStr,
        dueDate: dueDateStr,
        type: formData.type,
        quantity: formData.quantity,
        remark: formData.remark || ""
      });
      
      const isPositiveImpact = formData.type === 'OUT_FULL' || formData.type === 'OUT';
      if (isPositiveImpact && formData.returnQuantity > 0) {
        await addTransaction({
          customerId: formData.customerId,
          date: transactionDate,
          bsDate: bsDateStr,
          type: 'IN_EMPTY',
          quantity: formData.returnQuantity,
          remark: '',
        });
      }

      toast({ title: t('movementLogged') });
      router.push(`/customers/${formData.customerId}`);
    } catch (err) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const s = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(s) || 
      c.phone.includes(s) || 
      c.address.toLowerCase().includes(s)
    );
  }, [customers, customerSearch]);

  const years = getBSYears();
  const daysList = Array.from({ length: 32 }, (_, i) => safePad(i + 1));
  const isPositiveImpact = formData.type === 'OUT_FULL' || formData.type === 'OUT';

  if (!mounted || loading) {
    return <div className="flex h-full w-full items-center justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const CustomerSummaryPanel = () => {
    if (!selectedCustomer || !customerSummaryData) return null;

    const bal = selectedCustomer.balance || 0;
    const { totalToReceive, totalToGive, lastTxn, recent } = customerSummaryData;

    return (
      <Card className="border-none shadow-2xl bg-card overflow-hidden h-fit sticky top-8">
        <CardHeader className="bg-muted/30 border-b border-border/50 p-4">
          <CardTitle className="font-headline text-lg font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> {t('customerSummary')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-6">
          <div className="flex flex-col items-center justify-center py-4 bg-muted/20 rounded-xl border border-border/50">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{t('statedBalance')}</p>
            <h3 className={cn("text-3xl font-headline font-bold", bal > 0 ? "text-primary" : "text-emerald-500")}>
              {Math.abs(bal)}
            </h3>
            <p className={cn("text-[10px] uppercase font-black", bal > 0 ? "text-primary" : "text-emerald-500")}>
              {bal === 0 ? t('settled') : bal > 0 ? t('toReceiveSuffix') : t('toGiveSuffix')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
              <p className="text-[8px] uppercase font-bold text-primary mb-1">{t('toReceive')}</p>
              <p className="text-sm font-bold">{totalToReceive} PCS</p>
            </div>
            <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
              <p className="text-[8px] uppercase font-bold text-emerald-500 mb-1">{t('toGive')}</p>
              <p className="text-sm font-bold">{totalToGive} PCS</p>
            </div>
          </div>

          {lastTxn && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{t('lastTxn')}</h4>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                <div className="flex justify-between items-start mb-1">
                  <Badge variant="outline" className="text-[9px] font-bold h-5 uppercase tracking-tighter">
                    {lastTxn.type.replace('_', ' ')}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{lastTxn.bsDate}</span>
                </div>
                <p className="text-xs font-bold">{lastTxn.quantity} PCS</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <History className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{t('recentActivity')}</h4>
            </div>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="h-8 px-2 text-[9px] uppercase font-bold">{t('dateBs')}</TableHead>
                    <TableHead className="h-8 px-2 text-[9px] uppercase font-bold">{t('qty')}</TableHead>
                    <TableHead className="h-8 px-2 text-[9px] uppercase font-bold text-right">{t('balanceAfter')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((txn) => (
                    <TableRow key={txn.id} className="hover:bg-transparent border-border/30">
                      <TableCell className="px-2 py-2 text-[10px]">{txn.bsDate}</TableCell>
                      <TableCell className={cn("px-2 py-2 text-[10px] font-bold", getTransactionImpact(txn.type) > 0 ? "text-primary" : "text-emerald-500")}>
                        {getTransactionImpact(txn.type) > 0 ? '+' : '-'}{txn.quantity}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-[10px] font-bold text-right">
                        {txn.runningBalance}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in slide-in-from-right-4 duration-500 pb-24 w-full max-w-full overflow-x-hidden">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-headline text-2xl md:text-4xl font-bold text-foreground truncate">
              {editTransactionId ? t('quickLog') : t('newTransaction')}
            </h1>
            <p className="text-muted-foreground mt-1 text-xs md:text-sm font-medium truncate">{t('logMovements')}</p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit}>
              <Card className="border-none shadow-2xl bg-card overflow-hidden w-full">
                <CardHeader className="p-4 md:p-6 border-b border-border/50 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-muted text-muted-foreground shrink-0">
                      <Plus className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold uppercase tracking-widest text-[10px] md:text-xs">
                      {t('directEntryMode')}
                    </h3>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">
                        <User className="h-3 w-3" /> {t('name')}
                      </Label>
                      
                      <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={isCustomerPopoverOpen}
                            className="h-12 w-full justify-between bg-background border-border"
                          >
                            <span className="truncate">
                              {selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.phone})` : t('search')}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] sm:w-[400px] p-0" align="start">
                          <div className="flex flex-col">
                            <div className="flex items-center border-b px-3">
                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              <Input
                                placeholder={t('search')}
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none border-none focus-visible:ring-0"
                              />
                            </div>
                            <ScrollArea className="h-72">
                              <div className="p-1">
                                {filteredCustomers.length > 0 ? (
                                  filteredCustomers.map((customer) => (
                                    <Button
                                      key={customer.id}
                                      variant="ghost"
                                      className={cn(
                                        "w-full justify-start font-normal h-auto py-3 px-2",
                                        formData.customerId === customer.id && "bg-muted"
                                      )}
                                      onClick={() => {
                                        setFormData({ ...formData, customerId: customer.id });
                                        setIsCustomerPopoverOpen(false);
                                      }}
                                    >
                                      <div className="flex items-center gap-3 w-full">
                                        <div className={cn(
                                          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                                          formData.customerId === customer.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                        )}>
                                          <User className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col items-start overflow-hidden text-left">
                                          <span className="font-bold text-sm truncate w-full">{customer.name}</span>
                                          <span className="text-[10px] text-muted-foreground truncate w-full">{customer.phone} • {customer.address}</span>
                                        </div>
                                        {formData.customerId === customer.id && (
                                          <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
                                        )}
                                      </div>
                                    </Button>
                                  ))
                                ) : (
                                  <div className="py-6 text-center text-sm text-muted-foreground">
                                    No customer found matching "{customerSearch}"
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                            <div className="p-2 border-t bg-muted/30">
                              <Button 
                                className="w-full h-11 gap-2 font-bold bg-primary shadow-lg shadow-primary/20"
                                onClick={() => {
                                  setNewCust({ ...newCust, name: customerSearch });
                                  setIsAddCustomerOpen(true);
                                }}
                              >
                                <UserPlus className="h-4 w-4" />
                                {t('newProfile')} "{customerSearch || 'New Customer'}"
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">
                        <Calendar className="h-3 w-3" /> {t('dateBs')}
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Select value={bsParts.year} onValueChange={(v) => handleBSChange('year', v)}>
                          <SelectTrigger className="h-12 bg-background border-border text-xs px-2"><SelectValue placeholder="Y" /></SelectTrigger>
                          <SelectContent className="max-h-[300px]">{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={bsParts.month} onValueChange={(v) => handleBSChange('month', v)}>
                          <SelectTrigger className="h-12 bg-background border-border text-xs px-2"><SelectValue placeholder="M" /></SelectTrigger>
                          <SelectContent>{BS_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={bsParts.day} onValueChange={(v) => handleBSChange('day', v)}>
                          <SelectTrigger className="h-12 bg-background border-border text-xs px-2"><SelectValue placeholder="D" /></SelectTrigger>
                          <SelectContent className="max-h-[300px]">{daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Mobile Summary Collapsible */}
                    <div className="lg:hidden md:col-span-2">
                      <Collapsible open={isSummaryExpanded} onOpenChange={setIsSummaryExpanded}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full flex items-center justify-between px-2 h-8 text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-y rounded-none mb-2">
                            <span>{t('customerSummary')}</span>
                            {isSummaryExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="pb-4">
                            <CustomerSummaryPanel />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">{t('eventType')}</Label>
                      <Select value={formData.type} onValueChange={(v: TransactionType) => setFormData({...formData, type: v})}>
                        <SelectTrigger className="h-12 bg-background border-border font-bold text-sm w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OUT_FULL">{t('fullIssue')}</SelectItem>
                          <SelectItem value="IN_EMPTY">{t('emptyReturn')}</SelectItem>
                          <SelectItem value="LEAKAGE">{t('leakageReturn')}</SelectItem>
                          <SelectItem value="LOST">{t('cylinderLost')}</SelectItem>
                          <SelectItem value="ADJUSTMENT">{t('balanceAdjustment')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">{t('quantityPcs')}</Label>
                      <Input type="number" min="1" className="h-12 bg-background font-headline font-bold text-lg" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} />
                    </div>

                    {isPositiveImpact && (
                      <div className="md:col-span-2 p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2 text-primary uppercase text-[10px] tracking-widest font-bold">
                            <BellRing className="h-3.5 w-3.5" /> {t('collectionSchedule')}
                          </Label>
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="use-due-date" 
                              checked={useDueDate} 
                              onCheckedChange={(checked) => setUseDueDate(!!checked)} 
                            />
                            <Label htmlFor="use-due-date" className="text-[10px] font-bold cursor-pointer">{t('today')}</Label>
                          </div>
                        </div>
                        
                        {useDueDate && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-3 gap-2">
                              <Select value={dueBsParts.year} onValueChange={(v) => handleDueBSChange('year', v)}>
                                <SelectTrigger className="h-12 bg-background border-border text-xs px-2"><SelectValue placeholder="Y" /></SelectTrigger>
                                <SelectContent className="max-h-[300px]">{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                              </Select>
                              <Select value={dueBsParts.month} onValueChange={(v) => handleDueBSChange('month', v)}>
                                <SelectTrigger className="h-12 bg-background border-border text-xs px-2"><SelectValue placeholder="M" /></SelectTrigger>
                                <SelectContent>{BS_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                              </Select>
                              <Select value={dueBsParts.day} onValueChange={(v) => handleDueBSChange('day', v)}>
                                <SelectTrigger className="h-12 bg-background border-border text-xs px-2"><SelectValue placeholder="D" /></SelectTrigger>
                                <SelectContent className="max-h-[300px]">{daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {isPositiveImpact && !editTransactionId && (
                      <div className="space-y-2 md:col-span-2 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <Label className="text-emerald-500 uppercase text-[10px] tracking-widest font-bold">{t('returnOwed')}</Label>
                        <Input type="number" min="0" className="h-12 bg-background text-emerald-500 font-bold" value={formData.returnQuantity} onChange={e => setFormData({...formData, returnQuantity: parseInt(e.target.value) || 0})} />
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">{t('remarks')}</Label>
                      <Textarea className="bg-background resize-none min-h-[80px]" value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} />
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row gap-3">
                    <Button 
                      variant="ghost" 
                      type="button" 
                      onClick={() => router.back()} 
                      className="flex-1 h-14 font-bold uppercase tracking-widest border border-border"
                    >
                      <X className="h-4 w-4 mr-2" /> {t('cancel')}
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={submitting}
                      className="flex-[2] h-14 bg-primary text-primary-foreground font-headline text-lg font-bold shadow-lg shadow-primary/20"
                    >
                      {submitting ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <>
                          {editTransactionId ? <History className="h-6 w-6 mr-2" /> : <Plus className="h-6 w-6 mr-2" />}
                          {editTransactionId ? t('quickLog') : t('saveTransaction')}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </div>

          {/* Desktop Summary Sidebar */}
          <div className="hidden lg:block">
            <CustomerSummaryPanel />
          </div>
        </div>
      </div>

      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="sm:max-w-[400px] w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-headline font-bold text-xl">{t('newProfile')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('name')}</Label>
              <Input value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} className="h-12" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('phone')}</Label>
              <Input value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} className="h-12" maxLength={10} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('address')}</Label>
              <Input value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} className="h-12" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddCustomer} className="w-full bg-primary font-bold h-12">{t('saveProfile')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
