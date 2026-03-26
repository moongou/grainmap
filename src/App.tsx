import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Map from './pages/Map';
import Settings from './pages/Settings';
import InstallationGuide from './components/InstallationGuide';
import { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInstallationGuide, setShowInstallationGuide] = useState(false);

  useEffect(() => {
    // Check for stored user session and show installation guide on first launch
    const checkSession = async () => {
      try {
        const storedUser = await window.electronAPI.store.get('currentUser');
        if (storedUser) {
          setUser(storedUser);
        }

        // Check if installation guide has been shown
        const guideShown = await window.electronAPI.store.get('installationGuideShown');
        if (!guideShown) {
          setShowInstallationGuide(true);
          await window.electronAPI.store.set('installationGuideShown', true);
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleLogin = async (userData: User) => {
    setUser(userData);
    await window.electronAPI.store.set('currentUser', userData);
  };

  const handleLogout = async () => {
    setUser(null);
    await window.electronAPI.store.set('currentUser', null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-lg text-gray-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <Routes>
        <Route
          path="/login"
          element={
            user ? <Navigate to="/map" replace /> : <Login onLogin={handleLogin} />
          }
        />
        <Route
          path="/register"
          element={
            user ? <Navigate to="/map" replace /> : <Register onRegister={handleLogin} />
          }
        />
        <Route
          path="/map"
          element={
            user ? (
              <Map user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/settings"
          element={
            user ? (
              <Settings user={user} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/" element={<Navigate to={user ? "/map" : "/login"} replace />} />
      </Routes>
      {showInstallationGuide && (
        <InstallationGuide onClose={() => setShowInstallationGuide(false)} />
      )}
    </div>
  );
}

export default App;