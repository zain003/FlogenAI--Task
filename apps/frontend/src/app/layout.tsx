import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/auth-context';
import { SocketProvider } from '@/context/socket-context';
import { NavigationBar } from '@/components/navigation-bar';

export const metadata: Metadata = {
  title: 'FlogenAI — Real-Time Service Marketplace',
  description: 'Horizontally scalable real-time service marketplace with deterministic concurrency and live sync.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-[#f9fafb] antialiased">
        <AuthProvider>
          <SocketProvider>
            <div className="flex min-h-screen flex-col">
              <NavigationBar />
              <main className="flex-1">{children}</main>
            </div>
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
