"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useLedger } from "@/lib/ledger-context";
import { StatCard } from "@/components/dashboard/stat-card";
import { 
  Package, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Users,
  AlertCircle,
  Loader2,
  Bell,
  PhoneCall,
  History,
  TrendingUp,
  XCircle,
  AlertTriangle,
  Clock,
  LayoutDashboard,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  Activity
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatFullDate, adToBs, getCurrentADDate, toMillis, getDifferenceInDays } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { TransactionType } from "@/lib/types";

const getTransactionIcon = (type: TransactionType) => {
  const t = type.toUpperCase();
  if (t === 'OUT' || t === 'OUT_FULL') return <ArrowUpRight className="h-5 w-5" />;
  if (t === 'IN' || t === 'IN_EMPTY') return <ArrowDownLeft className="h-5 w-5" />;
  if (t === 'LEAKAGE') return <AlertTriangle className="h-5 w-5" />;
  if (t === 'LOST') return <XCircle className="h-5 w-5" />;
  return <Package className="h-5 w-5" />;
};

const getTransactionColor = (type: TransactionType) => {
  const t = type.toUpperCase();
  if (t === 'OUT' || t === 'OUT_FULL') return "bg-primary/10 text-primary";
  if (t === 'IN' || t === 'IN_EMPTY') return "bg-emerald-500/10 text-emerald-500";
  if (t === 'LEAKAGE') return "bg-amber-500/10 text-amber-500";
  if (t === 'LOST') return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
};

const getTransactionImpact = (type: TransactionType): number => {
  const t = type.toUpperCase();
  if (t === 'OUT' || t === 'OUT_FULL') return 1;
  if (t === 'IN' || t === 'IN_EMPTY' || t === 'LEAKAGE' || t === 'LOST' || t === 'ADJUSTMENT') return -1;
  return 0;
};

const getOverdueBadge = (daysDiff: number) => {
  if (daysDiff === 0) return <Badge className="bg-orange-500 text-white text-[10px] font-bold">Today</Badge>;
  const absDays = Math.abs(daysDiff);
  if (absDays >= 30) return <Badge variant="destructive" className="text-[10px] font-bold">Overdue 30+ Days</Badge>;
  if (absDays >= 10) return <Badge variant="destructive" className="bg-red-600 text-white text-[10px] font-bold">Overdue 10 Days</Badge>;
  if (absDays >= 3) return <Badge variant="destructive" className="bg-red-400 text-white text-[10px] font-bold">Overdue 3 Days</Badge>;
  return <Badge variant="destructive" className="bg-red-300 text-white text-[10px] font-bold">Overdue</Badge>;
};

export default function Dashboard() {
  const { customers, activeCustomers, transactions, getCustomerBalance, loading } = useLedger();
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    const todayAD = getCurrentADDate();
    setTodayLabel(formatFullDate(todayAD));
  }, []);

  // 1. Core liability metrics
  const toReceiveTotal = useMemo(() => 
    customers.reduce((sum, c) => sum + Math.max(0, getCustomerBalance(c.id)), 0),
    [customers, getCustomerBalance]
  );

  // 2. Collection logic filtered by balance > 0
  const collectionData = useMemo(() => {
    const today = getCurrentADDate();
    
    const collections = transactions
      .filter(t => t.status !== 'deleted' && t.dueDate && getTransactionImpact(t.type) === 1)
      .map(t => {
        // Handle both string and Date due dates
        const dueDateStr = typeof t.dueDate === 'string' ? t.dueDate : new Date(toMillis(t.dueDate)).toISOString().split('T')[0];
        
        return {
          ...t,
          dueDateFinal: dueDateStr,
          balance: getCustomerBalance(t.customerId),
          daysDiff: getDifferenceInDays(today, dueDateStr)
        };
      })
      .filter(item => item.balance > 0);

    const overdue = collections
      .filter(c => c.daysDiff < 0)
      .sort((a, b) => a.daysDiff - b.daysDiff); // Most overdue first

    const dueToday = collections
      .filter(c => c.daysDiff === 0)
      .sort((a, b) => b.balance - a.balance);

    const dueThisWeek = collections
      .filter(c => c.daysDiff > 0 && c.daysDiff <= 7)
      .sort((a, b) => a.daysDiff - b.daysDiff);

    return { overdue, dueToday, dueThisWeek };
  }, [transactions, getCustomerBalance]);

  const recentActivity = useMemo(() => {
    return [...transactions]
      .filter(t => t.status !== 'deleted')
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .slice(0, 8);
  }, [transactions]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 pb-24 md:pb-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center md:hidden">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-headline text-2xl md:text-4xl font-bold text-primary">Overview</h1>
            <p className="text-muted-foreground text-xs md:text-sm font-medium">{todayLabel || "Loading date..."}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/transactions">
            <Button className="bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-lg shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
              New Transaction
            </Button>
          </Link>
        </div>
      </header>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          title="Market Stock" 
          value={`${toReceiveTotal} To Receive`} 
          icon={Package} 
          description="Total outstanding cylinders"
          variant="primary"
          href="/customers?filter=TO_RECEIVE"
        />
        <StatCard 
          title="Active Accounts" 
          value={activeCustomers.length} 
          icon={Users} 
          description="Ongoing return cycles"
          variant="default"
          href="/customers?filter=ACTIVE"
        />
        <StatCard 
          title="Total Transactions" 
          value={transactions.length} 
          icon={Activity} 
          description="Lifetime movement logs"
          variant="accent"
          href="/reports"
        />
      </div>

      {/* Due Management Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 px-1">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-headline text-xl font-bold">Due Management</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Due Today */}
          <Card className="border-none shadow-xl bg-card border-t-4 border-t-orange-500 overflow-hidden flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" /> Due Today
                  </CardTitle>
                  <CardDescription className="text-xs">Pending collections for today</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-xl font-headline font-bold text-orange-500">{collectionData.dueToday.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">{collectionData.dueToday.reduce((s, c) => s + c.balance, 0)} To Receive</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {collectionData.dueToday.slice(0, 5).map((item) => {
                const customer = customers.find(c => c.id === item.customerId);
                return (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/50 group hover:bg-muted/40 transition-colors">
                    <div className="min-w-0">
                      <Link href={`/customers/${customer?.id}`} className="font-bold text-xs truncate block group-hover:text-primary transition-colors">
                        {customer?.name}
                      </Link>
                      <p className="text-[9px] text-muted-foreground">{customer?.phone}</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-xs font-bold text-orange-500">{item.balance} To Receive</span>
                      {getOverdueBadge(item.daysDiff)}
                    </div>
                  </div>
                );
              })}
              {collectionData.dueToday.length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-xs italic">No collections due today.</div>
              )}
            </CardContent>
            <CardFooter className="pt-2 border-t border-border/50">
              <Button variant="ghost" className="w-full text-xs gap-2 font-bold h-10 hover:bg-muted" asChild>
                <Link href="/customers?filter=SETTLED">View All Due Today <ExternalLink className="h-3 w-3" /></Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Due This Week */}
          <Card className="border-none shadow-xl bg-card border-t-4 border-t-yellow-500 overflow-hidden flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-yellow-500" /> Due This Week
                  </CardTitle>
                  <CardDescription className="text-xs">Next 7 days timeline</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-xl font-headline font-bold text-yellow-500">{collectionData.dueThisWeek.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">{collectionData.dueThisWeek.reduce((s, c) => s + c.balance, 0)} To Receive</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {collectionData.dueThisWeek.slice(0, 5).map((item) => {
                const customer = customers.find(c => c.id === item.customerId);
                return (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/50 group hover:bg-muted/40 transition-colors">
                    <div className="min-w-0">
                      <Link href={`/customers/${customer?.id}`} className="font-bold text-xs truncate block group-hover:text-primary transition-colors">
                        {customer?.name}
                      </Link>
                      <p className="text-[9px] text-muted-foreground">Due in {item.daysDiff} days</p>
                    </div>
                    <span className="text-xs font-bold text-yellow-500 whitespace-nowrap">{item.balance} To Receive</span>
                  </div>
                );
              })}
              {collectionData.dueThisWeek.length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-xs italic">No collections due this week.</div>
              )}
            </CardContent>
            <CardFooter className="pt-2 border-t border-border/50">
              <Button variant="ghost" className="w-full text-xs gap-2 font-bold h-10 hover:bg-muted" asChild>
                <Link href="/customers?filter=TO_RECEIVE">View Weekly Schedule <ExternalLink className="h-3 w-3" /></Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Overdue Customers */}
          <Card className="border-none shadow-xl bg-card border-t-4 border-t-destructive overflow-hidden flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" /> Overdue Customers
                  </CardTitle>
                  <CardDescription className="text-xs">Immediate action required</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-xl font-headline font-bold text-destructive">{collectionData.overdue.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">{collectionData.overdue.reduce((s, c) => s + c.balance, 0)} To Receive</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {collectionData.overdue.slice(0, 5).map((item) => {
                const customer = customers.find(c => c.id === item.customerId);
                return (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 border border-destructive/10 group hover:bg-destructive/10 transition-colors">
                    <div className="min-w-0">
                      <Link href={`/customers/${customer.id}`} className="font-bold text-sm hover:text-destructive transition-colors block truncate">
                        {customer?.name}
                      </Link>
                      <p className="text-[9px] text-destructive font-medium uppercase">{Math.abs(item.daysDiff)}d Overdue</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-xs font-bold text-destructive">{item.balance} To Receive</span>
                      {getOverdueBadge(item.daysDiff)}
                    </div>
                  </div>
                );
              })}
              {collectionData.overdue.length === 0 && (
                <div className="py-8 text-center text-emerald-500 text-xs italic font-bold">No overdue accounts! Great job.</div>
              )}
            </CardContent>
            <CardFooter className="pt-2 border-t border-border/50">
              <Button variant="ghost" className="w-full text-xs gap-2 font-bold h-10 hover:bg-muted text-destructive hover:text-destructive" asChild>
                <Link href="/customers?filter=OVERDUE">View All Overdue <ExternalLink className="h-3 w-3" /></Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Activity and History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <Card className="lg:col-span-2 border-none shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-6 px-4 md:px-6">
            <div>
              <CardTitle className="font-headline text-lg md:text-xl font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" /> Recent Logs
              </CardTitle>
              <CardDescription className="text-xs">Real-time ledger updates</CardDescription>
            </div>
            <Link href="/reports">
              <Button variant="ghost" size="sm" className="text-xs">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-6 p-0">
            <ScrollArea className="h-[400px]">
              <div className="px-4 md:px-6 space-y-4 pb-6">
                {recentActivity.length > 0 ? recentActivity.map((txn) => {
                  const customer = customers.find(c => c.id === txn.customerId);
                  const isInactive = customer?.status === 'inactive';
                  const impact = getTransactionImpact(txn.type);
                  return (
                    <div key={txn.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 group transition-all">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={cn("h-10 w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110", getTransactionColor(txn.type))}>
                          {getTransactionIcon(txn.type)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm truncate max-w-[120px] md:max-w-none">{customer?.name || "System"}</p>
                            {isInactive && <Badge variant="secondary" className="text-[7px] h-3 px-1 leading-none font-black uppercase">Inactive</Badge>}
                          </div>
                          <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{txn.type.replace('_', ' ')} • {txn.bsDate}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("font-headline font-bold text-sm md:text-base", impact > 0 ? "text-primary" : "text-emerald-500")}>
                          {impact > 0 ? '+' : '-'}{txn.quantity} PCS
                        </p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="py-20 text-center text-muted-foreground"><p className="text-sm">No recent movement</p></div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-card border-t-4 border-accent overflow-hidden">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="font-headline text-lg font-bold flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-accent" /> Contact Center
            </CardTitle>
            <CardDescription className="text-xs">Quick call actions for collections</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 px-4 md:px-6 pb-6 pt-2">
                {[...collectionData.overdue, ...collectionData.dueToday].length > 0 ? 
                  [...collectionData.overdue, ...collectionData.dueToday].map((txn) => {
                    const customer = customers.find(c => c.id === txn.customerId);
                    if (!customer) return null;
                    
                    return (
                      <div key={txn.id} className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4 hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="overflow-hidden">
                            <Link href={`/customers/${customer.id}`} className="font-bold text-sm hover:text-primary transition-colors block truncate">{customer.name}</Link>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Owed: <span className="font-bold text-primary">{txn.balance} To Receive</span></p>
                          </div>
                          {getOverdueBadge(txn.daysDiff)}
                        </div>
                        <Button size="sm" variant="outline" className="w-full h-9 px-4 text-[10px] gap-2 border-accent/20 hover:bg-accent hover:text-white" onClick={() => window.open(`tel:${customer.phone}`)}>
                          <PhoneCall className="h-3 w-3" /> Call {customer.phone}
                        </Button>
                      </div>
                    );
                  }) : (
                  <div className="py-20 text-center space-y-3">
                    <AlertCircle className="h-10 w-10 text-emerald-500 mx-auto opacity-40" />
                    <p className="text-sm text-muted-foreground">No priority calls needed</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
