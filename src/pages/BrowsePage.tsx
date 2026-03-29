import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { User, Photo, Album } from '../types';
import BrowseView from '../components/BrowseView';

interface BrowsePageProps {
  user: User;
}

export default function BrowsePage({ user }: BrowsePageProps) {
  const navigate = useNavigate();
  const { photoId } = useParams<{ photoId?: string }>();
  const [searchParams] = useSearchParams();
  const albumId = searchParams.get('albumId');

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user.id]);

  const loadData = async () => {
    try {
      const [userPhotos, userAlbums] = await Promise.all([
        window.electronAPI.db.getPhotosByUser(user.id),
        window.electronAPI.db.getAlbumsByUser(user.id),
      ]);

      // Filter by albumId if provided
      const filteredPhotos = albumId
        ? userPhotos.filter(p => p.albumId === albumId)
        : userPhotos;

      setPhotos(filteredPhotos);
      setAlbums(userAlbums);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = useCallback((photo: Photo) => {
    navigate(`/edit/${photo.id}`);
  }, [navigate]);

  const handleClose = useCallback(() => {
    navigate('/map');
  }, [navigate]);

  const handlePhotoChange = useCallback((photo: Photo) => {
    // Could track analytics or do other things here
    console.log('Viewing photo:', photo.id);
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="text-gray-600 mb-4">没有可浏览的照片</div>
        <button
          onClick={() => navigate('/map')}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          返回地图
        </button>
      </div>
    );
  }

  return (
    <BrowseView
      photos={photos}
      albums={albums}
      initialPhotoId={photoId}
      onEdit={handleEdit}
      onClose={handleClose}
      onPhotoChange={handlePhotoChange}
    />
  );
}
