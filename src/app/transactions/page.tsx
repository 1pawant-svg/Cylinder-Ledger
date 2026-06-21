
"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useLedger } from "@/lib/ledger-context";
import { 
  Calendar, 
  User, 
  Plus,
  Loader2,
  ArrowLeft,
  X
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
import { adToBs, bsToAd, BS_MONTHS, getBSYears, getCurrentADDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { TransactionType } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";
import { useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { customers, addCustomer, addTransaction, deleteTransaction } = useLedger();
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
        month: parts[1].padStart(2, '0'), 
        day: parts[2].padStart(2, '0') 
      };
    }
    return { year: '2081', month: '01', day: '01' };
  };

  const [bsParts, setBsParts] = useState(getTodayBSParts);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(!!editTransactionId);

  const [formData, setFormData] = useState({
    customerId: urlCustomerId || '',
    date: getCurrentADDate(), 
    type: 'OUT_FULL' as TransactionType,
    quantity: 1,
    returnQuantity: 0, 
    remark: '',
  });

  // Fetch transaction data if editing (Duplicate & Replace workflow)
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
              month: parts[1].padStart(2, '0'),
              day: parts[2].padStart(2, '0')
            });
          }

          // Map legacy types
          let mappedType = data.type as TransactionType;
          if (mappedType === 'IN' as any) mappedType = 'IN_EMPTY';
          if (mappedType === 'OUT' as any) mappedType = 'OUT_FULL';

          setFormData({
            customerId: data.customerId,
            date: data.date,
            type: mappedType,
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

    try {
      // If editing, delete the old one first (Duplicate & Replace workflow)
      if (editTransactionId) {
        await deleteTransaction(editTransactionId, "Replaced by updated entry");
      }

      await addTransaction({
        customerId: formData.customerId,
        date: transactionDate,
        bsDate: bsDateStr,
        type: formData.type,
        quantity: formData.quantity,
        remark: formData.remark
      });
      
      const isPositiveImpact = formData.type === 'OUT_FULL' || formData.type === 'OUT';
      if (isPositiveImpact && formData.returnQuantity > 0) {
        await addTransaction({
          customerId: formData.customerId,
          date: transactionDate,
          bsDate: bsDateStr,
          type: 'IN_EMPTY',
          quantity: formData.returnQuantity,
          remark: `Empty return logged during delivery.`,
        });
      }

      toast({ title: editTransactionId ? "Transaction Updated" : "Transaction Logged" });
      router.push(`/customers/${formData.customerId}`);
    } catch (err) {
      toast({ variant: "destructive", title: "Action Failed" });
    } finally {
      setSubmitting(false);
    }
  };

  const years = getBSYears();
  const daysList = Array.from({ length: 32 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const isPositiveImpact = formData.type === 'OUT_FULL' || formData.type === 'OUT';

  if (loading) {
    return <div className="flex h-full w-full items-center justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in slide-in-from-right-4 duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-headline text-2xl md:text-4xl font-bold text-foreground">
              {editTransactionId ? "Edit Transaction" : "New Transaction"}
            </h1>
            <p className="text-muted-foreground mt-1 text-xs md:text-sm font-medium">Log cylinder movements using accurate algorithmic Nepali calendar</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit}>
          <Card className="border-none shadow-2xl bg-card overflow-hidden">
            <CardHeader className="p-6 pb-2 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                  <Plus className="h-5 w-5" />
                </div>
                <h3 className="font-bold uppercase tracking-widest text-xs">
                  {editTransactionId ? "Direct Edit Mode" : "Direct Entry Mode"}
                </h3>
              </div>
            </CardHeader>
            <CardContent className="p-6 md:p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">
                    <User className="h-3 w-3" /> Customer
                  </Label>
                  <Select 
                    value={formData.customerId} 
                    onValueChange={(v) => v === "ADD_NEW" ? setIsAddCustomerOpen(true) : setFormData({...formData, customerId: v})}
                  >
                    <SelectTrigger className="h-12 bg-background border-border">
                      <SelectValue placeholder="Select customer..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-[300px]">
                      {!editTransactionId && (
                        <>
                          <SelectItem value="ADD_NEW" className="text-primary font-bold"><Plus className="h-4 w-4 mr-2" /> Add New Customer</SelectItem>
                          <SelectSeparator />
                        </>
                      )}
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

                {isPositiveImpact && !editTransactionId && (
                  <div className="space-y-2 md:col-span-2 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <Label className="text-emerald-500 uppercase text-[10px] tracking-widest font-bold">Return Owed (PCS)</Label>
                    <Input type="number" min="0" className="h-12 bg-background text-emerald-500 font-bold" value={formData.returnQuantity} onChange={e => setFormData({...formData, returnQuantity: parseInt(e.target.value) || 0})} />
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
                      {editTransactionId ? <History className="h-6 w-6 mr-2" /> : <Plus className="h-6 w-6 mr-2" />}
                      {editTransactionId ? "Update Entry" : "Save Transaction"}
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
