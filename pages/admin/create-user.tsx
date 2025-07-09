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
    if (!res.ok) setStatus("Fehler: " + (result.error || "Unbekannter Fehler"));
    else setStatus("User angelegt: " + result.user.email);
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-2xl mb-4">Neuen Benutzer anlegen</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="email" type="email" placeholder="E-Mail" value={form.email} onChange={handleChange} className="w-full p-2 border" required />
        <input name="password" type="text" placeholder="Passwort" value={form.password} onChange={handleChange} className="w-full p-2 border" required />
        <select name="role" value={form.role} onChange={handleChange} className="w-full p-2 border">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="w-full bg-blue-600 text-white p-2">Anlegen</button>
      </form>
      {status && <div className="mt-4">{status}</div>}
    </div>
  );
}