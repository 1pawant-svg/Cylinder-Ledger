
"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useFirestore, useUser, useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { getSettings } from "@/lib/services/settings-service";
import { getUserProfile } from "@/lib/services/user-service";
import { exportBackup, restoreBackup, BackupData } from "@/lib/services/backup-service";
import { Setting, UserProfile } from "@/lib/types";
import { useI18n } from "@/lib/i18n-context";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  User, 
  Database, 
  LogOut, 
  ChevronRight, 
  Download, 
  Upload, 
  History,
  ShieldCheck,
  MapPin,
  Phone,
  Loader2,
  AlertTriangle,
  Languages
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

export default function MorePage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const { t, language, setLanguage } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<Setting | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!db || !user) return;
      const [fetchedSettings, fetchedProfile] = await Promise.all([
        getSettings(db),
        getUserProfile(db, user.uid)
      ]);
      setSettings(fetchedSettings);
      setProfile(fetchedProfile);
      setLoading(false);
    }
    loadData();
  }, [db, user]);

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push("/login");
  };

  const handleExport = async () => {
    if (!db || !user || !profile) return;
    setBackingUp(true);
    try {
      const data = await exportBackup(db, user.uid, profile.fullName || 'User');
      if (data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cylindera_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: t('success') });
      }
    } catch (error: any) {
      if (error.code !== 'permission-denied') {
        toast({ variant: "destructive", title: t('error'), description: error.message });
      }
    } finally {
      setBackingUp(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !db || !user || !profile) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      setRestoring(true);
      try {
        const content = e.target?.result as string;
        const backupData: BackupData = JSON.parse(content);
        await restoreBackup(db, backupData, user.uid, profile.fullName || 'User');
        toast({ title: t('success') });
        setTimeout(() => window.location.reload(), 1500);
      } catch (error: any) {
        if (error.code !== 'permission-denied') {
          toast({ variant: "destructive", title: t('error'), description: error.message });
        }
      } finally {
        setRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24 md:hidden animate-in fade-in duration-500">
      <header className="py-2">
        <h1 className="font-headline text-3xl font-bold text-primary">{t('menu')}</h1>
        <p className="text-muted-foreground text-xs uppercase tracking-widest font-bold">{t('systemOptions')}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1">{t('language')}</h2>
        <Card className="border-none shadow-md bg-card p-4">
          <div className="flex items-center gap-4">
            <Languages className="h-5 w-5 text-primary" />
            <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
              <SelectTrigger className="flex-1 h-11 bg-muted/20 border-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t('english')}</SelectItem>
                <SelectItem value="ne">{t('nepali')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>
      </section>

      <Card className="border-none shadow-lg bg-card overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 flex items-center gap-4 bg-muted/20">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <User className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg truncate">{profile?.fullName || "System User"}</h3>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold uppercase border-primary/20 text-primary">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1">{t('businessIdentity')}</h2>
        <Card className="border-none shadow-md bg-card">
          <CardContent className="p-0 divide-y divide-border/50">
            <div className="p-4 flex items-start gap-4" onClick={() => router.push('/settings')}>
              <Building2 className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{t('company')}</p>
                <p className="text-sm font-bold">{settings?.businessName || "No Business Name Set"}</p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" /> {settings?.address || "No address set"}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> {settings?.phone || "No phone set"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground self-center" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1">{t('systemMaintenance')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="h-24 flex-col gap-2 border-border/50 bg-card hover:bg-muted/50"
            onClick={handleExport}
            disabled={backingUp}
          >
            {backingUp ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5 text-primary" />}
            <span className="text-[10px] font-bold uppercase tracking-widest">{t('backup')}</span>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="h-24 flex-col gap-2 border-border/50 bg-card hover:bg-muted/50"
                disabled={restoring}
              >
                {restoring ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 text-accent" />}
                <span className="text-[10px] font-bold uppercase tracking-widest">{t('restore')}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="w-[90vw] max-w-sm rounded-xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-accent" /> Confirm Restore?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs">
                  This will overwrite matches in your current database. Proceed only with a valid JSON backup.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
                <AlertDialogAction onClick={() => fileInputRef.current?.click()} className="bg-accent text-white w-full">Select File</AlertDialogAction>
                <AlertDialogCancel className="w-full">Cancel</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1">Quick Links</h2>
        <Card className="border-none shadow-md bg-card">
          <CardContent className="p-0 divide-y divide-border/50">
            <Button 
              variant="ghost" 
              className="w-full justify-between h-14 px-4 font-bold rounded-none"
              onClick={() => router.push('/settings')}
            >
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-primary" />
                <span className="text-sm">Full Settings</span>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-between h-14 px-4 font-bold rounded-none"
              asChild
            >
              <a href="https://firebase.google.com" target="_blank" rel="noreferrer">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm">Security & Access</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <div className="pt-4">
        <Button 
          variant="destructive" 
          className="w-full h-14 gap-2 font-headline text-lg font-bold shadow-lg shadow-destructive/20"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" /> {t('logout')}
        </Button>
        <p className="text-center text-[10px] text-muted-foreground mt-4 uppercase tracking-[0.3em] font-bold opacity-50">
          Cylindera Pro • Version 1.2
        </p>
      </div>
    </div>
  );
}
