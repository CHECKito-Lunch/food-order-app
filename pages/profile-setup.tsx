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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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
    router.push('/'); // Dashboard
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-lg">Lädt...</div>;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-blue-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 md:p-8 border border-blue-100">
        <h1 className="text-2xl md:text-3xl font-bold text-[#0056b3] mb-6 text-center tracking-tight">Profil vervollständigen</h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">Vorname</label>
            <input
              name="firstName"
              placeholder="Vorname"
              value={form.firstName}
              onChange={handleChange}
              className="w-full border border-blue-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">Nachname</label>
            <input
              name="lastName"
              placeholder="Nachname"
              value={form.lastName}
              onChange={handleChange}
              className="w-full border border-blue-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">Standort</label>
            <select
              name="location"
              value={form.location}
              onChange={handleChange}
              className="w-full border border-blue-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
            >
              <option value="Nordpol">Nordpol</option>
              <option value="Südpol">Südpol</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-[#0056b3] hover:bg-blue-800 text-white py-2.5 rounded-full font-semibold shadow transition text-lg"
          >
            Speichern
          </button>
        </form>
      </div>
      <div className="mt-8 text-xs text-gray-400">
        © {new Date().getFullYear()} CHECKito Lunch
      </div>
    </div>
  );
}
