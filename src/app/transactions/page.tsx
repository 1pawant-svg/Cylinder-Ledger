
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
  RotateCcw,
  ArrowLeft,
  Save,
  X,
  Banknote
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
import { useRouter, useSearchParams } from "next/navigation";

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { customers, addCustomer, addTransaction, updateTransaction } = useLedger();
  const { toast } = useToast();
  
  const transactionId = searchParams?.get('transactionId');
  const urlCustomerId = searchParams?.get('customerId');

  const transactionRef = useMemo(() => 
    (db && transactionId) ? doc(db, 'transactions', transactionId) : null, 
  [db, transactionId]);
  
  const { data: existingTxn, loading: txnLoading } = useDoc<Transaction>(transactionRef);

  const getTodayBSParts = () => {
    const todayAD = getCurrentADDate();
    const bsDateStr = adToBs(todayAD);
    const parts = bsDateStr.split(/[-/]/);
    if (parts.length === 3) {
      return { 
        year: parts[0], 
        month: parts[1].padStart(2, '0'), 
        day: parts[2].padStart(2, '0') 
      };
    }
    return { year: '2081', month: '01', day: '01' };
  };

  const [bsParts, setBsParts] = useState(getTodayBSParts);
  const [dueBsParts, setDueBsParts] = useState(getTodayBSParts);
  const [hasDueDate, setHasDueDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    customerId: '',
    date: getCurrentADDate(), 
    dueDate: getCurrentADDate(), 
    type: 'OUT_FULL' as TransactionType,
    quantity: 1,
    amount: 0,
    returnQuantity: 0, 
    simultaneousOutQuantity: 0,
    remark: '',
  });

  // Handle data pre-filling for edits with robust mapping
  useEffect(() => {
    if (transactionId && existingTxn && !txnLoading) {
      // 1. AD Date parsing
      const adDate = typeof existingTxn.date === 'string' 
        ? existingTxn.date 
        : new Date(toMillis(existingTxn.date)).toISOString().split('T')[0];
      
      // 2. BS Date parsing with strict 2-digit padding
      const parts = existingTxn.bsDate.split(/[-/]/);
      if (parts.length === 3) {
        setBsParts({ 
          year: parts[0], 
          month: parts[1].padStart(2, '0'), 
          day: parts[2].padStart(2, '0') 
        });
      }
      
      // 3. Robust Type Mapping (handle legacy IN/OUT)
      let displayType: TransactionType = 'OUT_FULL';
      const rawType = String(existingTxn.type).toUpperCase();
      if (rawType === 'IN' || rawType === 'IN_EMPTY') displayType = 'IN_EMPTY';
      else if (rawType === 'OUT' || rawType === 'OUT_FULL') displayType = 'OUT_FULL';
      else if (rawType === 'LEAKAGE') displayType = 'LEAKAGE';
      else if (rawType === 'LOST') displayType = 'LOST';
      else if (rawType === 'ADJUSTMENT') displayType = 'ADJUSTMENT';

      setFormData(prev => ({
        ...prev,
        customerId: existingTxn.customerId,
        date: adDate,
        dueDate: existingTxn.dueDate || adDate, 
        type: displayType,
        quantity: existingTxn.quantity || 0,
        amount: existingTxn.amount || 0,
        remark: existingTxn.remark || '',
      }));

      // 4. Due Date logic
      setHasDueDate(!!existingTxn.dueDate);
      if (existingTxn.dueDate) {
        const dParts = adToBs(existingTxn.dueDate).split(/[-/]/);
        if (dParts.length === 3) {
          setDueBsParts({ 
            year: dParts[0], 
            month: dParts[1].padStart(2, '0'), 
            day: dParts[2].padStart(2, '0') 
          });
        }
      }
    } else if (!transactionId) {
      // Reset form to defaults if not in edit mode
      const todayAD = getCurrentADDate();
      setFormData({
        customerId: urlCustomerId || '',
        date: todayAD,
        dueDate: todayAD,
        type: 'OUT_FULL',
        quantity: 1,
        amount: 0,
        returnQuantity: 0,
        simultaneousOutQuantity: 0,
        remark: '',
      });
      setBsParts(getTodayBSParts());
      setDueBsParts(getTodayBSParts());
      setHasDueDate(false);
    }
  }, [transactionId, existingTxn, txnLoading, urlCustomerId]);

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
      notes: newCust.notes,
      status: 'active'
    });
    setFormData(prev => ({ ...prev, customerId }));
    setIsAddCustomerOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) {
      toast({ variant: "destructive", title: "Missing Customer", description: "Please select or add a customer." });
      return;
    }
    
    setSubmitting(true);
    const transactionDate = formData.date || getCurrentADDate();
    const bsDateStr = `${bsParts.year}-${bsParts.month}-${bsParts.day}`;

    const payload = {
      customerId: formData.customerId,
      date: transactionDate,
      bsDate: bsDateStr,
      dueDate: hasDueDate ? (formData.dueDate || undefined) : undefined,
      type: formData.type,
      quantity: formData.quantity,
      amount: formData.amount,
      remark: formData.remark
    };

    try {
      if (transactionId) {
        await updateTransaction(transactionId, payload);
        toast({ title: "Entry Updated", description: "Ledger has been updated with changes." });
        router.push(`/customers/${formData.customerId}`);
      } else {
        await addTransaction(payload);
        
        const isPositiveImpact = formData.type === 'OUT_FULL' || formData.type === 'OUT';
        if (isPositiveImpact && formData.returnQuantity > 0) {
          await addTransaction({
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
          await addTransaction({
            customerId: formData.customerId,
            date: transactionDate,
            bsDate: bsDateStr,
            type: 'OUT_FULL',
            quantity: formData.simultaneousOutQuantity,
            remark: `Replacement issued for leakage.`,
            status: 'active'
          });
        }

        toast({ title: "Transaction Logged", description: "Cylinder movement recorded successfully." });
        router.push(`/customers/${formData.customerId}`);
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Action Failed", description: "There was an error saving the transaction." });
    } finally {
      setSubmitting(false);
    }
  };

  if (transactionId && txnLoading) {
    return (
      <div className="flex flex-col h-[70vh] items-center justify-center p-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-headline font-bold text-muted-foreground">Fetching ledger document...</p>
      </div>
    );
  }

  const years = getBSYears();
  const daysList = Array.from({ length: 32 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const isPositiveImpact = formData.type === 'OUT_FULL' || formData.type === 'OUT';

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in slide-in-from-right-4 duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-headline text-2xl md:text-4xl font-bold text-foreground">
              {transactionId ? "Edit Transaction" : "New Transaction"}
            </h1>
            <p className="text-muted-foreground mt-1 text-xs md:text-sm font-medium">
              {transactionId ? "Update existing cylinder record" : "Log cylinder movements using accurate algorithmic Nepali calendar"}
            </p>
          </div>
        </div>
        {transactionId && (
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 px-4 py-2 text-xs font-bold self-start md:self-center">
            DOC ID: {transactionId.slice(-6).toUpperCase()}
          </Badge>
        )}
      </header>

      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit}>
          <Card className="border-none shadow-2xl bg-card overflow-hidden">
            <CardHeader className={cn("p-6 pb-2 border-b border-border/50", transactionId ? "bg-primary/5" : "bg-muted/30")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("p-2 rounded-lg", transactionId ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                    {transactionId ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </div>
                  <h3 className="font-bold uppercase tracking-widest text-xs">
                    {transactionId ? "Edit Audit Trail" : "Direct Entry Mode"}
                  </h3>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 md:p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">
                    <User className="h-3 w-3" /> Customer
                  </Label>
                  <Select 
                    disabled={!!transactionId} 
                    value={formData.customerId} 
                    onValueChange={(v) => v === "ADD_NEW" ? setIsAddCustomerOpen(true) : setFormData({...formData, customerId: v})}
                  >
                    <SelectTrigger className="h-12 bg-background border-border">
                      <SelectValue placeholder="Select customer..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-[300px]">
                      {!transactionId && <SelectItem value="ADD_NEW" className="text-primary font-bold"><Plus className="h-4 w-4 mr-2" /> Add New Customer</SelectItem>}
                      {!transactionId && <SelectSeparator />}
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">
                    <Calendar className="h-3 w-3" /> Date (BS)
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={bsParts.year} onValueChange={(v) => handleBSChange('year', v)}>
                      <SelectTrigger className="h-12 bg-background border-border text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[200px]">{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={bsParts.month} onValueChange={(v) => handleBSChange('month', v)}>
                      <SelectTrigger className="h-12 bg-background border-border text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{BS_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={bsParts.day} onValueChange={(v) => handleBSChange('day', v)}>
                      <SelectTrigger className="h-12 bg-background border-border text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[200px]">{daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">Event Type</Label>
                  <Select value={formData.type} onValueChange={(v: TransactionType) => setFormData({...formData, type: v})}>
                    <SelectTrigger className="h-12 bg-background border-border font-bold text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OUT_FULL">To Receive (Full Issue)</SelectItem>
                      <SelectItem value="IN_EMPTY">To Give (Empty Return)</SelectItem>
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

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">
                    <Banknote className="h-3 w-3" /> Amount (Optional)
                  </Label>
                  <Input type="number" className="h-12 bg-background font-headline font-bold" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} />
                </div>

                <div className="space-y-2 hidden md:block" />

                {isPositiveImpact && !transactionId && (
                  <div className="space-y-2 md:col-span-2 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <Label className="text-emerald-500 uppercase text-[10px] tracking-widest font-bold">Return Owed (PCS)</Label>
                    <Input type="number" min="0" className="h-12 bg-background text-emerald-500 font-bold" value={formData.returnQuantity} onChange={e => setFormData({...formData, returnQuantity: parseInt(e.target.value) || 0})} />
                  </div>
                )}

                {isPositiveImpact && (
                  <div className="md:col-span-2 p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Set Return Due Date?</span>
                      <Switch checked={hasDueDate} onCheckedChange={setHasDueDate} />
                    </div>
                    {hasDueDate && (
                      <div className="grid grid-cols-3 gap-2 animate-in slide-in-from-top-2 duration-300">
                        <Select value={dueBsParts.year} onValueChange={(v) => handleDueBSChange('year', v)}>
                          <SelectTrigger className="h-10 bg-background text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-[200px]">{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={dueBsParts.month} onValueChange={(v) => handleDueBSChange('month', v)}>
                          <SelectTrigger className="h-10 bg-background text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{BS_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={dueBsParts.day} onValueChange={(v) => handleDueBSChange('day', v)}>
                          <SelectTrigger className="h-10 bg-background text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-[200px]">{daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">Remarks</Label>
                  <Textarea className="bg-background resize-none min-h-[100px]" value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} placeholder="Internal notes about this movement..." />
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <Button 
                  variant="ghost" 
                  type="button" 
                  onClick={() => router.back()} 
                  className="flex-1 h-16 font-bold uppercase tracking-widest border border-border"
                >
                  <X className="h-4 w-4 mr-2" /> Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-[2] h-16 bg-primary text-primary-foreground font-headline text-xl font-bold shadow-lg shadow-primary/20"
                >
                  {submitting ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      {transactionId ? <Save className="h-5 w-5 mr-2" /> : <Plus className="h-6 w-6 mr-2" />}
                      {transactionId ? "Save Changes" : "Save Transaction"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>

      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-headline font-bold text-xl">Quick Customer Add</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</Label>
              <Input value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} placeholder="Ram Bahadur" className="h-12" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Phone</Label>
              <Input value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} placeholder="98XXXXXXXX" className="h-12" maxLength={10} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddCustomer} className="w-full bg-primary font-bold h-12">Save & Select</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
