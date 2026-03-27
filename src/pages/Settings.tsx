import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Key, Globe, Bot, AlertCircle, MapPin, Search, CheckCircle2 } from 'lucide-react';
import { User, AIConfig } from '../types';

interface SettingsProps {
  user: User;
}

const AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', defaultUrl: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-3.5-turbo' },
  { id: 'claude', name: 'Claude (Anthropic)', defaultUrl: 'https://api.anthropic.com/v1/messages', defaultModel: 'claude-3-haiku-20240307' },
  { id: 'ollama', name: 'Ollama (本地)', defaultUrl: 'http://localhost:11434/api/chat', defaultModel: 'llama3' },
  { id: 'volcano', name: '火山大模型 (Ark)', defaultUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', defaultModel: 'ep-xxx' },
  { id: 'custom', name: '自定义 API', defaultUrl: '', defaultModel: '' },
];

const MAP_PROVIDERS = [
  { id: 'baidu', name: '百度地图', needsKey: false, needsSecurity: false },
  { id: 'tianditu', name: '天地图', needsKey: true, needsSecurity: false },
];

function Settings({ user }: SettingsProps) {
  const navigate = useNavigate();

  if (!window.electronAPI) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-10 bg-gray-50 text-gray-500">
        <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">环境错误</h2>
        <p>未检测到 Electron 接口。请确保在应用内运行。</p>
        <button onClick={() => navigate('/map')} className="mt-4 text-primary-600 hover:underline">返回</button>
      </div>
    );
  }

  const [, setAiConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Form state
  const [provider, setProvider] = useState<'openai' | 'claude' | 'ollama' | 'volcano' | 'custom'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [model, setModel] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Map state
  const [mapProvider, setMapProvider] = useState<'tianditu' | 'baidu'>('baidu');
  const [tiandituKey, setTiandituKey] = useState('');

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

      // 加载地图设置
      const tKey = await window.electronAPI.store.get('tiandituKey');
      if (tKey) setTiandituKey(tKey);

      const mProvider = await window.electronAPI.store.get('mapProvider');
      if (mProvider) setMapProvider(mProvider as any);
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const handleProviderChange = (newProvider: 'openai' | 'claude' | 'ollama' | 'volcano' | 'custom') => {
    setProvider(newProvider);
    const providerInfo = AI_PROVIDERS.find(p => p.id === newProvider);
    if (providerInfo) {
      setApiUrl(providerInfo.defaultUrl);
      setModel(providerInfo.defaultModel);
      setAvailableModels([]); // Reset available models
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError('');
    setMessage('');

    try {
      const result = await window.electronAPI.db.testAIConnection({
        provider,
        apiKey: provider === 'ollama' ? (apiKey || 'ollama') : apiKey,
        apiUrl: apiUrl || undefined,
      });

      if (result.success) {
        setAvailableModels(result.models || []);
        setMessage('连接成功！已获取可用模型列表。');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setError(`连接失败: ${result.error}`);
      }
    } catch (error: any) {
      setError(`连接错误: ${error.message || '未知错误'}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // 1. 保存地图设置 (不依赖于 AI 设置)
      await window.electronAPI.store.set('mapProvider', mapProvider);
      if (tiandituKey) await window.electronAPI.store.set('tiandituKey', tiandituKey);

      // 2. 保存 AI 配置
      const config = await window.electronAPI.db.saveAIConfig(user.id, {
        provider,
        apiKey: provider === 'ollama' ? (apiKey || 'ollama') : apiKey,
        apiUrl: apiUrl || undefined,
        model: model || undefined,
      });

      setAiConfig(config);
      setMessage('设置已保存');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error saving config:', error);
      setError(`保存失败: ${error.message || '请重试'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/map')}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg mr-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="text-base font-bold text-gray-900">设置</h1>
            </div>
            <button
              onClick={handleSave}
              disabled={loading}
              className="btn-primary !py-1.5 !px-3 text-sm flex items-center shadow-sm"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              保存设置
            </button>
          </div>
        </div>
      </div>

      {/* Content - Scrollable container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
          {/* Map Provider Settings Card */}
          <div className="card !p-4">
            <div className="flex items-center mb-3">
              <div className="p-1.5 bg-primary-100 rounded-lg mr-2.5">
                <MapPin className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">地图服务设置</h2>
                <p className="text-[10px] text-gray-500">配置地图提供商和 API Key</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Provider Selection */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  地图提供商
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MAP_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setMapProvider(p.id as any)}
                      className={`p-2 rounded-lg border-2 text-center transition-all ${
                        mapProvider === p.id
                          ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-200'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900">{p.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {mapProvider === 'tianditu' && (
                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <div className="flex items-center">
                        <Key className="w-3.5 h-3.5 mr-1 text-gray-400" />
                        天地图浏览器端 Token (tk)
                      </div>
                    </label>
                    <input
                      type="text"
                      value={tiandituKey}
                      onChange={(e) => setTiandituKey(e.target.value)}
                      className="input-field text-sm !py-1.5"
                      placeholder="输入你的天地图 tk"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      你可以在 <a href="https://www.tianditu.gov.cn/" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">国家地理信息公共服务平台 (天地图)</a> 申请
                    </p>
                  </div>
                </div>
              )}

              {mapProvider === 'baidu' && (
                <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg text-[11px] flex items-start border border-blue-100">
                  <Globe className="w-3.5 h-3.5 mr-2 mt-0.5 flex-shrink-0" />
                  <p>百度地图将以第三方图层方式载入。由于坐标系统差异 (BD-09)，标记位置可能会有少量偏移。</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Settings Card */}
          <div className="card !p-4">
            <div className="flex items-center mb-3">
              <div className="p-1.5 bg-primary-100 rounded-lg mr-2.5">
                <Bot className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">AI 文案生成设置</h2>
                <p className="text-[10px] text-gray-500">配置大语言模型以生成照片文案</p>
              </div>
            </div>

            {error && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-xs animate-slide-up">
                <AlertCircle className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                {error}
              </div>
            )}

            {message && (
              <div className="mb-3 p-2.5 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs flex items-center animate-slide-up">
                <CheckCircle2 className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                {message}
              </div>
            )}

            <div className="space-y-4">
              {/* Provider Selection */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  AI 提供商
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {AI_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleProviderChange(p.id as any)}
                      className={`p-1.5 rounded-lg border-2 text-center transition-all ${
                        provider === p.id
                          ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-200'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-xs font-medium text-gray-900">{p.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* API Key */}
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <div className="flex items-center">
                      <Key className="w-3 h-3 mr-1 text-gray-400" />
                      API Key
                    </div>
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="input-field text-sm !py-1.5"
                    placeholder={provider === 'ollama' ? 'Ollama 不需要 API Key' : '输入你的 API Key'}
                    disabled={provider === 'ollama'}
                  />
                </div>

                {/* API URL */}
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <div className="flex items-center">
                      <Globe className="w-3 h-3 mr-1 text-gray-400" />
                      API URL
                    </div>
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className="input-field text-sm !py-1.5 flex-1"
                      placeholder="API 地址"
                    />
                    <button
                      onClick={handleTestConnection}
                      disabled={testing}
                      className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center"
                    >
                      {testing ? <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-1" /> : <Search className="w-3 h-3 mr-1" />}
                      测试
                    </button>
                  </div>
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">模型名称</label>
                {availableModels.length > 0 ? (
                  <div className="relative">
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="input-field text-sm !py-1.5 appearance-none"
                    >
                      <option value="">请选择模型...</option>
                      {availableModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                      <Search className="w-3 h-3" />
                    </div>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="input-field text-sm !py-1.5"
                    placeholder="例如: gpt-3.5-turbo 或自定义模型 ID"
                  />
                )}
                <p className="text-[10px] text-gray-500 mt-1">
                  {availableModels.length > 0 ? '建议从已加载的列表中选择' : '点击“测试”可自动获取可用模型列表'}
                </p>
              </div>
            </div>
          </div>

          {/* About Card */}
          <div className="card !p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">关于 Grainmap</h2>
            <div className="text-[11px] text-gray-600 space-y-1">
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
