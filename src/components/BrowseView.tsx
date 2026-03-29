import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Edit3, MapPin, Sparkles, ChevronLeft, ChevronRight, Maximize2, Shuffle, ArrowUpDown, SortAsc } from 'lucide-react';
import L, { TileLayer } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Photo, Album } from '../types';

type SortMode = 'order' | 'random' | 'distance';

interface BrowseViewProps {
  photos: Photo[];
  albums: Album[];
  initialPhotoId?: string;
  onEdit: (photo: Photo) => void;
  onClose: () => void;
  onPhotoChange: (photo: Photo) => void;
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

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function BrowseView({
  photos,
  albums,
  initialPhotoId,
  onEdit,
  onClose,
  onPhotoChange: _onPhotoChange,
  mapProvider = 'tencent'
}: BrowseViewProps) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (initialPhotoId) {
      const idx = photos.findIndex(p => p.id === initialPhotoId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const [sortMode, setSortMode] = useState<SortMode>('order');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const mapMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const thumbnailBarRef = useRef<HTMLDivElement>(null);

  const sortedPhotos = useMemo(() => {
    const arr = [...photos];
    switch (sortMode) {
      case 'random':
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      case 'distance':
        if (!photos[currentIndex]) return arr;
        return arr.sort((a, b) => {
          const distA = calculateDistance(photos[currentIndex].latitude, photos[currentIndex].longitude, a.latitude, a.longitude);
          const distB = calculateDistance(photos[currentIndex].latitude, photos[currentIndex].longitude, b.latitude, b.longitude);
          return distA - distB;
        });
      default:
        return arr;
    }
  }, [photos, sortMode, currentIndex]);

  const displayPhoto = sortedPhotos[currentIndex];

  const albumName = useMemo(() => {
    if (!displayPhoto?.albumId) return '未分类';
    return albums.find(a => a.id === displayPhoto.albumId)?.name || '未分类';
  }, [albums, displayPhoto]);

  const buildTileLayer = useCallback((provider: 'tencent' | 'osm', type: 'standard' | 'satellite' = 'standard') => {
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

  const createMarkerIcon = (photo: Photo) => {
    const iconHtml = `
      <div class="custom-marker">
        <img src="${photo.imagePath}" class="marker-image" />
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
    if (!mapRef.current || isFullscreen) return;

    const map = L.map(mapRef.current, {
      center: [displayPhoto?.latitude || 19.188947, displayPhoto?.longitude || 109.778137],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    tileLayerRef.current = buildTileLayer(mapProvider);
    tileLayerRef.current.addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isFullscreen, mapProvider, buildTileLayer]);

  // Update map when photo changes
  useEffect(() => {
    if (!mapInstanceRef.current || !displayPhoto) return;

    mapInstanceRef.current.setView([displayPhoto.latitude, displayPhoto.longitude], 15, { animate: true });

    if (mapMarkerRef.current) {
      mapMarkerRef.current.remove();
    }

    if (displayPhoto.latitude && displayPhoto.longitude) {
      mapMarkerRef.current = L.marker([displayPhoto.latitude, displayPhoto.longitude], {
        icon: createMarkerIcon(displayPhoto),
      }).addTo(mapInstanceRef.current);
    }
  }, [displayPhoto]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFullscreen(f => !f);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setMapExpanded(exp => !exp);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFullscreen, onClose]);

  // Scroll thumbnail into view
  useEffect(() => {
    if (thumbnailBarRef.current) {
      const thumbnail = thumbnailBarRef.current.children[currentIndex] as HTMLElement;
      if (thumbnail) {
        thumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIndex]);

  const handlePrevious = () => {
    const newIndex = (currentIndex - 1 + photos.length) % photos.length;
    setCurrentIndex(newIndex);
  };

  const handleNext = () => {
    const newIndex = (currentIndex + 1) % photos.length;
    setCurrentIndex(newIndex);
  };

  const handleThumbnailClick = (index: number) => {
    setCurrentIndex(index);
  };

  // Layout: Left = photo (85%), Right top = map, Right bottom = info
  const photoPanelWidth = isFullscreen ? 'w-full' : 'w-[85%]';
  const mapPanelWidth = isFullscreen ? 'w-0' : 'w-[15%]';

  return (
    <div className={`flex flex-col bg-white ${isFullscreen ? 'fixed inset-0 z-[3000]' : ''}`}>
      {/* Thumbnail Navigation Bar */}
      <div className="h-16 border-b border-gray-200 bg-gray-50 flex items-center px-4 overflow-x-auto flex-shrink-0" ref={thumbnailBarRef}>
        <div className="flex items-center gap-2 min-w-max">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => handleThumbnailClick(index)}
              className={`relative group flex-shrink-0 rounded-lg overflow-hidden transition-all ${
                index === currentIndex
                  ? 'ring-2 ring-primary-500 ring-offset-2 scale-105'
                  : 'opacity-70 hover:opacity-100 hover:scale-105'
              }`}
            >
              <img
                src={photo.imagePath}
                alt={photo.title}
                className="w-14 h-14 object-cover"
              />
              {index === currentIndex && (
                <div className="absolute inset-0 bg-primary-500/20" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Photo Display - 85% width */}
        <div
          className={`${photoPanelWidth} bg-gray-900 flex items-center justify-center relative transition-all duration-300`}
        >
          {displayPhoto ? (
            <img
              src={displayPhoto.imagePath}
              alt={displayPhoto.title}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-white">No photo</div>
          )}

          {/* Photo Counter */}
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-medium">
            {currentIndex + 1} / {photos.length}
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full text-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full text-white transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Map Expand Button */}
          <button
            onClick={() => setMapExpanded(exp => !exp)}
            className="absolute bottom-4 left-4 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-lg text-white transition-colors"
            title="展开地图 (M)"
          >
            <MapPin className="w-5 h-5" />
          </button>
        </div>

        {/* Right Panel: Map (top) + Info (bottom) */}
        {!isFullscreen && (
          <div className={`${mapPanelWidth} flex flex-col border-l border-gray-200 transition-all duration-300`}>
            {/* Map Area - 60% height */}
            <div
              className={`${mapExpanded ? 'flex-[3]' : 'flex-[6]'} relative transition-all duration-300`}
              ref={mapRef}
            />

            {/* Info Area - 40% height */}
            <div className={`${mapExpanded ? 'flex-[7]' : 'flex-[4]'} border-t border-gray-200 bg-white overflow-y-auto transition-all duration-300`}>
              <div className="p-3">
                {displayPhoto && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-base font-bold text-gray-900 truncate flex-1 mr-2">{displayPhoto.title}</h2>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => onEdit(displayPhoto)}
                          className="btn-primary !py-1 !px-2 text-xs flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          编辑
                        </button>
                        <button
                          onClick={() => setIsFullscreen(true)}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={onClose}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500 mb-2">
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded">{albumName}</span>
                      <span>{new Date(displayPhoto.createdAt).toLocaleDateString('zh-CN')}</span>
                      <span className="font-mono">{displayPhoto.latitude.toFixed(6)}, {displayPhoto.longitude.toFixed(6)}</span>
                    </div>

                    {displayPhoto.description && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">{displayPhoto.description}</p>
                      </div>
                    )}

                    {displayPhoto.aiGeneratedText && (
                      <div className="mb-2 bg-primary-50 border border-primary-100 rounded-lg p-2">
                        <div className="flex items-center mb-1">
                          <Sparkles className="w-3 h-3 text-primary-600 mr-1" />
                          <span className="text-[10px] font-bold text-primary-700 uppercase tracking-wider">AI 文案</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">{displayPhoto.aiGeneratedText}</p>
                      </div>
                    )}

                    {displayPhoto.address && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
                        <span className="truncate">{displayPhoto.address}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="h-12 border-t border-gray-200 bg-gray-50 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMapExpanded(exp => !exp)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mapExpanded ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="展开/收起地图 (M)"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{mapExpanded ? '收起地图' : '展开地图'}</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
            >
              <SortAsc className="w-3.5 h-3.5" />
              <span>
                {sortMode === 'order' ? '顺序' : sortMode === 'random' ? '随机' : '距离'}
              </span>
            </button>
            {showSortMenu && (
              <div className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[100px] z-10">
                <button
                  onClick={() => { setSortMode('order'); setShowSortMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${sortMode === 'order' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}
                >
                  <ArrowUpDown className="w-3.5 h-3.5 inline mr-2" />
                  照片顺序
                </button>
                <button
                  onClick={() => { setSortMode('random'); setShowSortMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${sortMode === 'random' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}
                >
                  <Shuffle className="w-3.5 h-3.5 inline mr-2" />
                  随机
                </button>
                <button
                  onClick={() => { setSortMode('distance'); setShowSortMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${sortMode === 'distance' ? 'text-primary-600 font-medium' : 'text-gray-700'}`}
                >
                  <MapPin className="w-3.5 h-3.5 inline mr-2" />
                  最近距离
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[9px]">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[9px]">↓</kbd>
            切换照片
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[9px]">M</kbd>
            展开地图
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[9px]">F</kbd>
            全屏
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[9px]">ESC</kbd>
            关闭
          </span>
        </div>
      </div>
    </div>
  );
}
