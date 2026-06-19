
"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useLedger } from "@/lib/ledger-context";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  User, 
  Plus,
  History,
  StickyNote,
  Bell,
  AlertCircle,
  Package,
  XCircle,
  Settings2,
  Edit2,
  Loader2,
  RotateCcw
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectSeparator
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { adToBs, bsToAd, BS_MONTHS, getBSYears, getCurrentADDate, toMillis } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { TransactionType, Transaction } from "@/lib/types";
import { useDoc, useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";

export default function TransactionsPage(props: { 
  params: Promise<any>; 
  searchParams: Promise<any> 
}) {
  const searchParams = React.use(props.searchParams);
  const db = useFirestore();
  const { customers, addCustomer, addTransaction, updateTransaction } = useLedger();
  const { toast } = useToast();
  
  const transactionId = searchParams?.transactionId as string;
  const transactionRef = useMemo(() => 
    (db && transactionId) ? doc(db, 'transactions', transactionId) : null, 
  [db, transactionId]);
  
  const { data: existingTxn, loading: txnLoading } = useDoc<Transaction>(transactionRef);

  // Helper to get today's BS date parts
  const getTodayBSParts = () => {
    const todayAD = getCurrentADDate();
    const bsDateStr = adToBs(todayAD);
    const parts = bsDateStr.split('-');
    if (parts.length === 3) {
      return { year: parts[0], month: parts[1], day: parts[2] };
    }
    return { year: '2081', month: '01', day: '01' };
  };

  // State for primary BS date selection
  const [bsParts, setBsParts] = useState(getTodayBSParts);
  
  // State for Due Date BS selection - Initialized to today to match transaction date
  const [dueBsParts, setDueBsParts] = useState(getTodayBSParts);

  const [hasDueDate, setHasDueDate] = useState(false);

  const [formData, setFormData] = useState(() => {
    const todayAD = getCurrentADDate();

    return {
      customerId: (searchParams?.customerId as string) || '',
      date: todayAD, 
      dueDate: todayAD, 
      type: 'OUT_FULL' as TransactionType,
      quantity: 1,
      returnQuantity: 0, 
      simultaneousOutQuantity: 0,
      remark: '',
    };
  });

  // Synchronization for EDIT MODE only
  useEffect(() => {
    if (transactionId && existingTxn) {
      const adDate = typeof existingTxn.date === 'string' 
        ? existingTxn.date 
        : new Date(toMillis(existingTxn.date)).toISOString().split('T')[0];
      
      const parts = existingTxn.bsDate.split('-');
      if (parts.length === 3) {
        setBsParts({ year: parts[0], month: parts[1], day: parts[2] });
      }
      
      setFormData({
        customerId: existingTxn.customerId,
        date: adDate,
        dueDate: existingTxn.dueDate || adDate, 
        type: existingTxn.type,
        quantity: existingTxn.quantity,
        returnQuantity: 0,
        simultaneousOutQuantity: 0,
        remark: existingTxn.remark || '',
      });
      setHasDueDate(!!existingTxn.dueDate);

      if (existingTxn.dueDate) {
        const dParts = adToBs(existingTxn.dueDate).split('-');
        if (dParts.length === 3) {
          setDueBsParts({ year: dParts[0], month: dParts[1], day: dParts[2] });
        }
      }
    }
  }, [transactionId, existingTxn]);

  // Sync due date parts when the primary transaction date changes (for new transactions)
  useEffect(() => {
    if (!transactionId && !hasDueDate) {
      setDueBsParts(bsParts);
    }
  }, [bsParts, hasDueDate, transactionId]);

  const handleBSChange = (field: 'year' | 'month' | 'day', value: string) => {
    const newBS = { ...bsParts, [field]: value };
    setBsParts(newBS);
    if (newBS.year && newBS.month && newBS.day) {
      const adDate = bsToAd(newBS.year, newBS.month, newBS.day);
      setFormData(prev => ({ ...prev, date: adDate }));
    }
  };

  const handleDueBSChange = (field: 'year' | 'month' | 'day', value: string) => {
    const newBS = { ...dueBsParts, [field]: value };
    setDueBsParts(newBS);
    if (newBS.year && newBS.month && newBS.day) {
      const adDate = bsToAd(newBS.year, newBS.month, newBS.day);
      setFormData(prev => ({ ...prev, dueDate: adDate }));
    }
  };

  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCust, setNewCust] = useState({ 
    name: '', 
    address: '', 
    phone: '', 
    notes: '',
    openingToReceive: '',
    openingToGive: ''
  });

  const handleAddCustomer = () => {
    if (!newCust.name || !newCust.phone) {
      toast({ variant: "destructive", title: "Incomplete Form" });
      return;
    }
    const customerId = addCustomer({
      name: newCust.name,
      address: newCust.address,
      phone: newCust.phone,
      notes: newCust.notes
    });
    setFormData(prev => ({ ...prev, customerId }));
    setIsAddCustomerOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) {
      toast({ variant: "destructive", title: "Missing Customer" });
      return;
    }
    
    const transactionDate = formData.date || getCurrentADDate();
    const bsDateStr = `${bsParts.year}-${bsParts.month}-${bsParts.day}`;

    const payload = {
      customerId: formData.customerId,
      date: transactionDate,
      bsDate: bsDateStr,
      dueDate: hasDueDate ? (formData.dueDate || undefined) : undefined,
      type: formData.type,
      quantity: formData.quantity,
      remark: formData.remark
    };

    if (transactionId) {
      updateTransaction(transactionId, payload);
      toast({ title: "Entry Updated" });
    } else {
      addTransaction(payload);
      
      const isPositiveImpact = formData.type === 'OUT_FULL' || formData.type === 'OUT';
      if (isPositiveImpact && formData.returnQuantity > 0) {
        addTransaction({
          customerId: formData.customerId,
          date: transactionDate,
          bsDate: bsDateStr,
          type: 'IN_EMPTY',
          quantity: formData.returnQuantity,
          remark: `Empty return logged during delivery.`,
          status: 'active'
        });
      }

      if (formData.type === 'LEAKAGE' && formData.simultaneousOutQuantity > 0) {
        addTransaction({
          customerId: formData.customerId,
          date: transactionDate,
          bsDate: bsDateStr,
          type: 'OUT_FULL',
          quantity: formData.simultaneousOutQuantity,
          remark: `Replacement issued for leakage.`,
          status: 'active'
        });
      }

      toast({ title: "Transaction Logged" });
      
      setFormData(prev => ({
        ...prev,
        customerId: '',
        quantity: 1,
        returnQuantity: 0,
        simultaneousOutQuantity: 0,
        remark: '',
      }));
      setHasDueDate(false);
    }
  };

  if (transactionId && txnLoading) {
    return <div className="flex h-full items-center justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const years = getBSYears();
  const daysList = Array.from({ length: 32 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const isPositiveImpact = formData.type === 'OUT_FULL' || formData.type === 'OUT';

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in slide-in-from-right-4 duration-500 pb-24">
      <header className="border-b border-border pb-6">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground">
          {transactionId ? "Edit Transaction" : "New Transaction"}
        </h1>
        <p className="text-muted-foreground mt-1 font-medium">
          Log cylinder movements using accurate algorithmic Nepali calendar conversion
        </p>
      </header>

      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit}>
          <Card className="border-none shadow-2xl bg-card overflow-hidden">
            <CardContent className="p-6 md:p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">
                    <User className="h-3 w-3" /> Select Customer
                  </Label>
                  <Select 
                    value={formData.customerId} 
                    onValueChange={(v) => v === "ADD_NEW" ? setIsAddCustomerOpen(true) : setFormData({...formData, customerId: v})}
                  >
                    <SelectTrigger className="h-12 bg-background border-border">
                      <SelectValue placeholder="Search customer..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="ADD_NEW" className="text-primary font-bold"><Plus className="h-4 w-4 mr-2" /> Add New Customer</SelectItem>
                      <SelectSeparator />
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">
                    <Calendar className="h-3 w-3" /> Transaction Date (BS)
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={bsParts.year} onValueChange={(v) => handleBSChange('year', v)}>
                      <SelectTrigger className="h-12 bg-background border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={bsParts.month} onValueChange={(v) => handleBSChange('month', v)}>
                      <SelectTrigger className="h-12 bg-background border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>{BS_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={bsParts.day} onValueChange={(v) => handleBSChange('day', v)}>
                      <SelectTrigger className="h-12 bg-background border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>{daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">Event Type</Label>
                  <Select value={formData.type} onValueChange={(v: TransactionType) => setFormData({...formData, type: v})}>
                    <SelectTrigger className="h-12 bg-background border-border font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OUT_FULL">Cylinder Out (Full)</SelectItem>
                      <SelectItem value="IN_EMPTY">Cylinder In (Empty)</SelectItem>
                      <SelectItem value="LEAKAGE">Leakage Return</SelectItem>
                      <SelectItem value="LOST">Cylinder Lost</SelectItem>
                      <SelectItem value="ADJUSTMENT">Balance Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">Quantity (PCS)</Label>
                  <Input type="number" min="1" className="h-12 bg-background font-headline font-bold text-lg" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} />
                </div>

                {isPositiveImpact && !transactionId && (
                  <div className="space-y-2 md:col-span-2 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <Label className="text-emerald-500 uppercase text-[10px] tracking-widest font-bold">Empty Return (PCS)</Label>
                    <Input type="number" min="0" className="h-12 bg-background text-emerald-500 font-bold" value={formData.returnQuantity} onChange={e => setFormData({...formData, returnQuantity: parseInt(e.target.value) || 0})} />
                  </div>
                )}

                {formData.type === 'LEAKAGE' && !transactionId && (
                  <div className="space-y-2 md:col-span-2 p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <Label className="text-primary uppercase text-[10px] tracking-widest font-bold">Replacement Issue (PCS)</Label>
                    <Input type="number" min="0" className="h-12 bg-background text-primary font-bold" value={formData.simultaneousOutQuantity} onChange={e => setFormData({...formData, simultaneousOutQuantity: parseInt(e.target.value) || 0})} />
                  </div>
                )}

                {isPositiveImpact && (
                  <div className="md:col-span-2 p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Set Return Due Date?</span>
                      <Switch checked={hasDueDate} onCheckedChange={setHasDueDate} />
                    </div>
                    {hasDueDate && (
                      <div className="grid grid-cols-3 gap-2">
                        <Select value={dueBsParts.year} onValueChange={(v) => handleDueBSChange('year', v)}>
                          <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={dueBsParts.month} onValueChange={(v) => handleDueBSChange('month', v)}>
                          <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>{BS_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={dueBsParts.day} onValueChange={(v) => handleDueBSChange('day', v)}>
                          <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>{daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">Remarks</Label>
                  <Textarea className="bg-background resize-none" value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} />
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" className="w-full h-16 bg-primary text-primary-foreground font-headline text-xl font-bold">
                  {transactionId ? "Update Entry" : "Save Transaction"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>

      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Name</Label><Input value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={handleAddCustomer}>Save & Select</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
