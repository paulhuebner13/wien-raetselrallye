'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Team = { id: string; name: string };

export default function LoginForm() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/teams', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setTeams(d.teams ?? []);
        if (d.teams?.[0]) setTeamId(d.teams[0].id);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error ?? 'Login fehlgeschlagen.');
    sessionStorage.setItem('rallye-show-intro', '1');
    router.push('/rallye');
    router.refresh();
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">WIEN</div>
        <h1>Rätselrallye</h1>
        <p className="muted">Team auswählen und starten.</p>
        <form onSubmit={submit} className="stack">
          <label>
            Team
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={!teams.length}>
              {teams.length ? teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>) : <option>Noch keine Teams</option>}
            </select>
          </label>
          <label>
            Passwort
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button className="primary" disabled={loading || !teamId}>{loading ? '...' : 'Starten'}</button>
        </form>
      </section>
    </main>
  );
}
