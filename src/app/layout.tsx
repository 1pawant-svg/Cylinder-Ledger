import type {Metadata} from 'next';
import './globals.css';
import {AppSidebar} from '@/components/app-sidebar';
import {SidebarProvider, SidebarInset} from '@/components/ui/sidebar';
import {LedgerProvider} from '@/lib/ledger-context';
import {Toaster} from '@/components/ui/toaster';
import {FirebaseClientProvider} from '@/firebase';
import {FirebaseErrorListener} from '@/components/FirebaseErrorListener';
import {AuthGuard} from '@/components/auth-guard';
import {MobileNav} from '@/components/mobile-nav';
import {I18nProvider} from '@/lib/i18n-context';
import {BackupReminderBanner} from '@/components/backup-reminder-banner';
import {PWARegistration} from '@/components/pwa-registration';

export const metadata: Metadata = {
  title: 'PGS Cylinder Ledger',
  description: 'Reliable and simple cylinder management system',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PGS Ledger',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
        <meta name="theme-color" content="#12110e" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
      </head>
      <body className="font-body antialiased pb-24 md:pb-0 min-h-screen bg-background overflow-x-hidden">
        <PWARegistration />
        <I18nProvider>
          <FirebaseClientProvider>
            <FirebaseErrorListener />
            <AuthGuard>
              <LedgerProvider>
                <BackupReminderBanner />
                <SidebarProvider>
                  <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
                    <AppSidebar />
                    <SidebarInset className="flex-1 bg-background relative min-w-0 overflow-x-hidden">
                      <main className="flex-1 w-full min-w-0">
                        {children}
                      </main>
                    </SidebarInset>
                  </div>
                </SidebarProvider>
                <MobileNav />
                <Toaster />
              </LedgerProvider>
            </AuthGuard>
          </FirebaseClientProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
