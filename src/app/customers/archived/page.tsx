
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RedirectArchivedPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Archiving has been replaced by active/inactive status.
    // Redirecting to the main ledger where inactive customers can be filtered.
    router.replace("/customers");
  }, [router]);

  return null;
}
