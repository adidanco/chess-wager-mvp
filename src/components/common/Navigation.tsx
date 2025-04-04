import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

// Interface for a navigation item
interface NavItem {
  name: string;
  path: string;
  icon: string; // CSS class for icon
  requiresAuth: boolean;
}

const navItems: NavItem[] = [
  { name: 'Home', path: '/', icon: 'home', requiresAuth: true },
  { name: 'Wallet', path: '/wallet', icon: 'wallet', requiresAuth: true },
  { name: 'Profile', path: '/profile', icon: 'user', requiresAuth: true },
  { name: 'Settings', path: '/settings', icon: 'cog', requiresAuth: true },
  { name: 'Login', path: '/login', icon: 'sign-in-alt', requiresAuth: false },
  { name: 'Sign Up', path: '/signup', icon: 'user-plus', requiresAuth: false },
];

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, balance, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Handle navigation to a path
  const navigateTo = (path: string) => {
    navigate(path);
    setMenuOpen(false); // Close mobile menu after navigation
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to logout', error);
    }
    setMenuOpen(false);
  };

  // Filter navigation items based on authentication state
  const filteredNavItems = navItems.filter(item => 
    isAuthenticated ? item.requiresAuth : !item.requiresAuth
  );

  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          {/* Logo and Title */}
          <div className="flex items-center">
            <span className="text-xl font-bold text-emerald-600 cursor-pointer" onClick={() => navigateTo('/')}>
              Oasis
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {isAuthenticated && (
              <div className="mr-4 py-1 px-3 bg-emerald-50 rounded-full text-emerald-700 font-medium">
                ₹{balance || 0}
              </div>
            )}
            
            {filteredNavItems.map((item) => (
              <span
                key={item.path}
                onClick={() => navigateTo(item.path)}
                className={`cursor-pointer py-2 px-1 hover:text-emerald-600 transition-colors ${
                  location.pathname === item.path ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-700'
                }`}
              >
                <i className={`fas fa-${item.icon} mr-2`}></i>
                {item.name}
              </span>
            ))}
            
            {isAuthenticated && (
              <span
                onClick={handleLogout}
                className="cursor-pointer py-2 px-1 text-gray-700 hover:text-red-600 transition-colors"
              >
                <i className="fas fa-sign-out-alt mr-2"></i>
                Logout
              </span>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-gray-700 focus:outline-none"
            >
              <i className={`fas fa-${menuOpen ? 'times' : 'bars'} text-xl`}></i>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden mt-3 pb-2 space-y-2">
            {isAuthenticated && (
              <div className="px-4 py-2 bg-emerald-50 rounded-md text-emerald-700 font-medium mb-2">
                Balance: ₹{balance || 0}
              </div>
            )}
            
            {filteredNavItems.map((item) => (
              <div
                key={item.path}
                onClick={() => navigateTo(item.path)}
                className={`cursor-pointer px-4 py-2 rounded-md ${
                  location.pathname === item.path ? 'bg-emerald-100 text-emerald-600' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <i className={`fas fa-${item.icon} mr-3 w-6 text-center`}></i>
                {item.name}
              </div>
            ))}
            
            {isAuthenticated && (
              <div
                onClick={handleLogout}
                className="cursor-pointer px-4 py-2 text-red-600 hover:bg-red-50 rounded-md"
              >
                <i className="fas fa-sign-out-alt mr-3 w-6 text-center"></i>
                Logout
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation; 