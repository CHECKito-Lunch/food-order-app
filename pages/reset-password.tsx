import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Nur ausführen, wenn router.query initialisiert ist (Next.js Besonderheit)
    if (!router.isReady) return;

    const { access_token, refresh_token, type } = router.query;

    if (type === "recovery" && access_token && refresh_token) {
      supabase.auth
        .setSession({
          access_token: access_token as string,
          refresh_token: refresh_token as string,
        })
        .then(() => {
          setShowForm(true);
          setLoading(false);
        });
    } else if (!access_token && !refresh_token) {
      // Kein Token in URL → Seite trotzdem anzeigen, evtl. kommt User direkt
      setShowForm(true);
      setLoading(false);
    } else {
      // Tokens sind unvollständig → Error oder Hinweis anzeigen
      setLoading(false);
      setShowForm(false);
    }
  }, [router.isReady, router.query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      alert(error.message);
    } else {
      alert("Passwort geändert. Du bist jetzt eingeloggt.");
      router.push("/");
    }
  };

  if (loading) return <div>Lädt...</div>;
  if (!showForm) return <div>Fehler: Kein gültiger Passwort-Reset-Link.</div>;

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-2xl mb-4">Neues Passwort setzen</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          placeholder="Neues Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border"
          required
        />
        <button type="submit" className="w-full bg-blue-600 text-white p-2" disabled={loading}>
          {loading ? "Speichern..." : "Passwort speichern"}
        </button>
      </form>
    </div>
  );
}
