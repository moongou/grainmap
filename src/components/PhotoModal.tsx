import { X, Edit3, Trash2, MapPin, Sparkles, Calendar, Folder, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { Photo, Album } from '../types';
import { useEffect, useMemo, useState } from 'react';

interface PhotoModalProps {
  photo: Photo;
  albums: Album[];
  currentIndex: number;
  totalCount: number;
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
  onClose,
  onEdit,
  onEditLocation,
  onDelete,
  onMoveToAlbum,
  onPrevious,
  onNext,
}: PhotoModalProps) {
  const [browseMode, setBrowseMode] = useState<'details' | 'map'>('details');

  const albumName = useMemo(
    () => albums.find(a => a.id === photo.albumId)?.name || '未分类',
    [albums, photo.albumId],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        onPrevious();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        onNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setBrowseMode('map');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onEdit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onEdit, onNext, onPrevious]);

  useEffect(() => {
    setBrowseMode('details');
  }, [photo.id]);

  return (
    <div className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full h-full flex bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 bg-gray-950 flex items-center justify-center p-6 lg:p-10 min-w-0">
          <img
            src={photo.imagePath}
            alt={photo.title}
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl bg-black"
          />
        </div>

        <div className="w-[460px] border-l border-gray-200 bg-white flex flex-col">
          <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-[0.2em] mb-2">
                照片 {currentIndex + 1} / {totalCount}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">{photo.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1">
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  {new Date(photo.createdAt).toLocaleDateString('zh-CN')}
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1">
                  <Folder className="w-3.5 h-3.5 mr-1" />
                  {albumName}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => setBrowseMode('map')}
              className={`inline-flex items-center rounded-lg px-3 py-2 font-medium transition-colors ${browseMode === 'map' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              左键看地图布局
            </button>
            <button
              onClick={onEdit}
              className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 font-medium text-gray-700 hover:bg-gray-200"
            >
              <ArrowRight className="w-3.5 h-3.5 mr-1" />
              右键进入编辑
            </button>
            <button
              onClick={onPrevious}
              className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 font-medium text-gray-700 hover:bg-gray-200"
            >
              <ArrowUp className="w-3.5 h-3.5 mr-1" />
              上一张
            </button>
            <button
              onClick={onNext}
              className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 font-medium text-gray-700 hover:bg-gray-200"
            >
              <ArrowDown className="w-3.5 h-3.5 mr-1" />
              下一张
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {browseMode === 'map' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center text-sm font-semibold text-gray-900 mb-2">
                    <MapPin className="w-4 h-4 mr-2 text-primary-600" />
                    地图联动浏览
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    当前主地图已定位到这张照片的位置。关闭弹窗后可直接继续在地图中查看；按右方向键可立即进入编辑布局调整位置与信息。
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">纬度</span>
                    <span className="font-mono text-gray-900">{photo.latitude.toFixed(6)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">经度</span>
                    <span className="font-mono text-gray-900">{photo.longitude.toFixed(6)}</span>
                  </div>
                  <button
                    onClick={onEditLocation}
                    className="w-full btn-secondary text-sm"
                  >
                    在编辑视图中重新选点
                  </button>
                </div>
              </div>
            ) : (
              <>
                {photo.description && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">照片描述</h3>
                    <p className="text-gray-700 leading-7">{photo.description}</p>
                  </div>
                )}

                {photo.aiGeneratedText && (
                  <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4">
                    <div className="flex items-center mb-2 text-primary-700 font-semibold text-sm">
                      <Sparkles className="w-4 h-4 mr-2" />
                      AI 文案
                    </div>
                    <p className="text-gray-700 leading-7">{photo.aiGeneratedText}</p>
                  </div>
                )}

                <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <MapPin className="w-4 h-4 mt-0.5 text-red-500" />
                    <span>{photo.address || '未设置地址'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <div className="text-[10px] text-gray-400 uppercase mb-1">纬度</div>
                      <div className="font-mono text-gray-900">{photo.latitude.toFixed(6)}</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <div className="text-[10px] text-gray-400 uppercase mb-1">经度</div>
                      <div className="font-mono text-gray-900">{photo.longitude.toFixed(6)}</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">所属相册</h3>
              <select
                value={photo.albumId || ''}
                onChange={(e) => onMoveToAlbum(e.target.value || null)}
                className="w-full bg-white border border-gray-200 text-sm rounded-xl px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
              >
                <option value="">未分类</option>
                {albums.map(album => (
                  <option key={album.id} value={album.id}>{album.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 grid grid-cols-2 gap-3">
            <button onClick={onEdit} className="btn-primary flex items-center justify-center">
              <Edit3 className="w-4 h-4 mr-2" />编辑
            </button>
            <button onClick={onDelete} className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 flex items-center justify-center">
              <Trash2 className="w-4 h-4 mr-2" />删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhotoModal;
