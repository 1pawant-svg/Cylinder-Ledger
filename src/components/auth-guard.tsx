
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser, useFirestore } from "@/firebase";
import { getUserProfile } from "@/lib/services/user-service";
import { UserProfile } from "@/lib/types";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      if (user && db) {
        try {
          const up = await getUserProfile(db, user.uid);
          setProfile(up);
          // If profile doesn't exist but user is authed, it will be handled by create on login
        } catch (e) {
          console.error("Failed to load user profile:", e);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setProfileLoading(false);
    }

    if (!authLoading) {
      fetchProfile();
    }
  }, [user, db, authLoading]);

  useEffect(() => {
    if (authLoading || (user && profileLoading)) return;

    if (!user && pathname !== "/login") {
      router.push("/login");
    } else if (user && pathname === "/login") {
      router.push("/");
    }
  }, [user, authLoading, profileLoading, pathname, router]);

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-headline font-bold text-muted-foreground animate-pulse">Initializing PGS Ledger...</p>
        </div>
      </div>
    );
  }

  // Allow access to login page even if not authenticated
  if (!user && pathname === "/login") return <>{children}</>;

  // Only render children if authenticated (unless on login)
  if (!user && pathname !== "/login") return null;

  return <>{children}</>;
}
