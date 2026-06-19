"use client";

import * as React from "react";
import { Plus, Users, Search, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();

  // Don't show on login page
  if (pathname === "/login") return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-4 py-2 flex items-center justify-around shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
      <Link href="/customers" className="flex flex-col items-center gap-1">
        <div className={cn(
          "p-2 rounded-xl transition-colors",
          pathname === "/customers" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
        )}>
          <Search className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-tight">Search</span>
      </Link>

      <Link href="/transactions" className="relative -top-6">
        <div className="bg-primary text-primary-foreground h-14 w-14 rounded-full flex items-center justify-center shadow-lg shadow-primary/40 border-4 border-background animate-in zoom-in duration-300">
          <Plus className="h-8 w-8" />
        </div>
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-tighter whitespace-nowrap text-primary">New Log</span>
      </Link>

      <Link href="/customers?add=true" className="flex flex-col items-center gap-1">
        <div className={cn(
          "p-2 rounded-xl transition-colors",
          pathname === "/customers" && pathname.includes('add=true') ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
        )}>
          <Users className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-tight">+ Customer</span>
      </Link>
    </div>
  );
}
