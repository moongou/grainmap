import { X, Edit3, Trash2, MapPin, Sparkles, Calendar } from 'lucide-react';
import { Photo } from '../types';

interface PhotoModalProps {
  photo: Photo;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function PhotoModal({ photo, onClose, onEdit, onDelete }: PhotoModalProps) {
  return (
    <div className="photo-modal-overlay" onClick={onClose}>
      <div 
        className="photo-modal-content max-w-4xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 照片区域 */}
        <div className="relative">
          <img
            src={photo.imagePath}
            alt={photo.title}
            className="w-full max-h-[60vh] object-contain bg-black"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 信息区域 */}
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{photo.title}</h2>
              <div className="flex items-center text-gray-500 mt-2 space-x-4">
                <span className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  {new Date(photo.createdAt).toLocaleDateString('zh-CN')}
                </span>
                {photo.address && (
                  <span className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {photo.address}
                  </span>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={onEdit}
                className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="编辑"
              >
                <Edit3 className="w-5 h-5" />
              </button>
              <button
                onClick={onDelete}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="删除"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 坐标信息 */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">坐标：</span>
              {photo.latitude.toFixed(6)}, {photo.longitude.toFixed(6)}
            </div>
          </div>

          {/* 描述 */}
          {photo.description && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">描述</h3>
              <p className="text-gray-600">{photo.description}</p>
            </div>
          )}

          {/* AI生成文案 */}
          {photo.aiGeneratedText && (
            <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Sparkles className="w-5 h-5 text-primary-600 mr-2" />
                <h3 className="text-sm font-medium text-primary-700">AI生成文案</h3>
              </div>
              <p className="text-gray-700 leading-relaxed">{photo.aiGeneratedText}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PhotoModal;
