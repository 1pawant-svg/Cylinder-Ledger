"use client";

import * as React from "react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useLedger } from "@/lib/ledger-context";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Eye, 
  Phone, 
  MapPin,
  History,
  Filter,
  ArrowUpDown,
  Loader2,
  UserPlus,
  Calendar
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getCurrentADDate, toMillis, getDifferenceInDays, adToBs, bsToAd, BS_MONTHS, getBSYears } from "@/lib/date-utils";
import { Customer, TransactionType } from "@/lib/types";

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'TO_RECEIVE' | 'TO_GIVE' | 'SETTLED' | 'OVERDUE';
type SortOption = 'NAME_ASC' | 'NAME_DESC' | 'BALANCE_HIGH_TO_LOW' | 'BALANCE_LOW_TO_HIGH' | 'LATEST_ACTIVITY';

const getTransactionImpact = (type: TransactionType): number => {
  const t = type.toUpperCase();
  if (t === 'OUT' || t === 'OUT_FULL') return 1;
  if (t === 'IN' || t === 'IN_EMPTY' || t === 'LEAKAGE' || t === 'LOST' || t === 'ADJUSTMENT') return -1;
  return 0;
};

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const { 
    customers,
    addCustomer, 
    addTransaction, 
    getCustomerBalance, 
    getCustomerTransactions,
    transactions,
    loading 
  } = useLedger();
  
  const { toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [sortBy, setSortBy] = useState<SortOption>('NAME_ASC');
  
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter) setStatusFilter(filter as StatusFilter);
    
    const shouldAdd = searchParams.get('add');
    if (shouldAdd === 'true') setIsAddOpen(true);
  }, [searchParams]);

  const getTodayBSParts = () => {
    const todayAD = getCurrentADDate();
    const bsDateStr = adToBs(todayAD);
    const parts = bsDateStr.split('-');
    if (parts.length === 3) {
      return { year: parts[0], month: parts[1], day: parts[2] };
    }
    return { year: '2081', month: '01', day: '01' };
  };

  const [newCust, setNewCust] = useState({ 
    name: '', 
    address: '', 
    phone: '', 
    notes: '',
    openingToReceive: '',
    openingToGive: ''
  });

  const [openingDateBS, setOpeningDateBS] = useState(getTodayBSParts);

  const processedCustomers = useMemo(() => {
    const today = getCurrentADDate();
    
    let result = customers.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.phone.includes(search) ||
      c.address.toLowerCase().includes(search.toLowerCase())
    );

    result = result.filter(c => {
      const balance = getCustomerBalance(c.id);
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'ACTIVE') return c.status === 'active' || !c.status;
      if (statusFilter === 'INACTIVE') return c.status === 'inactive';
      if (statusFilter === 'TO_RECEIVE') return balance > 0;
      if (statusFilter === 'TO_GIVE') return balance < 0;
      if (statusFilter === 'SETTLED') return balance === 0;
      if (statusFilter === 'OVERDUE') {
        const txns = getCustomerTransactions(c.id);
        const isOverdue = txns.some(t => t.dueDate && t.dueDate < today && balance > 0);
        return isOverdue;
      }
      return true;
    });

    result.sort((a, b) => {
      const balanceA = getCustomerBalance(a.id);
      const balanceB = getCustomerBalance(b.id);
      
      switch (sortBy) {
        case 'NAME_ASC':
          return a.name.localeCompare(b.name);
        case 'NAME_DESC':
          return b.name.localeCompare(a.name);
        case 'BALANCE_HIGH_TO_LOW':
          return balanceB - balanceA;
        case 'BALANCE_LOW_TO_HIGH':
          return balanceA - balanceB;
        case 'LATEST_ACTIVITY':
          const txnsA = getCustomerTransactions(a.id);
          const txnsB = getCustomerTransactions(b.id);
          const lastDateA = txnsA[0] ? toMillis(txnsA[0].date) : (a.createdAt ? toMillis(a.createdAt) : 0);
          const lastDateB = txnsB[0] ? toMillis(txnsB[0].date) : (b.createdAt ? toMillis(b.createdAt) : 0);
          return lastDateB - lastDateA;
        default:
          return 0;
      }
    });

    return result;
  }, [customers, search, statusFilter, sortBy, getCustomerBalance, getCustomerTransactions]);

  const handleAdd = useCallback(() => {
    if (!newCust.name || !newCust.phone) {
      toast({ variant: "destructive", title: "Incomplete Form", description: "Name and Phone are required." });
      return;
    }

    const cleanPhone = newCust.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      toast({ variant: "destructive", title: "Invalid Phone", description: "Phone number must be exactly 10 digits." });
      return;
    }

    const isDuplicate = customers.some(c => c.phone.replace(/\D/g, '') === cleanPhone);
    if (isDuplicate) {
      toast({ 
        variant: "destructive", 
        title: "Duplicate Customer", 
        description: "A customer with this phone number already exists." 
      });
      return;
    }
    
    const customerId = addCustomer({
      name: newCust.name,
      address: newCust.address,
      phone: cleanPhone,
      notes: newCust.notes
    });

    if (!customerId) return;

    const openingAD = bsToAd(openingDateBS.year, openingDateBS.month, openingDateBS.day);
    const openingBSStr = `${openingDateBS.year}-${openingDateBS.month}-${openingDateBS.day}`;
    
    const toReceive = parseInt(newCust.openingToReceive) || 0;
    const toGive = parseInt(newCust.openingToGive) || 0;

    // No auto-generated remarks like "Opening Balance" to comply with user's request
    if (toReceive > 0) {
      addTransaction({ customerId, date: openingAD, bsDate: openingBSStr, type: 'OUT_FULL', quantity: toReceive, remark: '' });
    }
    if (toGive > 0) {
      addTransaction({ customerId, date: openingAD, bsDate: openingBSStr, type: 'IN_EMPTY', quantity: toGive, remark: '' });
    }

    setNewCust({ name: '', address: '', phone: '', notes: '', openingToReceive: '', openingToGive: '' });
    setOpeningDateBS(getTodayBSParts());
    setIsAddOpen(false);
    toast({ title: "Customer Added", description: `${newCust.name} has been added.` });
  }, [newCust, openingDateBS, addCustomer, addTransaction, customers, toast]);

  if (loading) return <div className="flex h-full w-full items-center justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const years = getBSYears();
  const daysList = Array.from({ length: 32 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const hasOpeningBalance = (parseInt(newCust.openingToReceive) || 0) > 0 || (parseInt(newCust.openingToGive) || 0) > 0;

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-24 max-w-full overflow-x-hidden">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-4 md:pb-6">
        <div>
          <h1 className="font-headline text-2xl md:text-4xl font-bold text-primary">Customer Ledger</h1>
          <p className="text-muted-foreground text-[10px] md:text-sm mt-1 font-medium">Manage accounts and return cycles</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground font-bold h-10 md:h-11 px-4 md:px-6 rounded-lg shadow-lg shadow-primary/20 flex items-center gap-2 hover:scale-105 transition-all text-xs md:text-sm">
                <Plus className="h-4 w-4 md:h-5 md:w-5" /> New Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-card border-border overflow-y-auto max-h-[90vh] p-4 md:p-6">
              <DialogHeader>
                <DialogTitle className="font-headline text-2xl font-bold text-primary flex items-center gap-2">
                  <UserPlus className="h-6 w-6" /> Create Profile
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">Full Name</Label>
                    <Input value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} placeholder="e.g. Ram Bahadur" className="bg-background h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">Phone Number</Label>
                    <Input value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} placeholder="98XXXXXXXX" className="bg-background h-12" maxLength={10} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">Address</Label>
                  <Input value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} placeholder="Location" className="bg-background h-12" />
                </div>
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-4">
                    <History className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-sm uppercase tracking-wider">Initial Account Status</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/20 border border-border/50">
                    <div className="space-y-2">
                      <Label className="text-primary uppercase text-[9px] tracking-[0.2em] font-bold">To Receive (PCS)</Label>
                      <Input type="number" value={newCust.openingToReceive} onChange={e => setNewCust({...newCust, openingToReceive: e.target.value})} placeholder="0" className="bg-background font-headline font-bold h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-accent uppercase text-[9px] tracking-[0.2em] font-bold">To Give (PCS)</Label>
                      <Input type="number" value={newCust.openingToGive} onChange={e => setNewCust({...newCust, openingToGive: e.target.value})} placeholder="0" className="bg-background font-headline font-bold h-10" />
                    </div>
                  </div>

                  {hasOpeningBalance && (
                    <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Label className="flex items-center gap-2 text-primary uppercase text-[10px] tracking-widest font-bold">
                        <Calendar className="h-3 w-3" /> Opening Balance Date (BS)
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Select value={openingDateBS.year} onValueChange={(v) => setOpeningDateBS({...openingDateBS, year: v})}>
                          <SelectTrigger className="h-10 bg-background border-border text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={openingDateBS.month} onValueChange={(v) => setOpeningDateBS({...openingDateBS, month: v})}>
                          <SelectTrigger className="h-10 bg-background border-border text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{BS_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={openingDateBS.day} onValueChange={(v) => setOpeningDateBS({...openingDateBS, day: v})}>
                          <SelectTrigger className="h-10 bg-background border-border text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">Internal Notes</Label>
                  <Textarea value={newCust.notes} onChange={e => setNewCust({...newCust, notes: e.target.value})} placeholder="Optional customer notes..." className="bg-background resize-none h-20" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAdd} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-14">Save Profile</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input placeholder="Search name or phone..." className="pl-10 h-11 md:h-12 bg-card border-border shadow-sm focus-visible:ring-primary text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
          <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
            <SelectTrigger className="h-11 md:h-12 w-full md:w-[150px] bg-card border-border text-xs">
              <div className="flex items-center gap-2"><Filter className="h-3 w-3" /><SelectValue placeholder="Status" /></div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active Only</SelectItem>
              <SelectItem value="INACTIVE">Inactive Only</SelectItem>
              <SelectItem value="ALL">All Customers</SelectItem>
              <SelectItem value="TO_RECEIVE">To Receive</SelectItem>
              <SelectItem value="TO_GIVE">To Give</SelectItem>
              <SelectItem value="SETTLED">Settled</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
            <SelectTrigger className="h-11 md:h-12 w-full md:w-[160px] bg-card border-border text-xs">
              <div className="flex items-center gap-2"><ArrowUpDown className="h-3 w-3" /><SelectValue placeholder="Sort" /></div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NAME_ASC">Name (A-Z)</SelectItem>
              <SelectItem value="NAME_DESC">Name (Z-A)</SelectItem>
              <SelectItem value="BALANCE_HIGH_TO_LOW">High Balance</SelectItem>
              <SelectItem value="BALANCE_LOW_TO_HIGH">Low Balance</SelectItem>
              <SelectItem value="LATEST_ACTIVITY">Latest Activity</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="py-3 md:py-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px] md:text-[10px] pl-4 md:pl-6">Profile</TableHead>
                <TableHead className="py-3 md:py-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px] md:text-[10px] hidden sm:table-cell">Contact</TableHead>
                <TableHead className="py-3 md:py-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px] md:text-[10px] px-2">Net Status</TableHead>
                <TableHead className="py-3 md:py-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px] md:text-[10px] hidden sm:table-cell">Collection</TableHead>
                <TableHead className="py-3 md:py-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px] md:text-[10px] text-right pr-4 md:pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedCustomers.length > 0 ? processedCustomers.map((customer) => {
                const balance = getCustomerBalance(customer.id);
                const txns = getCustomerTransactions(customer.id);
                const today = getCurrentADDate();
                const latestDueTxn = txns.find(t => t.dueDate && getTransactionImpact(t.type) === 1);
                const daysDiff = latestDueTxn && balance > 0 ? getDifferenceInDays(today, latestDueTxn.dueDate!) : null;
                
                const isActive = customer.status === 'active' || !customer.status;
                
                const getDueBadge = () => {
                  if (balance <= 0 || daysDiff === null) return null;
                  if (daysDiff < 0) return <Badge variant="destructive" className="text-[7px] font-black uppercase">Overdue</Badge>;
                  if (daysDiff === 0) return <Badge className="bg-orange-500 text-white text-[7px] font-black uppercase">Today</Badge>;
                  if (daysDiff <= 7) return <Badge className="bg-yellow-500 text-black text-[7px] font-black uppercase">Soon</Badge>;
                  return null;
                };

                return (
                  <TableRow key={customer.id} className={cn("border-border/50 hover:bg-muted/10 transition-colors", !isActive && "opacity-60 bg-muted/5")}>
                    <TableCell className="py-3 md:py-4 pl-4 md:pl-6 max-w-[150px] md:max-w-none">
                      <div className="flex items-center gap-2 md:gap-4">
                        <div className={cn("h-8 w-8 md:h-10 md:w-10 rounded-lg flex items-center justify-center font-bold shrink-0 text-xs md:text-sm", isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{customer.name.charAt(0)}</div>
                        <div className="min-w-0">
                          <Link href={`/customers/${customer.id}`} className="font-bold text-xs md:text-sm text-foreground hover:text-primary transition-colors block truncate">
                            {customer.name}
                          </Link>
                          <div className="flex items-center gap-1 text-[8px] md:text-[10px] text-muted-foreground truncate"><MapPin className="h-2 w-2 md:h-2.5 md:w-2.5" /> {customer.address}</div>
                          <div className="flex gap-1 mt-1">
                            {!isActive && <Badge variant="secondary" className="text-[6px] md:text-[7px] h-3 px-1 leading-none font-black uppercase">Inactive</Badge>}
                            {isActive && getDueBadge()}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"><div className="flex items-center gap-2 text-xs md:text-sm text-foreground"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {customer.phone}</div></TableCell>
                    <TableCell className="px-2">
                      <div className="flex flex-col min-w-[70px]">
                        <span className={cn("font-headline font-bold text-[11px] md:text-sm", balance > 0 ? "text-primary" : balance < 0 ? "text-accent" : "text-emerald-500")}>
                          {balance === 0 ? "Settled" : balance > 0 ? `${balance} To Receive` : `${Math.abs(balance)} To Give`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {latestDueTxn && balance > 0 ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold">{adToBs(latestDueTxn.dueDate!)}</span>
                          <span className={cn("text-[8px] font-medium uppercase", daysDiff! < 0 ? "text-destructive" : daysDiff! === 0 ? "text-amber-500" : "text-muted-foreground")}>
                            {daysDiff! < 0 ? `${Math.abs(daysDiff!)}d Over` : daysDiff! === 0 ? "Due Today" : `${daysDiff!}d Left`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4 md:pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted"><MoreHorizontal className="h-4 w-4 md:h-5 md:w-5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border w-[160px]">
                          <DropdownMenuItem asChild><Link href={`/customers/${customer.id}`} className="cursor-pointer flex items-center py-2.5 text-xs"><Eye className="h-3.5 w-3.5 mr-2" /> View Profile</Link></DropdownMenuItem>
                          <DropdownMenuItem asChild><Link href={`/transactions?customerId=${customer.id}`} className="cursor-pointer flex items-center py-2.5 text-xs text-primary"><Plus className="h-3.5 w-3.5 mr-2" /> New Entry</Link></DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-xs">No customers found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
