import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

interface LoginForm {
  email: string;
  password: string;
}

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // Login mit Supabase
    const { error } = await supabase.auth.signInWithPassword(form);
    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      // Nach erfolgreichem Login: User abfragen
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        alert("Fehler beim Abrufen des Nutzers.");
        return;
      }

      // Profildaten prüfen
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, location')
        .eq('id', user.id)
        .single();

      if (profileError) {
        // Falls noch kein Profileintrag existiert, leite zur Profilerfassung
        router.push('/profile-setup');
        return;
      }

      if (!profile?.first_name || !profile?.last_name || !profile?.location) {
        // Profildaten unvollständig
        router.push('/profile-setup');
      } else {
        // Profil vollständig, ab ins Dashboard
        router.push('/');
      }
    }
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-2xl mb-4">Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className="w-full p-2 border"
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Passwort"
          value={form.password}
          onChange={handleChange}
          className="w-full p-2 border"
          required
        />
        <button type="submit" className="w-full bg-green-600 text-white p-2" disabled={loading}>
          {loading ? "Wird geprüft..." : "Einloggen"}
        </button>
      </form>
      <div className="mt-4 flex justify-between">
        <Link href="/register" className="text-blue-600 text-sm">
          Noch kein Konto? Jetzt registrieren
        </Link>
        <Link href="/forgot-password" className="text-blue-600 text-sm">
          Passwort vergessen?
        </Link>
      </div>
    </div>
  );
}
