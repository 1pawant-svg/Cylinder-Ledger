'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { getSettings, saveSettings } from '@/lib/services/settings-service';
import { exportBackup } from '@/lib/services/backup-service';
import { Setting, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/services/user-service';
import { useI18n } from '@/lib/i18n-context';
import { getCurrentADDate, getDifferenceInDays, isBSMonthEnd, adToBs } from '@/lib/date-utils';
import { AlertTriangle, Download, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export function BackupReminderBanner() {
  const db = useFirestore();
  const { user } = useUser();
  const { t } = useI18n();
  const { toast } = useToast();
  const pathname = usePathname();

  const [settings, setSettings] = useState<Setting | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!db || !user) return;
      const [s, p] = await Promise.all([
        getSettings(db),
        getUserProfile(db, user.uid)
      ]);
      setSettings(s);
      setProfile(p);
      setMounted(true);
    }
    loadData();
  }, [db, user]);

  const backupStatus = useMemo(() => {
    if (!mounted || !settings) return { due: false, days: 0, reason: '' };

    const today = getCurrentADDate();
    const lastBackupAt = settings.lastBackupAt ? (typeof settings.lastBackupAt === 'object' && 'toDate' in settings.lastBackupAt ? (settings.lastBackupAt as any).toDate().toISOString().split('T')[0] : String(settings.lastBackupAt).split('T')[0]) : null;

    if (!lastBackupAt) return { due: true, days: 99, reason: 'first' };

    const daysSince = getDifferenceInDays(lastBackupAt, today);
    const monthEnd = isBSMonthEnd();
    
    // Logic: Remind if >= 15 days OR if month end and last backup wasn't today
    const due15Days = daysSince >= 15;
    const dueMonthEnd = monthEnd && daysSince > 0;

    return {
      due: due15Days || dueMonthEnd,
      days: daysSince,
      reason: dueMonthEnd ? 'monthEnd' : '15days'
    };
  }, [mounted, settings]);

  const handleBackupNow = async () => {
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
        
        // Refresh local settings to hide banner
        const updatedSettings = await getSettings(db);
        setSettings(updatedSettings);

        toast({ title: t('success'), description: t('backupSuccess') });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: t('error'), description: error.message });
    } finally {
      setBackingUp(false);
    }
  };

  if (!mounted || !backupStatus.due || pathname === '/login') return null;

  return (
    <div className="bg-accent text-accent-foreground py-3 px-4 shadow-lg sticky top-0 z-[60] animate-in slide-in-from-top duration-500">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-full shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <p className="font-bold text-sm leading-tight">
              {backupStatus.reason === 'monthEnd' ? t('backupDueMonthEnd') : t('backupDue15Days')}
            </p>
            <p className="text-[10px] opacity-90 uppercase tracking-widest font-bold">
              {t('daysSinceLastBackup')}: {backupStatus.days} • {t('lastBackupDate')}: {settings?.lastBackupAt ? adToBs(settings.lastBackupAt instanceof Date ? settings.lastBackupAt.toISOString().split('T')[0] : (settings.lastBackupAt as any).toDate().toISOString().split('T')[0]) : 'None'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button 
            onClick={handleBackupNow} 
            disabled={backingUp}
            className="w-full md:w-auto bg-white text-accent hover:bg-white/90 font-bold gap-2 h-10"
          >
            {backingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t('backupNow')}
          </Button>
        </div>
      </div>
    </div>
  );
}
