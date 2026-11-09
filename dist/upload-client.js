import { upload } from 'https://esm.sh/@vercel/blob@2.8.2/client';
window.clipforgeUploadMp4 = async (file, onProgress) => upload(`sources/${Date.now()}-${file.name}`, file, {
  access: 'public', handleUploadUrl: '/api/upload-source', multipart: file.size > 100 * 1024 * 1024,
  headers: { Authorization: `Bearer ${sessionStorage.getItem('clipforge_session') || ''}` }, onUploadProgress: onProgress,
});
