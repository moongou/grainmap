import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, Photo, Album } from '../types';
import EditView from '../components/EditView';
import AIGenerateModal from '../components/AIGenerateModal';

interface EditPageProps {
  user: User;
}

export default function EditPage({ user }: EditPageProps) {
  const navigate = useNavigate();
  const { photoId } = useParams<{ photoId: string }>();

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiCallback, setAiCallback] = useState<((text: string) => void) | null>(null);

  useEffect(() => {
    loadData();
  }, [user.id, photoId]);

  const loadData = async () => {
    try {
      const [userPhotos, userAlbums] = await Promise.all([
        window.electronAPI.db.getPhotosByUser(user.id),
        window.electronAPI.db.getAlbumsByUser(user.id),
      ]);

      const targetPhoto = userPhotos.find(p => p.id === photoId);
      if (!targetPhoto) {
        console.error('Photo not found:', photoId);
        navigate('/map');
        return;
      }

      setPhoto(targetPhoto);
      setAlbums(userAlbums);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback(async (updatedPhoto: Photo) => {
    try {
      const updated = await window.electronAPI.db.updatePhoto(updatedPhoto.id, {
        title: updatedPhoto.title,
        description: updatedPhoto.description,
        latitude: updatedPhoto.latitude,
        longitude: updatedPhoto.longitude,
        address: updatedPhoto.address,
        aiGeneratedText: updatedPhoto.aiGeneratedText,
        albumId: updatedPhoto.albumId,
        photoDate: updatedPhoto.photoDate || null,
      });

      if (updated) {
        navigate('/browse/' + updated.id);
      }
    } catch (error) {
      console.error('Error saving photo:', error);
    }
  }, [navigate]);

  const handleCancel = useCallback(() => {
    navigate('/browse/' + photoId);
  }, [navigate, photoId]);

  const handleDelete = useCallback(async () => {
    if (!photo || !confirm('确定要删除这张照片吗？')) return;

    try {
      await window.electronAPI.file.deleteImage(photo.imagePath);
      await window.electronAPI.db.deletePhoto(photo.id);
      navigate('/map');
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  }, [photo, navigate]);

  const handleShowAIGenerate = useCallback((callback: (text: string) => void) => {
    setAiCallback(() => callback);
    setShowAIGenerate(true);
  }, []);

  const handleAIGenerated = useCallback((text: string) => {
    if (aiCallback) {
      aiCallback(text);
    }
    setShowAIGenerate(false);
    setAiCallback(null);
  }, [aiCallback]);

  if (loading || !photo) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  return (
    <>
      <EditView
        photo={photo}
        albums={albums}
        onSave={handleSave}
        onCancel={handleCancel}
        onDelete={handleDelete}
        onShowAIGenerate={handleShowAIGenerate}
      />
      {showAIGenerate && (
        <AIGenerateModal
          userId={user.id}
          photoTitle={photo.title}
          photoDescription={photo.description}
          onClose={() => setShowAIGenerate(false)}
          onGenerate={handleAIGenerated}
        />
      )}
    </>
  );
}
