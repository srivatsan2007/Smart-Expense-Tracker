import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { notify } from '../components/Toast.jsx';
import { getAuthHeaders } from '../hooks/useAuth.js';
import {
  Shield,
  Search,
  Trash2,
  Crown,
  User,
  AlertCircle,
  Mail,
  Phone
} from '../components/Icons.jsx';

export default function Admin() {
  const [users, setUsers] = useState(null); // null = loading
  const [term, setTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name }
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { headers: getAuthHeaders() });
      if (res.status === 403 || res.status === 401) {
        notify('Access Denied: Administrator rights required', 'error');
        navigate('/dashboard');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } else {
        notify('Failed to load user directory', 'error');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      notify('Network error fetching users', 'error');
    }
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || user.role !== 'admin') {
      notify('Access Denied: You must be an administrator to view this page.', 'error');
      navigate('/dashboard');
      return;
    }
    fetchUsers();
  }, [navigate]);

  const stats = useMemo(() => {
    if (!users) return { total: 0, admins: 0, regular: 0 };
    const total = users.length;
    const admins = users.filter((u) => u.role === 'admin').length;
    return { total, admins, regular: total - admins };
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!term.trim()) return users;
    const q = term.toLowerCase();
    return users.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.mobileNumber || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q) || role.includes(q);
    });
  }, [users, term]);

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        notify(data.message || `User ${deleteTarget.name} deleted successfully.`, 'success');
        setDeleteTarget(null);
        fetchUsers();
      } else {
        notify(data.message || 'Failed to delete user', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      notify('An error occurred while deleting user', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout title="Admin Panel - RupeeRise" adminOnly active="admin">
      <PageHeader
        title="Admin Control Center"
        subtitle="Manage registered accounts, view system access roles, and maintain data security"
      />

      {/* Summary Stats */}
      <div className="stats-grid">
        <StatCard
          label="Total Registered Users"
          value={stats.total}
          sub="Active accounts in database"
          icon={<User size={22} />}
          badge="Accounts"
          variant="primary"
        />
        <StatCard
          label="System Administrators"
          value={stats.admins}
          sub="Privileged management accounts"
          icon={<Crown size={22} />}
          badge="Admins"
          variant="default"
        />
        <StatCard
          label="Standard Users"
          value={stats.regular}
          sub="Regular tracker accounts"
          icon={<Shield size={22} />}
          badge="Clients"
          variant="success"
        />
      </div>

      {/* Main Table Card */}
      <div className="glass-card" style={{ marginTop: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 14
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Registered Users Directory</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Manage access permissions and member status
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '6px 12px',
              gap: 8,
              minWidth: 260
            }}
          >
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by name, email, role..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.88rem',
                color: 'var(--text-color)',
                width: '100%'
              }}
            />
          </div>
        </div>

        {users === null ? (
          <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px auto' }}></div>
            <p>Loading user directory...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={<User size={36} />}
            title="No Users Found"
            description={term ? `No accounts match "${term}". Try another search keyword.` : 'No registered users in the database.'}
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Mobile Number</th>
                  <th>Role</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isAdmin = u.role === 'admin';
                  const initials = (u.name || 'U')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr key={u._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: isAdmin ? 'rgba(71, 127, 224, 0.15)' : 'rgba(100, 116, 139, 0.12)',
                              color: isAdmin ? 'var(--primary-color)' : 'var(--text-color)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.82rem'
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <span style={{ fontWeight: 600 }}>{u.name || 'Unknown'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                          {u.email}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                          {u.mobileNumber || '—'}
                        </span>
                      </td>
                      <td>
                        {isAdmin ? (
                          <span
                            className="badge badge-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Crown size={12} />
                            <span>Admin</span>
                          </span>
                        ) : (
                          <span className="badge badge-default">User</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isAdmin ? (
                          <span
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--text-muted)',
                              fontStyle: 'italic',
                              padding: '4px 8px'
                            }}
                          >
                            Protected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: u._id, name: u.name || u.email })}
                            className="btn btn-secondary btn-icon"
                            title="Delete user"
                            style={{
                              color: 'var(--danger-color)',
                              borderColor: 'rgba(239, 68, 68, 0.25)',
                              background: 'rgba(239, 68, 68, 0.05)'
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete User Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Permanently Delete User"
      >
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              color: 'var(--danger-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}
          >
            <AlertCircle size={28} />
          </div>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8, color: 'var(--danger-color)' }}>
            Delete user &ldquo;{deleteTarget?.name}&rdquo;?
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: 24 }}>
            This will permanently remove this user account and cascade-delete all their recorded expenses, bills, salary history, and savings goals.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              style={{ flex: 1.5 }}
              onClick={confirmDeleteUser}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete User'}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
