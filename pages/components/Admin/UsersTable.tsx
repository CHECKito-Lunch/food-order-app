import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  location: string;
  role: string;
};

export default function UsersTable() {
  const [users, setUsers] = useState<Profile[]>([]);
  useEffect(() => {
    supabase.from('profiles').select('*').then(r => r.data && setUsers(r.data));
  }, []);

  const updateRole = async (id: string, role: string) => {
    await supabase.from('profiles').update({ role }).eq('id', id);
    setUsers(users.map(u => u.id === id ? { ...u, role } : u));
  };

  return (
    <div className="space-y-2">
      <h2 className="text-xl">User-Verwaltung</h2>
      {users.map(u => (
        <div key={u.id} className="flex items-center gap-4 p-2 border">
          <span>{u.first_name} {u.last_name} ({u.location})</span>
          <select
            value={u.role}
            onChange={e => updateRole(u.id, e.target.value)}
            className="p-1 border"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      ))}
    </div>
  );
}
