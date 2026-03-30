import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Edit3, MapPin, Sparkles, ChevronLeft, ChevronRight, Maximize2, Shuffle, ArrowUpDown, SortAsc, Home } from 'lucide-react';
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
  const [photoPanelSide, setPhotoPanelSide] = useState<'left' | 'right'>('left');
  const [isMapMain, setIsMapMain] = useState(false);

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
  }, [isFullscreen, mapProvider, buildTileLayer, isMapMain]);

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
  }, [displayPhoto, isMapMain]);

  // Handle layout changes and map resize
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 300); // Wait for transition duration
  }, [isMapMain, isFullscreen, photoPanelSide]);

  const handlePrevious = useCallback(() => {
    const newIndex = (currentIndex - 1 + photos.length) % photos.length;
    setCurrentIndex(newIndex);
  }, [currentIndex, photos.length]);

  const handleNext = useCallback(() => {
    const newIndex = (currentIndex + 1) % photos.length;
    setCurrentIndex(newIndex);
  }, [currentIndex, photos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      if (isTypingTarget) {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        setIsMapMain(m => !m);
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
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setPhotoPanelSide(side => side === 'left' ? 'right' : 'left');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onClose, handlePrevious, handleNext]);

  // Scroll thumbnail into view
  useEffect(() => {
    if (thumbnailBarRef.current) {
      const thumbnail = thumbnailBarRef.current.children[currentIndex] as HTMLElement;
      if (thumbnail) {
        thumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIndex]);

  const handleThumbnailClick = (index: number) => {
    setCurrentIndex(index);
  };

  // Layout: Left = photo (70%), Right top = map, Right bottom = info
  const photoPanelWidth = isFullscreen ? 'w-full' : 'w-[70%]';
  const sidePanelWidth = isFullscreen ? 'w-0' : 'w-[30%] min-w-[340px]';

  return (
    <div className={`flex flex-col h-screen bg-white ${isFullscreen ? 'fixed inset-0 z-[3000]' : ''}`}>
      {/* Thumbnail Navigation Bar */}
      <div className="h-14 border-b border-gray-200 bg-gray-50 flex items-center px-4 overflow-x-auto flex-shrink-0" ref={thumbnailBarRef}>
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
                className="w-12 h-12 object-cover"
              />
              {index === currentIndex && (
                <div className="absolute inset-0 bg-primary-500/20" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex overflow-hidden min-h-0 ${!isFullscreen && photoPanelSide === 'right' ? 'flex-row-reverse' : ''}`}>
        {/* Main Display Area (70%) */}
        <div
          className={`${photoPanelWidth} bg-black flex items-center justify-center relative transition-all duration-300 min-w-0`}
        >
          {isMapMain ? (
            <div className="h-full w-full" ref={mapRef} />
          ) : (
            <>
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

              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-lg text-white transition-colors"
                  title="全屏 (F)"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
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

              {/* Swap Layout Button */}
              <button
                onClick={() => setIsMapMain(m => !m)}
                className="absolute bottom-4 left-4 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-lg text-white transition-colors"
                title="切换地图与照片 (CTRL+↑)"
              >
                <ArrowUpDown className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Side Panel Area (30%) */}
        {!isFullscreen && (
          <div className={`${sidePanelWidth} flex flex-col border-l border-gray-200 bg-white transition-all duration-300`}>
            <div className="flex-[3] border-b border-gray-100 overflow-hidden bg-gray-100 relative">
              {isMapMain ? (
                /* Swapped: Photo is in the smaller side area */
                displayPhoto ? (
                  <div className="h-full w-full bg-black flex items-center justify-center p-2">
                    <img
                      src={displayPhoto.imagePath}
                      alt={displayPhoto.title}
                      className="max-w-full max-h-full object-contain shadow-lg"
                    />
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-white text-[10px]">
                      {currentIndex + 1} / {photos.length}
                    </div>
                  </div>
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-black text-white text-xs">No photo</div>
                )
              ) : (
                /* Normal: Map is in the side area */
                <div
                  className="h-full w-full"
                  ref={mapRef}
                />
              )}
            </div>

            <div className="flex-[2] overflow-y-auto bg-white min-h-0">
              <div className="h-full px-4 py-4 flex flex-col justify-between gap-4">
                {displayPhoto && (
                  <>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h2 className="text-base font-bold text-gray-900 leading-tight line-clamp-2">{displayPhoto.title}</h2>
                          <button
                            onClick={onClose}
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                            title="关闭"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500">
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded">{albumName}</span>
                          <span>{new Date(displayPhoto.createdAt).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>

                      {displayPhoto.description && (
                        <div>
                          <p className="text-xs text-gray-700 leading-relaxed line-clamp-4">{displayPhoto.description}</p>
                        </div>
                      )}

                      {displayPhoto.aiGeneratedText && (
                        <div className="bg-primary-50 border border-primary-100 rounded-lg p-2.5">
                          <div className="flex items-center mb-1">
                            <Sparkles className="w-3 h-3 text-primary-600 mr-1" />
                            <span className="text-[10px] font-bold text-primary-700 uppercase tracking-wider">AI 文案</span>
                          </div>
                          <p className="text-xs text-gray-700 leading-relaxed line-clamp-4">{displayPhoto.aiGeneratedText}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-start gap-1.5 text-xs text-gray-600">
                          <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="break-words">{displayPhoto.address || '未设置地址'}</div>
                            <div className="mt-1 font-mono text-[10px] text-gray-500">
                              {displayPhoto.latitude.toFixed(6)}, {displayPhoto.longitude.toFixed(6)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => onEdit(displayPhoto)}
                          className="btn-primary !py-2 !px-2 text-xs flex items-center justify-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />编辑
                        </button>
                        <button
                          onClick={() => setIsMapMain(m => !m)}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          切换主视图
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="h-11 border-t border-gray-200 bg-gray-50 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 rounded-lg text-xs font-medium text-white transition-colors shadow-sm"
            title="返回主界面 (ESC)"
          >
            <Home className="w-3.5 h-3.5" />
            <span>主页</span>
          </button>

          <button
            onClick={() => setIsMapMain(m => !m)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
            title="切换主视图 (CTRL+↑)"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>切换主视图</span>
          </button>

          <button
            onClick={() => setPhotoPanelSide(side => side === 'left' ? 'right' : 'left')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
            title="切换布局 (S)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>切换布局</span>
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

        <div className="flex items-center gap-3 text-[10px] text-gray-500 whitespace-nowrap">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[9px]">←</kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[9px]">→</kbd>
            切换照片
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[9px]">S</kbd>
            切换布局
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[9px]">CTRL+↑</kbd>
            切换主视图
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
