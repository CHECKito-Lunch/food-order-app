// pages/_app.tsx
'use client';

import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabaseClient';
import Head from 'next/head';
import { Analytics } from "@vercel/analytics/next";
import { useRouter } from 'next/router';

function HeaderLogo() {
  return (
    <div className="flex flex-col items-center py-6">
      <img
        src="/CHECK24_Logo_Nova-Blue (1).svg"
        alt="CHECK24 Logo"
        className="h-16 md:h-20 max-w-xs object-contain drop-shadow-xl"
        style={{ marginTop: '8px', marginBottom: '8px' }}
      />
      <div className="h-[3px] w-40 bg-blue-100 dark:bg-blue-900 rounded-full mt-2 shadow-lg" />
    </div>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Kein Header auf /login
  const hideHeader = router.pathname === "/login";

  return (
    <SessionContextProvider supabaseClient={supabase as any}>
      <Head>
        <title>CHECKito Lunch</title>
        <meta name="description" content="CHECKito Lunch – Dein Tool für Essensbestellungen und Menüverwaltung." />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen bg-white text-gray-900 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {!hideHeader && <HeaderLogo />}
        <Component {...pageProps} />
      </div>
      <Analytics />
    </SessionContextProvider>
  );
}
