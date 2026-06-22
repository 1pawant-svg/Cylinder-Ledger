
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
  TrendingDown,
  XCircle,
  AlertTriangle,
  Clock,
  LayoutDashboard,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  Activity,
  Phone
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const { customers, transactions, getCustomerBalance, loading } = useLedger();
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    const todayAD = getCurrentADDate();
    setTodayLabel(formatFullDate(todayAD));
  }, []);

  // Core liability metrics
  const toReceiveTotal = useMemo(() => 
    customers.reduce((sum, c) => sum + Math.max(0, getCustomerBalance(c.id)), 0),
    [customers, getCustomerBalance]
  );

  const toGiveTotal = useMemo(() => 
    customers.reduce((sum, c) => sum + Math.max(0, -getCustomerBalance(c.id)), 0),
    [customers, getCustomerBalance]
  );

  // Top 5 To Receive
  const topToReceive = useMemo(() => {
    return customers
      .map(c => ({ ...c, balance: getCustomerBalance(c.id) }))
      .filter(c => c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);
  }, [customers, getCustomerBalance]);

  // Top 5 To Give
  const topToGive = useMemo(() => {
    return customers
      .map(c => ({ ...c, balance: getCustomerBalance(c.id) }))
      .filter(c => c.balance < 0)
      .sort((a, b) => a.balance - b.balance)
      .slice(0, 5);
  }, [customers, getCustomerBalance]);

  // Collection logic filtered by balance > 0
  const collectionData = useMemo(() => {
    const today = getCurrentADDate();
    
    const collections = transactions
      .filter(t => t.status !== 'deleted' && t.dueDate && getTransactionImpact(t.type) === 1)
      .map(t => {
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
      .sort((a, b) => a.daysDiff - b.daysDiff);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <StatCard 
          title="To Receive" 
          value={`${toReceiveTotal} PCS`} 
          icon={Package} 
          description="Total outstanding cylinders"
          variant="primary"
          href="/customers?filter=TO_RECEIVE"
        />
        <StatCard 
          title="To Give" 
          value={`${toGiveTotal} PCS`} 
          icon={ArrowDownLeft} 
          description="Cylinders owed to customers"
          variant="warning"
          href="/customers?filter=TO_GIVE"
        />
      </div>

      {/* Top Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top To Receive */}
        <Card className="border-none shadow-xl bg-card">
          <CardHeader className="pb-3 px-4 md:px-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-headline text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> Top To Receive
                </CardTitle>
                <CardDescription className="text-xs">Highest outstanding balances</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-[10px] uppercase font-bold tracking-widest" asChild>
                <Link href="/customers?filter=TO_RECEIVE">Full List</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6 space-y-2">
            {topToReceive.map((c) => (
              <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors group">
                <span className="font-bold text-xs truncate group-hover:text-primary pr-2">{c.name}</span>
                <Badge className="bg-primary/10 text-primary border-none font-bold shrink-0">{c.balance} PCS</Badge>
              </Link>
            ))}
            {topToReceive.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-xs italic">
                No outstanding balances found.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top To Give */}
        <Card className="border-none shadow-xl bg-card">
          <CardHeader className="pb-3 px-4 md:px-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-headline text-lg font-bold flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-accent" /> Top To Give
                </CardTitle>
                <CardDescription className="text-xs">Cylinders owed to customers</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-[10px] uppercase font-bold tracking-widest" asChild>
                <Link href="/customers?filter=TO_GIVE">Full List</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6 space-y-2">
            {topToGive.map((c) => (
              <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors group">
                <span className="font-bold text-xs truncate group-hover:text-primary pr-2">{c.name}</span>
                <Badge className="bg-accent/10 text-accent border-none font-bold shrink-0">{Math.abs(c.balance)} PCS</Badge>
              </Link>
            ))}
            {topToGive.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-xs italic">
                No cylinders currently owed to customers.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unified Collection Schedule Widget */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-headline text-xl font-bold">Collection Schedule</h2>
        </div>
        
        <Card className="border-none shadow-xl bg-card overflow-hidden">
          <Tabs defaultValue="overdue" className="w-full">
            <CardHeader className="pb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <TabsList className="grid grid-cols-3 w-full md:w-[400px] h-11 bg-muted/50 p-1">
                  <TabsTrigger value="overdue" className="data-[state=active]:bg-background data-[state=active]:text-destructive font-bold text-xs gap-2">
                    Overdue <Badge variant="destructive" className="h-5 px-1.5 min-w-5 flex items-center justify-center">{collectionData.overdue.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="today" className="data-[state=active]:bg-background data-[state=active]:text-orange-500 font-bold text-xs gap-2">
                    Today <Badge className="h-5 px-1.5 min-w-5 flex items-center justify-center bg-orange-500">{collectionData.dueToday.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="weekly" className="data-[state=active]:bg-background data-[state=active]:text-yellow-500 font-bold text-xs gap-2">
                    Weekly <Badge className="h-5 px-1.5 min-w-5 flex items-center justify-center bg-yellow-500">{collectionData.dueThisWeek.length}</Badge>
                  </TabsTrigger>
                </TabsList>
                <div className="hidden md:block text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Priority Status</p>
                  <p className="text-xs font-medium text-muted-foreground">Updated in real-time</p>
                </div>
              </div>
            </CardHeader>

            <div className="px-6 pb-6">
              <TabsContent value="overdue" className="mt-4 space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="text-sm font-bold text-destructive">Critical Collections</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">{collectionData.overdue.reduce((s, c) => s + c.balance, 0)} Total PCS to Recover</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive font-bold gap-1 text-[10px]" asChild>
                    <Link href="/customers?filter=OVERDUE">View All <ChevronRight className="h-3 w-3" /></Link>
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {collectionData.overdue.slice(0, 6).map((item) => {
                    const customer = customers.find(c => c.id === item.customerId);
                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/50 group hover:bg-muted/40 transition-colors">
                        <div className="min-w-0 flex-1">
                          <Link href={`/customers/${customer?.id}`} className="font-bold text-xs truncate block group-hover:text-primary transition-colors">
                            {customer?.name}
                          </Link>
                          <p className="text-[10px] text-destructive font-bold uppercase">{Math.abs(item.daysDiff)}d Overdue</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-xs font-bold text-destructive">{item.balance} PCS</p>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => window.open(`tel:${customer?.phone}`)}>
                            <Phone className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {collectionData.overdue.length === 0 && (
                  <div className="py-12 text-center text-emerald-500 font-bold text-sm italic">All accounts are up to date!</div>
                )}
              </TabsContent>

              <TabsContent value="today" className="mt-4 space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex items-center justify-between p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-sm font-bold text-orange-500">Scheduled for Today</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">{collectionData.dueToday.reduce((s, c) => s + c.balance, 0)} Expected PCS Today</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-orange-500 font-bold gap-1 text-[10px]" asChild>
                    <Link href="/customers?filter=SETTLED">View Daily Log <ChevronRight className="h-3 w-3" /></Link>
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {collectionData.dueToday.slice(0, 6).map((item) => {
                    const customer = customers.find(c => c.id === item.customerId);
                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/50 group hover:bg-muted/40 transition-colors">
                        <div className="min-w-0 flex-1">
                          <Link href={`/customers/${customer?.id}`} className="font-bold text-xs truncate block group-hover:text-primary transition-colors">
                            {customer?.name}
                          </Link>
                          <p className="text-[10px] text-muted-foreground">{customer?.phone}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-xs font-bold text-orange-500">{item.balance} PCS</p>
                          {getOverdueBadge(item.daysDiff)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {collectionData.dueToday.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground text-sm italic">No collections scheduled for today.</div>
                )}
              </TabsContent>

              <TabsContent value="weekly" className="mt-4 space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="text-sm font-bold text-yellow-500">Upcoming This Week</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">{collectionData.dueThisWeek.reduce((s, c) => s + c.balance, 0)} Total PCS Pipeline</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-yellow-500 font-bold gap-1 text-[10px]" asChild>
                    <Link href="/customers?filter=TO_RECEIVE">View Schedule <ChevronRight className="h-3 w-3" /></Link>
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {collectionData.dueThisWeek.slice(0, 6).map((item) => {
                    const customer = customers.find(c => c.id === item.customerId);
                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/50 group hover:bg-muted/40 transition-colors">
                        <div className="min-w-0 flex-1">
                          <Link href={`/customers/${customer?.id}`} className="font-bold text-xs truncate block group-hover:text-primary transition-colors">
                            {customer?.name}
                          </Link>
                          <p className="text-[10px] text-muted-foreground">Due in {item.daysDiff} days</p>
                        </div>
                        <span className="text-xs font-bold text-yellow-500 shrink-0 ml-3">{item.balance} PCS</span>
                      </div>
                    );
                  })}
                </div>
                {collectionData.dueThisWeek.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground text-sm italic">No upcoming collections this week.</div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </Card>
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
                      <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                        <div className={cn("h-10 w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shrink-0", getTransactionColor(txn.type))}>
                          {getTransactionIcon(txn.type)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm truncate max-w-[120px] md:max-w-none">{customer?.name || "System"}</p>
                            {isInactive && <Badge variant="secondary" className="text-[7px] h-3 px-1 leading-none font-black uppercase">Inactive</Badge>}
                          </div>
                          <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-bold truncate">{txn.type.replace('_', ' ')} • {txn.bsDate}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
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
                          <div className="overflow-hidden min-w-0 flex-1">
                            <Link href={`/customers/${customer.id}`} className="font-bold text-sm hover:text-primary transition-colors block truncate">{customer.name}</Link>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Owed: <span className="font-bold text-primary">{txn.balance} To Receive</span></p>
                          </div>
                          <div className="shrink-0">
                            {getOverdueBadge(txn.daysDiff)}
                          </div>
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
