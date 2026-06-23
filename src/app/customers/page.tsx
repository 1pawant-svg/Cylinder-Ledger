"use client";

import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { useLedger } from "@/lib/ledger-context";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Search, MoreHorizontal, Eye, MapPin, Loader2
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getCurrentADDate, adToBs, bsToAd, toMillis } from "@/lib/date-utils";
import { useI18n } from "@/lib/i18n-context";

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'TO_RECEIVE' | 'TO_GIVE' | 'SETTLED' | 'OVERDUE';
type SortOption = 'NAME_ASC' | 'NAME_DESC' | 'BALANCE_HIGH_TO_LOW' | 'BALANCE_LOW_TO_HIGH' | 'LATEST_ACTIVITY';

export default function CustomersPage() {
  const { customers, addCustomer, addTransaction, getCustomerTransactions, loading } = useLedger();
  const { toast } = useToast();
  const { t } = useI18n();
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [sortBy, setSortBy] = useState<SortOption>('NAME_ASC');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const getTodayBSParts = useCallback(() => {
    const todayAD = getCurrentADDate();
    const bsDateStr = adToBs(todayAD);
    const parts = bsDateStr.split('-');
    return parts.length === 3 ? { year: parts[0], month: parts[1], day: parts[2] } : { year: '2081', month: '01', day: '01' };
  }, []);

  const [newCust, setNewCust] = useState({ 
    name: '', address: '', phone: '', pan: '', notes: '', openingToReceive: '', openingToGive: ''
  });
  const [openingDateBS, setOpeningDateBS] = useState(getTodayBSParts());

  const processedCustomers = useMemo(() => {
    const today = getCurrentADDate();
    const s = search.toLowerCase();
    
    let result = customers.filter(c => 
      c.name.toLowerCase().includes(s) || 
      c.phone.includes(search) ||
      c.address.toLowerCase().includes(s) ||
      (c.pan && c.pan.toLowerCase().includes(s))
    );

    result = result.filter(c => {
      const balance = c.balance || 0;
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'ACTIVE') return c.status === 'active' || !c.status;
      if (statusFilter === 'INACTIVE') return c.status === 'inactive';
      if (statusFilter === 'TO_RECEIVE') return balance > 0;
      if (statusFilter === 'TO_GIVE') return balance < 0;
      if (statusFilter === 'SETTLED') return balance === 0;
      if (statusFilter === 'OVERDUE') {
        const txns = getCustomerTransactions(c.id);
        return balance > 0 && txns.some(t => t.dueDate && t.dueDate < today);
      }
      return true;
    });

    result.sort((a, b) => {
      const balanceA = a.balance || 0;
      const balanceB = b.balance || 0;
      switch (sortBy) {
        case 'NAME_ASC': return a.name.localeCompare(b.name);
        case 'NAME_DESC': return b.name.localeCompare(a.name);
        case 'BALANCE_HIGH_TO_LOW': return balanceB - balanceA;
        case 'BALANCE_LOW_TO_HIGH': return balanceA - balanceB;
        case 'LATEST_ACTIVITY':
          const lastDateA = a.createdAt ? toMillis(a.createdAt) : 0;
          const lastDateB = b.createdAt ? toMillis(b.createdAt) : 0;
          return lastDateB - lastDateA;
        default: return 0;
      }
    });

    return result;
  }, [customers, search, statusFilter, sortBy, getCustomerTransactions]);

  const handleAdd = useCallback(() => {
    if (!newCust.name || !newCust.phone) return;
    const cleanPhone = newCust.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) return;

    if (newCust.pan && newCust.pan.length !== 9) return;
    
    const customerId = addCustomer({
      name: newCust.name, address: newCust.address, phone: cleanPhone, pan: newCust.pan, notes: newCust.notes
    });

    if (!customerId) return;

    const openingAD = bsToAd(openingDateBS.year, openingDateBS.month, openingDateBS.day);
    const openingBSStr = `${openingDateBS.year}-${openingDateBS.month}-${openingDateBS.day}`;
    
    const toReceive = parseInt(newCust.openingToReceive) || 0;
    const toGive = parseInt(newCust.openingToGive) || 0;

    if (toReceive > 0) addTransaction({ customerId, date: openingAD, bsDate: openingBSStr, type: 'OUT_FULL', quantity: toReceive, remark: '' });
    if (toGive > 0) addTransaction({ customerId, date: openingAD, bsDate: openingBSStr, type: 'IN_EMPTY', quantity: toGive, remark: '' });

    setNewCust({ name: '', address: '', phone: '', pan: '', notes: '', openingToReceive: '', openingToGive: '' });
    setOpeningDateBS(getTodayBSParts());
    setIsAddOpen(false);
    toast({ title: t('profileAdded') });
  }, [newCust, openingDateBS, addCustomer, addTransaction, getTodayBSParts, toast, t]);

  if (loading) return <div className="flex h-full w-full items-center justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-24 w-full max-w-full overflow-x-hidden min-w-0">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="font-headline text-2xl md:text-4xl font-bold text-primary truncate">{t('customerLedger')}</h1>
          <p className="text-muted-foreground text-xs font-medium truncate">{t('manageAccounts')}</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild><Button className="w-full md:w-auto bg-primary font-bold shadow-lg shrink-0"><Plus className="h-4 w-4 mr-2" /> {t('newProfile')}</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[500px] w-[95vw] rounded-xl overflow-y-auto max-h-[90vh]">
            <DialogHeader><DialogTitle className="font-headline text-2xl font-bold">{t('createProfile')}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">{t('name')}</Label><Input value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">{t('phone')}</Label><Input value={newCust.phone} maxLength={10} onChange={e => setNewCust({...newCust, phone: e.target.value.replace(/\D/g, '')})} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">{t('address')}</Label><Input value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">{t('pan')}</Label><Input value={newCust.pan} maxLength={9} onChange={e => setNewCust({...newCust, pan: e.target.value.replace(/\D/g, '')})} /></div>
              </div>
              <div className="p-4 rounded-xl bg-muted/20 border border-border/50 space-y-4">
                 <Label className="text-primary font-bold text-xs">{t('initialBalances')}</Label>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[9px] uppercase font-bold">{t('toReceiveSuffix')}</Label><Input type="number" value={newCust.openingToReceive} onChange={e => setNewCust({...newCust, openingToReceive: e.target.value})} /></div>
                    <div className="space-y-2"><Label className="text-[9px] uppercase font-bold">{t('toGiveSuffix')}</Label><Input type="number" value={newCust.openingToGive} onChange={e => setNewCust({...newCust, openingToGive: e.target.value})} /></div>
                 </div>
              </div>
            </div>
            <DialogFooter><Button onClick={handleAdd} className="w-full h-12 font-bold">{t('saveProfile')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex flex-col md:flex-row gap-3 min-w-0">
        <div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder={t('search')} className="pl-10 h-12 w-full" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2 shrink-0"><Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}><SelectTrigger className="h-12 w-full md:w-[150px]"><SelectValue placeholder={t('activeOnly')} /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">{t('activeOnly')}</SelectItem><SelectItem value="INACTIVE">{t('inactiveOnly')}</SelectItem><SelectItem value="ALL">{t('allCustomers')}</SelectItem><SelectItem value="TO_RECEIVE">{t('toReceive')}</SelectItem><SelectItem value="TO_GIVE">{t('toGive')}</SelectItem><SelectItem value="SETTLED">{t('settled')}</SelectItem><SelectItem value="OVERDUE">{t('overdue')}</SelectItem></SelectContent></Select><Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}><SelectTrigger className="h-12 w-full md:w-[160px]"><SelectValue placeholder="Sort" /></SelectTrigger><SelectContent><SelectItem value="NAME_ASC">Name (A-Z)</SelectItem><SelectItem value="NAME_DESC">Name (Z-A)</SelectItem><SelectItem value="BALANCE_HIGH_TO_LOW">High Balance</SelectItem><SelectItem value="BALANCE_LOW_TO_HIGH">Low Balance</SelectItem><SelectItem value="LATEST_ACTIVITY">Latest Activity</SelectItem></SelectContent></Select></div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-xl w-full max-w-full">
        <div className="overflow-x-auto w-full">
          <Table className="min-w-[600px] md:min-w-full">
            <TableHeader className="bg-muted/30">
              <TableRow><TableHead className="pl-6 font-bold text-[10px] uppercase">{t('name')}</TableHead><TableHead className="font-bold text-[10px] uppercase">{t('netBalance')}</TableHead><TableHead className="text-right pr-6 font-bold text-[10px] uppercase">{t('actions')}</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {processedCustomers.map((customer) => {
                const bal = customer.balance || 0;
                return (
                  <TableRow key={customer.id} className={cn(!customer.status || customer.status === 'active' ? "" : "opacity-60")}>
                    <TableCell className="pl-6">
                      <Link href={`/customers/${customer.id}`} className="font-bold hover:text-primary transition-colors block truncate max-w-[180px] sm:max-w-[300px]">{customer.name}</Link>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground truncate max-w-[180px] sm:max-w-[300px]"><MapPin className="h-3 w-3 shrink-0" /> {customer.address} • {customer.phone}</div>
                    </TableCell>
                    <TableCell><span className={cn("font-headline font-bold text-sm whitespace-nowrap", bal > 0 ? "text-primary" : bal < 0 ? "text-accent" : "text-emerald-500")}>{bal === 0 ? t('settled') : bal > 0 ? `${bal} ${t('toReceiveSuffix')}` : `${Math.abs(bal)} ${t('toGiveSuffix')}`}</span></TableCell>
                    <TableCell className="text-right pr-6"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`/customers/${customer.id}`} className="cursor-pointer gap-2"><Eye className="h-4 w-4" /> {t('viewProfile')}</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/transactions?customerId=${customer.id}`} className="cursor-pointer gap-2 text-primary"><Plus className="h-4 w-4" /> {t('newEntry')}</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
