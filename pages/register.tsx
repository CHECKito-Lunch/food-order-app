import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '', location: 'Nordpol'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password
    }, {
      data: {
        first_name: form.firstName,
        last_name: form.lastName,
        location: form.location
      }
    });
    if (error) return alert(error.message);
    alert('Bestätige deine Email – dann kannst du dich einloggen.');
    router.push('/login');
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-2xl mb-4">Registrieren</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="firstName"    placeholder="Vorname"   value={form.firstName} onChange={handleChange}
               className="w-full p-2 border" required />
        <input name="lastName"     placeholder="Nachname"  value={form.lastName}  onChange={handleChange}
               className="w-full p-2 border" required />
        <select name="location" value={form.location} onChange={handleChange}
                className="w-full p-2 border">
          <option value="Nordpol">Nordpol</option>
          <option value="Südpol">Südpol</option>
        </select>
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange}
               className="w-full p-2 border" required />
        <input name="password" type="password" placeholder="Passwort" value={form.password} onChange={handleChange}
               className="w-full p-2 border" required />
        <button type="submit" className="w-full bg-blue-600 text-white p-2">Registrieren</button>
      </form>
    </div>
  );
}
