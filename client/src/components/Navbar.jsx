import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const NAV_LINKS = [
  { path: '/', label: 'Overview' },
  { path: '/activity', label: 'Activity' },
  { path: '/wealth', label: 'Wealth' },
  { path: '/profile', label: 'Profile' },
];

const TAB_LINKS = [
  { path: '/', label: 'Overview', icon: '📊' },
  { path: '/activity', label: 'Activity', icon: '💳' },
  { path: '/wealth', label: 'Wealth', icon: '📈' },
  { path: '/profile', label: 'Profile', icon: '👤' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Top bar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <Link to="/" className="brand-link">FamiBudget</Link>
          </div>
          {/* Desktop links */}
          <div className="navbar-links">
            {NAV_LINKS.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`nav-link${location.pathname === link.path ? ' active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          {/* User + logout */}
          <div className="navbar-user">
            <span className="user-name">{user?.name || user?.email}</span>
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <div className="tab-bar">
        {TAB_LINKS.map(link => (
          <Link
            key={link.path}
            to={link.path}
            className={`tab-item${location.pathname === link.path ? ' active' : ''}`}
          >
            <span className="tab-icon">{link.icon}</span>
            <span className="tab-label">{link.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
