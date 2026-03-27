import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Loader2 } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [amapApiKey, setAmapApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await window.electronAPI.db.validateUser(username, password);
      if (user) {
        // Store AMap Key if provided
        if (amapApiKey) {
          await window.electronAPI.store.set('amapApiKey', amapApiKey);
        }
        onLogin(user);
      } else {
        setError('用户名或密码错误');
      }
    } catch (err) {
      setError('登录失败，请重试');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="card w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <MapPin className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Grainmap</h1>
          <p className="text-gray-600 mt-2">在地图上记录你的照片故事</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              placeholder="请输入用户名"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="请输入密码"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              高德地图 API Key (可选)
            </label>
            <input
              type="text"
              value={amapApiKey}
              onChange={(e) => setAmapApiKey(e.target.value)}
              className="input-field"
              placeholder="请输入高德地图 API Key"
            />
            <p className="text-xs text-gray-500 mt-1">如果已在设置中配置，可留空</p>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                登录中...
              </>
            ) : (
              '登录'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            还没有账号？{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              立即注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
