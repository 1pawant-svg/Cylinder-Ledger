"use client";

import * as React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare, MessageCircle, AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { Customer, Setting } from "@/lib/types";
import { generateReminderMessage, openWhatsAppReminder, openSMSReminder } from "@/lib/services/reminder-service";

interface ReminderDialogProps {
  customer: Customer | null;
  settings: Setting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReminderDialog({ customer, settings, open, onOpenChange }: ReminderDialogProps) {
  const { t } = useI18n();

  if (!customer) return null;

  const message = generateReminderMessage(customer, settings);

  const handleWhatsApp = () => {
    openWhatsAppReminder(customer.phone, message);
    onOpenChange(false);
  };

  const handleSMS = () => {
    openSMSReminder(customer.phone, message);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {t('sendReminder')}
          </Dialog্ল্ডTitle>
          <DialogDescription>
            {t('reminderPreview')} for <strong>{customer.name}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-sm whitespace-pre-wrap font-mono leading-relaxed">
          {message}
        </div>

        {!customer.phone && (
          <div className="flex items-center gap-2 text-destructive text-xs font-bold mt-2">
            <AlertCircle className="h-4 w-4" />
            Invalid phone number detected.
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
          <Button 
            variant="outline" 
            className="flex-1 gap-2 border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" 
            onClick={handleWhatsApp}
            disabled={!customer.phone}
          >
            <MessageCircle className="h-4 w-4" /> {t('whatsappReminder')}
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 gap-2 border-primary/50 text-primary hover:bg-primary/5" 
            onClick={handleSMS}
            disabled={!customer.phone}
          >
            <MessageSquare className="h-4 w-4" /> {t('smsReminder')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
