import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Key, Globe, Bot, AlertCircle, MapPin, Search, CheckCircle2, HelpCircle, Download, Upload, Database, X } from 'lucide-react';
import { User, AIConfig, MapProvider, Album } from '../types';
import OperationGuide from '../components/OperationGuide';

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
  { id: 'tencent', name: '腾讯地图 (Tencent)', needsKey: false, needsSecurity: false },
  { id: 'osm', name: 'OpenStreetMap', needsKey: false, needsSecurity: false },
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
  const [showGuide, setShowGuide] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [showImportConflict, setShowImportConflict] = useState(false);
  const [importData, setImportData] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Form state
  const [provider, setProvider] = useState<'openai' | 'claude' | 'ollama' | 'volcano' | 'custom'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [model, setModel] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Map state
  const [mapProvider, setMapProvider] = useState<MapProvider>('tencent');

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
      const mProvider = await window.electronAPI.store.get('mapProvider');
      if (mProvider === 'tencent' || mProvider === 'osm') {
        setMapProvider(mProvider);
      }

      // 加载相册列表
      const userAlbums = await window.electronAPI.db.getAlbumsByUser(user.id);
      setAlbums(userAlbums);
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

  const handleExport = async () => {
    if (!selectedAlbumId) {
      setError('请先选择要导出的相册');
      return;
    }

    setIsExporting(true);
    setError('');
    setMessage('');

    try {
      let exportPayload: any = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
      };

      if (selectedAlbumId === 'all') {
        // 导出全部相册
        const allPhotos = await window.electronAPI.db.getPhotosByUser(user.id);
        const allAlbums = await window.electronAPI.db.getAlbumsByUser(user.id);
        exportPayload.albums = allAlbums;
        exportPayload.photos = allPhotos;
      } else {
        // 导出单个相册
        const album = albums.find(a => a.id === selectedAlbumId);
        if (!album) throw new Error('未找到相册');
        const photos = await window.electronAPI.db.getPhotosByAlbum(selectedAlbumId);
        exportPayload.album = album;
        exportPayload.photos = photos;
      }

      const success = await window.electronAPI.file.exportData(exportPayload);
      if (success) {
        setMessage(selectedAlbumId === 'all' ? '所有数据导出成功！' : '相册导出成功！');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err: any) {
      setError(`导出失败: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportRequest = async () => {
    setIsImporting(true);
    setError('');
    setMessage('');

    try {
      const data = await window.electronAPI.file.importData();
      if (!data) return;

      // 验证数据结构 (支持单个相册或多个相册)
      const hasSingle = data.album && data.photos;
      const hasMultiple = data.albums && Array.isArray(data.albums);

      if (!hasSingle && !hasMultiple) {
        throw new Error('无效的导出文件格式');
      }

      if (hasMultiple) {
        // 处理多个相册导入逻辑
        await executeBulkImport(data);
      } else {
        // 处理单个相册冲突逻辑
        const existingAlbum = albums.find(a => a.name === data.album.name);
        if (existingAlbum) {
          setImportData({ ...data, existingId: existingAlbum.id });
          setShowImportConflict(true);
        } else {
          await executeImport(data, 'new');
        }
      }
    } catch (err: any) {
      setError(`导入失败: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const executeBulkImport = async (data: any) => {
    try {
      setLoading(true);
      const userAlbums = await window.electronAPI.db.getAlbumsByUser(user.id);
      const existingAlbumNames = new Set(userAlbums.map(a => a.name));

      for (const albumData of data.albums) {
        let finalName = albumData.name;
        let counter = 1;
        while (existingAlbumNames.has(finalName)) {
          finalName = `${albumData.name} (${counter})`;
          counter++;
        }
        existingAlbumNames.add(finalName);

        const newAlbum = await window.electronAPI.db.createAlbum(user.id, {
          name: finalName,
          description: albumData.description
        });

        // 导入该相册下的照片
        const albumPhotos = data.photos.filter((p: any) => p.albumId === albumData.id);
        for (const photo of albumPhotos) {
          await window.electronAPI.db.createPhoto({
            ...photo,
            userId: user.id,
            albumId: newAlbum.id,
            id: undefined,
            createdAt: undefined,
            updatedAt: undefined
          });
        }
      }

      // 处理那些不属于任何导出相册的照片 (如果有的话)
      const unassignedPhotos = data.photos.filter((p: any) => !p.albumId);
      if (unassignedPhotos.length > 0) {
        for (const photo of unassignedPhotos) {
          await window.electronAPI.db.createPhoto({
            ...photo,
            userId: user.id,
            albumId: null,
            id: undefined,
            createdAt: undefined,
            updatedAt: undefined
          });
        }
      }

      setMessage('所有相册数据已成功导入！');
      loadAIConfig();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      throw new Error(`批量导入失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const executeImport = async (data: any, mode: 'new' | 'append' | 'overwrite') => {
    try {
      setLoading(true);
      setShowImportConflict(false);

      let targetAlbumId: string;

      if (mode === 'new') {
        const newAlbum = await window.electronAPI.db.createAlbum(user.id, {
          name: data.album.name,
          description: data.album.description
        });
        targetAlbumId = newAlbum.id;
      } else if (mode === 'append') {
        targetAlbumId = data.existingId;
      } else { // overwrite
        // Clear existing photos in the album first?
        // For simplicity, let's just use the existing album and add new photos
        // The user might expect "overwrite" to delete old ones.
        const existingPhotos = await window.electronAPI.db.getPhotosByAlbum(data.existingId);
        for (const p of existingPhotos) {
          await window.electronAPI.db.deletePhoto(p.id);
          if (p.imagePath) await window.electronAPI.file.deleteImage(p.imagePath);
        }
        targetAlbumId = data.existingId;
      }

      // Create photos
      const existingPhotosInTarget = mode === 'append'
        ? await window.electronAPI.db.getPhotosByAlbum(targetAlbumId)
        : [];

      const existingTitles = new Set(existingPhotosInTarget.map(p => p.title));

      for (const photo of data.photos) {
        let finalTitle = photo.title;
        let counter = 1;

        // 自动修改冲突标题
        while (existingTitles.has(finalTitle)) {
          finalTitle = `${photo.title} (${counter})`;
          counter++;
        }
        existingTitles.add(finalTitle);

        await window.electronAPI.db.createPhoto({
          ...photo,
          title: finalTitle,
          userId: user.id,
          albumId: targetAlbumId,
          id: undefined, // Let DB generate new ID
          createdAt: undefined,
          updatedAt: undefined
        });
      }

      setMessage('导入成功！');
      loadAIConfig(); // Refresh album list
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(`执行导入时出错: ${err.message}`);
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
              <button
                onClick={() => setShowGuide(true)}
                className="ml-3 p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="操作指引"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
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
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
          {/* Logo Sidebar */}
          <div className="w-full md:w-80 flex-shrink-0">
            <div className="bg-white rounded-3xl shadow-xl p-4 border border-gray-100 sticky top-0 overflow-hidden group">
              <div className="absolute -inset-2 bg-primary-500/5 blur-2xl group-hover:bg-primary-500/10 transition-colors" />
              <img
                src="assets/grainmap-logo.jpg"
                alt="Grainmap Logo"
                className="relative w-full rounded-2xl shadow-inner object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "https://ui-avatars.com/api/?name=Grainmap&background=1e3a8a&color=fff&size=512";
                }}
              />
              <div className="mt-4 px-2">
                <h3 className="text-lg font-bold text-gray-900">Grainmap</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">记录每一颗被点亮的足迹，编织属于你的地理记忆。</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4">
            {/* Map Provider Settings Card */}
            <div className="card !p-4">
              <div className="flex items-center mb-3">
                <div className="p-1.5 bg-primary-100 rounded-lg mr-2.5">
                  <MapPin className="w-4 h-4 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">地图服务设置</h2>
                  <p className="text-[10px] text-gray-500">切换当前可用的地图底图</p>
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

            {/* Data Management Card */}
            <div className="card !p-4">
              <div className="flex items-center mb-3">
                <div className="p-1.5 bg-primary-100 rounded-lg mr-2.5">
                  <Database className="w-4 h-4 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">数据管理 (导入/导出)</h2>
                  <p className="text-[10px] text-gray-500">导出相册备份或从其他设备导入数据 (*.grainmap)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export Section */}
                <div className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-700 flex items-center">
                      <Download className="w-3.5 h-3.5 mr-1.5 text-primary-500" />
                      导出相册
                    </h3>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1.5">选择要导出的相册</label>
                    <select
                      value={selectedAlbumId}
                      onChange={(e) => setSelectedAlbumId(e.target.value)}
                      className="input-field text-sm !py-1.5 mb-3"
                    >
                      <option value="">-- 请选择导出范围 --</option>
                      <option value="all" className="font-bold text-primary-600 italic">全部相册 (完整备份)</option>
                      <hr />
                      {albums.map(album => (
                        <option key={album.id} value={album.id}>{album.name}</option>
                      ))}
                    </select>

                    <button
                      onClick={handleExport}
                      disabled={isExporting || !selectedAlbumId}
                      className="w-full btn-primary !py-2 text-xs flex items-center justify-center shadow-sm disabled:opacity-50"
                    >
                      {isExporting ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        <Download className="w-3.5 h-3.5 mr-2" />
                      )}
                      开始导出 (.grainmap)
                    </button>
                    <p className="text-[9px] text-gray-400 mt-2 italic">包含照片、EXIF、文案、标题及描述等所有信息。</p>
                  </div>
                </div>

                {/* Import Section */}
                <div className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-700 flex items-center">
                      <Upload className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                      导入数据
                    </h3>
                  </div>

                  <div className="flex flex-col h-full justify-between">
                    <p className="text-[11px] text-gray-600 mb-4">从本地导入生成的 *.grainmap 文件到本系统中。</p>

                    <button
                      onClick={handleImportRequest}
                      disabled={isImporting}
                      className="w-full bg-white border-2 border-gray-200 text-gray-700 py-2 rounded-lg text-xs font-bold hover:border-primary-300 hover:text-primary-600 transition-all flex items-center justify-center shadow-sm"
                    >
                      {isImporting ? (
                        <div className="w-3.5 h-3.5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 mr-2" />
                      )}
                      导入文件
                    </button>
                    <p className="text-[9px] text-gray-400 mt-2 italic">如果相册名重复，系统将询问处理方式。</p>
                  </div>
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

      {/* Operation Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">操作指引</h2>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <OperationGuide />
            </div>
          </div>
        </div>
      )}

      {/* Import Conflict Modal */}
      {showImportConflict && importData && (
        <div className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />
                <h3 className="text-lg font-bold text-gray-900">导入相册名冲突</h3>
              </div>
              <button onClick={() => setShowImportConflict(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              系统内已存在名为 <span className="font-bold text-primary-600">"{importData.album.name}"</span> 的相册。
              请选择处理方式：
            </p>

            <div className="space-y-3">
              <button
                onClick={() => executeImport(importData, 'append')}
                className="w-full p-4 border-2 border-gray-100 hover:border-primary-500 hover:bg-primary-50 rounded-xl transition-all text-left group"
              >
                <div className="text-sm font-bold text-gray-900 group-hover:text-primary-700">追加</div>
                <div className="text-xs text-gray-500">保留现有照片，并将新照片添加至该相册。</div>
              </button>

              <button
                onClick={() => executeImport(importData, 'overwrite')}
                className="w-full p-4 border-2 border-gray-100 hover:border-red-500 hover:bg-red-50 rounded-xl transition-all text-left group"
              >
                <div className="text-sm font-bold text-gray-900 group-hover:text-red-700">覆盖</div>
                <div className="text-xs text-gray-500">删除原相册内的所有照片，并导入当前新照片。</div>
              </button>

              <button
                onClick={() => {
                  const newName = `${importData.album.name} (导入-${new Date().toLocaleTimeString()})`;
                  executeImport({ ...importData, album: { ...importData.album, name: newName } }, 'new');
                }}
                className="w-full p-4 border-2 border-gray-100 hover:border-green-500 hover:bg-green-50 rounded-xl transition-all text-left group"
              >
                <div className="text-sm font-bold text-gray-900 group-hover:text-green-700">创建新相册</div>
                <div className="text-xs text-gray-500">保持原相册不变，新建一个包含时间戳名称的相册。</div>
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowImportConflict(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
