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
    
    <div className="min-h-screen flex flex-col justify-center items-center bg-blue-50 px-2">
       <div className="bg-red-500 text-white p-4 mb-4">Test</div>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 border border-blue-100">
        {/* LOGO */}
        <div className="flex justify-center mb-5">
          <img
            src="https://www.check24.de/apple-touch-icon.png"
            alt="CHECK24 Logo"
            className="w-16 h-16 md:w-20 md:h-20"
            style={{ objectFit: "contain" }}
          />
        </div>
        <h1 className="text-3xl font-extrabold text-[#0056b3] mb-8 text-center tracking-tight">
          CHECKito Lunch
        </h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">E-Mail-Adresse</label>
            <input
              name="email"
              type="email"
              placeholder="z.B. max.mustermann@mail.de"
              value={form.email}
              onChange={handleChange}
              className="w-full border border-blue-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base transition"
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
              className="w-full border border-blue-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base transition"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[#0056b3] hover:bg-blue-800 text-white py-3 rounded-full font-bold shadow-md transition text-lg"
          >
            Einloggen
          </button>
        </form>
      </div>
      <div className="mt-8 text-xs text-gray-400">
        © {new Date().getFullYear()} CHECKito Lunch
      </div>
    </div>
  );
}
