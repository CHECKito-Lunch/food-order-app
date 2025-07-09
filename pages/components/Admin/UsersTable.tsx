import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Profile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  location: string;
  role: string;
};

export default function UsersTable() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<null | Profile>(null);
  const [editForm, setEditForm] = useState<Partial<Profile> & { password?: string }>({});
  const [showCreate, setShowCreate] = useState(false);

  // Laden aller User & Profile
  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      // Hole alle User aus Auth
      const { data: authList } = await supabase.auth.admin.listUsers();
      const usersFull = profiles?.map(p => ({
        ...p,
        email: authList?.users.find(u => u.id === p.id)?.email ?? "",
      })) || [];
      setUsers(usersFull);
    })();
  }, []);

  // User bearbeiten
  function handleEdit(user: Profile) {
    setEditing(user);
    setEditForm({ ...user, password: "" });
  }

  // User speichern (Profil und ggf. Auth/Passwort)
  async function handleSave() {
    if (!editing) return;

    // Profile updaten
    await supabase.from("profiles").update({
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      location: editForm.location,
      role: editForm.role
    }).eq("id", editing.id);

    // E-Mail oder Passwort in Auth updaten (Service Role Key im Backend nötig!)
    if (editForm.email || editForm.password) {
      await supabase.auth.admin.updateUserById(editing.id, {
        email: editForm.email,
        password: editForm.password || undefined,
        user_metadata: { role: editForm.role }
      });
    }
    alert("User aktualisiert!");

    setEditing(null);
    window.location.reload();
  }

  // Neuen User anlegen
  async function handleCreate() {
    // Auth-User anlegen
    const { data, error } = await supabase.auth.admin.createUser({
      email: editForm.email!,
      password: editForm.password!,
      email_confirm: true,
      user_metadata: { role: editForm.role || "user" }
    });
    if (error) return alert("Fehler: " + error.message);

    // Profile-Eintrag anlegen
    await supabase.from("profiles").insert({
      id: data.user?.id,
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      location: editForm.location,
      role: editForm.role
    });

    alert("User angelegt!");
    setShowCreate(false);
    window.location.reload();
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Userverwaltung</h2>
      <button onClick={() => { setEditForm({}); setShowCreate(true); }} className="mb-2 bg-blue-600 text-white px-3 py-1 rounded">Neuen User anlegen</button>
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
          {users.map(u => (
            <tr key={u.id}>
              <td className="border p-2">{u.email}</td>
              <td className="border p-2">{u.first_name}</td>
              <td className="border p-2">{u.last_name}</td>
              <td className="border p-2">{u.location}</td>
              <td className="border p-2">{u.role}</td>
              <td className="border p-2">
                <button onClick={() => handleEdit(u)} className="text-blue-600 underline">Bearbeiten</button>
              </td>
            </tr>
          ))}
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
            <input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="mb-2 w-full p-1 border" placeholder="Location" />
            <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="mb-2 w-full p-1 border">
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
            <input value={editForm.location || ""} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="mb-2 w-full p-1 border" placeholder="Location" />
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
