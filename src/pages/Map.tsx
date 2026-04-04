import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, Plus, X, Image as ImageIcon, Loader2, Sparkles, MapPin, FolderPlus, Edit2, Trash2, Folder, AlertCircle, Eye, Search, Footprints, MoveRight, ChevronDown } from 'lucide-react';
import L, { TileLayer } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { User, Photo, Album, MapProvider } from '../types';
import AIGenerateModal from '../components/AIGenerateModal';

interface MapProps {
  user: User;
  onLogout: () => void;
}

// 默认中心位置 — Leaflet uses [lat, lng]
const DEFAULT_CENTER: [number, number] = [19.188947, 109.778137];
const DEFAULT_ZOOM = 9;

// Custom TileLayer for Tencent maps (requires server selection + y inversion)
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

// OSM tile URL template
const OSM_TILE_URL = 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png';

const getTodayDate = () => new Date().toISOString().slice(0, 10);

function Map({ user, onLogout }: MapProps) {
  const navigate = useNavigate();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const selectMapContainerRef = useRef<HTMLDivElement>(null);
  const selectMapRef = useRef<L.Map | null>(null);
  const mainTileLayerRef = useRef<L.TileLayer | null>(null);
  const selectTileLayerRef = useRef<TileLayer | TencentTileLayer | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const selectMarkerRef = useRef<L.Marker | null>(null);
  const mapInitializedRef = useRef(false);
  const selectMapInitializedRef = useRef(false);

  // 数据状态
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  // UI 状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const [error, setError] = useState('');
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [mapProvider, setMapProvider] = useState<MapProvider>('tencent');
  const [isEditing, setIsEditing] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [thumbnailRect, setThumbnailRect] = useState<{ x: number, y: number, w: number, h: number, dirIndex: number } | null>(null);
  const [crosshairPos, setCrosshairPos] = useState<{ x: number, y: number } | null>(null);
  const [isDraggingThumbnail, setIsDraggingThumbnail] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const previewLayerRef = useRef<L.LayerGroup | null>(null);

  // Directions: N, S, E, W, NE, NW, SE, SW
  const DIRECTIONS = [
    { dx: 0, dy: -1 }, // N
    { dx: 0, dy: 1 },  // S
    { dx: 1, dy: 0 },  // E
    { dx: -1, dy: 0 }, // W
    { dx: 1, dy: -1 }, // NE
    { dx: -1, dy: -1 },// NW
    { dx: 1, dy: 1 },  // SE
    { dx: -1, dy: 1 }  // SW
  ];

  const MARGIN = 40; // ~1cm in screen pixels

  // Helper to calculate best thumbnail position based on crosshair screen position
  const calculateThumbnailRect = (px: number, py: number, imgW: number, imgH: number, preferredDirIndex: number = -1) => {
    // Thumbnail display size (roughly 5x the small marker, but keeping aspect ratio)
    // Small markers are 50x50, so target area is ~250x250, but constrained by image ratio.
    const maxDim = 312; // 240 * 1.3
    const actionBarHeight = 44; // 底部操作栏预留高度
    let w = maxDim;
    let h = maxDim;
    if (imgW > imgH) {
      h = (imgH / imgW) * maxDim;
    } else {
      w = (imgW / imgH) * maxDim;
    }

    h += actionBarHeight; // 为按钮留出空间

    // Directions to try: if preferred is set, try it first.
    // Otherwise, shuffle directions to make it appear randomly around the target.
    let indices = DIRECTIONS.map((_, i) => i);
    if (preferredDirIndex >= 0) {
      indices = [preferredDirIndex, ...indices.filter(i => i !== preferredDirIndex)];
    } else {
      // Randomize initial direction
      indices.sort(() => Math.random() - 0.5);
    }

    for (const i of indices) {
      const dir = DIRECTIONS[i];
      // Center of thumbnail Cx, Cy such that boundary is MARGIN away from px, py
      // Boundary distance d = |Cx - px| - w/2 or |Cy - py| - h/2
      // So Cx = px + dir.dx * (w/2 + MARGIN), but if dir.dx is 0, Cx = px
      // To be precise, if it's diagonal (NE/NW/SE/SW), both dx and dy contribute.
      const cx = px + dir.dx * (w/2 + MARGIN);
      const cy = py + dir.dy * (h/2 + MARGIN);

      // Check if this position fits on screen (roughly)
      const rect = { x: cx - w/2, y: cy - h/2, w, h, dirIndex: i };
      if (rect.x > 50 && rect.x + w < window.innerWidth - 50 && rect.y > 50 && rect.y + h < window.innerHeight - 50) {
        return rect;
      }
    }
    // Fallback to first direction if none fit perfectly
    const dir = DIRECTIONS[indices[0]];
    return { x: px + dir.dx * (w/2 + MARGIN) - w/2, y: py + dir.dy * (h/2 + MARGIN) - h/2, w, h, dirIndex: indices[0] };
  };

  // Sync crosshair screen position and leader line
  useEffect(() => {
    if (!mapRef.current || !previewPhoto) {
      setCrosshairPos(null);
      setThumbnailRect(null);
      return;
    }

    const map = mapRef.current;
    const updatePositions = () => {
      const latlng = L.latLng(previewPhoto.latitude, previewPhoto.longitude);
      const containerPoint = map.latLngToContainerPoint(latlng);

      // Get map container offset relative to window for fixed overlay positioning
      const mapRect = mapContainerRef.current?.getBoundingClientRect();
      const offsetX = mapRect?.left || 0;
      const offsetY = mapRect?.top || 0;

      setCrosshairPos({ x: containerPoint.x + offsetX, y: containerPoint.y + offsetY });
    };

    map.on('move zoom viewreset', updatePositions);
    updatePositions();

    // Calculate initial thumbnail position based on aspect ratio
    const img = new Image();
    img.onload = () => {
      // Re-get current crosshair position in case it shifted slightly during load
      const latlng = L.latLng(previewPhoto.latitude, previewPhoto.longitude);
      const cp = map.latLngToContainerPoint(latlng);
      const mapRect = mapContainerRef.current?.getBoundingClientRect();
      const ox = mapRect?.left || 0;
      const oy = mapRect?.top || 0;

      setThumbnailRect(calculateThumbnailRect(cp.x + ox, cp.y + oy, img.width, img.height));
    };
    img.src = previewPhoto.imagePath;

    return () => {
      map.off('move zoom viewreset', updatePositions);
    };
  }, [previewPhoto]);

  // Handle auto-repositioning if crosshair gets obscured
  useEffect(() => {
    if (!crosshairPos || !thumbnailRect || isDraggingThumbnail) return;

    // Margin check: if crosshair is inside thumbnail or too close
    const { x, y, w, h } = thumbnailRect;
    const buffer = 10; // Extra buffer before jumping
    if (crosshairPos.x > x - buffer && crosshairPos.x < x + w + buffer &&
        crosshairPos.y > y - buffer && crosshairPos.y < y + h + buffer) {

      // Need aspect ratio again (could store it, but for now just use current w, h)
      setThumbnailRect(calculateThumbnailRect(crosshairPos.x, crosshairPos.y, w, h, (thumbnailRect.dirIndex + 1) % 8));
    }
  }, [crosshairPos, thumbnailRect, isDraggingThumbnail]);

  // Dragging logic
  useEffect(() => {
    if (!isDraggingThumbnail) return;

    const handleMouseMove = (e: MouseEvent) => {
      setThumbnailRect(prev => prev ? {
        ...prev,
        x: e.clientX - dragOffsetRef.current.x,
        y: e.clientY - dragOffsetRef.current.y
      } : null);
    };

    const handleMouseUp = () => {
      setIsDraggingThumbnail(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingThumbnail]);

  // 添加照片表单状态 (支持多张导入)
  const [newPhoto, setNewPhoto] = useState<Partial<Photo>>({
    title: '',
    description: '',
    latitude: DEFAULT_CENTER[0],
    longitude: DEFAULT_CENTER[1],
    address: '',
    albumId: null,
    photoDate: '',
  });
  const [selectedImages, setSelectedImages] = useState<{data: string, name: string, exif?: any}[]>([]);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);
  const [lastImportedPhotoDate, setLastImportedPhotoDate] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [movingPhotoId, setMovingPhotoId] = useState<string | null>(null);
  const [albumPickerPhotoId, setAlbumPickerPhotoId] = useState<string | null>(null);

  // 相册表单
  const [albumForm, setAlbumForm] = useState({ name: '', description: '' });

  // Build a tile layer for the given provider and map type
  const buildTileLayer = (provider: MapProvider, type: 'standard' | 'satellite'): TileLayer | TencentTileLayer => {
    if (provider === 'tencent') {
      const styleId = type === 'satellite' ? 101 : 1000;
      return new TencentTileLayer(styleId);
    } else {
      return L.tileLayer(OSM_TILE_URL, {
        tileSize: 256,
        minZoom: 3,
        maxZoom: 18,
        attribution: '',
      });
    }
  };

  
  // 创建高精度对标点 (红色“十”字线)
  const createMarkerIcon = (_photo: Photo) => {
    const iconHtml = `
      <div class="precision-target">
        <div class="target-line vertical"></div>
        <div class="target-line horizontal"></div>
        <div class="target-center"></div>
      </div>
    `;
    return L.divIcon({
      html: iconHtml,
      className: 'custom-leaflet-target',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  const createFootprintIcon = () => L.divIcon({
    html: `
      <div style="width:28px;height:28px;border-radius:9999px;background:rgba(245,158,11,0.92);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(120,53,15,0.35);border:2px solid rgba(255,255,255,0.95);color:#fff7d6;font-size:15px;">👣</div>
    `,
    className: 'custom-footprint-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  // 初始化主地图
  useEffect(() => {
    const initMap = async () => {
      try {
        setMapLoading(true);
        setMapError('');

        if (mapInitializedRef.current) {
          setMapLoading(false);
          return;
        }

        if (!mapContainerRef.current) {
          console.error('Map container not found!');
          setMapError('地图容器未找到');
          setMapLoading(false);
          return;
        }

        // Load map provider preference from settings
        const stored = await window.electronAPI.store.get('mapProvider');
        const provider: MapProvider = stored === 'osm' ? 'osm' : 'tencent';
        setMapProvider(provider);
        console.log('Map provider:', provider);

        // Create map instance
        const map = L.map(mapContainerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          zoomControl: true,
          attributionControl: true,
        });

        // Add initial tile layer
        mainTileLayerRef.current = buildTileLayer(provider, 'standard');
        mainTileLayerRef.current.addTo(map);

        mapRef.current = map;
        mapInitializedRef.current = true;
        console.log('Map initialized successfully');
        setMapLoading(false);
      } catch (error) {
        console.error('Map initialization error:', error);
        setMapError('地图加载失败，请检查网络连接。');
        setMapLoading(false);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      mainTileLayerRef.current = null;
      // Note: we intentionally do NOT reset mapInitializedRef to false.
      // The guard `if (mapInitializedRef.current) return` at the top of initMap
      // will prevent double-initialization on any future remount.
    };
  }, []);

  // Handle standard/satellite layer switch
  useEffect(() => {
    if (!mapRef.current || !mapInitializedRef.current) return;
    if (mainTileLayerRef.current) {
      mapRef.current.removeLayer(mainTileLayerRef.current);
    }
    mainTileLayerRef.current = buildTileLayer(mapProvider, mapType);
    mainTileLayerRef.current.addTo(mapRef.current);
  }, [mapType, mapProvider]);

  // Select map — shown in both add-modal and edit-modal
  useEffect(() => {
    // Initialize when add modal opens OR when editing a photo
    const shouldInit = showAddModal || !!editingPhoto;
    if (!shouldInit) {
      if (selectMapRef.current) {
        selectMapRef.current.remove();
        selectMapRef.current = null;
      }
      selectMapInitializedRef.current = false;
      selectMarkerRef.current = null;
      return;
    }

    const initSelectMap = async () => {
      try {
        if (selectMapInitializedRef.current) return;

        // Pick correct container: add-modal uses ref, edit-modal uses class selector
        const container = showAddModal
          ? selectMapContainerRef.current
          : (document.querySelector('.select-map-container') as HTMLDivElement);
        if (!container) return;

        if (selectMapRef.current) {
          selectMapRef.current.remove();
          selectMapRef.current = null;
        }
        selectMapInitializedRef.current = false;

        const centerLat = editingPhoto?.latitude ?? newPhoto.latitude ?? DEFAULT_CENTER[0];
        const centerLng = editingPhoto?.longitude ?? newPhoto.longitude ?? DEFAULT_CENTER[1];

        const map = L.map(container, {
          center: [centerLat, centerLng] as [number, number],
          zoom: 12,
          zoomControl: true,
          attributionControl: false,
        });

        selectTileLayerRef.current = buildTileLayer(mapProvider, 'standard');
        selectTileLayerRef.current.addTo(map);

        const updateSelection = (lat: number, lng: number) => {
          const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          if (editingPhoto) {
            setEditingPhoto(prev => prev ? { ...prev, latitude: lat, longitude: lng, address } : prev);
          } else {
            setNewPhoto(prev => ({ ...prev, latitude: lat, longitude: lng, address }));
          }

          if (selectMarkerRef.current) selectMarkerRef.current.remove();
          const targetPhoto = editingPhoto || { imagePath: selectedImages[currentImportIndex]?.data || '' } as Photo;
          selectMarkerRef.current = L.marker([lat, lng], { icon: createMarkerIcon(targetPhoto) }).addTo(map);
        };

        map.on('click', (e: L.LeafletMouseEvent) => {
          updateSelection(e.latlng.lat, e.latlng.lng);
        });

        selectMapRef.current = map;
        selectMapInitializedRef.current = true;

        if (editingPhoto) {
          updateSelection(editingPhoto.latitude, editingPhoto.longitude);
        } else if (newPhoto.latitude && newPhoto.longitude) {
          updateSelection(newPhoto.latitude, newPhoto.longitude);
        }
      } catch (error) {
        console.error('Select map initialization error:', error);
      }
    };

    // Reset init flag when switching between add and edit modes
    if (editingPhoto && !showAddModal) {
      selectMapInitializedRef.current = false;
    }

    const timer = setTimeout(initSelectMap, 100);
    return () => {
      clearTimeout(timer);
      if (selectMapRef.current) {
        selectMapRef.current.remove();
        selectMapRef.current = null;
      }
      selectMapInitializedRef.current = false;
      selectTileLayerRef.current = null;
      selectMarkerRef.current = null;
    };
  }, [showAddModal, currentImportIndex, editingPhoto?.id, mapProvider, mapType]);

  // 加载数据
  useEffect(() => {
    loadPhotos();
    loadAlbums();
  }, [user.id]);

  // Sync editingPhoto lat/lng changes (from text input) to select map marker
  useEffect(() => {
    if (!editingPhoto || !selectMapRef.current || !selectMapInitializedRef.current) return;
    const lat = editingPhoto.latitude;
    const lng = editingPhoto.longitude;
    selectMapRef.current.setView([lat, lng], 12);
    if (selectMarkerRef.current) selectMarkerRef.current.remove();
    selectMarkerRef.current = L.marker([lat, lng], { icon: createMarkerIcon(editingPhoto) }).addTo(selectMapRef.current);
  }, [editingPhoto?.latitude, editingPhoto?.longitude]);

  // Switch select map tile layer when provider or type changes
  useEffect(() => {
    if (!selectMapRef.current || !selectTileLayerRef.current) return;
    selectMapRef.current.removeLayer(selectTileLayerRef.current);
    selectTileLayerRef.current = buildTileLayer(mapProvider, mapType);
    selectTileLayerRef.current.addTo(selectMapRef.current);
  }, [mapType, mapProvider]);

  // Handle preview thumbnail and leader line
  useEffect(() => {
    if (!mapRef.current) return;

    if (previewLayerRef.current) {
      previewLayerRef.current.clearLayers();
    } else {
      previewLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    if (!previewPhoto) return;

    // We no longer add the thumbnail as a Leaflet marker.
    // It's handled by the React overlay state.
  }, [previewPhoto]);

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

  const filteredPhotos = useMemo(() => (
    selectedAlbumId ? photos.filter(p => p.albumId === selectedAlbumId) : photos
  ), [photos, selectedAlbumId]);

  const groupedPhotos = useMemo(() => {
    const groups = new globalThis.Map<string, Photo[]>();
    for (const photo of filteredPhotos) {
      const key = `${photo.latitude.toFixed(6)},${photo.longitude.toFixed(6)}`;
      const current = groups.get(key) || [];
      current.push(photo);
      groups.set(key, current);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({ key, photo: items[0], count: items.length }));
  }, [filteredPhotos]);


  const openPhoto = (photo: Photo) => {
    if (!mapRef.current) return;

    // 1. 先清除当前预览 (避免上一张照片的框架在移动时闪烁)
    setPreviewPhoto(null);
    setThumbnailRect(null);
    setCrosshairPos(null);

    // 2. 地图飞至目标位置
    const targetZoom = 15;
    const randomDuration = 0.8 + Math.random() * 0.7; // 0.8s - 1.5s 随机
    mapRef.current.flyTo([photo.latitude, photo.longitude], targetZoom, {
      duration: randomDuration,
      easeLinearity: 0.25
    });

    // 3. 监听飞行动画结束
    const onMoveEnd = () => {
      // 延时一小会儿确保视觉平滑
      setTimeout(() => {
        setPreviewPhoto(photo);
      }, 100);
      mapRef.current?.off('moveend', onMoveEnd);
    };
    mapRef.current.on('moveend', onMoveEnd);
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
    const nextPhotoDate = photoData.exif?.photoDate || lastImportedPhotoDate || getTodayDate();
    setNewPhoto(prev => ({
      ...prev,
      title: photoData.name.split('.')[0],
      description: '',
      latitude: photoData.exif?.latitude || DEFAULT_CENTER[0],
      longitude: photoData.exif?.longitude || DEFAULT_CENTER[1],
      address: '',
      aiGeneratedText: '',
      albumId: selectedAlbumId,
      photoDate: nextPhotoDate,
    }));

    const targetLat = photoData.exif?.latitude || DEFAULT_CENTER[0];
    const targetLng = photoData.exif?.longitude || DEFAULT_CENTER[1];
    if (selectMapRef.current) {
      const latlng: [number, number] = [targetLat, targetLng];
      selectMapRef.current.setView(latlng, 12);
      if (selectMarkerRef.current) {
        selectMarkerRef.current.remove();
      }
      selectMarkerRef.current = L.marker(latlng).addTo(selectMapRef.current);
    }

    if (photoData.exif?.latitude) {
      setNewPhoto(prev => ({
        ...prev,
        address: `${photoData.exif.latitude.toFixed(6)}, ${photoData.exif.longitude.toFixed(6)}`,
      }));
    }
  };

  const handleNextImport = async () => {
    await saveCurrentImage();
    if (currentImportIndex < selectedImages.length - 1) {
      const nextIndex = currentImportIndex + 1;
      const nextPhoto = selectedImages[nextIndex];
      setCurrentImportIndex(nextIndex);
      applyPhotoData(nextPhoto);
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
          photoDate: newPhoto.photoDate || null,
        });
      } else {
        const savedImage = await window.electronAPI.file.saveImage(current.data, user.id);
        await window.electronAPI.db.createPhoto({
          userId: user.id,
          albumId: newPhoto.albumId,
          title: newPhoto.title || current.name,
          description: newPhoto.description || '',
          imagePath: savedImage.path,
          latitude: newPhoto.latitude || DEFAULT_CENTER[0],
          longitude: newPhoto.longitude || DEFAULT_CENTER[1],
          address: newPhoto.address || '',
          aiGeneratedText: newPhoto.aiGeneratedText || '',
          photoDate: newPhoto.photoDate || null,
        });
      }
      setLastImportedPhotoDate(newPhoto.photoDate || '');
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
        photoDate: editingPhoto.photoDate || null,
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
      loadPhotos();
    } catch (error) {
      console.error('Error deleting album:', error);
    }
  };

  const resetAddForm = () => {
    setNewPhoto({
      title: '',
      description: '',
      latitude: DEFAULT_CENTER[0],
      longitude: DEFAULT_CENTER[1],
      address: '',
      albumId: selectedAlbumId,
      photoDate: '',
    });
    setSelectedImages([]);
    setCurrentImportIndex(0);
    setLastImportedPhotoDate('');
    setIsEditing(false);
    setEditingPhotoId(null);
  };

  const handleAIGenerated = (text: string) => {
    if (editingPhoto) {
      setEditingPhoto({ ...editingPhoto, aiGeneratedText: text });
    } else {
      setNewPhoto(prev => ({ ...prev, aiGeneratedText: text }));
    }
    setShowAIGenerate(false);
  };

  const handleSearchAddress = async () => {
    if (!searchKeyword.trim() || !mapRef.current) return;

    setSearchingAddress(true);
    setError('');
    try {
      const response = await fetch(`https://apis.map.qq.com/ws/geocoder/v1/?address=${encodeURIComponent(searchKeyword.trim())}&output=json`);
      const data = await response.json();
      const location = data?.result?.location;
      if (!location) {
        throw new Error('未找到该地址');
      }
      setPreviewPhoto(null);
      setThumbnailRect(null);
      setCrosshairPos(null);
      mapRef.current.flyTo([location.lat, location.lng], 15, { duration: 1 });
    } catch (err: any) {
      setError(err.message || '地址搜索失败');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSearchingAddress(false);
    }
  };

  const handleDeletePhoto = async (photo: Photo) => {
    if (!confirm(`确定要删除照片“${photo.title}”吗？`)) return;
    try {
      await window.electronAPI.file.deleteImage(photo.imagePath);
      await window.electronAPI.db.deletePhoto(photo.id);
      setPhotos(prev => prev.filter(item => item.id !== photo.id));
      if (previewPhoto?.id === photo.id) {
        setPreviewPhoto(null);
        setThumbnailRect(null);
        setCrosshairPos(null);
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  };

  const handleMovePhotoToAlbum = async (photo: Photo, targetAlbumId: string | null) => {
    const targetName = targetAlbumId
      ? albums.find(album => album.id === targetAlbumId)?.name || '目标相册'
      : '未分类';

    setMovingPhotoId(photo.id);
    try {
      const updated = await window.electronAPI.db.updatePhoto(photo.id, {
        title: photo.title,
        description: photo.description,
        latitude: photo.latitude,
        longitude: photo.longitude,
        address: photo.address,
        aiGeneratedText: photo.aiGeneratedText,
        albumId: targetAlbumId,
        photoDate: photo.photoDate || null,
      });

      if (updated) {
        setPhotos(prev => prev.map(item => item.id === updated.id ? updated : item));
        if (previewPhoto?.id === updated.id) {
          setPreviewPhoto(updated);
        }
        setAlbumPickerPhotoId(null);
      }
    } catch (error) {
      console.error('Error moving photo:', error);
      setError(`移动失败：无法将照片移到${targetName}`);
      setTimeout(() => setError(''), 3000);
    } finally {
      setMovingPhotoId(null);
    }
  };

  // 更新地图标记
  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (previewPhoto) {
      const marker = L.marker([previewPhoto.latitude, previewPhoto.longitude], {
        icon: createMarkerIcon(previewPhoto),
      });

      marker.on('click', () => {
        navigate(`/browse/${previewPhoto.id}?albumId=${selectedAlbumId || ''}`);
      });

      marker.addTo(mapRef.current);
      markersRef.current.push(marker);
      return;
    }

    groupedPhotos.forEach(({ photo, count }) => {
      const marker = L.marker([photo.latitude, photo.longitude], {
        icon: createFootprintIcon(),
      });
      marker.on('click', () => openPhoto(photo));
      marker.bindTooltip(count > 1 ? `${count} 张照片` : '1 张照片', { direction: 'top', offset: [0, -10] });
      marker.addTo(mapRef.current!);
      markersRef.current.push(marker);
    });
  }, [groupedPhotos, navigate, openPhoto, previewPhoto, selectedAlbumId]);

  // Handle preview thumbnail and leader line
  useEffect(() => {
    if (!mapRef.current) return;

    if (previewLayerRef.current) {
      previewLayerRef.current.clearLayers();
    } else {
      previewLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    if (!previewPhoto) return;

    // We no longer add the thumbnail as a Leaflet marker.
    // It's handled by the React overlay state.
  }, [previewPhoto]);

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

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <div className="w-[18.5rem] shrink-0 border-r border-gray-200 bg-white/95 backdrop-blur-sm flex flex-col">
        {/* 头部 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <MapPin className="w-6 h-6 text-primary-600" />
              <span className="text-lg font-bold text-gray-900">Grainmap</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setPreviewPhoto(null);
                  if (mapRef.current) {
                    mapRef.current.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM);
                  }
                }}
                className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                title="回到首页"
              >
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold">HOME</span>
                </div>
              </button>
              <button onClick={() => navigate('/settings')} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg" title="设置">
                <Settings className="w-5 h-5" />
              </button>
              <button onClick={onLogout} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg" title="退出登录">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchAddress(); }}
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
                placeholder="搜索地图地址"
              />
            </div>
            <button onClick={handleSearchAddress} disabled={searchingAddress || !searchKeyword.trim()} className="btn-secondary !py-2 !px-3 text-sm disabled:opacity-50">
              {searchingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜索'}
            </button>
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
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-[10px] animate-slide-up mb-2 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1.5 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (previewPhoto) {
                  setEditingPhoto(previewPhoto);
                } else {
                  setError('请先在地图或列表中选择一张照片');
                  setTimeout(() => setError(''), 3000);
                }
              }}
              className="flex-1 btn-secondary !py-2 flex items-center justify-center text-xs"
              title="设定照片 (编辑当前选中照片)"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1.5" />
              设定照片
            </button>
            <button
              onClick={() => navigate(`/browse?albumId=${selectedAlbumId || ''}`)}
              className="flex-1 btn-secondary !py-2 flex items-center justify-center text-xs"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              浏览相册
            </button>
          </div>
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
          <div className="space-y-2.5">
            {filteredPhotos.map(photo => (
              <div
                key={photo.id}
                className="group rounded-xl border border-gray-200 bg-gray-50/90 p-2 cursor-pointer hover:bg-gray-100 transition-colors relative"
                onClick={() => openPhoto(photo)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePhoto(photo);
                  }}
                  className="absolute bottom-2 right-2 z-10 rounded-full bg-white/90 p-1.5 text-gray-500 shadow-sm hover:text-red-600"
                  title="删除照片"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-start gap-2">
                  <div className="relative shrink-0">
                    <img src={photo.imagePath} alt={photo.title} className="h-16 w-16 object-cover rounded-lg bg-gray-100" />
                    {photo.latitude && photo.longitude && (
                      <div className="absolute -top-1 -right-1 bg-primary-500 text-white p-0.5 rounded-full border border-white shadow-sm">
                        <MapPin className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pr-8">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium text-gray-900 line-clamp-2 break-words">{photo.title}</h4>
                      <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setAlbumPickerPhotoId(prev => prev === photo.id ? null : photo.id)}
                          className="rounded-full bg-white p-1.5 text-gray-500 shadow-sm hover:text-primary-600"
                          title="分入相册"
                        >
                          <MoveRight className="h-3.5 w-3.5" />
                        </button>
                        {albumPickerPhotoId === photo.id && (
                          <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                            <div className="mb-1 flex items-center justify-between px-1 text-[10px] font-medium text-gray-500">
                              <span>分入相册</span>
                              <ChevronDown className="h-3 w-3" />
                            </div>
                            <select
                              value={photo.albumId || ''}
                              onChange={(e) => handleMovePhotoToAlbum(photo, e.target.value || null)}
                              disabled={movingPhotoId === photo.id}
                              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-600 outline-none focus:border-primary-500"
                              autoFocus
                            >
                              <option value="">未分类</option>
                              {albums.map(album => (
                                <option key={album.id} value={album.id}>{album.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">{photo.address || '未设置位置'}</p>
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
        {mapError && !mapLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10 p-6">
            <div className="max-w-md text-center text-gray-700">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">地图加载失败</h3>
              <p className="text-sm text-gray-600 mb-4">{mapError}</p>
              <button
                onClick={() => navigate('/settings')}
                className="btn-primary !py-2 !px-4 text-sm"
              >
                前往设置
              </button>
            </div>
          </div>
        )}
        <div ref={mapContainerRef} id="grainmap-main-map" className="w-full h-full" />

        {/* 图层切换按钮 */}
        <div className="absolute left-4 bottom-4 flex bg-white rounded-lg shadow-md overflow-hidden z-10">
          <button onClick={() => setMapType('standard')} className={`px-3 py-1.5 text-xs font-medium border-r border-gray-100 transition-colors ${mapType === 'standard' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>标准</button>
          <button onClick={() => setMapType('satellite')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${mapType === 'satellite' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>卫星</button>
        </div>

        {/* 当前地图信息 */}
            <div className="absolute left-4 top-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-md z-10 flex items-center gap-2">
              <Footprints className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-gray-600">
                {mapProvider === 'tencent' ? '腾讯地图' : 'OpenStreetMap'} · {mapType === 'satellite' ? '卫星' : '标准'}
              </span>
            </div>
      </div>

      {/* 添加照片全屏 UI */}
      {showAddModal && (
        <div className="fixed inset-0 z-[1000] bg-white flex h-screen w-screen overflow-hidden animate-fade-in">
          <div className="w-[520px] flex flex-col h-full border-r border-gray-100 bg-white">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{isEditing ? '编辑照片' : '添加照片'}</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {isEditing ? '左侧调整照片信息，右侧直接在地图上修改位置。' : '先看照片，再在右侧地图上确认拍摄位置。'}
                </p>
                {!isEditing && selectedImages.length > 1 && (
                  <p className="text-xs text-gray-500 mt-1">正在导入第 {currentImportIndex + 1} 张，共 {selectedImages.length} 张</p>
                )}
              </div>
              <button onClick={() => { setShowAddModal(false); resetAddForm(); }} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择照片</label>
                {selectedImages.length > 0 ? (
                  <div className="flex justify-center">
                    <div className="relative w-full max-w-[320px]">
                      <img src={selectedImages[currentImportIndex]?.data} alt="Selected" className="mx-auto h-40 w-full object-contain rounded-xl shadow-sm bg-gray-100" />
                      {!isEditing && (
                        <button onClick={() => { setSelectedImages([]); }} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"><X className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button onClick={handleSelectImage} className="w-full aspect-video border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-primary-500 hover:text-primary-500 hover:bg-primary-50 transition-all">
                    <ImageIcon className="w-12 h-12 mb-2" />
                    <span className="font-medium">点击选择照片 (支持多选)</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">所属相册</label>
                  <select
                    value={newPhoto.albumId || ''}
                    onChange={(e) => setNewPhoto(prev => ({ ...prev, albumId: e.target.value || null }))}
                    className="input-field text-sm"
                  >
                    <option value="">未分类</option>
                    {albums.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">拍摄日期</label>
                  <input
                    type="date"
                    value={newPhoto.photoDate || ''}
                    onChange={(e) => setNewPhoto(prev => ({ ...prev, photoDate: e.target.value }))}
                    className="input-field text-sm"
                  />
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold mb-1">地址 / 坐标</span>
                  <span className="text-sm break-all">{newPhoto.address || '在右侧地图上点击选点'}</span>
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
            </div>

            <div className="p-5 border-t border-gray-100 flex space-x-3 bg-gray-50">
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
        <div className="fixed inset-0 z-[1100] bg-white flex h-screen w-screen overflow-hidden animate-fade-in">
          <div className="w-[540px] flex flex-col border-r border-gray-100 bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">编辑照片</h2>
                <p className="text-xs text-gray-500 mt-1">左侧编辑内容，右侧直接在地图上重新定位。</p>
              </div>
              <button onClick={() => setEditingPhoto(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex justify-center">
                <img src={editingPhoto.imagePath} alt={editingPhoto.title} className="h-40 w-full max-w-[340px] object-contain rounded-xl bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">所属相册</label>
                <select value={editingPhoto.albumId || ''} onChange={(e) => setEditingPhoto(prev => prev ? { ...prev, albumId: e.target.value || null } : null)} className="input-field text-sm">
                  <option value="">未分类</option>
                  {albums.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                <input type="text" value={editingPhoto.title} onChange={(e) => setEditingPhoto(prev => prev ? { ...prev, title: e.target.value } : null)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea value={editingPhoto.description} onChange={(e) => setEditingPhoto(prev => prev ? { ...prev, description: e.target.value } : null)} className="input-field h-24 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">拍摄日期</label>
                <input
                  type="date"
                  value={editingPhoto.photoDate || ''}
                  onChange={(e) => setEditingPhoto(prev => prev ? { ...prev, photoDate: e.target.value } : null)}
                  className="input-field text-sm"
                />
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block uppercase font-bold mb-1">地址 / 坐标</span>
                <span className="text-sm break-all">{editingPhoto.address || '在右侧地图中重新选点'}</span>
              </div>
              <button onClick={() => setShowAIGenerate(true)} className="w-full btn-secondary flex items-center justify-center">
                <Sparkles className="w-4 h-4 mr-2" />重新生成AI文案
              </button>
            </div>
            <div className="flex space-x-3 p-5 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setEditingPhoto(null)} className="flex-1 btn-secondary">取消</button>
              <button onClick={handleUpdatePhoto} disabled={loading} className="flex-1 btn-primary flex items-center justify-center">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : '保存'}
              </button>
            </div>
          </div>
          <div className="flex-1 relative bg-gray-100">
            <div className="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-xl border border-white/50">
              <p className="text-sm font-bold text-gray-900 flex items-center"><MapPin className="w-4 h-4 mr-1.5 text-primary-600" />点击地图更新这张照片的位置</p>
            </div>
            <div className="select-map-container w-full h-full cursor-crosshair" />
          </div>
        </div>
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

      {thumbnailRect && crosshairPos && previewPhoto && (
        <>
          <svg className="fixed inset-0 pointer-events-none z-[1200] w-full h-full">
            <line
              x1={crosshairPos.x}
              y1={crosshairPos.y}
              x2={thumbnailRect.x + thumbnailRect.w / 2}
              y2={thumbnailRect.y + thumbnailRect.h / 2}
              stroke="#1e3a8a"
              strokeWidth="1"
              strokeDasharray="5,5"
              strokeOpacity="0.6"
            />
          </svg>
          <div
            key={previewPhoto.id}
            className="fixed z-[1201] cursor-move select-none animate-thumbnail-emerge"
            style={{
              left: thumbnailRect.x,
              top: thumbnailRect.y,
              width: thumbnailRect.w,
              height: thumbnailRect.h,
              transformOrigin: `${crosshairPos.x - thumbnailRect.x}px ${crosshairPos.y - thumbnailRect.y}px`
            } as any}
            onMouseDown={(e) => {
              setIsDraggingThumbnail(true);
              dragOffsetRef.current = {
                x: e.clientX - thumbnailRect.x,
                y: e.clientY - thumbnailRect.y
              };
            }}
          >
            <div className="absolute -inset-2 bg-white/30 blur-lg rounded-xl"></div>
            <div className="relative bg-white p-2 rounded-xl shadow-2xl border-[4px] border-white overflow-hidden h-full w-full flex flex-col group/thumb">
              <div className="flex-1 min-h-0 relative overflow-hidden rounded-lg">
                <img
                  src={previewPhoto.imagePath}
                  className="w-full h-full object-contain shadow-inner bg-gray-50"
                  draggable={false}
                />
              </div>

              {/* 操作按钮栏 - 默认隐藏，悬浮或选中时显示 */}
              <div className="mt-2 flex gap-1.5 animate-slide-up">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPhoto(previewPhoto);
                  }}
                  className="flex-1 bg-gray-100 hover:bg-primary-50 hover:text-primary-600 text-gray-600 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center transition-all"
                  title="设定照片 (编辑)"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  设定照片
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/browse/${previewPhoto.id}?albumId=${selectedAlbumId || ''}`);
                  }}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center transition-all shadow-sm"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  浏览相册
                </button>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewPhoto(null);
              }}
              className="absolute -top-2 -right-2 bg-white text-gray-500 p-1 rounded-full shadow-lg hover:text-red-500 transition-colors z-10 border border-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Map;
