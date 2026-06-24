import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './Profile.css';

function MemberAvatar({ name }) {
  const colors = ['#042F34', '#1a9e6e', '#5a7a80', '#FFC933'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const bg = colors[Math.abs(hash) % colors.length];
  return (
    <div className="member-avatar" style={{ background: bg }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Profile() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [members, setMembers] = useState([]);
  const [editName, setEditName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/auth/me').then(res => {
      setProfile(res.data.user);
      setMembers(res.data.members);
      setEditName(res.data.user.name);
    }).catch(() => {});
  }, []);

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.put('/auth/me', { name: editName.trim() });
      setProfile(prev => ({ ...prev, name: res.data.name }));
      login(localStorage.getItem('token'), { ...user, name: res.data.name });
      setEditing(false);
    } catch {
      setError('Failed to update name.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(profile?.householdId || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!profile) {
    return <div className="page-content"><div style={{ color: 'var(--muted)' }}>Loading...</div></div>;
  }

  return (
    <div className="page-content">
      <div className="profile-header">
        <div className="profile-avatar-lg">{profile.name.charAt(0).toUpperCase()}</div>
        <div>
          <div className="profile-name">{profile.name}</div>
          <div className="profile-email">{profile.email}</div>
        </div>
      </div>

      {/* Account Info */}
      <div className="profile-card">
        <div className="profile-card-title">Account</div>

        <div className="profile-field">
          <div className="field-label">Display Name</div>
          {editing ? (
            <div className="field-edit-row">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                autoFocus
              />
              <button className="btn-primary btn-sm-action" onClick={handleSaveName} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-ghost btn-sm-action" onClick={() => { setEditing(false); setEditName(profile.name); }}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="field-value-row">
              <span className="field-value">{profile.name}</span>
              <button className="btn-ghost btn-sm-action" onClick={() => setEditing(true)}>Edit</button>
            </div>
          )}
          {error && <div className="field-error">{error}</div>}
        </div>

        <div className="profile-field">
          <div className="field-label">Email</div>
          <div className="field-value">{profile.email}</div>
        </div>

        <div className="profile-field">
          <div className="field-label">Member since</div>
          <div className="field-value">
            {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Family Code */}
      <div className="profile-card">
        <div className="profile-card-title">Family Code</div>
        <p className="family-code-hint">
          Share this code with your partner when they register so you're linked to the same household.
        </p>
        <div className="family-code-box">
          <code className="family-code-text">{profile.householdId}</code>
          <button className="btn-ghost btn-sm-action" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Household Members */}
      <div className="profile-card">
        <div className="profile-card-title">Household Members ({members.length})</div>
        <div className="members-list">
          {members.map(m => (
            <div className="member-row" key={m._id}>
              <MemberAvatar name={m.name} />
              <div className="member-info">
                <div className="member-name">
                  {m.name}
                  {m._id === profile.id && <span className="you-badge">You</span>}
                </div>
                <div className="member-email">{m.email}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
      <button className="btn-logout" onClick={handleLogout}>Sign Out</button>
    </div>
  );
}
