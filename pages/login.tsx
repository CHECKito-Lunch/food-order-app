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
      // Nach Login: Rolle holen
      const { data: { user } } = await supabase.auth.getUser();
      // Rolle steckt meist in user.user_metadata.role (kann aber auch woanders stehen)
      const role = user?.user_metadata?.role || "user";
      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/index");
      }
    }
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-2xl mb-4">Login</h1>
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
        <button type="submit" className="w-full bg-green-600 text-white p-2">
          Einloggen
        </button>
      </form>
    </div>
  );
}
