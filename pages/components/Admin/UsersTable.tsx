import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

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
    const { data: profiles, error } = await supabase.from("profiles").select("*");
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
      location: user.location || LOCATION_OPTIONS[0], // Defaultwert, falls leer
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

  if (loading) return <div>Lädt...</div>;

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
      <h2 className="text-xl font-bold mb-2">Userverwaltung</h2>
      <div className="flex gap-4 mb-2">
        <button onClick={() => { setEditForm({ location: LOCATION_OPTIONS[0] }); setShowCreate(true); }} className="bg-blue-600 text-white px-3 py-1 rounded">
          Neuen User anlegen
        </button>
        <input
          type="text"
          placeholder="Suche nach Name, Email, Rolle..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border p-2 rounded flex-1 min-w-[200px]"
        />
      </div>
      <table className="min-w-full border">
        <thead>
          <tr>
            <th className="p-2 border">E-Mail</th>
            <th className="p-2 border">Vorname</th>
            <th className="p-2 border">Nachname</th>
            <th className="p-2 border">Location</th>
            <th className="p-2 border">Rolle</th>
            <th className="p-2 border">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(u => (
            <tr key={u.id}>
              <td className="border p-2">{u.email}</td>
              <td className="border p-2">{u.first_name}</td>
              <td className="border p-2">{u.last_name}</td>
              <td className="border p-2">{u.location}</td>
              <td className="border p-2">{u.role}</td>
              <td className="border p-2 flex gap-2">
                <button onClick={() => handleEdit(u)} className="text-blue-600 underline">Bearbeiten</button>
                <button onClick={() => handleDelete(u)} className="text-red-600 underline">Löschen</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="p-4 text-gray-400 text-center">Keine passenden User gefunden.</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Bearbeiten Modal */}
      {editing && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-30 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-4">User bearbeiten</h3>
            <input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="mb-2 w-full p-1 border" placeholder="E-Mail" />
            <input value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} className="mb-2 w-full p-1 border" placeholder="Vorname" />
            <input value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} className="mb-2 w-full p-1 border" placeholder="Nachname" />
            <select value={editForm.location || LOCATION_OPTIONS[0]} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="mb-2 w-full p-1 border">
              {LOCATION_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <select value={editForm.role || "user"} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="mb-2 w-full p-1 border">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <input value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} type="text" className="mb-2 w-full p-1 border" placeholder="Neues Passwort (optional)" />
            <div className="flex gap-2 mt-2">
              <button onClick={handleSave} className="bg-green-600 text-white px-3 py-1 rounded">Speichern</button>
              <button onClick={() => setEditing(null)} className="text-red-600">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {/* Neuen User anlegen Modal */}
      {showCreate && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-30 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-4">User anlegen</h3>
            <input value={editForm.email || ""} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="mb-2 w-full p-1 border" placeholder="E-Mail" />
            <input value={editForm.first_name || ""} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} className="mb-2 w-full p-1 border" placeholder="Vorname" />
            <input value={editForm.last_name || ""} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} className="mb-2 w-full p-1 border" placeholder="Nachname" />
            <select value={editForm.location || LOCATION_OPTIONS[0]} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="mb-2 w-full p-1 border">
              {LOCATION_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <select value={editForm.role || "user"} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="mb-2 w-full p-1 border">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <input value={editForm.password || ""} onChange={e => setEditForm({ ...editForm, password: e.target.value })} type="text" className="mb-2 w-full p-1 border" placeholder="Passwort" />
            <div className="flex gap-2 mt-2">
              <button onClick={handleCreate} className="bg-green-600 text-white px-3 py-1 rounded">Anlegen</button>
              <button onClick={() => setShowCreate(false)} className="text-red-600">Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
