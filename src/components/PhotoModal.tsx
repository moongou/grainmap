import { X, Edit3, Trash2, MapPin, Sparkles, Calendar, Folder, ArrowLeft, ArrowRight, MoveHorizontal } from 'lucide-react';
import { Photo, Album, MapProvider } from '../types';
import { useEffect, useMemo, useRef, useState } from 'react';
import L, { TileLayer } from 'leaflet';

function buildMiniMapTileLayer(provider: MapProvider): TileLayer {
  if (provider === 'osm') {
    return L.tileLayer('https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      tileSize: 256,
      minZoom: 3,
      maxZoom: 18,
      attribution: '',
    });
  }

  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    subdomains: ['a', 'b', 'c'],
    tileSize: 256,
    minZoom: 3,
    maxZoom: 18,
    attribution: '',
  });
}

interface PhotoModalProps {
  photo: Photo;
  albums: Album[];
  currentIndex: number;
  totalCount: number;
  mapProvider: MapProvider;
  onClose: () => void;
  onEdit: () => void;
  onEditLocation: () => void;
  onDelete: () => void;
  onMoveToAlbum: (albumId: string | null) => void;
  onPrevious: () => void;
  onNext: () => void;
}

function PhotoModal({
  photo,
  albums,
  currentIndex,
  totalCount,
  mapProvider,
  onClose,
  onEdit,
  onEditLocation,
  onDelete,
  onMoveToAlbum,
  onPrevious,
  onNext,
}: PhotoModalProps) {
  const [photoPanelSide, setPhotoPanelSide] = useState<'left' | 'right'>('left');
  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<L.Map | null>(null);
  const miniMapLayerRef = useRef<TileLayer | null>(null);
  const miniMapMarkerRef = useRef<L.Marker | null>(null);

  const albumName = useMemo(
    () => albums.find(a => a.id === photo.albumId)?.name || '未分类',
    [albums, photo.albumId],
  );

  useEffect(() => {
    const mapContainer = miniMapContainerRef.current;
    if (!mapContainer) return;

    if (!miniMapRef.current) {
      const map = L.map(mapContainer, {
        center: [photo.latitude, photo.longitude],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });
      miniMapRef.current = map;
      miniMapLayerRef.current = buildMiniMapTileLayer(mapProvider);
      miniMapLayerRef.current.addTo(map);
    }

    const map = miniMapRef.current;
    if (!map) return;

    map.setView([photo.latitude, photo.longitude], Math.max(map.getZoom(), 12));

    if (miniMapLayerRef.current) {
      map.removeLayer(miniMapLayerRef.current);
    }
    miniMapLayerRef.current = buildMiniMapTileLayer(mapProvider);
    miniMapLayerRef.current.addTo(map);

    if (miniMapMarkerRef.current) {
      miniMapMarkerRef.current.remove();
    }
    miniMapMarkerRef.current = L.marker([photo.latitude, photo.longitude]).addTo(map);

    window.setTimeout(() => map.invalidateSize(), 0);
  }, [mapProvider, photo.id, photo.latitude, photo.longitude]);

  useEffect(() => {
    return () => {
      if (miniMapMarkerRef.current) {
        miniMapMarkerRef.current.remove();
        miniMapMarkerRef.current = null;
      }
      if (miniMapLayerRef.current && miniMapRef.current) {
        miniMapRef.current.removeLayer(miniMapLayerRef.current);
        miniMapLayerRef.current = null;
      }
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      if (isTypingTarget) {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNext();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrevious]);


  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full h-full p-4 md:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`h-full w-full rounded-[28px] overflow-hidden bg-[#0b0b0d] shadow-2xl ${photoPanelSide === 'right' ? 'lg:flex lg:flex-row-reverse' : 'lg:flex lg:flex-row'}`}>
          <div className="relative min-w-0 lg:basis-[70%] lg:grow bg-black flex items-center justify-center px-4 py-4 md:px-6 md:py-6">
            <img
              src={photo.imagePath}
              alt={photo.title}
              className="block max-w-full max-h-full object-contain select-none"
            />

            <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3 pointer-events-none">
              <div className="pointer-events-auto inline-flex items-center rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
                照片 {currentIndex + 1} / {totalCount}
              </div>
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  onClick={() => setPhotoPanelSide(side => side === 'left' ? 'right' : 'left')}
                  className="inline-flex items-center rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/70"
                  title="切换照片与地图位置"
                >
                  <MoveHorizontal className="mr-1.5 h-3.5 w-3.5" />切换布局
                </button>
                <button onClick={onClose} className="rounded-full bg-black/55 p-2 text-white hover:bg-black/70" title="关闭">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex h-[42vh] min-h-0 flex-col bg-white lg:h-full lg:basis-[30%] lg:min-w-[340px] lg:max-w-[420px]">
            <div className="border-b border-gray-100 px-4 py-3 md:px-5 md:py-4">
              <h2 className="text-lg font-bold leading-tight text-gray-900 line-clamp-2">{photo.title}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1">
                  <Calendar className="mr-1 h-3.5 w-3.5" />
                  {new Date(photo.createdAt).toLocaleDateString('zh-CN')}
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1">
                  <Folder className="mr-1 h-3.5 w-3.5" />
                  {albumName}
                </span>
              </div>
            </div>

            <div className="border-b border-gray-100 px-4 py-4 md:px-5">
              <div className="mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm">
                <div ref={miniMapContainerRef} className="h-full w-full" />
              </div>
              <button
                onClick={onEditLocation}
                className="mt-3 w-full rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100"
              >
                调整照片位置
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-4">
              <div className="flex h-full flex-col justify-between gap-4">
                <div className="space-y-3">
                  {photo.description && (
                    <div>
                      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">照片描述</h3>
                      <p className="text-sm leading-6 text-gray-700">{photo.description}</p>
                    </div>
                  )}

                  {photo.aiGeneratedText && (
                    <div className="rounded-2xl border border-primary-100 bg-primary-50 p-3">
                      <div className="mb-1.5 flex items-center text-sm font-semibold text-primary-700">
                        <Sparkles className="mr-1.5 h-4 w-4" />
                        AI 文案
                      </div>
                      <p className="text-sm leading-6 text-gray-700">{photo.aiGeneratedText}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="flex items-start gap-2 text-sm text-gray-700">
                      <MapPin className="mt-0.5 h-4 w-4 text-red-500" />
                      <div className="min-w-0 flex-1">
                        <div className="break-all">{photo.address || '未设置地址'}</div>
                        <div className="mt-1 font-mono text-[11px] text-gray-500">
                          {photo.latitude.toFixed(6)}, {photo.longitude.toFixed(6)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">所属相册</h3>
                    <select
                      value={photo.albumId || ''}
                      onChange={(e) => onMoveToAlbum(e.target.value || null)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
                    >
                      <option value="">未分类</option>
                      {albums.map(album => (
                        <option key={album.id} value={album.id}>{album.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={onPrevious}
                      className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <ArrowLeft className="mr-1.5 h-4 w-4" />上一张
                    </button>
                    <button
                      onClick={onNext}
                      className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      下一张<ArrowRight className="ml-1.5 h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-gray-100 px-4 py-3 md:px-5">
              <button onClick={onEdit} className="btn-primary flex items-center justify-center !py-2.5">
                <Edit3 className="mr-2 h-4 w-4" />编辑
              </button>
              <button onClick={onDelete} className="btn-secondary flex items-center justify-center !py-2.5 text-red-600 border-red-200 hover:bg-red-50">
                <Trash2 className="mr-2 h-4 w-4" />删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhotoModal;
