
"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useLedger } from "@/lib/ledger-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, MapPin, Phone, Share2, Edit2, Trash2, MoreVertical, History, Info, MessageSquare, ArrowUpRight, ArrowDownLeft, StickyNote, ClipboardList, AlertTriangle, UserX, UserCheck, Save, X, Hash, Loader2, Plus, Calendar, FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
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
import { useUser, useFirestore } from "@/firebase";
import { getSettings } from "@/lib/services/settings-service";
import { generateCustomerLedgerPDF, sharePDF } from "@/lib/services/pdf-service";
import { TransactionType, Transaction, Setting } from "@/lib/types";

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
  if (t === 'IN' || t === 'IN_EMPTY' || t === 'LEAKAGE' || t === 'LOST' || t === 'ADJUSTMENT') return -1;
  return 0;
};

export default function CustomerProfile(props: { params: Promise<{ id: string }> }) {
  const { id } = React.use(props.params);
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const { customers, getCustomerTransactions, addTransaction, deleteTransaction, updateCustomer, updateCustomerStatus, updateTransaction } = useLedger();
  
  const customer = customers.find(c => c.id === id);
  const transactions = getCustomerTransactions(id);
  const balance = customer?.balance || 0;
  const isInactive = customer?.status === 'inactive';

  const [settings, setSettings] = useState<Setting | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<any>({});
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);

  // Quick Log State
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [quickLogType, setQuickLogType] = useState<TransactionType>('OUT_FULL');
  const [quickQty, setQuickQty] = useState("1");
  const [quickRemark, setQuickRemark] = useState("");
  const [quickBSDate, setQuickBSDate] = useState(() => {
    const parts = adToBs(getCurrentADDate()).split('-');
    return { year: parts[0] || '2081', month: parts[1] || '01', day: parts[2] || '01' };
  });

  useEffect(() => {
    if (db) getSettings(db).then(setSettings);
  }, [db]);

  const transactionsWithBalance = useMemo(() => {
    const chronological = [...transactions].reverse();
    let currentBalance = 0;
    return chronological.map(txn => {
      currentBalance += (txn.quantity * getTransactionImpact(txn.type));
      return { ...txn, runningBalance: currentBalance };
    }).reverse();
  }, [transactions]);

  const handleSharePDF = async () => {
    if (!customer) return;
    setIsGeneratingPDF(true);
    try {
      const totalOut = transactions.filter(t => getTransactionImpact(t.type) === 1).reduce((s, t) => s + t.quantity, 0);
      const totalIn = transactions.filter(t => getTransactionImpact(t.type) === -1).reduce((s, t) => s + t.quantity, 0);
      const doc = await generateCustomerLedgerPDF(customer, transactionsWithBalance, settings, { totalIn, totalOut, balance });
      await sharePDF(doc, `${customer.name.replace(/\s+/g, '_')}_Ledger.pdf`, customer.phone, customer.name);
      toast({ title: "Statement Prepared" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "PDF Failed", description: err.message });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleQuickLog = () => {
    if (!customer || isInactive) return;
    const qty = parseInt(quickQty);
    if (isNaN(qty) || qty <= 0) return;
    const logAD = bsToAd(quickBSDate.year, quickBSDate.month, quickBSDate.day);
    const logBS = `${quickBSDate.year}-${quickBSDate.month}-${quickBSDate.day}`;
    addTransaction({ customerId: customer.id, date: logAD, bsDate: logBS, type: quickLogType, quantity: qty, remark: quickRemark || "" });
    setQuickLogOpen(false);
    setQuickQty("1");
    setQuickRemark("");
    toast({ title: "Movement Logged" });
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
      toast({ title: "Entry Updated" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed" });
    } finally {
      setIsConfirmSaveOpen(false);
    }
  };

  if (!customer) return <div className="p-20 text-center">Not found</div>;

  const bsYears = getBSYears();
  const daysList = Array.from({ length: 32 }, (_, i) => (i + 1).toString().padStart(2, '0'));

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-700 pb-24">
      <div className="flex flex-col md:flex-row md:items-center gap-4 border-b pb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft className="h-6 w-6" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3"><h1 className="font-headline text-2xl md:text-3xl font-bold truncate">{customer.name}</h1><Badge variant={isInactive ? "secondary" : "default"}>{(customer.status || 'active').toUpperCase()}</Badge></div>
          <div className="text-muted-foreground flex gap-4 text-xs mt-1"><span><MapPin className="h-3 w-3 inline mr-1" />{customer.address}</span><span><Phone className="h-3 w-3 inline mr-1" />{customer.phone}</span>{customer.pan && <span><Hash className="h-3 w-3 inline mr-1" />PAN: {customer.pan}</span>}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="bg-emerald-600 font-bold" onClick={() => router.push(`/transactions?customerId=${id}`)}><Plus className="h-4 w-4 mr-1" /> New Entry</Button>
          <Button variant="outline" size="sm" className="font-bold" onClick={handleSharePDF} disabled={isGeneratingPDF}>{isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4 mr-1" />}Share PDF</Button>
          <Button size="sm" variant="outline" onClick={() => updateCustomerStatus(customer.id, isInactive ? 'active' : 'inactive')}>{isInactive ? <UserCheck className="h-4 w-4 mr-1" /> : <UserX className="h-4 w-4 mr-1" />}{isInactive ? "Activate" : "Deactivate"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="border-none shadow-xl">
             <CardHeader className="flex flex-row items-center justify-between px-6">
                <div><CardTitle className="text-xl font-bold">Ledger</CardTitle><CardDescription>Transaction timeline</CardDescription></div>
                <div className="text-right"><p className="text-[10px] uppercase font-bold text-muted-foreground">Balance</p><Badge className={cn(balance > 0 ? "bg-primary" : balance < 0 ? "bg-accent" : "bg-emerald-500")}>{balance === 0 ? "SETTLED" : `${Math.abs(balance)} ${balance > 0 ? 'To Receive' : 'To Give'}`}</Badge></div>
             </CardHeader>
             <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30"><TableRow><TableHead className="pl-6 text-[10px] font-bold">DATE (BS)</TableHead><TableHead className="text-[10px] font-bold">TYPE</TableHead><TableHead className="text-[10px] font-bold">QTY</TableHead><TableHead className="text-[10px] font-bold">BALANCE</TableHead><TableHead className="text-right pr-6 text-[10px] font-bold">ACTIONS</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {transactionsWithBalance.map((txn) => (
                      <TableRow key={txn.id} className={cn(editingId === txn.id && "bg-primary/5")}>
                        <TableCell className="pl-6 font-medium text-xs">{txn.bsDate}</TableCell>
                        <TableCell><Badge variant="outline" className={cn("text-[9px] font-bold", getTransactionColor(txn.type))}>{getTransactionLabel(txn.type)}</Badge></TableCell>
                        <TableCell className={cn("font-bold text-xs", getTransactionImpact(txn.type) > 0 ? "text-primary" : "text-emerald-500")}>{getTransactionImpact(txn.type) > 0 ? '+' : '-'}{txn.quantity}</TableCell>
                        <TableCell className="font-bold text-xs">{txn.runningBalance === 0 ? "Settled" : `${Math.abs(txn.runningBalance)} ${txn.runningBalance > 0 ? 'To Rcv' : 'To Give'}`}</TableCell>
                        <TableCell className="text-right pr-6"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => startInlineEdit(txn)}><Edit2 className="h-3 w-3 mr-2" />Edit</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => deleteTransaction(txn.id, "User requested delete")}><Trash2 className="h-3 w-3 mr-2" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {!isInactive && (
            <Card className="border-none shadow-xl">
              <CardHeader><CardTitle className="text-lg font-bold">Quick Log</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-1">
                  <Select value={quickBSDate.year} onValueChange={v => setQuickBSDate({...quickBSDate, year: v})}><SelectTrigger className="h-9 text-[10px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-[300px]">{bsYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                  <Select value={quickBSDate.month} onValueChange={v => setQuickBSDate({...quickBSDate, month: v})}><SelectTrigger className="h-9 text-[10px]"><SelectValue /></SelectTrigger><SelectContent>{BS_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
                  <Select value={quickBSDate.day} onValueChange={v => setQuickBSDate({...quickBSDate, day: v})}><SelectTrigger className="h-9 text-[10px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-[300px]">{daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
                </div>
                <Button className="w-full h-11 bg-primary font-bold" onClick={() => { setQuickLogType('OUT_FULL'); setQuickLogOpen(true); }}><ArrowUpRight className="h-4 w-4 mr-2" /> Issue Cylinder</Button>
                <Button variant="outline" className="w-full h-11 text-emerald-500 font-bold" onClick={() => { setQuickLogType('IN_EMPTY'); setQuickLogOpen(true); }}><ArrowDownLeft className="h-4 w-4 mr-2" /> Return Cylinder</Button>
              </CardContent>
            </Card>
          )}
          <Card className="bg-muted/20 border-none shadow-xl"><CardHeader><CardTitle className="text-sm font-bold flex gap-2 items-center"><ClipboardList className="h-4 w-4" /> Documentation</CardTitle></CardHeader><CardContent className="space-y-4 text-xs"><div><p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">General Notes</p><div className="bg-card p-2 rounded border">{customer.remarks || "N/A"}</div></div><div><p className="text-[10px] font-bold uppercase text-primary mb-1">Instructions</p><div className="bg-card p-2 rounded border">{customer.specialInstructions || "None"}</div></div></CardContent></Card>
        </div>
      </div>

      <Dialog open={quickLogOpen} onOpenChange={setQuickLogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Log {quickLogType.replace('_', ' ')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4"><div className="space-y-2"><Label className="text-xs font-bold uppercase">Quantity</Label><Input type="number" value={quickQty} onChange={e => setQuickQty(e.target.value)} className="h-12 text-lg font-bold" /></div><div className="space-y-2"><Label className="text-xs font-bold uppercase">Remark (User Typed Only)</Label><Textarea value={quickRemark} onChange={e => setQuickRemark(e.target.value)} placeholder="Notes..." /></div></div>
          <DialogFooter><Button onClick={handleQuickLog} className="w-full h-12 font-bold">Confirm Log</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={editingId !== null && isConfirmSaveOpen} onOpenChange={setIsConfirmSaveOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Save Changes?</AlertDialogTitle><AlertDialogDescription>This will update the ledger entry and adjust denormalized balances.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setEditingId(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={saveInlineEdit} className="bg-emerald-600">Save</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
