"use client";

import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isUp: boolean;
  };
  variant?: 'default' | 'accent' | 'primary' | 'warning' | 'destructive';
  href?: string;
}

export function StatCard({ title, value, icon: Icon, description, trend, variant = 'default', href }: StatCardProps) {
  const colorMap = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    warning: "bg-amber-500/10 text-amber-500",
    destructive: "bg-destructive/10 text-destructive",
  };

  const cardContent = (
    <Card className={cn(
      "overflow-hidden border-none shadow-md bg-card transition-all duration-300",
      href ? "hover:bg-card/80 hover:scale-[1.02] cursor-pointer" : ""
    )}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className={cn("p-2 rounded-lg", colorMap[variant])}>
            <Icon className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          {trend && (
            <span className={cn(
              "text-[10px] md:text-xs font-bold px-2 py-1 rounded-full",
              trend.isUp ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
            )}>
              {trend.isUp ? '+' : '-'}{trend.value}%
            </span>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] md:text-sm font-bold text-muted-foreground uppercase tracking-[0.1em]">{title}</p>
          <h3 className="text-3xl md:text-4xl font-headline font-bold text-foreground tabular-nums leading-tight">
            {value}
          </h3>
          {description && (
            <p className="text-[9px] md:text-xs text-muted-foreground mt-1 md:mt-2 font-medium">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
