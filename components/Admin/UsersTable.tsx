import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// Profile Typisierung
type Profile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  location: string;
  role: string;
};

const LOCATION_OPTIONS = ["Nordpol", "Südpol"];

export default function UsersTable() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<null | Profile>(null);
  const [editForm, setEditForm] = useState<Partial<Profile> & { password?: string }>({});
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Userdaten laden
  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase.from("profiles").select("*").range(0, 999);
    const res = await fetch("/api/admin/list-users");
    const { users: authList, error: error2 } = await res.json();
    if (error || error2) {
      alert("Fehler beim Laden: " + (error?.message || error2));
      setLoading(false);
      return;
    }
    const usersFull = profiles?.map(p => ({
      ...p,
      email: authList?.find((u: any) => u.id === p.id)?.email ?? "",
    })) || [];
    setUsers(usersFull);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  // User bearbeiten
  function handleEdit(user: Profile) {
    setEditing(user);
    setEditForm({
      ...user,
      location: user.location || LOCATION_OPTIONS[0],
      password: ""
    });
  }

  // User speichern (API)
  async function handleSave() {
    if (!editing) return;
    const res = await fetch("/api/admin/update-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        email: editForm.email || "",
        password: editForm.password || "",
        first_name: editForm.first_name || "",
        last_name: editForm.last_name || "",
        location: editForm.location || LOCATION_OPTIONS[0],
        role: editForm.role || "user"
      })
    });
    const result = await res.json();
    if (!res.ok) return alert("Fehler: " + (result.error || "Unbekannter Fehler"));
    alert("User aktualisiert!");
    setEditing(null);
    await fetchUsers();
  }

  // User löschen (API)
  async function handleDelete(user: Profile) {
    if (!window.confirm("Wirklich löschen?")) return;
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id })
    });
    const result = await res.json();
    if (!res.ok) return alert("Fehler: " + (result.error || "Unbekannter Fehler"));
    alert("User gelöscht!");
    await fetchUsers();
  }

  // Neuen User anlegen (API)
  async function handleCreate() {
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: editForm.email || "",
        password: editForm.password || "",
        first_name: editForm.first_name || "",
        last_name: editForm.last_name || "",
        location: editForm.location || LOCATION_OPTIONS[0],
        role: editForm.role || "user"
      })
    });
    const result = await res.json();
    if (!res.ok) {
      alert("Fehler: " + (result.error || "Unbekannter Fehler"));
      return;
    }
    alert("User angelegt: " + result.user.email);
    setShowCreate(false);
    await fetchUsers();
  }

  if (loading) return <div className="text-center py-12 text-lg dark:bg-gray-900 dark:text-gray-100">Lädt...</div>;

  // Filter users nach Suchtext
  const filtered = users.filter(u =>
    (u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.location?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <h2 className="text-lg font-bold mb-1 text-[#0056b3] dark:text-blue-200">Userverwaltung</h2>
      <div className="flex flex-col md:flex-row gap-1 md:gap-2 mb-2">
        <fieldset className="border border-blue-200 dark:border-gray-700 rounded-xl p-4 mb-6">
    
        <button
          onClick={() => { setEditForm({ location: LOCATION_OPTIONS[0] }); setShowCreate(true); }}
          className="bg-[#0056b3] hover:bg-blue-800 text-white font-semibold px-2 py-1 rounded-full shadow text-xs w-full md:w-auto"
        >
          neuen User anlegen
        </button>
          </fieldset>
        <input
          type="text"
          placeholder="Suche…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="
            border border-blue-200 dark:border-gray-700
            rounded px-2 py-1.5
            bg-white dark:bg-gray-900
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-400
            text-xs w-full
            transition
          "
        />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-blue-100 dark:border-gray-700 shadow bg-white dark:bg-gray-800">
        <table className="min-w-full divide-y divide-blue-100 dark:divide-gray-700">
          <thead>
            <tr className="bg-blue-50 dark:bg-gray-900">
              <th className="p-2 font-semibold text-[#0056b3] dark:text-blue-200 text-xs">E-Mail</th>
              <th className="p-2 font-semibold text-[#0056b3] dark:text-blue-200 text-xs">Vorname</th>
              <th className="p-2 font-semibold text-[#0056b3] dark:text-blue-200 text-xs">Nachname</th>
              <th className="p-2 font-semibold text-[#0056b3] dark:text-blue-200 text-xs">Location</th>
              <th className="p-2 font-semibold text-[#0056b3] dark:text-blue-200 text-xs">Rolle</th>
              <th className="p-2 font-semibold text-[#0056b3] dark:text-blue-200 text-xs">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-blue-50 dark:hover:bg-gray-700">
                <td className="border-t border-blue-100 dark:border-gray-700 p-2 text-xs">{u.email}</td>
                <td className="border-t border-blue-100 dark:border-gray-700 p-2 text-xs">{u.first_name}</td>
                <td className="border-t border-blue-100 dark:border-gray-700 p-2 text-xs">{u.last_name}</td>
                <td className="border-t border-blue-100 dark:border-gray-700 p-2 text-xs">{u.location}</td>
                <td className="border-t border-blue-100 dark:border-gray-700 p-2 text-xs">{u.role}</td>
                <td className="border-t border-blue-100 dark:border-gray-700 p-2 flex flex-col gap-1 md:flex-row text-xs">
                  <button onClick={() => handleEdit(u)} className="text-[#0056b3] dark:text-blue-400 hover:underline font-semibold px-2 py-1">Bearbeiten</button>
                  <button onClick={() => handleDelete(u)} className="text-red-600 hover:underline font-semibold px-2 py-1">Löschen</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-5 text-gray-400 dark:text-gray-500 text-center text-xs">Keine passenden User gefunden.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bearbeiten Modal */}
      {editing && (
        <div className="fixed inset-0 z-30 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 w-full max-w-xs mx-auto border border-blue-100 dark:border-gray-700">
            <h3 className="font-bold text-base mb-2 text-[#0056b3] dark:text-blue-200">User bearbeiten</h3>
            <input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })}
              className="mb-1 w-full p-1.5 border border-blue-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-400" placeholder="E-Mail" />
            <input value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
              className="mb-1 w-full p-1.5 border border-blue-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-400" placeholder="Vorname" />
            <input value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
              className="mb-1 w-full p-1.5 border border-blue-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-400" placeholder="Nachname" />
            <select value={editForm.location || LOCATION_OPTIONS[0]} onChange={e => setEditForm({ ...editForm, location: e.target.value })}
              className="mb-1 w-full p-1.5 border border-blue-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs">
              {LOCATION_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <select value={editForm.role || "user"} onChange={e => setEditForm({ ...editForm, role: e.target.value })}
              className="mb-1 w-full p-1.5 border border-blue-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <input value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} type="text"
              className="mb-1 w-full p-1.5 border border-blue-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs" placeholder="Neues Passwort (optional)" />
            <div className="flex gap-2 mt-2">
              <button onClick={handleSave} className="bg-green-600 text-white px-2 py-1 rounded-full font-semibold hover:bg-green-700 text-xs shadow">Speichern</button>
              <button onClick={() => setEditing(null)} className="text-red-600 font-semibold px-2 py-1 text-xs">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {/* Neuen User anlegen Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-30 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 w-full max-w-xs mx-auto border border-blue-100 dark:border-gray-700">
            <h3 className="font-bold text-base mb-2 text-[#0056b3] dark:text-blue-200">User anlegen</h3>
            <input value={editForm.email || ""} onChange={e => setEditForm({ ...editForm, email: e.target.value })}
              className="mb-1 w-full p-1.5 border border-blue-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-400" placeholder="E-Mail" />
            <input value={editForm.first_name || ""} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
              className="mb-1 w-full p-1.5 border border-blue-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-400" placeholder="Vorname" />
            <input value={editForm.last_name || ""} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
              className="mb-1 w-full p-1.5 border border-blue-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-400" placeholder="Nachname" />
            <select value={editForm.location || LOCATION_OPTIONS[0]} onChange={e => setEditForm({ ...editForm, location: e.target.value })}
              className="mb-1 w-full p-1.5 border border-blue-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs">
              {LOCATION_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <select value={editForm.role || "user"} onChange={e => setEditForm({ ...editForm, role: e.target.value })}
              className="mb-1 w-full p-1.5 border border-blue-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <input value={editForm.password || ""} onChange={e => setEditForm({ ...editForm, password: e.target.value })} type="text"
              className="mb-1 w-full p-1.5 border border-blue-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs" placeholder="Passwort" />
            <div className="flex gap-2 mt-2">
              <button onClick={handleCreate} className="bg-green-600 text-white px-2 py-1 rounded-full font-semibold hover:bg-green-700 text-xs shadow">Anlegen</button>
              <button onClick={() => setShowCreate(false)} className="text-red-600 font-semibold px-2 py-1 text-xs">Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
