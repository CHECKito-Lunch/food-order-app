import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword(form);
    if (error) {
      alert(error.message);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role || "user";
      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/index");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-blue-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-6 md:p-8 border border-blue-100">
        <h1 className="text-3xl font-bold text-[#0056b3] mb-6 text-center tracking-tight">Login</h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">Email</label>
            <input
              name="email"
              type="email"
              placeholder="z.B. max.mustermann@mail.de"
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
              type="password"
              placeholder="Passwort"
              value={form.password}
              onChange={handleChange}
              className="w-full border border-blue-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[#0056b3] hover:bg-blue-800 text-white py-2.5 rounded-full font-semibold shadow transition text-lg"
          >
            Einloggen
          </button>
        </form>
      </div>
      {/* Optionale Fußzeile */}
      <div className="mt-8 text-xs text-gray-400">
        © {new Date().getFullYear()} CHECKito Lunch
      </div>
    </div>
  );
}
