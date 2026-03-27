import { X, Edit3, Trash2, MapPin, Sparkles, Calendar, Maximize2, Minimize2 } from 'lucide-react';
import { Photo } from '../types';
import { useState } from 'react';

interface PhotoModalProps {
  photo: Photo;
  onClose: () => void;
  onEdit: () => void;
  onEditLocation: () => void;
  onDelete: () => void;
}

function PhotoModal({ photo, onClose, onEdit, onEditLocation, onDelete }: PhotoModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 bg-black z-[2000] flex items-center justify-center animate-in fade-in duration-300">
        <img
          src={photo.imagePath}
          alt={photo.title}
          className="max-w-full max-h-full object-contain cursor-zoom-out"
          onClick={() => setIsFullScreen(false)}
        />
        <div className="absolute top-6 left-6 text-white bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
          <h2 className="text-lg font-bold">{photo.title}</h2>
        </div>
        <button
          onClick={() => setIsFullScreen(false)}
          className="absolute top-6 right-6 p-2.5 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all backdrop-blur-sm border border-white/20"
        >
          <Minimize2 className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div className="photo-modal-overlay" onClick={onClose}>
      <div
        className="photo-modal-content max-w-4xl max-h-[95vh] w-full mx-4 overflow-hidden flex flex-col slide-up shadow-2xl border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 照片区域 */}
        <div className="relative flex-1 bg-gray-950 flex items-center justify-center overflow-hidden group">
          <img
            src={photo.imagePath}
            alt={photo.title}
            className="max-w-full max-h-[70vh] object-contain cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.01]"
            onClick={() => setIsFullScreen(true)}
          />
          <div className="absolute bottom-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setIsFullScreen(true)}
              className="p-2 bg-black/60 text-white rounded-lg hover:bg-black/80 transition-all backdrop-blur-sm"
              title="全屏预览"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 transition-all backdrop-blur-sm border border-white/10"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 信息区域 */}
        <div className="p-8 bg-white overflow-y-auto max-h-[40vh] border-t border-gray-50">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1 pr-8">
              <h2 className="text-3xl font-extrabold text-gray-900 leading-tight mb-2">{photo.title}</h2>
              <div className="flex flex-wrap items-center text-sm text-gray-500 gap-x-6 gap-y-2">
                <span className="flex items-center bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                  <Calendar className="w-3.5 h-3.5 mr-1.5 text-primary-500" />
                  {new Date(photo.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                {photo.address && (
                  <span className="flex items-center bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-red-500" />
                    {photo.address}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={onEdit}
                className="p-3 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all border border-gray-100 hover:border-primary-100"
                title="编辑信息"
              >
                <Edit3 className="w-5.5 h-5.5" />
              </button>
              <button
                onClick={onDelete}
                className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-gray-100 hover:border-red-100"
                title="永久删除"
              >
                <Trash2 className="w-5.5 h-5.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              {/* 描述 */}
              {photo.description && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                    <span className="w-4 h-[1px] bg-gray-200 mr-2"></span>
                    背景描述
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-lg italic pl-4 border-l-2 border-primary-100">{photo.description}</p>
                </div>
              )}

              {/* AI生成文案 */}
              {photo.aiGeneratedText && (
                <div className="bg-gradient-to-br from-primary-50/50 to-purple-50/50 rounded-2xl p-6 border border-primary-50">
                  <div className="flex items-center mb-4">
                    <div className="p-1.5 bg-primary-100 rounded-lg mr-3 shadow-sm shadow-primary-200">
                      <Sparkles className="w-4 h-4 text-primary-600" />
                    </div>
                    <h3 className="text-sm font-bold text-primary-800">AI 灵感文案</h3>
                  </div>
                  <p className="text-gray-800 leading-relaxed text-lg font-medium font-serif">{photo.aiGeneratedText}</p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* 坐标信息 */}
              <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-100 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">地理坐标</h3>
                  <button
                    onClick={onEditLocation}
                    className="text-[10px] font-bold text-primary-600 hover:text-primary-700 hover:bg-primary-50 px-2 py-0.5 rounded transition-all flex items-center"
                    title="在地图上重新选点"
                  >
                    <Edit3 className="w-2.5 h-2.5 mr-1" />
                    重新选点
                  </button>
                </div>
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">纬度 (LAT)</span>
                    <span className="text-gray-900 font-mono font-medium">{photo.latitude.toFixed(6)}°</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">经度 (LNG)</span>
                    <span className="text-gray-900 font-mono font-medium">{photo.longitude.toFixed(6)}°</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhotoModal;
