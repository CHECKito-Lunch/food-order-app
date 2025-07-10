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

  if (loading)
    return <div className="h-screen flex items-center justify-center text-lg dark:bg-gray-900 dark:text-gray-100">Lädt...</div>;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-blue-50 dark:bg-gray-900 px-2">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 md:p-8 border border-blue-100 dark:border-gray-700">
        <h1 className="text-2xl md:text-3xl font-bold text-[#0056b3] dark:text-blue-200 mb-6 text-center tracking-tight">
          Profil vervollständigen
        </h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-200">Vorname</label>
            <input
              name="firstName"
              placeholder="Vorname"
              value={form.firstName}
              onChange={handleChange}
              className="w-full border border-blue-200 dark:border-gray-700 rounded px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-200">Nachname</label>
            <input
              name="lastName"
              placeholder="Nachname"
              value={form.lastName}
              onChange={handleChange}
              className="w-full border border-blue-200 dark:border-gray-700 rounded px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-200">Standort</label>
            <select
              name="location"
              value={form.location}
              onChange={handleChange}
              className="w-full border border-blue-200 dark:border-gray-700 rounded px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            >
              <option value="Nordpol">Nordpol</option>
              <option value="Südpol">Südpol</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-[#0056b3] dark:bg-blue-600 hover:bg-blue-800 dark:hover:bg-blue-700 text-white py-2 rounded-full font-semibold shadow transition text-sm"
          >
            Speichern
          </button>
        </form>
      </div>
      <div className="mt-8 text-xs text-gray-400 dark:text-gray-600">
        © {new Date().getFullYear()} CHECKito Lunch
      </div>
    </div>
  );
}
