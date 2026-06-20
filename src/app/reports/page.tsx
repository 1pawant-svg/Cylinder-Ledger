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
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in slide-in-from-top-4 duration-500 print:p-0 print:space-y-4 pb-24 md:pb-8 w-full max-w-full overflow-x-hidden">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6 print:hidden">
        <div>
          <h1 className="font-headline text-2xl md:text-4xl font-bold text-primary">Advanced Analytics</h1>
          <p className="text-muted-foreground mt-1 font-medium text-[10px] md:text-sm">Production and operational performance module</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full md:w-auto">
          <Button variant="outline" className="gap-2 font-bold h-11 md:h-12 flex-1 sm:flex-none" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print PDF
          </Button>
          <Button variant="outline" className="gap-2 font-bold h-11 md:h-12 flex-1 sm:flex-none" onClick={exportCSV}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </header>

      {/* Stats Summary - Stacked on Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 print:grid-cols-3 print:gap-4">
        <Card className="border-none shadow-xl bg-card border-t-4 border-t-primary min-w-0">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="font-headline text-lg md:text-xl font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Top Debtors
            </CardTitle>
            <CardDescription className="print:hidden text-[10px] md:text-xs">Highest outstanding To Receive counts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 md:p-6 pt-0">
            {rankings.filter(r => r.balance > 0).slice(0, 10).map((r, i) => (
              <Link key={r.id} href={`/customers/${r.id}`}>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer group gap-2">
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <span className="text-[10px] font-bold text-primary w-4 shrink-0">#{i+1}</span>
                    <span className="font-bold text-xs truncate group-hover:text-primary">{r.name}</span>
                  </div>
                  <span className="font-headline font-bold text-[10px] md:text-xs text-primary shrink-0 whitespace-nowrap">{r.balance} To Receive</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-card border-t-4 border-t-emerald-500 min-w-0">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="font-headline text-lg md:text-xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" /> Staff Performance
            </CardTitle>
            <CardDescription className="print:hidden text-[10px] md:text-xs">Contribution logs by personnel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 md:p-6 pt-0">
            {staffActivity.map((staff, i) => (
              <div key={i} className="space-y-1 p-3 rounded-lg bg-emerald-500/5">
                <div className="flex justify-between items-center mb-1 gap-2">
                  <span className="font-bold text-sm flex items-center gap-2 min-w-0 overflow-hidden">
                    <User className="h-3 w-3 shrink-0" /> 
                    <span className="truncate">{staff.name}</span>
                  </span>
                  <Badge variant="outline" className="text-[9px] font-bold shrink-0">{staff.count} TXNS</Badge>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                  <span>Total Volume</span>
                  <span className="text-emerald-500">{staff.volume} PCS</span>
                </div>
              </div>
            ))}
            {staffActivity.length === 0 && <p className="text-center py-8 text-muted-foreground text-xs italic">No activity recorded.</p>}
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-card border-t-4 border-t-accent min-w-0">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="font-headline text-lg md:text-xl font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-accent" /> Operation Volume
            </CardTitle>
            <CardDescription className="print:hidden text-[10px] md:text-xs">Net business movement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-4 md:p-6 pt-0">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <span>Total Issues (+)</span>
                <span className="text-primary">{totalOut} PCS</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${outPercentage}%` }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <span>Total Cleared (-)</span>
                <span className="text-emerald-500">{totalIn} PCS</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${inPercentage}%` }} />
              </div>
            </div>
            <div className="pt-4 border-t border-border mt-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Net Liability Growth</p>
                  <p className="text-2xl md:text-3xl font-headline font-bold text-foreground">{totalOut - totalIn} PCS</p>
                </div>
                <Activity className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground opacity-20" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl bg-card print:shadow-none overflow-hidden w-full">
        <CardHeader className="border-b border-border/50 p-4 md:p-6 print:pb-2">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="font-headline text-xl md:text-2xl font-bold">Business Ledger</CardTitle>
              <CardDescription className="text-xs md:text-sm">Comprehensive transaction history</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 print:hidden w-full lg:w-auto">
              <div className="relative w-full sm:w-auto sm:flex-1 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search ledger..." 
                  className="pl-9 h-10 w-full" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[180px] h-10">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Event Types</SelectItem>
                  <SelectItem value="OUT_FULL">Full Issues</SelectItem>
                  <SelectItem value="IN_EMPTY">Empty Returns</SelectItem>
                  <SelectItem value="LEAKAGE">Leakage Logs</SelectItem>
                  <SelectItem value="LOST">Lost Shells</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustments</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border/50">
                <TableHead className="py-4 font-bold text-[9px] md:text-[10px] uppercase tracking-widest pl-4 md:pl-6 hidden sm:table-cell">ID</TableHead>
                <TableHead className="py-4 font-bold text-[9px] md:text-[10px] uppercase tracking-widest px-2 md:px-4">BS Date</TableHead>
                <TableHead className="py-4 font-bold text-[9px] md:text-[10px] uppercase tracking-widest px-2 md:px-4">Customer</TableHead>
                <TableHead className="py-4 font-bold text-[9px] md:text-[10px] uppercase tracking-widest px-2 md:px-4">Type</TableHead>
                <TableHead className="py-4 font-bold text-[9px] md:text-[10px] uppercase tracking-widest px-2 md:px-4">Qty</TableHead>
                <TableHead className="py-4 font-bold text-[9px] md:text-[10px] uppercase tracking-widest px-2 md:px-4 hidden sm:table-cell">Staff</TableHead>
                <TableHead className="py-4 font-bold text-[9px] md:text-[10px] uppercase tracking-widest text-right pr-4 md:pr-6 print:hidden">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeTransactions.length > 0 ? activeTransactions.map((txn) => {
                const customer = customers.find(c => c.id === txn.customerId);
                const isInactive = customer?.status === 'inactive';
                const impact = getTransactionImpact(txn.type);
                return (
                  <TableRow key={txn.id} className={cn("border-border/50 transition-colors", isInactive && "bg-muted/5 opacity-80")}>
                    <TableCell className="pl-4 md:pl-6 font-mono text-[9px] md:text-[10px] text-muted-foreground uppercase hidden sm:table-cell">#{txn.id.slice(-4)}</TableCell>
                    <TableCell className="px-2 md:px-4 font-bold text-[10px] md:text-xs whitespace-nowrap">{txn.bsDate}</TableCell>
                    <TableCell className="px-2 md:px-4 font-medium text-[10px] md:text-xs min-w-[80px] md:min-w-[120px] max-w-[150px]">
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{customer?.name || 'Deleted'}</span>
                        {isInactive && <span className="text-[7px] text-accent font-bold uppercase tracking-tighter">Inactive</span>}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 md:px-4">
                      <Badge variant={impact === 1 ? 'default' : 'secondary'} className="text-[7px] md:text-[8px] font-bold uppercase tracking-widest px-1 py-0">
                        {getTransactionLabel(txn.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 md:px-4 font-headline font-bold text-xs">{txn.quantity} PCS</TableCell>
                    <TableCell className="px-2 md:px-4 text-[9px] md:text-[10px] font-medium min-w-[80px] hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <User className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{txn.createdByName || 'Staff'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-4 md:pr-6 print:hidden">
                      {customer && <Button variant="ghost" size="icon" asChild className="h-6 w-6 text-muted-foreground hover:text-primary"><Link href={`/customers/${customer.id}`}><ChevronRight className="h-3 w-3" /></Link></Button>}
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic text-xs">No transactions found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Footer for PDF Print */}
      <footer className="hidden print:block pt-8 text-center border-t border-border mt-8">
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Generated by Cylindera LPG Pro • {getCurrentADDate()}</p>
      </footer>
    </div>
  );
}
