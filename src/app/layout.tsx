import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Mind Spark | Admin', description: 'Private Mind Spark admin dashboard' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
