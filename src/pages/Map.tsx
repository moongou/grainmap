import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, Plus, X, Image as ImageIcon, Loader2, Sparkles, MapPin, Download, Upload, FolderPlus, MoreVertical, Edit2, Trash2, ChevronRight, Folder } from 'lucide-react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { User, Photo, Album } from '../types';
import PhotoModal from '../components/PhotoModal';
import AIGenerateModal from '../components/AIGenerateModal';

interface MapProps {
  user: User;
  onLogout: () => void;
}

// 默认中心位置 (三亚)
const DEFAULT_CENTER = [109.5119, 18.2528];
const DEFAULT_ZOOM = 9;

function Map({ user, onLogout }: MapProps) {
  const navigate = useNavigate();

  if (!window.electronAPI) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <MapPin className="w-16 h-16 mb-4 text-red-500 animate-pulse" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">环境未就绪</h2>
        <p>未检测到 Electron 接口，应用功能将无法正常使用。</p>
        <p className="mt-2 text-sm text-gray-400">请确保在 Grainmap 桌面客户端中运行。</p>
      </div>
    );
  }

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  // 数据状态
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  // UI 状态
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'terrain'>('standard');
  const [mapProvider, setMapProvider] = useState<'tianditu' | 'baidu'>('baidu');
  const [isEditing, setIsEditing] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);

  // 选点地图引用
  const selectMapContainerRef = useRef<HTMLDivElement>(null);
  const selectMapRef = useRef<any>(null);

  // 添加照片表单状态 (支持多张导入)
  const [newPhoto, setNewPhoto] = useState<Partial<Photo>>({
    title: '',
    description: '',
    latitude: DEFAULT_CENTER[1],
    longitude: DEFAULT_CENTER[0],
    address: '',
    albumId: null,
  });
  const [selectedImages, setSelectedImages] = useState<{data: string, name: string, exif?: any}[]>([]);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);

  // 相册表单
  const [albumForm, setAlbumForm] = useState({ name: '', description: '' });

  // 初始化地图
  useEffect(() => {
    const initMap = async () => {
      try {
        setMapLoading(true);
        const amapApiKey = await window.electronAPI.store.get('amapApiKey');
        const amapSec = await window.electronAPI.store.get('amapSecurityCode');
        const mProvider = await window.electronAPI.store.get('mapProvider') || 'baidu';
        const tKey = await window.electronAPI.store.get('tiandituKey');

        setMapProvider(mProvider as any);

        if (amapSec) {
          (window as any)._AMapSecurityConfig = { securityJsCode: amapSec };
        }

        const AMap = await AMapLoader.load({
          key: amapApiKey || '6be7a012c419356073167735399581f4',
          version: '2.0',
          plugins: ['AMap.ToolBar', 'AMap.Scale', 'AMap.Geocoder', 'AMap.ControlBar'],
        }).catch(err => {
          console.error('AMapLoader failed, retrying with default key...', err);
          return AMapLoader.load({
            key: '6be7a012c419356073167735399581f4',
            version: '2.0',
            plugins: ['AMap.ToolBar', 'AMap.Scale', 'AMap.Geocoder', 'AMap.ControlBar'],
          });
        });

        if (mapContainerRef.current && AMap) {
          const map = new AMap.Map(mapContainerRef.current, {
            zoom: DEFAULT_ZOOM,
            center: DEFAULT_CENTER,
            viewMode: '3D',
          });

          configureMapLayers(map, mProvider, tKey);
          map.addControl(new AMap.ToolBar());
          map.addControl(new AMap.Scale());
          const controlBar = new (window as any).AMap.ControlBar({ position: { right: '10px', top: '10px' } });
          map.addControl(controlBar);
          mapRef.current = map;
        }
      } catch (error) {
        console.error('Map initialization error:', error);
      } finally {
        setMapLoading(false);
      }
    };

    initMap();
    return () => { if (mapRef.current) mapRef.current.destroy(); };
  }, []);

  const configureMapLayers = (map: any, provider: string, tKey?: string) => {
    if (provider === 'tianditu' && tKey) {
      const vecLayer = new (window as any).AMap.TileLayer({
        getTileUrl: (x: number, y: number, z: number) =>
          `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL=${x}&TILEROW=${y}&TILEMATRIX=${z}&tk=${tKey}`
      });
      const cvaLayer = new (window as any).AMap.TileLayer({
        getTileUrl: (x: number, y: number, z: number) =>
          `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL=${x}&TILEROW=${y}&TILEMATRIX=${z}&tk=${tKey}`
      });
      map.setLayers([vecLayer, cvaLayer]);
    } else if (provider === 'baidu') {
      const baiduLayer = new (window as any).AMap.TileLayer({
        getTileUrl: (x: number, y: number, z: number) => {
          const server = Math.abs(x + y) % 4;
          const styles = mapType === 'satellite' ? 'sh' : 'pl';
          return `https://maponline${server}.bdimg.com/tile/?qt=vtile&x=${x}&y=${y}&z=${z}&styles=${styles}&scaler=1&udt=20230519`;
        },
        tileSize: 256,
        zooms: [3, 19]
      });
      map.setLayers([baiduLayer]);
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    updateMapLayers(mapRef.current);
  }, [mapType, mapProvider]);

  useEffect(() => {
    if (!selectMapRef.current) return;
    updateMapLayers(selectMapRef.current);
  }, [mapType, mapProvider, showAddModal, currentImportIndex]);

  const updateMapLayers = async (mapInstance: any) => {
    if (mapProvider === 'tianditu') {
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
    } else if (mapProvider === 'baidu') {
      const baiduLayer = new (window as any).AMap.TileLayer({
        getTileUrl: (x: number, y: number, z: number) => {
          const server = Math.abs(x + y) % 4;
          const styles = mapType === 'satellite' ? 'sh' : 'pl';
          return `https://maponline${server}.bdimg.com/tile/?qt=vtile&x=${x}&y=${y}&z=${z}&styles=${styles}&scaler=1&udt=20230519`;
        },
        tileSize: 256,
        zooms: [3, 19]
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
          const mProvider = await window.electronAPI.store.get('mapProvider') || 'baidu';
          const tKey = await window.electronAPI.store.get('tiandituKey');

          if (amapSec) { (window as any)._AMapSecurityConfig = { securityJsCode: amapSec }; }

          const AMap = await AMapLoader.load({
            key: amapApiKey || '6be7a012c419356073167735399581f4',
            version: '2.0',
            plugins: ['AMap.ToolBar', 'AMap.Scale', 'AMap.Geocoder'],
          });

          const map = new AMap.Map(selectMapContainerRef.current, {
            zoom: 12,
            center: [newPhoto.longitude || DEFAULT_CENTER[0], newPhoto.latitude || DEFAULT_CENTER[1]],
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

            const geocoder = new AMap.Geocoder({ radius: 1000, extensions: 'all' });
            geocoder.getAddress([lnglat.getLng(), lnglat.getLat()], (status: string, result: any) => {
              if (status === 'complete' && result.regeocode) {
                setNewPhoto(prev => ({ ...prev, address: result.regeocode.formattedAddress }));
              }
            });

            map.clearMap();
            new AMap.Marker({ position: lnglat, map: map });
          });

          selectMapRef.current = map;

          // 如果当前照片已有经纬度，显示标记
          if (newPhoto.longitude && newPhoto.latitude) {
            new AMap.Marker({ position: [newPhoto.longitude, newPhoto.latitude], map: map });
          }
        } catch (error) {
          console.error('Select map initialization error:', error);
        }
      };

      const timer = setTimeout(initSelectMap, 100);
      return () => {
        clearTimeout(timer);
        if (selectMapRef.current) selectMapRef.current.destroy();
      };
    }
  }, [showAddModal, currentImportIndex]);

  // 加载数据
  useEffect(() => {
    loadPhotos();
    loadAlbums();
  }, [user.id]);

  // 更新地图标记
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.clearMap();
      const filteredPhotos = selectedAlbumId
        ? photos.filter(p => p.albumId === selectedAlbumId)
        : photos;

      filteredPhotos.forEach(photo => {
        if (!photo.longitude || !photo.latitude) return;
        const marker = new (window as any).AMap.Marker({
          position: [photo.longitude, photo.latitude],
          title: photo.title,
          content: createMarkerContent(photo),
          offset: new (window as any).AMap.Pixel(-20, -40),
        });

        marker.on('click', () => {
          setSelectedPhoto(photo);
          if (mapRef.current) {
            mapRef.current.setCenter([photo.longitude, photo.latitude]);
            mapRef.current.setZoom(15, false, 500);
          }
        });
        mapRef.current.add(marker);
      });
    }
  }, [photos, selectedAlbumId]);

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

  const loadAlbums = async () => {
    try {
      const userAlbums = await window.electronAPI.db.getAlbumsByUser(user.id);
      setAlbums(userAlbums);
    } catch (error) {
      console.error('Error loading albums:', error);
    }
  };

  const handleSelectImage = async () => {
    try {
      const results = await window.electronAPI.file.selectImage();
      if (results && Array.isArray(results)) {
        setSelectedImages(results);
        setCurrentImportIndex(0);
        applyPhotoData(results[0]);
      }
    } catch (error) {
      console.error('Error selecting images:', error);
    }
  };

  const applyPhotoData = (photoData: any) => {
    setNewPhoto(prev => ({
      ...prev,
      title: photoData.name.split('.')[0],
      description: '',
      latitude: photoData.exif?.latitude || DEFAULT_CENTER[1],
      longitude: photoData.exif?.longitude || DEFAULT_CENTER[0],
      address: '',
      aiGeneratedText: '',
      albumId: selectedAlbumId,
    }));

    if (photoData.exif?.latitude && selectMapRef.current) {
      const lnglat = [photoData.exif.longitude, photoData.exif.latitude];
      selectMapRef.current.setCenter(lnglat);
      selectMapRef.current.clearMap();
      new (window as any).AMap.Marker({ position: lnglat, map: selectMapRef.current });

      const geocoder = new (window as any).AMap.Geocoder({ radius: 1000, extensions: 'all' });
      geocoder.getAddress(lnglat, (status: string, gResult: any) => {
        if (status === 'complete' && gResult.regeocode) {
          setNewPhoto(prev => ({ ...prev, address: gResult.regeocode.formattedAddress }));
        }
      });
    }
  };

  const handleNextImport = async () => {
    await saveCurrentImage();
    if (currentImportIndex < selectedImages.length - 1) {
      const nextIndex = currentImportIndex + 1;
      setCurrentImportIndex(nextIndex);
      applyPhotoData(selectedImages[nextIndex]);
    } else {
      setShowAddModal(false);
      resetAddForm();
      loadPhotos();
    }
  };

  const saveCurrentImage = async () => {
    const current = selectedImages[currentImportIndex];
    if (!current) return;

    setLoading(true);
    try {
      if (isEditing && editingPhotoId) {
        await window.electronAPI.db.updatePhoto(editingPhotoId, {
          title: newPhoto.title,
          description: newPhoto.description,
          latitude: newPhoto.latitude,
          longitude: newPhoto.longitude,
          address: newPhoto.address,
          aiGeneratedText: newPhoto.aiGeneratedText,
          albumId: newPhoto.albumId,
        });
      } else {
        const savedImage = await window.electronAPI.file.saveImage(current.data, user.id);
        await window.electronAPI.db.createPhoto({
          userId: user.id,
          albumId: newPhoto.albumId,
          title: newPhoto.title || current.name,
          description: newPhoto.description || '',
          imagePath: savedImage.path,
          latitude: newPhoto.latitude || DEFAULT_CENTER[1],
          longitude: newPhoto.longitude || DEFAULT_CENTER[0],
          address: newPhoto.address || '',
          aiGeneratedText: newPhoto.aiGeneratedText || '',
        });
      }
    } catch (error) {
      console.error('Error saving photo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = async () => {
    if (selectedImages.length === 0) {
      alert('请选择照片');
      return;
    }
    await handleNextImport();
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
        albumId: editingPhoto.albumId,
      });
      if (updated) {
        setPhotos(prev => prev.map(p => p.id === updated.id ? updated : p));
        setEditingPhoto(null);
      }
    } catch (error) {
      console.error('Error updating photo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('确定要删除这张照片吗？')) return;
    try {
      const photo = photos.find(p => p.id === photoId);
      if (photo) await window.electronAPI.file.deleteImage(photo.imagePath);
      await window.electronAPI.db.deletePhoto(photoId);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      setSelectedPhoto(null);
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  };

  const handleMovePhotoToAlbum = async (albumId: string | null) => {
    if (!selectedPhoto) return;
    try {
      const updated = await window.electronAPI.db.updatePhoto(selectedPhoto.id, {
        ...selectedPhoto,
        albumId,
      });
      if (updated) {
        setPhotos(prev => prev.map(p => p.id === updated.id ? updated : p));
        setSelectedPhoto(updated);
      }
    } catch (error) {
      console.error('Error moving photo to album:', error);
    }
  };

  const handleAlbumAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumForm.name.trim()) return;

    try {
      if (editingAlbum) {
        const updated = await window.electronAPI.db.updateAlbum(editingAlbum.id, albumForm);
        if (updated) setAlbums(prev => prev.map(a => a.id === updated.id ? updated : a));
      } else {
        const created = await window.electronAPI.db.createAlbum(user.id, albumForm);
        setAlbums(prev => [...prev, created]);
      }
      setShowAlbumModal(false);
      setEditingAlbum(null);
      setAlbumForm({ name: '', description: '' });
    } catch (error) {
      console.error('Error saving album:', error);
    }
  };

  const handleDeleteAlbum = async (id: string) => {
    if (!confirm('确定要删除此相册吗？其中的相片不会被删除，将变为未分类。')) return;
    try {
      await window.electronAPI.db.deleteAlbum(id);
      setAlbums(prev => prev.filter(a => a.id !== id));
      if (selectedAlbumId === id) setSelectedAlbumId(null);
      loadPhotos(); // 刷新以更新相片的 albumId 状态
    } catch (error) {
      console.error('Error deleting album:', error);
    }
  };

  const resetAddForm = () => {
    setNewPhoto({
      title: '',
      description: '',
      latitude: DEFAULT_CENTER[1],
      longitude: DEFAULT_CENTER[0],
      address: '',
      albumId: selectedAlbumId,
    });
    setSelectedImages([]);
    setCurrentImportIndex(0);
    setIsEditing(false);
    setEditingPhotoId(null);
  };

  const handleEditLocation = (photo: Photo) => {
    setSelectedPhoto(null);
    setNewPhoto({
      title: photo.title,
      description: photo.description,
      latitude: photo.latitude,
      longitude: photo.longitude,
      address: photo.address,
      aiGeneratedText: photo.aiGeneratedText,
      albumId: photo.albumId,
    });
    setSelectedImages([{ data: photo.imagePath, name: '已保存的照片', exif: { latitude: photo.latitude, longitude: photo.longitude } }]);
    setCurrentImportIndex(0);
    setIsEditing(true);
    setEditingPhotoId(photo.id);
    setShowAddModal(true);
  };

  const handleAIGenerated = (text: string) => {
    if (editingPhoto) {
      setEditingPhoto({ ...editingPhoto, aiGeneratedText: text });
    } else {
      setNewPhoto(prev => ({ ...prev, aiGeneratedText: text }));
    }
    setShowAIGenerate(false);
  };

  const filteredPhotos = selectedAlbumId
    ? photos.filter(p => p.albumId === selectedAlbumId)
    : photos;

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
              <button onClick={() => navigate('/settings')} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg" title="设置">
                <Settings className="w-5 h-5" />
              </button>
              <button onClick={onLogout} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg" title="退出登录">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 相册列表 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">我的相册</h3>
            <button
              onClick={() => { setEditingAlbum(null); setAlbumForm({ name: '', description: '' }); setShowAlbumModal(true); }}
              className="p-1 text-primary-600 hover:bg-primary-50 rounded"
              title="新建相册"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            <button
              onClick={() => setSelectedAlbumId(null)}
              className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${!selectedAlbumId ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Folder className="w-4 h-4 mr-2" />
              全部照片
              <span className="ml-auto text-[10px] bg-gray-200 px-1.5 py-0.5 rounded-full text-gray-600">{photos.length}</span>
            </button>
            {albums.map(album => (
              <div key={album.id} className="group flex items-center">
                <button
                  onClick={() => setSelectedAlbumId(album.id)}
                  className={`flex-1 flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${selectedAlbumId === album.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Folder className="w-4 h-4 mr-2" />
                  <span className="truncate">{album.name}</span>
                  <span className="ml-auto text-[10px] bg-gray-200 px-1.5 py-0.5 rounded-full text-gray-600">
                    {photos.filter(p => p.albumId === album.id).length}
                  </span>
                </button>
                <div className="hidden group-hover:flex items-center px-1">
                  <button onClick={() => { setEditingAlbum(album); setAlbumForm({ name: album.name, description: album.description || '' }); setShowAlbumModal(true); }} className="p-1 text-gray-400 hover:text-primary-600"><Edit2 className="w-3 h-3" /></button>
                  <button onClick={() => handleDeleteAlbum(album.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="p-4 border-b border-gray-200 space-y-2">
          <button onClick={() => { resetAddForm(); setShowAddModal(true); }} className="w-full btn-primary flex items-center justify-center">
            <Plus className="w-4 h-4 mr-2" />
            添加照片
          </button>
        </div>

        {/* 照片列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            {selectedAlbumId ? albums.find(a => a.id === selectedAlbumId)?.name : '全部照片'} ({filteredPhotos.length})
          </h3>
          <div className="space-y-3">
            {filteredPhotos.map(photo => (
              <div
                key={photo.id}
                className="group bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors relative"
                onClick={() => {
                  setSelectedPhoto(photo);
                  if (photo.longitude && photo.latitude && mapRef.current) {
                    mapRef.current.setCenter([photo.longitude, photo.latitude], false, 500);
                    mapRef.current.setZoom(15, false, 500);
                  }
                }}
              >
                <div className="flex items-start space-x-3">
                  <div className="relative">
                    <img src={photo.imagePath} alt={photo.title} className="w-16 h-16 object-cover rounded-lg" />
                    {photo.latitude && photo.longitude && (
                      <div className="absolute -top-1 -right-1 bg-primary-500 text-white p-0.5 rounded-full border border-white shadow-sm">
                        <MapPin className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">{photo.title}</h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{photo.address || '未设置位置'}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(photo.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
            {filteredPhotos.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">没有照片</p>
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
          <button onClick={() => setMapType('standard')} className={`px-3 py-1.5 text-xs font-medium border-r border-gray-100 transition-colors ${mapType === 'standard' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>标准</button>
          <button onClick={() => setMapType('satellite')} className={`px-3 py-1.5 text-xs font-medium border-r border-gray-100 transition-colors ${mapType === 'satellite' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>卫星</button>
          <button onClick={() => setMapType('terrain')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${mapType === 'terrain' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>地形</button>
        </div>
      </div>

      {/* 添加照片全屏 UI */}
      {showAddModal && (
        <div className="fixed inset-0 z-[1000] bg-white flex h-screen w-screen overflow-hidden animate-fade-in">
          <div className="w-[450px] flex flex-col h-full border-r border-gray-100 bg-white">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{isEditing ? '编辑照片' : '添加照片'}</h2>
                {!isEditing && selectedImages.length > 1 && (
                  <p className="text-xs text-gray-500 mt-1">正在导入第 {currentImportIndex + 1} 张，共 {selectedImages.length} 张</p>
                )}
              </div>
              <button onClick={() => { setShowAddModal(false); resetAddForm(); }} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择照片</label>
                {selectedImages.length > 0 ? (
                  <div className="relative">
                    <img src={selectedImages[currentImportIndex]?.data} alt="Selected" className="w-full aspect-video object-cover rounded-xl shadow-sm" />
                    {!isEditing && (
                      <button onClick={() => { setSelectedImages([]); }} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"><X className="w-4 h-4" /></button>
                    )}
                  </div>
                ) : (
                  <button onClick={handleSelectImage} className="w-full aspect-video border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-primary-500 hover:text-primary-500 hover:bg-primary-50 transition-all">
                    <ImageIcon className="w-12 h-12 mb-2" />
                    <span className="font-medium">点击选择照片 (支持多选)</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">所属相册</label>
                  <select
                    value={newPhoto.albumId || ''}
                    onChange={(e) => setNewPhoto(prev => ({ ...prev, albumId: e.target.value || null }))}
                    className="input-field text-sm"
                  >
                    <option value="">未分类</option>
                    {albums.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                  <input type="text" value={newPhoto.title} onChange={(e) => setNewPhoto(prev => ({ ...prev, title: e.target.value }))} className="input-field" placeholder="输入照片标题" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <textarea value={newPhoto.description} onChange={(e) => setNewPhoto(prev => ({ ...prev, description: e.target.value }))} className="input-field h-24 resize-none" placeholder="输入照片描述" />
                </div>
                <button onClick={() => setShowAIGenerate(true)} className="w-full py-2.5 px-4 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center font-medium hover:bg-primary-100 transition-colors">
                  <Sparkles className="w-4 h-4 mr-2" />使用 AI 生成文案
                </button>
                {newPhoto.aiGeneratedText && (
                  <div className="bg-primary-50 p-4 rounded-xl border border-primary-100">
                    <div className="flex items-center mb-2"><Sparkles className="w-4 h-4 text-primary-600 mr-1.5" /><span className="text-xs font-bold text-primary-700 uppercase tracking-wider">AI 建议</span></div>
                    <p className="text-sm text-gray-700 leading-relaxed">{newPhoto.aiGeneratedText}</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center text-gray-900 font-medium mb-3"><MapPin className="w-4 h-4 mr-1.5 text-primary-600" /><span>照片位置</span></div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200"><span className="text-[10px] text-gray-400 block uppercase font-bold mb-1">纬度</span><span className="text-sm font-mono">{newPhoto.latitude?.toFixed(6)}</span></div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200"><span className="text-[10px] text-gray-400 block uppercase font-bold mb-1">经度</span><span className="text-sm font-mono">{newPhoto.longitude?.toFixed(6)}</span></div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200"><span className="text-[10px] text-gray-400 block uppercase font-bold mb-1">地址</span><span className="text-sm line-clamp-2">{newPhoto.address || '在右侧地图上点击选点'}</span></div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex space-x-3 bg-gray-50">
              <button onClick={() => { setShowAddModal(false); resetAddForm(); }} className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">取消</button>
              <button onClick={handleAddPhoto} disabled={loading || selectedImages.length === 0} className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shadow-lg shadow-primary-100">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (currentImportIndex < selectedImages.length - 1 ? '保存并继续' : '保存照片')}
              </button>
            </div>
          </div>

          <div className="flex-1 relative">
            <div className="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-xl border border-white/50">
              <p className="text-sm font-bold text-gray-900 flex items-center"><MapPin className="w-4 h-4 mr-1.5 text-primary-600 animate-bounce" />在地图上点击以选择拍摄地点</p>
            </div>
            <div ref={selectMapContainerRef} className="w-full h-full cursor-red-crosshair" />
          </div>
        </div>
      )}

      {/* 相册管理模态框 */}
      {showAlbumModal && (
        <div className="photo-modal-overlay">
          <div className="photo-modal-content w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editingAlbum ? '编辑相册' : '新建相册'}</h2>
            <form onSubmit={handleAlbumAction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">相册名称</label>
                <input type="text" value={albumForm.name} onChange={e => setAlbumForm({...albumForm, name: e.target.value})} className="input-field" placeholder="输入相册名称" required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述 (可选)</label>
                <textarea value={albumForm.description} onChange={e => setAlbumForm({...albumForm, description: e.target.value})} className="input-field h-24 resize-none" placeholder="输入相册描述" />
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setShowAlbumModal(false)} className="flex-1 btn-secondary">取消</button>
                <button type="submit" className="flex-1 btn-primary">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 编辑照片模态框 */}
      {editingPhoto && (
        <div className="photo-modal-overlay">
          <div className="photo-modal-content w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">编辑照片</h2>
              <button onClick={() => setEditingPhoto(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <img src={editingPhoto.imagePath} alt={editingPhoto.title} className="w-full h-48 object-cover rounded-lg" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">所属相册</label>
                <select value={editingPhoto.albumId || ''} onChange={(e) => setEditingPhoto(prev => prev ? { ...prev, albumId: e.target.value || null } : null)} className="input-field text-sm">
                  <option value="">未分类</option>
                  {albums.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                <input type="text" value={editingPhoto.title} onChange={(e) => setEditingPhoto(prev => prev ? { ...prev, title: e.target.value } : null)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea value={editingPhoto.description} onChange={(e) => setEditingPhoto(prev => prev ? { ...prev, description: e.target.value } : null)} className="input-field h-20 resize-none" />
              </div>
              <button onClick={() => setShowAIGenerate(true)} className="w-full btn-secondary flex items-center justify-center">
                <Sparkles className="w-4 h-4 mr-2" />重新生成AI文案
              </button>
              <div className="flex space-x-3 pt-4">
                <button onClick={() => setEditingPhoto(null)} className="flex-1 btn-secondary">取消</button>
                <button onClick={handleUpdatePhoto} disabled={loading} className="flex-1 btn-primary flex items-center justify-center">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          albums={albums}
          onClose={() => setSelectedPhoto(null)}
          onEdit={() => { setEditingPhoto(selectedPhoto); setSelectedPhoto(null); }}
          onEditLocation={() => handleEditLocation(selectedPhoto)}
          onDelete={() => handleDeletePhoto(selectedPhoto.id)}
          onMoveToAlbum={handleMovePhotoToAlbum}
        />
      )}

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
