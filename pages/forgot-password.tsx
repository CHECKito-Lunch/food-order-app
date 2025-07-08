import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://food-order-app-theta-eight.vercel.app/reset-password"
      // Für lokale Entwicklung zusätzlich:
      // redirectTo: "http://localhost:3000/reset-password"
    });
    if (error) return alert(error.message);
    alert('Email zum Zurücksetzen wurde gesendet.');
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-2xl mb-4">Passwort zurücksetzen</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" placeholder="Deine Email" value={email} onChange={e=>setEmail(e.target.value)}
               className="w-full p-2 border" required />
        <button type="submit" className="w-full bg-orange-600 text-white p-2">Senden</button>
      </form>
    </div>
  );
}
