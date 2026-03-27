import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, Plus, X, Image as ImageIcon, Loader2, Sparkles, MapPin, Download, Upload } from 'lucide-react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { User, Photo } from '../types';
import PhotoModal from '../components/PhotoModal';
import AIGenerateModal from '../components/AIGenerateModal';

interface MapProps {
  user: User;
  onLogout: () => void;
}

// 海南省中心位置，使整个海南省居中
const HAINAN_CENTER = [109.73, 19.03];

function Map({ user, onLogout }: MapProps) {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'terrain'>('standard');
  const [mapProvider, setMapProvider] = useState<'amap' | 'tianditu' | 'baidu' | 'osm'>('amap');

  // 选点地图引用
  const selectMapContainerRef = useRef<HTMLDivElement>(null);
  const selectMapRef = useRef<any>(null);

  // 添加照片表单状态
  const [newPhoto, setNewPhoto] = useState<Partial<Photo>>({
    title: '',
    description: '',
    latitude: HAINAN_CENTER[1],
    longitude: HAINAN_CENTER[0],
    address: '',
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState('');

  // 初始化地图
  useEffect(() => {
    const initMap = async () => {
      try {
        // 从本地存储中获取地图配置
        const amapApiKey = await window.electronAPI.store.get('amapApiKey');
        const amapSec = await window.electronAPI.store.get('amapSecurityCode');
        const mProvider = await window.electronAPI.store.get('mapProvider') || 'amap';
        const tKey = await window.electronAPI.store.get('tiandituKey');

        setMapProvider(mProvider as any);

        // 设置高德地图安全密钥 (必须在 AMapLoader.load 之前设置)
        if (amapSec) {
          (window as any)._AMapSecurityConfig = {
            securityJsCode: amapSec,
          };
        }

        const AMap = await AMapLoader.load({
          key: amapApiKey || 'YOUR_AMAP_KEY',
          version: '2.0',
          plugins: ['AMap.ToolBar', 'AMap.Scale', 'AMap.Geocoder', 'AMap.ControlBar'],
        });

        if (mapContainerRef.current) {
          const map = new AMap.Map(mapContainerRef.current, {
            zoom: 7.8,
            center: HAINAN_CENTER,
            viewMode: '3D',
          });

          // 根据提供商配置图层
          configureMapLayers(map, mProvider, tKey);

          map.addControl(new AMap.ToolBar());
          map.addControl(new AMap.Scale());

          const controlBar = new (window as any).AMap.ControlBar({
            position: { right: '10px', top: '10px' }
          });
          map.addControl(controlBar);

          mapRef.current = map;
          setMapLoading(false);
        }
      } catch (error) {
        console.error('Map initialization error:', error);
        setMapLoading(false);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) mapRef.current.destroy();
    };
  }, []);

  // 配置地图图层
  const configureMapLayers = (map: any, provider: string, tKey?: string) => {
    if (provider === 'tianditu' && tKey) {
      // 天地图图层
      const vecLayer = new (window as any).AMap.TileLayer({
        getTileUrl: (x: number, y: number, z: number) =>
          `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL=${x}&TILEROW=${y}&TILEMATRIX=${z}&tk=${tKey}`
      });
      const cvaLayer = new (window as any).AMap.TileLayer({
        getTileUrl: (x: number, y: number, z: number) =>
          `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL=${x}&TILEROW=${y}&TILEMATRIX=${z}&tk=${tKey}`
      });
      map.setLayers([vecLayer, cvaLayer]);
    } else if (provider === 'osm') {
      // OSM 图层
      const osmLayer = new (window as any).AMap.TileLayer({
        getTileUrl: 'https://{a,b,c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      });
      map.setLayers([osmLayer]);
    } else if (provider === 'baidu') {
      // 百度地图图层 (模仿浏览器地址)
      const baiduLayer = new (window as any).AMap.TileLayer({
        getTileUrl: (x: number, y: number, z: number) => {
          const res = Math.pow(2, z - 18);
          const offsetX = x * res;
          const offsetY = y * res;
          // 百度切片服务 URL，使用随机服务器以提高性能
          const server = Math.abs(x + y) % 4;
          return `https://maponline${server}.bdimg.com/tile/?qt=vtile&x=${x}&y=${y}&z=${z}&styles=pl&scaler=1&udt=20230519`;
        },
        tileSize: 256,
        zooms: [3, 19]
      });
      map.setLayers([baiduLayer]);
    }
  };

  // 切换地图类型 (主地图)
  useEffect(() => {
    if (!mapRef.current) return;
    updateMapLayers(mapRef.current);
  }, [mapType, mapProvider]);

  // 切换地图类型 (选点地图)
  useEffect(() => {
    if (!selectMapRef.current) return;
    updateMapLayers(selectMapRef.current);
  }, [mapType, mapProvider, showAddModal]);

  const updateMapLayers = async (mapInstance: any) => {
    if (mapProvider === 'amap') {
      if (mapType === 'satellite') {
        const satellite = new (window as any).AMap.TileLayer.Satellite();
        const roadNet = new (window as any).AMap.TileLayer.RoadNet();
        mapInstance.setLayers([satellite, roadNet]);
      } else {
        mapInstance.setLayers([new (window as any).AMap.TileLayer()]);
      }
    } else if (mapProvider === 'tianditu') {
      const tKey = await window.electronAPI.store.get('tiandituKey');
      if (!tKey) return;
      let layers = [];
      if (mapType === 'satellite') {
        layers.push(new (window as any).AMap.TileLayer({
          getTileUrl: (x: number, y: number, z: number) =>
            `https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL=${x}&TILEROW=${y}&TILEMATRIX=${z}&tk=${tKey}`
        }));
        layers.push(new (window as any).AMap.TileLayer({
          getTileUrl: (x: number, y: number, z: number) =>
            `https://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL=${x}&TILEROW=${y}&TILEMATRIX=${z}&tk=${tKey}`
        }));
      } else if (mapType === 'terrain') {
        layers.push(new (window as any).AMap.TileLayer({
          getTileUrl: (x: number, y: number, z: number) =>
            `https://t0.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL=${x}&TILEROW=${y}&TILEMATRIX=${z}&tk=${tKey}`
        }));
        layers.push(new (window as any).AMap.TileLayer({
          getTileUrl: (x: number, y: number, z: number) =>
            `https://t0.tianditu.gov.cn/cta_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cta&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL=${x}&TILEROW=${y}&TILEMATRIX=${z}&tk=${tKey}`
        }));
      } else {
        layers.push(new (window as any).AMap.TileLayer({
          getTileUrl: (x: number, y: number, z: number) =>
            `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL=${x}&TILEROW=${y}&TILEMATRIX=${z}&tk=${tKey}`
        }));
        layers.push(new (window as any).AMap.TileLayer({
          getTileUrl: (x: number, y: number, z: number) =>
            `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL=${x}&TILEROW=${y}&TILEMATRIX=${z}&tk=${tKey}`
        }));
      }
      mapInstance.setLayers(layers);
    } else if (mapProvider === 'osm') {
      const osmLayer = new (window as any).AMap.TileLayer({
        getTileUrl: 'https://{a,b,c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      });
      mapInstance.setLayers([osmLayer]);
    } else if (mapProvider === 'baidu') {
      const baiduLayer = new (window as any).AMap.TileLayer({
        getTileUrl: (x: number, y: number, z: number) => {
          const server = Math.abs(x + y) % 4;
          if (mapType === 'satellite') {
            return `https://shangetu${server}.map.bdimg.com/it/u=x=${x};y=${y};z=${z};v=009;type=sate&fm=46`;
          }
          return `https://maponline${server}.bdimg.com/tile/?qt=vtile&x=${x}&y=${y}&z=${z}&styles=pl&scaler=1&udt=20230519`;
        }
      });
      mapInstance.setLayers([baiduLayer]);
    }
  };

  // 处理选点地图的显示
  useEffect(() => {
    if (showAddModal && selectMapContainerRef.current) {
      const initSelectMap = async () => {
        try {
          const amapApiKey = await window.electronAPI.store.get('amapApiKey');
          const amapSec = await window.electronAPI.store.get('amapSecurityCode');
          const mProvider = await window.electronAPI.store.get('mapProvider') || 'amap';
          const tKey = await window.electronAPI.store.get('tiandituKey');

          if (amapSec) {
            (window as any)._AMapSecurityConfig = { securityJsCode: amapSec };
          }

          const AMap = await AMapLoader.load({
            key: amapApiKey || 'YOUR_AMAP_KEY',
            version: '2.0',
            plugins: ['AMap.ToolBar', 'AMap.Scale', 'AMap.Geocoder'],
          });

          const map = new AMap.Map(selectMapContainerRef.current, {
            zoom: 12,
            center: [newPhoto.longitude || HAINAN_CENTER[0], newPhoto.latitude || HAINAN_CENTER[1]],
            viewMode: '3D',
          });

          configureMapLayers(map, mProvider, tKey);
          map.addControl(new AMap.ToolBar({ position: { right: '10px', top: '10px' } }));
          map.addControl(new AMap.Scale());

          // 点击选点
          map.on('click', (e: any) => {
            const lnglat = e.lnglat;
            setNewPhoto(prev => ({
              ...prev,
              latitude: lnglat.getLat(),
              longitude: lnglat.getLng(),
            }));

            // 逆地理编码
            const geocoder = new AMap.Geocoder({ radius: 1000, extensions: 'all' });
            geocoder.getAddress([lnglat.getLng(), lnglat.getLat()], (status: string, result: any) => {
              if (status === 'complete' && result.regeocode) {
                setNewPhoto(prev => ({ ...prev, address: result.regeocode.formattedAddress }));
              }
            });

            // 在点击处添加/移动一个临时标记
            map.clearMap();
            new AMap.Marker({ position: lnglat, map: map });
          });

          selectMapRef.current = map;
        } catch (error) {
          console.error('Select map initialization error:', error);
        }
      };

      // 小延迟确保容器已渲染
      const timer = setTimeout(initSelectMap, 100);
      return () => {
        clearTimeout(timer);
        if (selectMapRef.current) selectMapRef.current.destroy();
      };
    }
  }, [showAddModal]);

  // 加载用户照片
  useEffect(() => {
    loadPhotos();
  }, [user.id]);

  // 更新地图标记
  useEffect(() => {
    if (mapRef.current && photos.length > 0) {
      // 清除现有标记
      mapRef.current.clearMap();

      // 添加照片标记
      photos.forEach(photo => {
        const marker = new (window as any).AMap.Marker({
          position: [photo.longitude, photo.latitude],
          title: photo.title,
          content: createMarkerContent(photo),
          offset: new (window as any).AMap.Pixel(-20, -40),
        });

        marker.on('click', () => {
          setSelectedPhoto(photo);
          // 优雅地定位到地图位置并放大
          if (mapRef.current) {
            mapRef.current.setCenter([photo.longitude, photo.latitude]);
            mapRef.current.setZoom(15, false, 500); // 平滑缩放到 15 级
          }
        });

        mapRef.current.add(marker);
      });
    }
  }, [photos]);

  const createMarkerContent = (photo: Photo) => {
    const div = document.createElement('div');
    div.className = 'custom-marker';
    div.innerHTML = `
      <img src="${photo.imagePath}" class="marker-image" />
      <div class="marker-pin"></div>
    `;
    return div;
  };

  const loadPhotos = async () => {
    try {
      const userPhotos = await window.electronAPI.db.getPhotosByUser(user.id);
      setPhotos(userPhotos);
    } catch (error) {
      console.error('Error loading photos:', error);
    }
  };

  const handleSelectImage = async () => {
    try {
      const result = await window.electronAPI.file.selectImage();
      if (result) {
        setSelectedImage(result.data);
        setSelectedImageName(result.name);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
    }
  };

  const handleAddPhoto = async () => {
    if (!selectedImage) {
      alert('请选择一张照片');
      return;
    }

    setLoading(true);
    try {
      // 保存图片到本地
      const savedImage = await window.electronAPI.file.saveImage(selectedImage, user.id);

      // 创建照片记录
      const photo = await window.electronAPI.db.createPhoto({
        userId: user.id,
        title: newPhoto.title || selectedImageName,
        description: newPhoto.description || '',
        imagePath: savedImage.path, // main.ts already returns app-data:// path
        latitude: newPhoto.latitude || 19.03,
        longitude: newPhoto.longitude || 109.73,
        address: newPhoto.address || '',
        aiGeneratedText: newPhoto.aiGeneratedText || '',
      });

      setPhotos(prev => [photo, ...prev]);
      setShowAddModal(false);
      resetAddForm();
    } catch (error) {
      console.error('Error adding photo:', error);
      alert('添加照片失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePhoto = async () => {
    if (!editingPhoto) return;

    setLoading(true);
    try {
      const updated = await window.electronAPI.db.updatePhoto(editingPhoto.id, {
        title: editingPhoto.title,
        description: editingPhoto.description,
        latitude: editingPhoto.latitude,
        longitude: editingPhoto.longitude,
        address: editingPhoto.address,
        aiGeneratedText: editingPhoto.aiGeneratedText,
      });

      if (updated) {
        setPhotos(prev => prev.map(p => p.id === updated.id ? updated : p));
        setEditingPhoto(null);
      }
    } catch (error) {
      console.error('Error updating photo:', error);
      alert('更新照片失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('确定要删除这张照片吗？')) return;

    try {
      const photo = photos.find(p => p.id === photoId);
      if (photo) {
        await window.electronAPI.file.deleteImage(photo.imagePath);
      }

      await window.electronAPI.db.deletePhoto(photoId);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      setSelectedPhoto(null);
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('删除照片失败');
    }
  };

  const handleExportData = async () => {
    try {
      const data = {
        user,
        photos,
        exportDate: new Date().toISOString(),
      };
      await window.electronAPI.file.exportData(data);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const handleImportData = async () => {
    try {
      const data = await window.electronAPI.file.importData();
      if (data && data.photos) {
        setLoading(true);

        // 导入照片
        const importedPhotos = [];
        for (const photo of data.photos) {
          // 检查照片是否已存在 (基于 imagePath 的文件名或经纬度+标题)
          const fileName = photo.imagePath.split('/').pop();
          const existing = photos.find(p => p.imagePath.endsWith(fileName) || (p.latitude === photo.latitude && p.longitude === photo.longitude && p.title === photo.title));

          if (!existing) {
            // 创建照片记录
            const newPhoto = await window.electronAPI.db.createPhoto({
              userId: user.id,
              title: photo.title,
              description: photo.description,
              imagePath: photo.imagePath,
              latitude: photo.latitude,
              longitude: photo.longitude,
              address: photo.address,
              aiGeneratedText: photo.aiGeneratedText,
            });
            importedPhotos.push(newPhoto);
          }
        }

        if (importedPhotos.length > 0) {
          // 重新加载照片
          await loadPhotos();
          alert(`成功导入 ${importedPhotos.length} 张照片`);
        } else {
          alert('没有新照片可导入');
        }
      }
    } catch (error) {
      console.error('Error importing data:', error);
      alert('导入数据失败，请检查文件格式');
    } finally {
      setLoading(false);
    }
  };

  const resetAddForm = () => {
    setNewPhoto({
      title: '',
      description: '',
      latitude: HAINAN_CENTER[1],
      longitude: HAINAN_CENTER[0],
      address: '',
    });
    setSelectedImage(null);
    setSelectedImageName('');
  };

  const handleAIGenerated = (text: string) => {
    if (editingPhoto) {
      setEditingPhoto({ ...editingPhoto, aiGeneratedText: text });
    } else {
      setNewPhoto(prev => ({ ...prev, aiGeneratedText: text }));
    }
    setShowAIGenerate(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* 侧边栏 */}
      <div className="sidebar flex flex-col">
        {/* 头部 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="w-6 h-6 text-primary-600" />
              <span className="text-lg font-bold text-gray-900">Grainmap</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigate('/settings')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                title="设置"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={onLogout}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                title="退出登录"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            欢迎, {user.username}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="p-4 border-b border-gray-200 space-y-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full btn-primary flex items-center justify-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            添加照片
          </button>
          <div className="flex space-x-2">
            <button
              onClick={handleExportData}
              className="flex-1 btn-secondary flex items-center justify-center text-sm"
            >
              <Download className="w-4 h-4 mr-1" />
              导出
            </button>
            <button
              onClick={handleImportData}
              className="flex-1 btn-secondary flex items-center justify-center text-sm"
            >
              <Upload className="w-4 h-4 mr-1" />
              导入
            </button>
          </div>
        </div>

        {/* 照片列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            我的照片 ({photos.length})
          </h3>
          <div className="space-y-3">
            {photos.map(photo => (
              <div
                key={photo.id}
                className="group bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => {
                  setSelectedPhoto(photo);
                  // 地图定位到照片位置并优雅缩放
                  if (mapRef.current) {
                    mapRef.current.setCenter([photo.longitude, photo.latitude], false, 500);
                    mapRef.current.setZoom(15, false, 500);
                  }
                }}
              >
                <div className="flex items-start space-x-3">
                  <img
                    src={photo.imagePath}
                    alt={photo.title}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {photo.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {photo.address || '未设置位置'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(photo.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {photos.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">还没有照片</p>
                <p className="text-xs mt-1">点击上方按钮添加</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 地图区域 */}
      <div className="flex-1 relative">
        {mapLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
            <div className="flex items-center space-x-2 text-gray-600">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>加载地图...</span>
            </div>
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* 图层切换按钮 */}
        <div className="absolute left-4 bottom-4 flex bg-white rounded-lg shadow-md overflow-hidden z-10">
          <button
            onClick={() => setMapType('standard')}
            className={`px-3 py-1.5 text-xs font-medium border-r border-gray-100 transition-colors ${
              mapType === 'standard' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            标准
          </button>
          <button
            onClick={() => setMapType('satellite')}
            className={`px-3 py-1.5 text-xs font-medium border-r border-gray-100 transition-colors ${
              mapType === 'satellite' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            卫星
          </button>
          <button
            onClick={() => setMapType('terrain')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              mapType === 'terrain' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            地形
          </button>
        </div>
      </div>

      {/* 添加照片全屏 UI (左右布局) */}
      {showAddModal && (
        <div className="fixed inset-0 z-[1000] bg-white flex h-screen w-screen overflow-hidden animate-fade-in">
          {/* 左侧表单 */}
          <div className="w-[450px] flex flex-col h-full border-r border-gray-100 bg-white">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">添加新照片</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetAddForm();
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 图片选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择照片</label>
                {selectedImage ? (
                  <div className="relative">
                    <img src={selectedImage} alt="Selected" className="w-full aspect-video object-cover rounded-xl shadow-sm" />
                    <button
                      onClick={() => { setSelectedImage(null); setSelectedImageName(''); }}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSelectImage}
                    className="w-full aspect-video border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-primary-500 hover:text-primary-500 hover:bg-primary-50 transition-all"
                  >
                    <ImageIcon className="w-12 h-12 mb-2" />
                    <span className="font-medium">点击选择照片</span>
                  </button>
                )}
              </div>

              {/* 信息输入 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                  <input
                    type="text"
                    value={newPhoto.title}
                    onChange={(e) => setNewPhoto(prev => ({ ...prev, title: e.target.value }))}
                    className="input-field"
                    placeholder="输入照片标题"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <textarea
                    value={newPhoto.description}
                    onChange={(e) => setNewPhoto(prev => ({ ...prev, description: e.target.value }))}
                    className="input-field h-24 resize-none"
                    placeholder="输入照片描述"
                  />
                </div>

                <button
                  onClick={() => setShowAIGenerate(true)}
                  className="w-full py-2.5 px-4 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center font-medium hover:bg-primary-100 transition-colors"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  使用 AI 生成文案
                </button>

                {newPhoto.aiGeneratedText && (
                  <div className="bg-primary-50 p-4 rounded-xl border border-primary-100">
                    <div className="flex items-center mb-2">
                      <Sparkles className="w-4 h-4 text-primary-600 mr-1.5" />
                      <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">AI 建议</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{newPhoto.aiGeneratedText}</p>
                  </div>
                )}
              </div>

              {/* 位置预览 */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center text-gray-900 font-medium mb-3">
                  <MapPin className="w-4 h-4 mr-1.5 text-primary-600" />
                  <span>照片位置</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <span className="text-[10px] text-gray-400 block uppercase font-bold mb-1">纬度</span>
                    <span className="text-sm font-mono">{newPhoto.latitude?.toFixed(6)}</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <span className="text-[10px] text-gray-400 block uppercase font-bold mb-1">经度</span>
                    <span className="text-sm font-mono">{newPhoto.longitude?.toFixed(6)}</span>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold mb-1">地址</span>
                  <span className="text-sm line-clamp-2">{newPhoto.address || '在右侧地图上点击选点'}</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex space-x-3 bg-gray-50">
              <button
                onClick={() => { setShowAddModal(false); resetAddForm(); }}
                className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddPhoto}
                disabled={loading || !selectedImage}
                className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shadow-lg shadow-primary-100"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '保存照片'}
              </button>
            </div>
          </div>

          {/* 右侧地图 */}
          <div className="flex-1 relative">
            <div className="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-xl border border-white/50">
              <p className="text-sm font-bold text-gray-900 flex items-center">
                <MapPin className="w-4 h-4 mr-1.5 text-primary-600 animate-bounce" />
                在地图上点击以选择拍摄地点
              </p>
            </div>
            <div ref={selectMapContainerRef} className="w-full h-full" />
          </div>
        </div>
      )}

      {/* 编辑照片模态框 */}
      {editingPhoto && (
        <div className="photo-modal-overlay">
          <div className="photo-modal-content w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">编辑照片</h2>
                <button
                  onClick={() => setEditingPhoto(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <img
                  src={editingPhoto.imagePath}
                  alt={editingPhoto.title}
                  className="w-full h-48 object-cover rounded-lg"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    标题
                  </label>
                  <input
                    type="text"
                    value={editingPhoto.title}
                    onChange={(e) => setEditingPhoto(prev => prev ? { ...prev, title: e.target.value } : null)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    描述
                  </label>
                  <textarea
                    value={editingPhoto.description}
                    onChange={(e) => setEditingPhoto(prev => prev ? { ...prev, description: e.target.value } : null)}
                    className="input-field h-20 resize-none"
                  />
                </div>

                <button
                  onClick={() => setShowAIGenerate(true)}
                  className="w-full btn-secondary flex items-center justify-center"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  重新生成AI文案
                </button>

                {editingPhoto.aiGeneratedText && (
                  <div className="bg-primary-50 p-3 rounded-lg">
                    <div className="flex items-center mb-2">
                      <Sparkles className="w-4 h-4 text-primary-600 mr-1" />
                      <span className="text-sm font-medium text-primary-700">AI生成文案</span>
                    </div>
                    <textarea
                      value={editingPhoto.aiGeneratedText}
                      onChange={(e) => setEditingPhoto(prev => prev ? { ...prev, aiGeneratedText: e.target.value } : null)}
                      className="w-full bg-transparent border-0 resize-none text-sm text-gray-700 focus:outline-none"
                      rows={3}
                    />
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setEditingPhoto(null)}
                    className="flex-1 btn-secondary"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleUpdatePhoto}
                    disabled={loading}
                    className="flex-1 btn-primary flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      '保存'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 照片详情模态框 */}
      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onEdit={() => {
            setEditingPhoto(selectedPhoto);
            setSelectedPhoto(null);
          }}
          onDelete={() => handleDeletePhoto(selectedPhoto.id)}
        />
      )}

      {/* AI生成模态框 */}
      {showAIGenerate && (
        <AIGenerateModal
          userId={user.id}
          photoTitle={editingPhoto?.title || newPhoto.title || ''}
          photoDescription={editingPhoto?.description || newPhoto.description || ''}
          onClose={() => setShowAIGenerate(false)}
          onGenerate={handleAIGenerated}
        />
      )}
    </div>
  );
}

export default Map;
