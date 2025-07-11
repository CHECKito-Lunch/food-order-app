// pages/_app.tsx
'use client'; // falls du Next.js 13 App Router nutzt, sonst weglassen

import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabaseClient';
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      <Head>
        <title>CHECKito Lunch</title>
        <meta name="description" content="CHECKito Lunch – Dein Tool für Essensbestellungen und Menüverwaltung." />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen bg-white text-gray-900 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <Component {...pageProps} />
      </div>
    </SessionContextProvider>
  );
}
