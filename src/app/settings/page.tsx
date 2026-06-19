
"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useFirestore, useUser } from "@/firebase";
import { saveSettings, getSettings } from "@/lib/services/settings-service";
import { logAction } from "@/lib/services/audit-service";
import { exportBackup, restoreBackup, BackupData } from "@/lib/services/backup-service";
import { Setting, UserProfile } from "@/lib/types";
import { getUserProfile } from "@/lib/services/user-service";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
  History
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

export default function SettingsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
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
        title: "Settings Saved",
        description: "Business configuration has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!db || !user || !profile) return;
    setBackingUp(true);
    try {
      const data = await exportBackup(db, user.uid, profile.fullName || 'User');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cylindera_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Backup Successful", description: "JSON backup file has been downloaded." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Backup Failed", description: error.message });
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
        toast({ title: "Restore Successful", description: "Database has been synchronized with the backup." });
        setTimeout(() => window.location.reload(), 1500);
      } catch (error: any) {
        toast({ variant: "destructive", title: "Restore Failed", description: error.message });
      } finally {
        setRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
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
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <header className="border-b border-border pb-6">
        <h1 className="font-headline text-4xl font-bold text-foreground">Settings & Maintenance</h1>
        <p className="text-muted-foreground mt-1 font-medium">Configure business identity and manage system data</p>
      </header>

      <Card className="border-none shadow-2xl bg-card">
        <CardHeader>
          <CardTitle className="font-headline text-2xl font-bold flex items-center gap-2 text-primary">
            <Building2 className="h-6 w-6" /> Business Identity
          </CardTitle>
          <CardDescription>This information will appear on generated customer statements and reports.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
                Business Name
              </Label>
              <Input 
                value={settings.businessName}
                onChange={e => setSettings({...settings, businessName: e.target.value})}
                placeholder="e.g. Sagarmatha Gas House"
                className="bg-background h-12"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
                <Phone className="h-3 w-3" /> Contact Phone
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
            <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
              <MapPin className="h-3 w-3" /> Address
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
              <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
                <Hash className="h-3 w-3" /> PAN / VAT Number
              </Label>
              <Input 
                value={settings.panNumber}
                onChange={e => setSettings({...settings, panNumber: e.target.value})}
                placeholder="9-digit PAN number"
                className="bg-background h-12"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
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
        <CardFooter className="bg-muted/10 border-t border-border p-6 flex justify-between items-center">
          <p className="text-xs text-muted-foreground italic max-w-[60%]">
            Last updated config affects all new PDF statements.
          </p>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-primary text-primary-foreground font-bold h-12 px-8 flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Configuration
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-none shadow-2xl bg-card border-l-4 border-l-accent">
        <CardHeader>
          <CardTitle className="font-headline text-2xl font-bold flex items-center gap-2 text-accent">
            <Database className="h-6 w-6" /> Data Management
          </CardTitle>
          <CardDescription>Export backups or restore data from a local JSON file.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-border/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Download className="h-5 w-5" />
              </div>
              <h3 className="font-bold">System Backup</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Downloads a complete snapshot of your customers, transactions, and settings. Recommended weekly for safety.
            </p>
            <Button 
              variant="outline" 
              className="w-full h-12 border-primary/20 text-primary hover:bg-primary/5 font-bold"
              onClick={handleExport}
              disabled={backingUp}
            >
              {backingUp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Export as JSON
            </Button>
          </div>

          <div className="space-y-4 p-4 rounded-xl bg-accent/5 border border-accent/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-accent/10 text-accent">
                <Upload className="h-5 w-5" />
              </div>
              <h3 className="font-bold">Database Restore</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload a previous backup file to restore your system. <span className="text-accent font-bold">Warning:</span> This will overwrite existing data matches.
            </p>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full h-12 border-accent/20 text-accent hover:bg-accent hover:text-white font-bold"
                  disabled={restoring}
                >
                  {restoring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Restore from File
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-accent" /> Confirm Restore?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Restoring data will merge backup records with your current database. This action is irreversible and should only be done if you are certain about the backup file's content.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRestoreClick} className="bg-accent text-white hover:bg-accent/90">
                    I Understand, Proceed
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/5 p-6 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <History className="h-3 w-3" />
            Last Maintenance: <span className="font-bold">{new Date().toLocaleDateString()}</span>
          </div>
          <Badge variant="outline" className="text-[10px] opacity-70">
            SECURE BS SYNC • ATOMIC WRITES
          </Badge>
        </CardFooter>
      </Card>
    </div>
  );
}
