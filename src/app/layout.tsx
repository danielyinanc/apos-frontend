import type { Metadata } from 'next';
import { Providers } from '@/components/layout/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'APOS',
  description: 'Conversational portfolio copilot for investment professionals',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
