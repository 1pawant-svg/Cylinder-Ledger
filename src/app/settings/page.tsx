"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useFirestore, useUser } from "@/firebase";
import { saveSettings, getSettings } from "@/lib/services/settings-service";
import { logAction } from "@/lib/services/audit-service";
import { exportBackup, restoreBackup, clearDatabase, BackupData } from "@/lib/services/backup-service";
import { Setting, UserProfile } from "@/lib/types";
import { getUserProfile } from "@/lib/services/user-service";
import { useI18n } from "@/lib/i18n-context";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  MapPin, 
  Phone, 
  Hash, 
  Percent, 
  Save, 
  Loader2, 
  Download, 
  Upload, 
  Database,
  AlertTriangle,
  History,
  Languages,
  Trash2
} from "lucide-react";
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

export default function SettingsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { t, language, setLanguage } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<Setting>({
    businessName: "",
    address: "",
    phone: "",
    panNumber: "",
    vatPercentage: 13,
  });

  useEffect(() => {
    async function loadData() {
      if (!db || !user) return;
      
      const [fetchedSettings, fetchedProfile] = await Promise.all([
        getSettings(db),
        getUserProfile(db, user.uid)
      ]);

      if (fetchedSettings) setSettings(fetchedSettings);
      if (fetchedProfile) setProfile(fetchedProfile);
      setLoading(false);
    }
    loadData();
  }, [db, user]);

  const handleSave = async () => {
    if (!db || !user || !profile) return;
    setSaving(true);
    
    try {
      saveSettings(db, settings);
      
      logAction(db, {
        userId: user.uid,
        userName: profile.fullName || "User",
        action: "UPDATE_SETTINGS",
        entityType: "SETTING",
        entityId: "config",
        details: `Updated business settings for ${settings.businessName}`,
      });

      toast({
        title: t('settingsSaved'),
        description: "Business configuration has been updated successfully.",
      });
    } catch (error: any) {
      if (error.code !== 'permission-denied') {
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: error.message,
        });
      }
    } finally {
      setSaving(false);
    }
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
        toast({ title: t('success'), description: "JSON backup file has been downloaded." });
      }
    } catch (error: any) {
      if (error.code !== 'permission-denied') {
        toast({ variant: "destructive", title: t('error'), description: error.message });
      }
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
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
        
        if (!backupData.customers || !backupData.transactions) {
          throw new Error("Invalid backup format.");
        }

        await restoreBackup(db, backupData, user.uid, profile.fullName || 'User');
        toast({ title: t('success'), description: "Database has been synchronized with the backup." });
        setTimeout(() => window.location.reload(), 1500);
      } catch (error: any) {
        if (error.code !== 'permission-denied') {
          toast({ variant: "destructive", title: t('error'), description: error.message });
        }
      } finally {
        setRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleWipeData = async () => {
    if (!db || !user || !profile) return;
    setWiping(true);
    try {
      await clearDatabase(db, user.uid, profile.fullName || 'User');
      toast({ title: t('dataWiped'), description: "All business records have been removed." });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      if (error.code !== 'permission-denied') {
        toast({ variant: "destructive", title: t('error'), description: error.message });
      }
    } finally {
      setWiping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto pb-24 md:pb-8">
      <header className="border-b border-border pb-6">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground">{t('settings')} & {t('restore')}</h1>
        <p className="text-muted-foreground mt-1 font-medium">Configure business identity and manage system data</p>
      </header>

      <Card className="border-none shadow-2xl bg-card border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="font-headline text-2xl font-bold flex items-center gap-2 text-primary">
            <Languages className="h-6 w-6" /> {t('language')}
          </CardTitle>
          <CardDescription>Select your preferred language for the application interface.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('language')}</Label>
            <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
              <SelectTrigger className="h-12 bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t('english')}</SelectItem>
                <SelectItem value="ne">{t('nepali')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-2xl bg-card">
        <CardHeader>
          <CardTitle className="font-headline text-2xl font-bold flex items-center gap-2 text-primary">
            <Building2 className="h-6 w-6" /> {t('businessIdentity')}
          </CardTitle>
          <CardDescription>
            This information appears on WhatsApp statements and PDF reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">
                {t('company')}
              </Label>
              <Input 
                value={settings.businessName}
                onChange={e => setSettings({...settings, businessName: e.target.value})}
                placeholder="e.g. Sagarmatha Gas House"
                className="bg-background h-12"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">
                <Phone className="h-3 w-3" /> {t('phone')}
              </Label>
              <Input 
                value={settings.phone}
                onChange={e => setSettings({...settings, phone: e.target.value})}
                placeholder="01-XXXXXXX"
                className="bg-background h-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">
              <MapPin className="h-3 w-3" /> {t('address')}
            </Label>
            <Input 
              value={settings.address}
              onChange={e => setSettings({...settings, address: e.target.value})}
              placeholder="Full physical address"
              className="bg-background h-12"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">
                <Hash className="h-3 w-3" /> {t('pan')}
              </Label>
              <Input 
                value={settings.panNumber}
                onChange={e => setSettings({...settings, panNumber: e.target.value})}
                placeholder="9-digit PAN number"
                className="bg-background h-12"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-1">
                <Percent className="h-3 w-3" /> Default VAT (%)
              </Label>
              <Input 
                type="number"
                value={settings.vatPercentage}
                onChange={e => setSettings({...settings, vatPercentage: parseFloat(e.target.value) || 0})}
                placeholder="13"
                className="bg-background h-12"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/10 border-t border-border p-6 flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-primary text-primary-foreground font-bold h-12 px-8 flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('saveConfiguration')}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-none shadow-2xl bg-card">
        <CardHeader>
          <CardTitle className="font-headline text-2xl font-bold flex items-center gap-2 text-primary">
            <Database className="h-6 w-6" /> {t('systemMaintenance')}
          </CardTitle>
          <CardDescription>Export backups or restore data from a local JSON file.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-border/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Download className="h-5 w-5" />
              </div>
              <h3 className="font-bold">{t('backup')}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Downloads a complete snapshot of your customers, transactions, and settings.
            </p>
            <Button 
              variant="outline" 
              className="w-full h-12 border-primary/20 text-primary hover:bg-primary/5 font-bold"
              onClick={handleExport}
              disabled={backingUp}
            >
              {backingUp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              {t('backup')} (JSON)
            </Button>
          </div>

          <div className="space-y-4 p-4 rounded-xl bg-muted/10 border border-border/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Upload className="h-5 w-5" />
              </div>
              <h3 className="font-bold">{t('restore')}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload a previous backup file to restore your system.
            </p>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full h-12 border-primary/20 text-primary hover:bg-primary/5 font-bold"
                  disabled={restoring}
                >
                  {restoring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  {t('restore')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" /> Confirm Restore?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Restoring data will merge backup records with your current database. Proceed with caution.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRestoreClick} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Proceed
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-2xl bg-card border-l-4 border-l-destructive">
        <CardHeader>
          <CardTitle className="font-headline text-2xl font-bold flex items-center gap-2 text-destructive">
            <Trash2 className="h-6 w-6" /> {t('dangerZone')}
          </CardTitle>
          <CardDescription>Permanently remove all business data to start fresh.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('wipeDescription')}
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="w-full h-12 font-bold shadow-lg shadow-destructive/20"
                  disabled={wiping}
                >
                  {wiping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  {t('wipeData')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" /> Final Warning
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This is a factory reset. You will lose all your customers and transaction logs. Are you absolutely sure?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                  <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleWipeData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto">
                    {t('confirmWipe')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}