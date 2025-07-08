import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function ProfileSetup() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', location: 'Nordpol' });
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("Nicht eingeloggt.");
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: form.firstName,
        last_name: form.lastName,
        location: form.location
      })
      .eq('id', user.id);
    if (error) return alert(error.message);
    alert('Profil gespeichert!');
    router.push('/'); // Dashboard, o.ä.
  };

  if (loading) return <div>Lädt...</div>;

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-2xl mb-4">Profil vervollständigen</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="firstName" placeholder="Vorname" value={form.firstName} onChange={handleChange}
               className="w-full p-2 border" required />
        <input name="lastName" placeholder="Nachname" value={form.lastName} onChange={handleChange}
               className="w-full p-2 border" required />
        <select name="location" value={form.location} onChange={handleChange}
                className="w-full p-2 border">
          <option value="Nordpol">Nordpol</option>
          <option value="Südpol">Südpol</option>
        </select>
        <button type="submit" className="w-full bg-green-600 text-white p-2">Speichern</button>
      </form>
    </div>
  );
}
