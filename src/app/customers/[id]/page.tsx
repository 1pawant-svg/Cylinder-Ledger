"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useLedger } from "@/lib/ledger-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Share2, 
  Edit2,
  Trash2,
  MoreVertical,
  RotateCcw,
  AlertCircle,
  Package,
  History,
  Info,
  MessageSquare,
  ArrowUpRight,
  ArrowDownLeft,
  StickyNote,
  ClipboardList,
  AlertTriangle,
  UserX,
  UserCheck,
  Save,
  X,
  User,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getCurrentADDate, adToBs, bsToAd, toMillis, BS_MONTHS, getBSYears } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from "@/firebase";
import { getUserProfile } from "@/lib/services/user-service";
import { UserProfile, TransactionType, Transaction } from "@/lib/types";

const getTransactionLabel = (type: TransactionType) => {
  const t = type.toUpperCase();
  switch(t) {
    case 'OUT':
    case 'OUT_FULL': return 'OUT';
    case 'IN':
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

export default function CustomerProfile(props: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<any>;
}) {
  const { id } = React.use(props.params);
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const { 
    customers, 
    getCustomerTransactions, 
    getCustomerBalance, 
    addTransaction, 
    deleteTransaction,
    updateCustomer, 
    updateCustomerStatus,
    updateTransaction
  } = useLedger();
  
  const customer = customers.find(c => c.id === id);
  const transactions = getCustomerTransactions(id);
  const balance = getCustomerBalance(id);
  const isInactive = customer?.status === 'inactive';

  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);

  // Quick Log State
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [quickLogType, setQuickLogType] = useState<TransactionType>('OUT_FULL');
  const [quickQty, setQuickQty] = useState("1");
  const [quickRemark, setQuickRemark] = useState("");
  const [quickBSDate, setQuickBSDate] = useState(() => {
    const todayAD = getCurrentADDate();
    const bsDateStr = adToBs(todayAD);
    const parts = bsDateStr.split('-');
    return { 
      year: parts[0] || '2081', 
      month: parts[1] || '01', 
      day: parts[2] || '01' 
    };
  });

  useEffect(() => {
    if (user && db) {
      getUserProfile(db, user.uid).then(setProfile);
    }
  }, [user, db]);

  const transactionsWithBalance = useMemo(() => {
    const chronological = [...transactions].reverse();
    let currentBalance = 0;
    const withRunning = chronological.map(txn => {
      currentBalance += (txn.quantity * getTransactionImpact(txn.type));
      return { ...txn, runningBalance: currentBalance };
    });
    
    return withRunning.reverse();
  }, [transactions]);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareType, setShareType] = useState<'balance' | 'statement'>('balance');

  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ 
    name: '', 
    address: '', 
    phone: '', 
    remarks: '',
    specialInstructions: '',
    collectionNotes: ''
  });

  useEffect(() => {
    if (customer) {
      setEditFormData({ 
        name: customer.name, 
        address: customer.address, 
        phone: customer.phone, 
        remarks: customer.remarks || '',
        specialInstructions: customer.specialInstructions || '',
        collectionNotes: customer.collectionNotes || ''
      });
    }
  }, [customer]);
  
  const generateWhatsAppMessage = () => {
    if (!customer) return "";
    
    const todayBS = adToBs(getCurrentADDate());
    const header = `📦 *CYLINDERA CUSTOMER STATEMENT*\n📅 Date: ${todayBS}\n👤 Customer: ${customer.name}\n-----------------------------\n`;
    
    if (shareType === 'balance') {
      const statusText = balance > 0 
        ? `🔴 *To Receive: ${balance} PCS*` 
        : balance < 0 
          ? `🟢 *To Give: ${Math.abs(balance)} PCS*` 
          : `✅ *Account Settled*`;
          
      return `${header}\n📊 *Account Summary:* ${statusText}\n\n📍 Address: ${customer.address}\n📞 Contact: ${customer.phone}\n\n_Thank you for your business!_`;
    } else {
      let ledgerText = `📝 *Recent Activity (Last 5):*\n`;
      transactions.slice(0, 5).forEach(t => {
        const type = getTransactionLabel(t.type);
        ledgerText += `• ${t.bsDate}: ${type} [${t.quantity} PCS]\n`;
      });
      
      const balanceText = balance > 0 
        ? `\n💰 *Total To Receive: ${balance} PCS*` 
        : balance < 0 
          ? `\n💰 *Total To Give: ${Math.abs(balance)} PCS*`
          : `\n💰 *Status: Settled*`;

      return `${header}\n${ledgerText}${balanceText}\n\n📍 Address: ${customer.address}\n\n_Generated via Cylindera Pro_`;
    }
  };

  const shareOnWhatsApp = () => {
    const text = generateWhatsAppMessage();
    if (!text || !customer) return;
    window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
    setIsShareOpen(false);
  };

  const handleQuickLog = () => {
    if (!customer || isInactive) return;
    const qty = parseInt(quickQty);
    if (isNaN(qty) || qty <= 0) return;
    
    const logAD = bsToAd(quickBSDate.year, quickBSDate.month, quickBSDate.day);
    const logBS = `${quickBSDate.year}-${quickBSDate.month}-${quickBSDate.day}`;

    // Ensure remark strictly contains only what the user explicitly typed
    addTransaction({ 
      customerId: customer.id, 
      date: logAD, 
      bsDate: logBS, 
      type: quickLogType, 
      quantity: qty, 
      remark: quickRemark || "" 
    });
    
    setQuickLogOpen(false);
    setQuickQty("1");
    setQuickRemark("");
    toast({ title: "Transaction Logged" });
  };

  const handleDeleteTxn = async () => {
    if (!deleteTarget) return;
    if (!deleteReason) {
      toast({ variant: "destructive", title: "Reason Required", description: "Please provide a reason for deletion." });
      return;
    }
    deleteTransaction(deleteTarget.id, deleteReason);
    setDeleteTarget(null);
    setDeleteReason("");
    toast({ title: "Transaction Soft Deleted" });
  };

  const handleUpdate = () => {
    if (!customer || !editFormData.name || !editFormData.phone) return;
    const cleanPhone = editFormData.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      toast({ variant: "destructive", title: "Invalid Phone" });
      return;
    }

    updateCustomer(customer.id, { 
      name: editFormData.name, 
      address: editFormData.address, 
      phone: cleanPhone, 
      remarks: editFormData.remarks,
      specialInstructions: editFormData.specialInstructions,
      collectionNotes: editFormData.collectionNotes
    });
    setIsEditSheetOpen(false);
    toast({ title: "Profile Updated" });
  };

  const handleToggleStatus = () => {
    if (!customer) return;
    
    if (!isInactive && balance !== 0) {
      toast({ 
        variant: "destructive", 
        title: "Cannot Deactivate", 
        description: `This account has an outstanding balance of ${Math.abs(balance)} PCS. Please settle the account first.` 
      });
      return;
    }

    const newStatus = isInactive ? 'active' : 'inactive';
    updateCustomerStatus(customer.id, newStatus);
    toast({ title: `Customer marked ${newStatus}` });
  };

  // Inline Editing Handlers
  const startInlineEdit = (txn: Transaction) => {
    setEditingId(txn.id);
    setEditFields({
      bsDate: txn.bsDate,
      type: txn.type,
      quantity: txn.quantity,
      remark: txn.remark || '',
      customerId: txn.customerId
    });
  };

  const cancelInlineEdit = () => {
    setEditingId(null);
    setEditFields({});
  };

  const saveInlineEdit = async () => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      const bsParts = editFields.bsDate.split('-');
      if (bsParts.length !== 3) throw new Error("Invalid BS Date format (YYYY-MM-DD)");
      
      const adDate = bsToAd(bsParts[0], bsParts[1], bsParts[2]);
      
      await updateTransaction(editingId, {
        ...editFields,
        date: adDate
      });
      
      setEditingId(null);
      setEditFields({});
      toast({ title: "Entry updated inline" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
    } finally {
      setIsSaving(false);
      setIsConfirmSaveOpen(false);
    }
  };

  if (!customer) return <div className="p-20 text-center">Customer not found</div>;

  const bsYears = getBSYears();
  const daysList = Array.from({ length: 32 }, (_, i) => (i + 1).toString().padStart(2, '0'));

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-700 pb-24 md:pb-8">
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10 md:h-12 md:w-12 hover:bg-muted shrink-0">
          <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-2xl md:text-3xl font-bold truncate">{customer.name}</h1>
            <Badge variant={isInactive ? "secondary" : "default"} className={cn("font-bold text-[10px]", isInactive && "bg-muted text-muted-foreground")}>
              {(customer.status || 'active').toUpperCase()}
            </Badge>
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs mt-1">
            <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {customer.address}</div>
            <div className="hidden md:block opacity-50">•</div>
            <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {customer.phone}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3">
          <Button variant="outline" size="sm" className="gap-2 font-bold h-10 md:h-12 flex-1 md:flex-none" onClick={() => setIsShareOpen(true)}>
            <MessageSquare className="h-4 w-4" /> Share
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground gap-2 font-bold h-10 md:h-12 flex-1 md:flex-none" onClick={() => setIsEditSheetOpen(true)}>
            <Edit2 className="h-4 w-4" /> Edit
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className={cn(
              "gap-2 font-bold h-10 md:h-12 flex-1 md:flex-none", 
              isInactive ? "text-emerald-500 border-emerald-500/50 hover:bg-emerald-500/10" : "text-accent border-accent/50 hover:bg-accent/10"
            )} 
            onClick={handleToggleStatus}
          >
            {isInactive ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
            {isInactive ? "Reactivate" : "Deactivate"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <Card className="border-none shadow-xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-6 px-4 md:px-6">
              <div>
                <CardTitle className="font-headline text-lg md:text-2xl font-bold">Audit Ledger</CardTitle>
                <CardDescription className="text-xs md:text-sm">Detailed transaction timeline</CardDescription>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Current Balance</p>
                <Badge className={cn("font-bold px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs", balance > 0 ? "bg-primary text-primary-foreground" : balance < 0 ? "bg-accent text-accent-foreground" : "bg-emerald-500 text-white")}>
                  {balance === 0 ? "SETTLED" : balance > 0 ? `${balance} To Receive` : `${Math.abs(balance)} To Give`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/50">
                    <TableHead className="py-4 font-bold text-[9px] md:text-[10px] uppercase tracking-widest pl-4 md:pl-6">Date (BS)</TableHead>
                    <TableHead className="py-4 font-bold text-[9px] md:text-[10px] uppercase tracking-widest">Type</TableHead>
                    <TableHead className="py-4 font-bold text-[9px] md:text-[10px] uppercase tracking-widest">Qty</TableHead>
                    <TableHead className="py-4 font-bold text-[9px] md:text-[10px] uppercase tracking-widest">Remarks</TableHead>
                    <TableHead className="py-4 font-bold text-[9px] md:text-[10px] uppercase tracking-widest">Balance</TableHead>
                    <TableHead className="py-4 font-bold text-[9px] md:text-[10px] uppercase tracking-widest text-right pr-4 md:pr-6">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactionsWithBalance.map((txn) => {
                    const isEditing = editingId === txn.id;
                    const impact = getTransactionImpact(txn.type);
                    
                    if (isEditing) {
                      return (
                        <TableRow key={txn.id} className="bg-primary/5">
                          <TableCell className="pl-4 md:pl-6">
                            <Input 
                              value={editFields.bsDate} 
                              onChange={e => setEditFields({...editFields, bsDate: e.target.value})} 
                              className="h-8 text-xs font-mono" 
                              placeholder="YYYY-MM-DD"
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[8px] md:text-[9px] font-bold uppercase", getTransactionColor(txn.type))}>
                              {getTransactionLabel(txn.type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input 
                              type="number" 
                              value={editFields.quantity} 
                              onChange={e => setEditFields({...editFields, quantity: parseInt(e.target.value) || 0})} 
                              className="h-8 text-xs w-16" 
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              value={editFields.remark} 
                              onChange={e => setEditFields({...editFields, remark: e.target.value})} 
                              className="h-8 text-xs min-w-[120px]" 
                              placeholder="Notes..."
                            />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">Calc...</TableCell>
                          <TableCell className="text-right pr-4 md:pr-6 space-x-1">
                            <Button size="icon" variant="default" className="h-8 w-8 bg-emerald-500 hover:bg-emerald-600" onClick={() => setIsConfirmSaveOpen(true)} disabled={isSaving}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelInlineEdit} disabled={isSaving}>
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return (
                      <TableRow key={txn.id} className="border-border/50 group">
                        <TableCell className="font-medium text-[10px] md:text-xs pl-4 md:pl-6">
                          <strong>{txn.bsDate}</strong>
                          {txn.editedAt && <div className="text-[8px] text-muted-foreground italic flex items-center gap-1 mt-1"><History className="h-2 w-2" /> Edited</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[8px] md:text-[9px] font-bold uppercase", getTransactionColor(txn.type))}>
                            {getTransactionLabel(txn.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn("font-bold text-xs md:text-sm", impact > 0 ? "text-primary" : "text-emerald-500")}>
                          {impact > 0 ? `+${txn.quantity}` : `-${txn.quantity}`}
                        </TableCell>
                        <TableCell className="text-[10px] md:text-xs text-muted-foreground max-w-[150px] truncate">
                          {txn.remark || ""}
                        </TableCell>
                        <TableCell className="font-bold text-xs">
                           <span className={cn(txn.runningBalance > 0 ? "text-primary" : txn.runningBalance < 0 ? "text-accent" : "text-emerald-500")}>
                              {txn.runningBalance === 0 ? "Settled" : txn.runningBalance > 0 ? `${txn.runningBalance} To Receive` : `${Math.abs(txn.runningBalance)} To Give`}
                           </span>
                        </TableCell>
                        <TableCell className="text-right pr-4 md:pr-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card w-48">
                              <DropdownMenuItem className="cursor-pointer gap-2 py-3" onClick={() => startInlineEdit(txn)}>
                                <Edit2 className="h-3 w-3" /> Edit Inline
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive font-bold gap-2 py-3 cursor-pointer" onClick={() => setDeleteTarget(txn)}>
                                <Trash2 className="h-3 w-3" /> Soft Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {transactions.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-16 text-center text-muted-foreground italic text-sm">No transaction records found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 md:space-y-8">
          {!isInactive ? (
            <Card className="border-none shadow-xl bg-card">
              <CardHeader className="pb-4 px-4 md:px-6">
                <CardTitle className="font-headline text-lg font-bold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 md:px-6">
                <div className="space-y-2 mb-4 p-3 rounded-xl bg-muted/30 border border-border/50">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Calendar className="h-3 w-3" /> Log Date (BS)
                  </Label>
                  <div className="grid grid-cols-3 gap-1">
                    <Select value={quickBSDate.year} onValueChange={(v) => setQuickBSDate({...quickBSDate, year: v})}>
                      <SelectTrigger className="h-9 bg-background text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[200px]">{bsYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={quickBSDate.month} onValueChange={(v) => setQuickBSDate({...quickBSDate, month: v})}>
                      <SelectTrigger className="h-9 bg-background text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{BS_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={quickBSDate.day} onValueChange={(v) => setQuickBSDate({...quickBSDate, day: v})}>
                      <SelectTrigger className="h-9 bg-background text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[200px]">{daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 flex items-center gap-2" onClick={() => { setQuickLogType('OUT_FULL'); setQuickLogOpen(true); }}>
                  <ArrowUpRight className="h-4 w-4" /> Issue Cylinder
                </Button>
                <Button variant="outline" className="w-full border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 font-bold h-12 flex items-center gap-2" onClick={() => { setQuickLogType('IN_EMPTY'); setQuickLogOpen(true); }}>
                  <ArrowDownLeft className="h-4 w-4" /> Return Cylinder
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-xl bg-muted/20 border-l-4 border-l-accent">
              <CardHeader className="px-4 md:px-6">
                <CardTitle className="font-headline text-base font-bold text-accent">Account Inactive</CardTitle>
                <CardTitle className="text-xs">This customer is currently inactive. Reactivate to log new transactions.</CardTitle>
              </CardHeader>
              <CardContent className="px-4 md:px-6">
                <Button variant="outline" className="w-full text-emerald-500 border-emerald-500/50" onClick={handleToggleStatus}>
                  Reactivate Account
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-xl bg-muted/20">
            <CardHeader className="px-4 md:px-6">
              <CardTitle className="font-headline text-base font-bold flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" /> Internal Documentation
              </CardTitle>
              <CardDescription className="text-[10px]">Remarks, instructions and collection notes</CardDescription>
            </CardHeader>
            <CardContent className="px-4 md:px-6 space-y-4">
              <div className="space-y-2">
                <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <StickyNote className="h-2.5 w-2.5" /> General Remarks
                </h5>
                <div className="bg-card p-3 rounded-lg border border-border/50 text-sm italic">
                  {customer.remarks || "No general remarks recorded."}
                </div>
              </div>
              
              <div className="space-y-2">
                <h5 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1">
                  <Info className="h-2.5 w-2.5" /> Special Instructions
                </h5>
                <div className="bg-card p-3 rounded-lg border border-border/50 text-sm">
                  {customer.specialInstructions || "No special instructions."}
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="text-[10px] font-bold uppercase tracking-widest text-accent flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" /> Collection Notes
                </h5>
                <div className="bg-card p-3 rounded-lg border border-border/50 text-sm">
                  {customer.collectionNotes || "No specific collection notes."}
                </div>
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-3 text-[10px] font-bold uppercase tracking-wider h-8"
                onClick={() => setIsEditSheetOpen(true)}
              >
                Update Documentation
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Share Statement Dialog */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl font-bold flex items-center gap-2 text-primary">
              <MessageSquare className="h-6 w-6" /> Share Statement
            </DialogTitle>
            <DialogDescription>Select statement format for WhatsApp sharing.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div 
                className={cn(
                  "p-4 rounded-xl border-2 cursor-pointer transition-all space-y-2 text-center",
                  shareType === 'balance' ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                )}
                onClick={() => setShareType('balance')}
              >
                <Package className={cn("mx-auto h-6 w-6", shareType === 'balance' ? "text-primary" : "text-muted-foreground")} />
                <h4 className="font-bold text-sm">Summary Only</h4>
              </div>
              <div 
                className={cn(
                  "p-4 rounded-xl border-2 cursor-pointer transition-all space-y-2 text-center",
                  shareType === 'statement' ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                )}
                onClick={() => setShareType('statement')}
              >
                <History className={cn("mx-auto h-6 w-6", shareType === 'statement' ? "text-primary" : "text-muted-foreground")} />
                <h4 className="font-bold text-sm">Full Statement</h4>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Message Preview</h5>
              <div className="bg-background p-3 rounded border text-xs whitespace-pre-wrap max-h-[150px] overflow-y-auto font-mono">
                {generateWhatsAppMessage()}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-3 sm:flex-col">
            <Button onClick={shareOnWhatsApp} className="w-full h-12 bg-primary text-primary-foreground font-bold gap-2">
              <Share2 className="h-4 w-4" /> Send WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="sm:max-w-[450px] bg-card border-l border-border overflow-y-auto">
          <SheetHeader className="pb-8 border-b border-border/50">
            <SheetTitle className="font-headline text-2xl font-bold text-primary flex items-center gap-2">
              <Edit2 className="h-5 w-5" /> Edit Profile
            </SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Modify contact information and internal documentation.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-6 py-8">
            <div className="space-y-4">
              <div className="space-y-2"><Label className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">Full Name</Label><Input value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} placeholder="Name" className="bg-background h-12" /></div>
              <div className="space-y-2"><Label className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">Phone</Label><Input value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} placeholder="98XXXXXXXX" className="bg-background h-12" maxLength={10}/></div>
              <div className="space-y-2"><Label className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">Address</Label><Input value={editFormData.address} onChange={e => setEditFormData({...editFormData, address: e.target.value})} placeholder="Location" className="bg-background h-12" /></div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">General Remarks</Label>
                <Textarea 
                  value={editFormData.remarks} 
                  onChange={e => setEditFormData({...editFormData, remarks: e.target.value})} 
                  placeholder="Basic customer info..." 
                  className="bg-background resize-none h-20 text-sm" 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-primary uppercase text-[10px] tracking-widest font-bold">Special Instructions</Label>
                <Textarea 
                  value={editFormData.specialInstructions} 
                  onChange={e => setEditFormData({...editFormData, specialInstructions: e.target.value})} 
                  placeholder="Delivery or specific needs..." 
                  className="bg-background resize-none h-20 text-sm" 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-accent uppercase text-[10px] tracking-widest font-bold">Collection Notes</Label>
                <Textarea 
                  value={editFormData.collectionNotes} 
                  onChange={e => setEditFormData({...editFormData, collectionNotes: e.target.value})} 
                  placeholder="Cylinder tracking or reminder notes..." 
                  className="bg-background resize-none h-20 text-sm" 
                />
              </div>
            </div>
          </div>
          <SheetFooter className="pt-4 flex-col gap-3">
            <Button onClick={handleUpdate} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-14">
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={quickLogOpen} onOpenChange={setQuickLogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-bold font-headline">Confirm Quick Log: {quickLogType.replace('_', ' ')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-3 bg-muted/20 rounded-lg border border-border/50 text-xs flex items-center justify-between">
              <span className="text-muted-foreground font-bold uppercase tracking-widest">Selected Date</span>
              <span className="font-bold text-primary">{quickBSDate.year}-{quickBSDate.month}-{quickBSDate.day} BS</span>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quantity (PCS)</Label>
              <Input type="number" value={quickQty} onChange={e => setQuickQty(e.target.value)} className="font-headline font-bold text-lg h-12" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Remark (Optional)</Label>
              <Textarea value={quickRemark} onChange={e => setQuickRemark(e.target.value)} placeholder="e.g. Regular delivery..." className="resize-none h-24" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setQuickLogOpen(false)} className="font-bold">Cancel</Button>
            <Button onClick={handleQuickLog} className="bg-primary text-primary-foreground font-bold h-12 px-6">Log Movement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-headline font-bold"><Trash2 className="h-5 w-5" /> Soft Delete Record</DialogTitle>
            <DialogDescription>This will remove the record from ledger balances but keep it in audit history.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold tracking-widest">Deletion Reason</Label>
              <Textarea 
                value={deleteReason} 
                onChange={e => setDeleteReason(e.target.value)} 
                placeholder="Required for audit compliance..." 
                className="resize-none bg-muted/50 h-24" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button onClick={handleDeleteTxn} variant="destructive" className="font-bold">Soft Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmSaveOpen} onOpenChange={setIsConfirmSaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline font-bold">Confirm Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to update this ledger entry? This will modify the transaction record and adjust global inventory stock levels accordingly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                saveInlineEdit();
              }} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
