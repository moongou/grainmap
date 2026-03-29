import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MapPin, Sparkles, Loader2, Trash2, Save } from 'lucide-react';
import L, { TileLayer } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Photo, Album } from '../types';

interface EditViewProps {
  photo: Photo;
  albums: Album[];
  onSave: (photo: Photo) => void;
  onCancel: () => void;
  onDelete: () => void;
  onShowAIGenerate: (callback: (text: string) => void) => void;
  mapProvider?: 'tencent' | 'osm';
}

// Custom TileLayer for Tencent maps
class TencentTileLayer extends TileLayer {
  constructor(private styleId: number = 1000) {
    super('', {});
  }

  getTileUrl(coords: { x: number; y: number; z: number }): string {
    const { x, y, z } = coords;
    const server = (x + y) % 4;
    const yInv = Math.pow(2, z) - 1 - y;
    return `https://rt${server}.map.gtimg.com/tile?z=${z}&x=${x}&y=${yInv}&styleid=${this.styleId}&version=811`;
  }
}

const OSM_TILE_URL = 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png';

export default function EditView({
  photo,
  albums,
  onSave,
  onCancel,
  onDelete,
  onShowAIGenerate,
  mapProvider = 'tencent'
}: EditViewProps) {
  const [editData, setEditData] = useState<Photo>({ ...photo });
  const [loading, setLoading] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');

  const selectMapContainerRef = useRef<HTMLDivElement>(null);
  const selectMapRef = useRef<L.Map | null>(null);
  const selectTileLayerRef = useRef<TileLayer | TencentTileLayer | null>(null);
  const selectMarkerRef = useRef<L.Marker | null>(null);
  const mapInitializedRef = useRef(false);

  const buildTileLayer = useCallback((provider: 'tencent' | 'osm', type: 'standard' | 'satellite') => {
    if (provider === 'tencent') {
      const styleId = type === 'satellite' ? 101 : 1000;
      return new TencentTileLayer(styleId);
    }
    return L.tileLayer(OSM_TILE_URL, {
      tileSize: 256,
      minZoom: 3,
      maxZoom: 18,
      attribution: '',
    });
  }, []);

  const createMarkerIcon = (imgPath: string) => {
    const iconHtml = `
      <div class="custom-marker">
        <img src="${imgPath}" class="marker-image" />
        <div class="marker-pin"></div>
      </div>
    `;
    return L.divIcon({
      html: iconHtml,
      className: 'custom-leaflet-marker',
      iconSize: [50, 60],
      iconAnchor: [25, 60],
      popupAnchor: [0, -60],
    });
  };

  // Initialize map
  useEffect(() => {
    if (!selectMapContainerRef.current || mapInitializedRef.current) return;

    const map = L.map(selectMapContainerRef.current, {
      center: [editData.latitude, editData.longitude] as [number, number],
      zoom: 15,
      zoomControl: true,
      attributionControl: false,
    });

    selectTileLayerRef.current = buildTileLayer(mapProvider, 'standard');
    selectTileLayerRef.current.addTo(map);

    const updateSelection = (lat: number, lng: number) => {
      setEditData(prev => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      }));

      if (selectMarkerRef.current) selectMarkerRef.current.remove();
      selectMarkerRef.current = L.marker([lat, lng], {
        icon: createMarkerIcon(editData.imagePath)
      }).addTo(map);
    };

    map.on('click', (e: L.LeafletMouseEvent) => {
      updateSelection(e.latlng.lat, e.latlng.lng);
    });

    // Initial marker
    updateSelection(editData.latitude, editData.longitude);

    selectMapRef.current = map;
    mapInitializedRef.current = true;

    return () => {
      if (selectMapRef.current) {
        selectMapRef.current.remove();
        selectMapRef.current = null;
      }
      mapInitializedRef.current = false;
    };
  }, []);

  // Sync map type changes
  useEffect(() => {
    if (!selectMapRef.current || !selectTileLayerRef.current) return;
    selectMapRef.current.removeLayer(selectTileLayerRef.current);
    selectTileLayerRef.current = buildTileLayer(mapProvider, mapType);
    selectTileLayerRef.current.addTo(selectMapRef.current);
  }, [mapType, mapProvider, buildTileLayer]);

  // Sync lat/lng changes from text input to map
  useEffect(() => {
    if (!selectMapRef.current || !mapInitializedRef.current) return;
    selectMapRef.current.setView([editData.latitude, editData.longitude], 15);
    if (selectMarkerRef.current) selectMarkerRef.current.remove();
    selectMarkerRef.current = L.marker([editData.latitude, editData.longitude], {
      icon: createMarkerIcon(editData.imagePath)
    }).addTo(selectMapRef.current);
  }, [editData.latitude, editData.longitude]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(editData);
    } finally {
      setLoading(false);
    }
  };

  const handleAIGenerate = () => {
    onShowAIGenerate((text: string) => {
      setEditData(prev => ({ ...prev, aiGeneratedText: text }));
    });
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-white flex h-screen w-screen overflow-hidden animate-fade-in">
      {/* Left Panel - Edit Form */}
      <div className="w-[500px] flex flex-col border-r border-gray-100 bg-white">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">编辑照片</h2>
            <p className="text-xs text-gray-500 mt-1">左侧编辑内容，右侧直接在地图上重新定位。</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Photo Preview */}
          <div className="relative">
            <img
              src={editData.imagePath}
              alt={editData.title}
              className="w-full max-h-[35vh] object-contain rounded-xl bg-gray-100"
            />
          </div>

          {/* Album */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">所属相册</label>
            <select
              value={editData.albumId || ''}
              onChange={(e) => setEditData(prev => ({ ...prev, albumId: e.target.value || null }))}
              className="w-full bg-white border border-gray-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
            >
              <option value="">未分类</option>
              {albums.map(album => (
                <option key={album.id} value={album.id}>{album.name}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">标题</label>
            <input
              type="text"
              value={editData.title}
              onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full bg-white border border-gray-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
              placeholder="输入照片标题"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">描述</label>
            <textarea
              value={editData.description}
              onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full bg-white border border-gray-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200 h-24 resize-none"
              placeholder="输入照片描述"
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">纬度</span>
              <input
                type="number"
                step="0.000001"
                value={editData.latitude}
                onChange={(e) => setEditData(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-transparent text-sm font-mono outline-none"
              />
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">经度</span>
              <input
                type="number"
                step="0.000001"
                value={editData.longitude}
                onChange={(e) => setEditData(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-transparent text-sm font-mono outline-none"
              />
            </div>
          </div>

          {/* Address */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
            <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">地址 / 坐标</span>
            <span className="text-sm break-all">{editData.address || '在右侧地图中点击选点'}</span>
          </div>

          {/* AI Generate */}
          <button
            onClick={handleAIGenerate}
            className="w-full py-2.5 px-4 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center font-medium hover:bg-primary-100 transition-colors"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            使用 AI 生成文案
          </button>

          {editData.aiGeneratedText && (
            <div className="bg-primary-50 p-4 rounded-xl border border-primary-100">
              <div className="flex items-center mb-2">
                <Sparkles className="w-4 h-4 text-primary-600 mr-1.5" />
                <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">AI 建议</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{editData.aiGeneratedText}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex space-x-3">
          <button
            onClick={onDelete}
            className="px-4 py-2.5 text-red-600 border border-red-200 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            删除
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            保存
          </button>
        </div>
      </div>

      {/* Right Panel - Map */}
      <div className="flex-1 relative bg-gray-100">
        {/* Map Type Toggle */}
        <div className="absolute top-4 right-4 z-10 flex bg-white rounded-lg shadow-md overflow-hidden">
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
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              mapType === 'satellite' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            卫星
          </button>
        </div>

        {/* Instructions */}
        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-lg border border-white/50">
          <p className="text-sm font-bold text-gray-900 flex items-center">
            <MapPin className="w-4 h-4 mr-1.5 text-primary-500" />
            点击地图更新照片位置
          </p>
        </div>

        <div ref={selectMapContainerRef} className="w-full h-full cursor-crosshair" />
      </div>
    </div>
  );
}
