import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from '../lib/supabaseClient';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      <Component {...pageProps} />
    </SessionContextProvider>
  );
}
