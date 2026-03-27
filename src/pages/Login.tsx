import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Loader2, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSuperuserLogin = () => {
    const superuser: User = {
      id: 'superuser-id',
      username: 'rainforgrain',
      password: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onLogin(superuser);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (username === 'rainforgrain') {
      handleSuperuserLogin();
      return;
    }

    setLoading(true);

    try {
      const user = await window.electronAPI.db.validateUser(username, password);
      if (user) {
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
          <p className="text-gray-600 mt-2 text-sm">在地图上记录你的照片故事</p>
        </div>

        {/* Superuser Shortcut */}
        <div className="mb-6">
          <button
            onClick={handleSuperuserLogin}
            className="w-full flex items-center justify-between p-3 bg-white border-2 border-primary-100 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-all group"
          >
            <div className="flex items-center">
              <div className="p-2 bg-primary-100 rounded-lg mr-3 group-hover:bg-primary-200 transition-colors">
                <UserIcon className="w-5 h-5 text-primary-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900 leading-none">rainforgrain</p>
                <p className="text-[10px] text-gray-500 mt-1">点击立即快捷登录</p>
              </div>
            </div>
            <div className="px-2 py-1 bg-primary-600 text-white text-[10px] font-bold rounded-md">
              SUPERUSER
            </div>
          </button>

          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <span className="relative px-3 bg-white text-xs text-gray-400">或使用普通账号</span>
          </div>
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
