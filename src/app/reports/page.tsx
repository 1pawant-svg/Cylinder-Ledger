"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useLedger } from "@/lib/ledger-context";
import { 
  FileText, 
  Filter, 
  Download, 
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Printer,
  Calendar,
  UserCheck,
  Package,
  Activity,
  User,
  Search
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { TransactionType } from "@/lib/types";
import { adToBs, getCurrentADDate } from "@/lib/date-utils";
import { useI18n } from "@/lib/i18n-context";

const getTransactionImpact = (type: TransactionType): number => {
  const t = type.toUpperCase();
  if (t === 'OUT' || t === 'OUT_FULL') return 1;
  if (t === 'IN' || t === 'IN_EMPTY' || t === 'LEAKAGE' || t === 'LOST' || t === 'ADJUSTMENT') return -1;
  return 0;
};

const getTransactionLabel = (type: TransactionType) => {
  const t = type.toUpperCase();
  switch(t) {
    case 'OUT_FULL': return 'Full Issue';
    case 'IN_EMPTY': return 'Empty Return';
    case 'LEAKAGE': return 'Leakage';
    case 'LOST': return 'Lost Shell';
    case 'ADJUSTMENT': return 'Adjustment';
    default: return t;
  }
};

export default function ReportsPage() {
  const { customers, activeCustomers, transactions, getCustomerBalance, getStaffActivity } = useLedger();
  const { t } = useI18n();
  const [filterType, setFilterType] = useState<string>('ALL');
  const [search, setSearch] = useState("");

  const activeTransactions = useMemo(() => {
    let base = transactions.filter(t => t.status !== 'deleted');
    
    if (filterType !== 'ALL') {
      base = base.filter(t => t.type === filterType);
    }
    
    if (search) {
      const s = search.toLowerCase();
      base = base.filter(t => {
        const customer = customers.find(c => c.id === t.customerId);
        return customer?.name.toLowerCase().includes(s) || 
               customer?.phone.includes(s) || 
               t.bsDate.includes(s) || 
               t.remark?.toLowerCase().includes(s);
      });
    }
    
    return base;
  }, [transactions, customers, filterType, search]);

  const totalOut = activeTransactions.filter(t => getTransactionImpact(t.type) === 1).reduce((s, t) => s + t.quantity, 0);
  const totalIn = activeTransactions.filter(t => getTransactionImpact(t.type) === -1).reduce((s, t) => s + t.quantity, 0);
  const totalVolume = totalOut + totalIn;
  
  const outPercentage = totalVolume > 0 ? (totalOut / totalVolume) * 100 : 0;
  const inPercentage = totalVolume > 0 ? (totalIn / totalVolume) * 100 : 0;

  const rankings = useMemo(() => {
    return activeCustomers.map(c => ({
      ...c,
      balance: getCustomerBalance(c.id)
    })).sort((a, b) => b.balance - a.balance);
  }, [activeCustomers, getCustomerBalance]);

  const staffActivity = useMemo(() => getStaffActivity(), [getStaffActivity]);

  const exportCSV = () => {
    const headers = ["ID", "BS Date", "Customer", "Event Type", "Quantity", "Staff", "Status"];
    const rows = activeTransactions.map(t => {
      const customer = customers.find(c => c.id === t.customerId);
      return [
        t.id.slice(-6).toUpperCase(),
        t.bsDate,
        customer?.name || 'Unknown',
        getTransactionLabel(t.type),
        t.quantity,
        t.createdByName || 'System',
        customer?.status || 'active'
      ].join(",");
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Cylindera_Report_${getCurrentADDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in slide-in-from-top-4 duration-500 print:p-0 print:space-y-4 pb-24 md:pb-8 w-full max-w-full overflow-x-hidden min-w-0">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6 print:hidden min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="font-headline text-2xl md:text-4xl font-bold text-primary truncate">Advanced Analytics</h1>
          <p className="text-muted-foreground mt-1 font-medium text-[10px] md:text-sm truncate">Production and operational performance module</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full md:w-auto shrink min-w-0">
          <Button variant="outline" className="gap-2 font-bold h-10 md:h-12 flex-1 sm:flex-none text-[10px] md:text-sm shrink" onClick={handlePrint}>
            <Printer className="h-4 w-4 shrink-0" /> <span className="truncate">Print PDF</span>
          </Button>
          <Button variant="outline" className="gap-2 font-bold h-10 md:h-12 flex-1 sm:flex-none text-[10px] md:text-sm shrink" onClick={exportCSV}>
            <Download className="h-4 w-4 shrink-0" /> <span className="truncate">Export CSV</span>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 print:grid-cols-3 print:gap-4 min-w-0">
        <Card className="border-none shadow-xl bg-card border-t-4 border-t-primary min-w-0 overflow-hidden">
          <CardHeader className="p-4 md:p-6 min-w-0">
            <CardTitle className="font-headline text-lg md:text-xl font-bold flex items-center gap-2 truncate">
              <TrendingUp className="h-5 w-5 text-primary shrink-0" /> <span className="truncate">Top Debtors</span>
            </CardTitle>
            <CardDescription className="print:hidden text-[10px] md:text-xs truncate">Highest outstanding To Receive counts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 md:p-6 pt-0 min-w-0">
            {rankings.filter(r => r.balance > 0).slice(0, 5).map((r, i) => (
              <Link key={r.id} href={`/customers/${r.id}`}>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer group gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-primary w-4 shrink-0">#{i+1}</span>
                    <span className="font-bold text-xs truncate group-hover:text-primary">{r.name}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0 whitespace-nowrap">
                    <span className="font-headline font-bold text-[10px] text-primary">{r.balance}</span>
                    <span className="text-[8px] uppercase tracking-tighter text-muted-foreground">{t('toReceiveSuffix')}</span>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-card border-t-4 border-t-emerald-500 min-w-0 overflow-hidden">
          <CardHeader className="p-4 md:p-6 min-w-0">
            <CardTitle className="font-headline text-lg md:text-xl font-bold flex items-center gap-2 truncate">
              <Activity className="h-5 w-5 text-emerald-500 shrink-0" /> <span className="truncate">Staff Performance</span>
            </CardTitle>
            <CardDescription className="print:hidden text-[10px] md:text-xs truncate">Contribution logs by personnel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 md:p-6 pt-0 min-w-0">
            {staffActivity.slice(0, 3).map((staff, i) => (
              <div key={i} className="space-y-1 p-3 rounded-lg bg-emerald-500/5 min-w-0">
                <div className="flex justify-between items-center mb-1 gap-2 min-w-0">
                  <span className="font-bold text-xs flex items-center gap-2 min-w-0 flex-1">
                    <User className="h-3 w-3 shrink-0" /> 
                    <span className="truncate">{staff.name}</span>
                  </span>
                  <Badge variant="outline" className="text-[8px] font-bold shrink-0">{staff.count} TXNS</Badge>
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground uppercase tracking-widest font-bold gap-2 min-w-0">
                  <span className="shrink-0 mr-2">Volume</span>
                  <span className="text-emerald-500 truncate">{staff.volume} PCS</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-card border-t-4 border-t-accent min-w-0 overflow-hidden">
          <CardHeader className="p-4 md:p-6 min-w-0">
            <CardTitle className="font-headline text-lg md:text-xl font-bold flex items-center gap-2 truncate">
              <Package className="h-5 w-5 text-accent shrink-0" /> <span className="truncate">Operation Volume</span>
            </CardTitle>
            <CardDescription className="print:hidden text-[10px] md:text-xs truncate">Net business movement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-4 md:p-6 pt-0 min-w-0">
            <div className="space-y-2 min-w-0">
              <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-widest gap-2 min-w-0">
                <span className="shrink-0 mr-2">Total Issues (+)</span>
                <span className="text-primary truncate">{totalOut} PCS</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${outPercentage}%` }} />
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-widest gap-2 min-w-0">
                <span className="shrink-0 mr-2">Total Cleared (-)</span>
                <span className="text-emerald-500 truncate">{totalIn} PCS</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${inPercentage}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl bg-card print:shadow-none overflow-hidden w-full max-w-full">
        <CardHeader className="border-b border-border/50 p-4 md:p-6 print:pb-2 min-w-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
            <div className="min-w-0 flex-1">
              <CardTitle className="font-headline text-xl md:text-2xl font-bold truncate">Business Ledger</CardTitle>
              <CardDescription className="text-xs md:text-sm truncate">Comprehensive transaction history</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 print:hidden w-full lg:w-auto shrink-0 min-w-0">
              <div className="relative w-full sm:flex-1 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search ledger..." 
                  className="pl-9 h-10 w-full text-xs" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[150px] h-10 text-xs shrink-0">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Events</SelectItem>
                  <SelectItem value="OUT_FULL">Issues</SelectItem>
                  <SelectItem value="IN_EMPTY">Returns</SelectItem>
                  <SelectItem value="LEAKAGE">Leakage</SelectItem>
                  <SelectItem value="LOST">Lost</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adj</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <Table className="min-w-[600px] w-full">
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/50">
                  <TableHead className="py-4 font-bold text-[9px] uppercase tracking-widest pl-4 md:pl-6 hidden sm:table-cell">ID</TableHead>
                  <TableHead className="py-4 font-bold text-[9px] uppercase tracking-widest px-2 md:px-4">BS Date</TableHead>
                  <TableHead className="py-4 font-bold text-[9px] uppercase tracking-widest px-2 md:px-4">Customer</TableHead>
                  <TableHead className="py-4 font-bold text-[9px] uppercase tracking-widest px-2 md:px-4">Type</TableHead>
                  <TableHead className="py-4 font-bold text-[9px] uppercase tracking-widest px-2 md:px-4">Qty</TableHead>
                  <TableHead className="text-right pr-4 md:pr-6 text-[9px] uppercase tracking-widest print:hidden">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTransactions.length > 0 ? activeTransactions.map((txn) => {
                  const customer = customers.find(c => c.id === txn.customerId);
                  const isInactive = customer?.status === 'inactive';
                  const impact = getTransactionImpact(txn.type);
                  return (
                    <TableRow key={txn.id} className={cn("border-border/50", isInactive && "opacity-80")}>
                      <TableCell className="pl-4 md:pl-6 font-mono text-[9px] text-muted-foreground hidden sm:table-cell">#{txn.id.slice(-4)}</TableCell>
                      <TableCell className="px-2 md:px-4 font-bold text-[10px] whitespace-nowrap">{txn.bsDate}</TableCell>
                      <TableCell className="px-2 md:px-4 font-medium text-[10px] min-w-[100px] max-w-[150px]">
                        <div className="truncate flex items-center gap-1 min-w-0">
                          <span className="truncate">{customer?.name || 'Deleted'}</span>
                          {isInactive && <Badge variant="outline" className="text-[6px] px-1 h-3 shrink-0">OFF</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 md:px-4">
                        <Badge variant={impact === 1 ? 'default' : 'secondary'} className="text-[7px] font-bold uppercase tracking-widest px-1 py-0 h-4">
                          {getTransactionLabel(txn.type).split(' ')[0]}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-2 md:px-4 font-headline font-bold text-[10px] whitespace-nowrap">{txn.quantity} PCS</TableCell>
                      <TableCell className="text-right pr-4 md:pr-6 print:hidden">
                        {customer && <Button variant="ghost" size="icon" asChild className="h-7 w-7"><Link href={`/customers/${customer.id}`}><ChevronRight className="h-4 w-4" /></Link></Button>}
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic text-xs">No entries.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
