import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const handleChange = (e: any) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword(form);
    if (error) return alert(error.message);
    router.push('/');
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-2xl mb-4">Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange}
               className="w-full p-2 border" required />
        <input name="password" type="password" placeholder="Passwort" value={form.password} onChange={handleChange}
               className="w-full p-2 border" required />
        <button type="submit" className="w-full bg-green-600 text-white p-2">Einloggen</button>
      </form>
      <p className="mt-4 text-right">
        <a href="/forgot-password" className="text-blue-600">Passwort vergessen?</a>
      </p>
    </div>
  );
}
