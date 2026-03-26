import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Key, Globe, Bot, AlertCircle, MapPin } from 'lucide-react';
import { User, AIConfig } from '../types';

interface SettingsProps {
  user: User;
}

const AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', defaultUrl: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-3.5-turbo' },
  { id: 'claude', name: 'Claude (Anthropic)', defaultUrl: 'https://api.anthropic.com/v1/messages', defaultModel: 'claude-3-haiku-20240307' },
  { id: 'custom', name: '自定义 API', defaultUrl: '', defaultModel: '' },
];

function Settings({ user }: SettingsProps) {
  const navigate = useNavigate();
  const [, setAiConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Form state
  const [provider, setProvider] = useState<'openai' | 'claude' | 'custom'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [model, setModel] = useState('');
  const [amapApiKey, setAmapApiKey] = useState('');

  useEffect(() => {
    loadAIConfig();
  }, [user.id]);

  const loadAIConfig = async () => {
    try {
      const config = await window.electronAPI.db.getAIConfig(user.id);
      if (config) {
        setAiConfig(config);
        setProvider(config.provider);
        setApiKey(config.apiKey);
        setApiUrl(config.apiUrl || '');
        setModel(config.model || '');
      }
      
      // 加载高德地图 API Key
      const amapKey = await window.electronAPI.store.get('amapApiKey');
      if (amapKey) {
        setAmapApiKey(amapKey);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const handleProviderChange = (newProvider: 'openai' | 'claude' | 'custom') => {
    setProvider(newProvider);
    const providerInfo = AI_PROVIDERS.find(p => p.id === newProvider);
    if (providerInfo) {
      setApiUrl(providerInfo.defaultUrl);
      setModel(providerInfo.defaultModel);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('请输入 AI API Key');
      return;
    }

    if (provider === 'custom' && !apiUrl.trim()) {
      setError('请输入 API URL');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // 保存 AI 配置
      const config = await window.electronAPI.db.saveAIConfig(user.id, {
        provider,
        apiKey,
        apiUrl: apiUrl || undefined,
        model: model || undefined,
      });

      // 保存高德地图 API Key
      if (amapApiKey) {
        await window.electronAPI.store.set('amapApiKey', amapApiKey);
      }

      setAiConfig(config);
      setMessage('设置已保存');

      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      setError('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/map')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg mr-4"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">设置</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* 高德地图设置 Card */}
          <div className="card">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-primary-100 rounded-lg mr-3">
                <MapPin className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">高德地图设置</h2>
                <p className="text-sm text-gray-500">配置高德地图 API Key 以使用地图功能</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* 高德地图 API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center">
                    <Key className="w-4 h-4 mr-1" />
                    高德地图 API Key
                  </div>
                </label>
                <input
                  type="text"
                  value={amapApiKey}
                  onChange={(e) => setAmapApiKey(e.target.value)}
                  className="input-field"
                  placeholder="输入你的高德地图 API Key"
                />
                <p className="text-xs text-gray-500 mt-1">
                  你可以在 <a href="https://lbs.amap.com/" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">高德开放平台</a> 申请 API Key
                </p>
              </div>
            </div>
          </div>

          {/* AI Settings Card */}
          <div className="card">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-primary-100 rounded-lg mr-3">
                <Bot className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">AI 文案生成设置</h2>
                <p className="text-sm text-gray-500">配置大语言模型以生成照片文案</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
              </div>
            )}

            {message && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
                {message}
              </div>
            )}

            <div className="space-y-4">
              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI 提供商
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {AI_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleProviderChange(p.id as 'openai' | 'claude' | 'custom')}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${
                        provider === p.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{p.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center">
                    <Key className="w-4 h-4 mr-1" />
                    API Key
                  </div>
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input-field"
                  placeholder={`输入你的 ${AI_PROVIDERS.find(p => p.id === provider)?.name} API Key`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  你的 API Key 将被安全地存储在本地
                </p>
              </div>

              {/* API URL (for custom provider) */}
              {provider === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center">
                      <Globe className="w-4 h-4 mr-1" />
                      API URL
                    </div>
                  </label>
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    className="input-field"
                    placeholder="https://api.example.com/v1/chat"
                  />
                </div>
              )}

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模型
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="input-field"
                  placeholder={AI_PROVIDERS.find(p => p.id === provider)?.defaultModel || '模型名称'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  可选，留空将使用默认模型
                </p>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full btn-primary flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    保存设置
                  </>
                )}
              </button>
            </div>
          </div>

          {/* About Card */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">关于 Grainmap</h2>
            <div className="text-sm text-gray-600 space-y-2">
              <p>版本：1.0.0</p>
              <p>Grainmap 是一个照片地图应用，让你可以在地图上标记和记录你的照片故事。</p>
              <p>所有数据都存储在本地，保护你的隐私。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
