import type { Metadata } from 'next';
import '@fontsource-variable/inter-tight';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './globals.css';

export const metadata: Metadata = { title: { default: 'Crypto 5 — Daily Opportunity Scanner', template: '%s · Crypto 5' }, description: 'Daily crypto research screening. Not financial advice.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="min-h-screen font-sans">{children}</body></html>;
}
