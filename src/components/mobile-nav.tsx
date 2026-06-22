"use client";

import * as React from "react";
import { 
  Home, 
  Users, 
  Plus, 
  FileText, 
  MoreHorizontal 
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n-context";

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  // Don't show on login page
  if (pathname === "/login") return null;

  const navItems = [
    { label: t('dashboard'), href: "/", icon: Home },
    { label: t('customers'), href: "/customers", icon: Users },
    { label: t('newTransaction'), href: "/transactions", icon: Plus, isAction: true },
    { label: t('reports'), href: "/reports", icon: FileText },
    { label: t('more'), href: "/more", icon: MoreHorizontal },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border px-2 pb-safe pt-2 flex items-center justify-around shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        
        if (item.isAction) {
          return (
            <Link key={item.label} href={item.href} className="relative -top-5 flex flex-col items-center">
              <div className="bg-primary text-primary-foreground h-14 w-14 rounded-full flex items-center justify-center shadow-lg shadow-primary/40 border-4 border-background ring-2 ring-primary/20 animate-in zoom-in duration-300">
                <Plus className="h-8 w-8" />
              </div>
              <span className="mt-1 text-[8px] font-black uppercase tracking-tighter text-primary whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          );
        }

        return (
          <Link 
            key={item.label} 
            href={item.href} 
            className={cn(
              "flex flex-col items-center gap-1 min-w-[64px] transition-colors py-1",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className={cn("h-5 w-5", isActive && "animate-in fade-in zoom-in duration-300")} />
            <span className="text-[8px] font-bold uppercase tracking-tight whitespace-nowrap">
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
