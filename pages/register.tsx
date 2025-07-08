import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registerLoading, setRegisterLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });
    setRegisterLoading(false);
    if (error) return alert(error.message);
    alert('Bestätige deine Email – dann kannst du dich einloggen.');
    router.push('/login');
  };

  if (loading) return <div>Lädt...</div>;
  if (user) return <div>Du bist schon eingeloggt!</div>;

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-2xl mb-4">Registrieren</h1>
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
        <button type="submit" className="w-full bg-blue-600 text-white p-2" disabled={registerLoading}>
          {registerLoading ? "Wird erstellt..." : "Registrieren"}
        </button>
      </form>
      <div className="mt-4">
        <Link href="/login" className="text-blue-600 text-sm">
          Schon registriert? Zum Login
        </Link>
      </div>
    </div>
  );
}