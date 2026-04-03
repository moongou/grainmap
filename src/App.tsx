import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Map from './pages/Map';
import Settings from './pages/Settings';
import BrowsePage from './pages/BrowsePage';
import EditPage from './pages/EditPage';
import { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      if (!window.electronAPI) {
        setLoading(false);
        return;
      }

      try {
        const storedUser = await window.electronAPI.store.get('currentUser');
        if (storedUser) {
          setUser(storedUser);
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
    if (window.electronAPI) {
      await window.electronAPI.store.set('currentUser', userData);
    }
  };

  const handleLogout = async () => {
    setUser(null);
    if (window.electronAPI) {
      await window.electronAPI.store.set('currentUser', null);
    }
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
        <Route
          path="/browse/:photoId?"
          element={
            user ? (
              <BrowsePage user={user} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/edit/:photoId"
          element={
            user ? (
              <EditPage user={user} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/" element={<Navigate to={user ? "/map" : "/login"} replace />} />
      </Routes>
    </div>
  );
}

export default App;