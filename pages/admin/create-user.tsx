import { useState } from "react";

export default function AdminCreateUser() {
  const [form, setForm] = useState({ email: "", password: "", role: "user" });
  const [status, setStatus] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Wird angelegt...");
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const result = await res.json();
    if (!res.ok) setStatus("❌ Fehler: " + (result.error || "Unbekannter Fehler"));
    else setStatus("✅ User angelegt: " + result.user.email);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-blue-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 md:p-8 border border-blue-100">
        <h1 className="text-2xl md:text-3xl font-bold text-[#0056b3] mb-6 text-center tracking-tight">
          Neuen Benutzer anlegen
        </h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">E-Mail</label>
            <input
              name="email"
              type="email"
              placeholder="E-Mail"
              value={form.email}
              onChange={handleChange}
              className="w-full border border-blue-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">Passwort</label>
            <input
              name="password"
              type="text"
              placeholder="Passwort"
              value={form.password}
              onChange={handleChange}
              className="w-full border border-blue-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">Rolle</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full border border-blue-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-[#0056b3] hover:bg-blue-800 text-white py-2.5 rounded-full font-semibold shadow transition text-lg"
          >
            Anlegen
          </button>
        </form>
        {status && (
          <div
            className={`mt-6 text-center text-base font-medium ${
              status.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}
          >
            {status}
          </div>
        )}
      </div>
      <div className="mt-8 text-xs text-gray-400">
        © {new Date().getFullYear()} CHECKito Lunch
      </div>
    </div>
  );
}
