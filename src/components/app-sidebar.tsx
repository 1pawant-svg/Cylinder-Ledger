
"use client";

import { 
  LayoutDashboard, 
  Users, 
  ArrowLeftRight, 
  FileText, 
  Settings,
  Flame,
  LogOut,
  User as UserIcon
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarFooter,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useUser, useFirestore } from "@/firebase";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { getUserProfile } from "@/lib/services/user-service";
import { UserProfile } from "@/lib/types";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (user && db) {
        const up = await getUserProfile(db, user.uid);
        setProfile(up);
      }
    }
    fetchProfile();
  }, [user, db]);

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push("/login");
  };

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="py-6 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-primary rounded-lg p-2 flex items-center justify-center shadow-lg shadow-primary/20">
            <Flame className="text-primary-foreground h-6 w-6" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-headline text-xl font-bold tracking-tight text-primary">Cylindera</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">LPG Ledger Pro</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">Main Menu</SidebarGroupLabel>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild 
                  isActive={pathname === item.url}
                  tooltip={item.title}
                  className="px-4 py-6"
                >
                  <Link href={item.url}>
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium text-base ml-2">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 p-4 space-y-2">
        {profile && (
          <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:hidden">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold truncate">{profile.fullName}</span>
              <span className="text-[10px] text-muted-foreground truncate">{profile.email}</span>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Logout" className="px-4 py-6 text-destructive hover:text-destructive">
              <LogOut className="h-5 w-5" />
              <span className="font-medium text-base ml-2">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
