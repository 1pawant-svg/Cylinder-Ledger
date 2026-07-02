
"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useLedger } from "@/lib/ledger-context";
import { StatCard } from "@/components/dashboard/stat-card";
import { useI18n } from "@/lib/i18n-context";
import { 
  Package, 
  ArrowUpRight, 
  ArrowDownLeft, 
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
  Phone,
  UserCheck,
  Building2
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { formatFullDate, getCurrentADDate, toMillis, getDifferenceInDays } from "@/lib/date-utils";
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

const getOverdueBadge = (daysDiff: number, t: any) => {
  if (daysDiff === 0) return <Badge className="bg-orange-500 text-white text-[10px] font-bold">{t('today')}</Badge>;
  const absDays = Math.abs(daysDiff);
  if (absDays >= 30) return <Badge variant="destructive" className="text-[10px] font-bold">{t('overdue')} 30+ Days</Badge>;
  if (absDays >= 10) return <Badge variant="destructive" className="bg-red-600 text-white text-[10px] font-bold">{t('overdue')} 10 Days</Badge>;
  if (absDays >= 3) return <Badge variant="destructive" className="bg-red-400 text-white text-[10px] font-bold">{t('overdue')} 3 Days</Badge>;
  return <Badge variant="destructive" className="bg-red-300 text-white text-[10px] font-bold">{t('overdue')}</Badge>;
};

export default function Dashboard() {
  const { customers, transactions, loading } = useLedger();
  const { t } = useI18n();
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    setTodayLabel(formatFullDate(getCurrentADDate()));
  }, []);

  const coreStats = useMemo(() => {
    let toReceiveTotal = 0;
    let toGiveTotal = 0;
    const sortedByBalance = [...customers].sort((a, b) => (b.balance || 0) - (a.balance || 0));
    
    customers.forEach(c => {
      const bal = c.balance || 0;
      if (bal > 0) toReceiveTotal += bal;
      else if (bal < 0) toGiveTotal += Math.abs(bal);
    });

    const topToReceive = sortedByBalance.filter(c => (c.balance || 0) > 0).slice(0, 5);
    const topToGive = sortedByBalance.filter(c => (c.balance || 0) < 0).reverse().slice(0, 5);
    
    const topToReceiveNonRetailers = sortedByBalance
      .filter(c => (c.balance || 0) > 0 && (!c.pan || c.pan.trim().length === 0))
      .slice(0, 5);

    return { toReceiveTotal, toGiveTotal, topToReceive, topToGive, topToReceiveNonRetailers };
  }, [customers]);

  const collectionData = useMemo(() => {
    const today = getCurrentADDate();
    
    const collections = transactions
      .filter(t => t.status !== 'deleted' && t.dueDate && (t.type === 'OUT_FULL' || t.type === 'OUT'))
      .map(t => {
        const customer = customers.find(c => c.id === t.customerId);
        const bal = customer?.balance || 0;
        if (bal <= 0) return null;

        return {
          ...t,
          balance: bal,
          daysDiff: getDifferenceInDays(today, t.dueDate!)
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const overdue = collections.filter(c => c.daysDiff < 0).sort((a, b) => a.daysDiff - b.daysDiff);
    const dueToday = collections.filter(c => c.daysDiff === 0).sort((a, b) => b.balance - a.balance);
    const dueThisWeek = collections.filter(c => c.daysDiff > 0 && c.daysDiff <= 7).sort((a, b) => a.daysDiff - b.daysDiff);

    return { overdue, dueToday, dueThisWeek };
  }, [transactions, customers]);

  const recentActivity = useMemo(() => {
    return [...transactions]
      .filter(t => t.status !== 'deleted')
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
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 pb-24 md:pb-8 w-full max-w-full overflow-x-hidden">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center md:hidden shrink-0">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-headline text-2xl md:text-4xl font-bold text-primary truncate">{t('overview')}</h1>
            <p className="text-muted-foreground text-xs md:text-sm font-medium truncate">{todayLabel || "Loading date..."}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/transactions" className="w-full md:w-auto">
            <Button className="w-full md:w-auto bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-lg shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
              {t('newTransaction')}
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        <StatCard 
          title={t('toReceive')} 
          value={`${coreStats.toReceiveTotal} ${t('pcs')}`} 
          icon={Package} 
          description={t('totalOutstanding')}
          variant="primary"
          href="/customers?filter=TO_RECEIVE"
        />
        <StatCard 
          title={t('toGive')} 
          value={`${coreStats.toGiveTotal} ${t('pcs')}`} 
          icon={ArrowDownLeft} 
          description={t('owedToCustomers')}
          variant="secondary"
          href="/customers?filter=TO_GIVE"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl bg-card min-w-0">
          <CardHeader className="pb-3 px-4 md:px-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="font-headline text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary shrink-0" /> <span className="truncate">{t('topToReceive')}</span>
                </CardTitle>
                <CardDescription className="text-xs truncate">{t('highestOutstanding')}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-[10px] uppercase font-bold tracking-widest shrink-0" asChild>
                <Link href="/customers?filter=TO_RECEIVE">{t('fullList')}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6 space-y-2">
            {coreStats.topToReceive.map((c) => (
              <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors group gap-2">
                <span className="font-bold text-xs truncate group-hover:text-primary min-w-0">{c.name}</span>
                <Badge className="bg-primary/10 text-primary border-none font-bold shrink-0">{c.balance} {t('pcs')}</Badge>
              </Link>
            ))}
            {coreStats.topToReceive.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-xs italic">No outstanding balances.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-card min-w-0">
          <CardHeader className="pb-3 px-4 md:px-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="font-headline text-lg font-bold flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-emerald-500 shrink-0" /> <span className="truncate">{t('topToReceiveNonRetailers')}</span>
                </CardTitle>
                <CardDescription className="text-xs truncate">{t('nonRetailersOutstanding')}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-[10px] uppercase font-bold tracking-widest shrink-0" asChild>
                <Link href="/customers?filter=NON_RETAILERS">{t('fullList')}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6 space-y-2">
            {coreStats.topToReceiveNonRetailers.map((c) => (
              <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors group gap-2">
                <span className="font-bold text-xs truncate group-hover:text-primary min-w-0">{c.name}</span>
                <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-bold shrink-0">{c.balance} {t('pcs')}</Badge>
              </Link>
            ))}
            {coreStats.topToReceiveNonRetailers.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-xs italic">No individual outstanding.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-card min-w-0">
          <CardHeader className="pb-3 px-4 md:px-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="font-headline text-lg font-bold flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-emerald-500 shrink-0" /> <span className="truncate">{t('topToGive')}</span>
                </CardTitle>
                <CardDescription className="text-xs truncate">{t('owedToCustomers')}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-[10px] uppercase font-bold tracking-widest shrink-0" asChild>
                <Link href="/customers?filter=TO_GIVE">{t('fullList')}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6 space-y-2">
            {coreStats.topToGive.map((c) => (
              <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors group gap-2">
                <span className="font-bold text-xs truncate group-hover:text-primary min-w-0">{c.name}</span>
                <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-bold shrink-0">{Math.abs(c.balance)} {t('pcs')}</Badge>
              </Link>
            ))}
            {coreStats.topToGive.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-xs italic">No cylinders owed.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-headline text-xl font-bold">{t('collectionSchedule')}</h2>
        </div>
        
        <Card className="border-none shadow-xl bg-card overflow-hidden">
          <Tabs defaultValue="overdue" className="w-full">
            <CardHeader className="pb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <TabsList className="grid grid-cols-3 w-full md:w-[450px] h-11 bg-muted/50 p-1">
                  <TabsTrigger value="overdue" className="data-[state=active]:bg-background data-[state=active]:text-destructive font-bold text-xs gap-1 md:gap-2">
                    {t('overdue')} <Badge variant="destructive" className="h-5 px-1.5 min-w-5 flex items-center justify-center">{collectionData.overdue.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="today" className="data-[state=active]:bg-background data-[state=active]:text-orange-500 font-bold text-xs gap-1 md:gap-2">
                    {t('today')} <Badge className="h-5 px-1.5 min-w-5 flex items-center justify-center bg-orange-500">{collectionData.dueToday.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="weekly" className="data-[state=active]:bg-background data-[state=active]:text-yellow-500 font-bold text-xs gap-1 md:gap-2">
                    {t('weekly')} <Badge className="h-5 px-1.5 min-w-5 flex items-center justify-center bg-yellow-500">{collectionData.dueThisWeek.length}</Badge>
                  </TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>

            <div className="px-2 md:px-6 pb-6">
              <TabsContent value="overdue" className="mt-4 space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {collectionData.overdue.slice(0, 9).map((item) => {
                    const customer = customers.find(c => c.id === item.customerId);
                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/50 group hover:bg-muted/40 transition-colors gap-2">
                        <div className="min-w-0 flex-1">
                          <Link href={`/customers/${customer?.id}`} className="font-bold text-xs truncate block group-hover:text-primary transition-colors">{customer?.name}</Link>
                          <p className="text-[10px] text-destructive font-bold uppercase">{Math.abs(item.daysDiff)}d {t('overdue')}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-destructive">{item.balance} {t('pcs')}</p>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(`tel:${customer?.phone}`)}><Phone className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {collectionData.overdue.length === 0 && <div className="py-12 text-center text-emerald-500 font-bold text-sm italic">{t('allUpToDate')}</div>}
              </TabsContent>

              <TabsContent value="today" className="mt-4 space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {collectionData.dueToday.slice(0, 9).map((item) => {
                    const customer = customers.find(c => c.id === item.customerId);
                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/50 group hover:bg-muted/40 transition-colors gap-2">
                        <div className="min-w-0 flex-1">
                          <Link href={`/customers/${customer?.id}`} className="font-bold text-xs truncate block group-hover:text-primary transition-colors">{customer?.name}</Link>
                          <p className="text-[10px] text-muted-foreground truncate">{customer?.phone}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-orange-500">{item.balance} {t('pcs')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {collectionData.dueToday.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm italic">{t('noCollectionsToday')}</div>}
              </TabsContent>

              <TabsContent value="weekly" className="mt-4 space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {collectionData.dueThisWeek.slice(0, 9).map((item) => {
                    const customer = customers.find(c => c.id === item.customerId);
                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/50 group hover:bg-muted/40 transition-colors gap-2">
                        <div className="min-w-0 flex-1">
                          <Link href={`/customers/${customer?.id}`} className="font-bold text-xs truncate block group-hover:text-primary transition-colors">{customer?.name}</Link>
                          <p className="text-[10px] text-muted-foreground">Due in {item.daysDiff} days</p>
                        </div>
                        <span className="text-xs font-bold text-yellow-500 shrink-0">{item.balance} {t('pcs')}</span>
                      </div>
                    );
                  })}
                </div>
                {collectionData.dueThisWeek.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm italic">{t('noUpcomingCollections')}</div>}
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <Card className="lg:col-span-2 border-none shadow-xl bg-card/50 backdrop-blur-sm min-w-0">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-6 px-4 md:px-6">
            <div className="min-w-0">
              <CardTitle className="font-headline text-lg md:text-xl font-bold flex items-center gap-2"><History className="h-5 w-5 shrink-0" /> <span className="truncate">{t('recentLogs')}</span></CardTitle>
            </div>
            <Link href="/reports" className="shrink-0"><Button variant="ghost" size="sm" className="text-xs">{t('viewAll')}</Button></Link>
          </CardHeader>
          <CardContent className="pt-6 p-0">
            <ScrollArea className="h-[400px]">
              <div className="px-4 md:px-6 space-y-4 pb-6">
                {recentActivity.length > 0 ? recentActivity.map((txn) => {
                  const customer = customers.find(c => c.id === txn.customerId);
                  const bal = customer?.balance || 0;
                  return (
                    <div key={txn.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 group gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", getTransactionColor(txn.type))}>
                          {getTransactionIcon(txn.type)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{customer?.name || "System"}</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold truncate">{txn.type.replace('_', ' ')} • {txn.bsDate}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("font-headline font-bold text-sm", bal > 0 ? "text-primary" : "text-emerald-500")}>{txn.quantity} {t('pcs')}</p>
                      </div>
                    </div>
                  );
                }) : <div className="py-20 text-center text-muted-foreground">No recent movement</div>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-card border-t-4 border-accent overflow-hidden min-w-0">
          <CardHeader className="px-4 md:px-6"><CardTitle className="font-headline text-lg font-bold flex items-center gap-2"><PhoneCall className="h-5 w-5 text-accent shrink-0" /> <span className="truncate">{t('contactCenter')}</span></CardTitle></CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 px-4 md:px-6 pb-6 pt-2">
                {[...collectionData.overdue, ...collectionData.dueToday].slice(0, 10).map((txn) => {
                  const customer = customers.find(c => c.id === txn.customerId);
                  if (!customer) return null;
                  return (
                    <div key={txn.id} className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4 hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1"><Link href={`/customers/${customer.id}`} className="font-bold text-sm truncate block">{customer.name}</Link>
                          <p className="text-[10px] text-muted-foreground truncate">{t('owed')}: <span className="font-bold text-primary">{customer.balance} {t('pcs')}</span></p>
                        </div>
                        <div className="shrink-0">{getOverdueBadge(txn.daysDiff, t)}</div>
                      </div>
                      <Button size="sm" variant="outline" className="w-full h-9 text-[10px] gap-2" onClick={() => window.open(`tel:${customer.phone}`)}><PhoneCall className="h-3 w-3" /> {t('call')} {customer.phone}</Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
