import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Supabase speichert Session by default im localStorage.
    // (Der Switch ist kosmetisch oder für spätere Features)
    const { error } = await supabase.auth.signInWithPassword(form);
    if (error) {
      alert(error.message);
      setLoading(false);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role || "user";
      setTimeout(() => {
        if (role === "admin") {
          router.push("/admin");
        } else {
          window.location.href = "/";
        }
      }, 300);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-blue-50 dark:bg-gray-900 px-2">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 md:p-8 border border-blue-100 dark:border-gray-700">
        <div className="flex justify-center mb-5">
          <img
            src="/CHECK24_App_Icon_NNova-Blue_rounded.png"
            alt="CHECK24 Logo"
            className="w-16 h-16 md:w-20 md:h-20 rounded-xl"
            style={{ objectFit: "contain" }}
          />
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#0056b3] dark:text-blue-200 mb-8 text-center tracking-tight">
          CHECKito Lunch
        </h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-200">
              E-Mail-Adresse
            </label>
            <input
              name="email"
              type="email"
              placeholder="z.B. max.mustermann@mail.de"
              value={form.email}
              onChange={handleChange}
              className="w-full border border-blue-200 dark:border-gray-700 rounded px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm transition"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-200">
              Passwort
            </label>
            <input
              name="password"
              type="password"
              placeholder="Passwort"
              value={form.password}
              onChange={handleChange}
              className="w-full border border-blue-200 dark:border-gray-700 rounded px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm transition"
              required
            />
          </div>

          {/* Schieberegler (Optik, Funktion siehe oben) */}
          <div className="flex items-center justify-between mt-4 mb-2">
            <label className="flex items-center cursor-pointer text-xs gap-2 select-none text-gray-700 dark:text-gray-300">
              <span>Eingeloggt bleiben</span>
              <span className="relative">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="sr-only"
                />
                <span className={`block w-10 h-6 rounded-full transition-colors duration-200
                  ${rememberMe ? "bg-blue-600" : "bg-gray-300"}`}>
                  <span className={`absolute left-0 top-0 w-6 h-6 rounded-full bg-white border shadow 
                    transition-transform duration-200 ${rememberMe ? "translate-x-4" : ""}`} />
                </span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-[#0056b3] dark:bg-blue-600 hover:bg-blue-800 dark:hover:bg-blue-700 text-white py-2 rounded-full font-bold shadow-md transition text-sm ${
              loading ? "opacity-50 cursor-wait" : ""
            }`}
          >
            {loading ? "Einloggen ..." : "Einloggen"}
          </button>
        </form>
      </div>
      <div className="mt-8 text-xs text-gray-400 dark:text-gray-600">
        © {new Date().getFullYear()} CHECKito Lunch
      </div>
    </div>
  );
}
