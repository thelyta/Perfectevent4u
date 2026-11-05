import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';

export type MediaType = 'image' | 'video';

const imageExtensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

const videoExtensions: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/ogg': '.ogv'
};

const contentTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogv': 'video/ogg'
};

const imageSizeLimit = 12 * 1024 * 1024;
const videoSizeLimit = 100 * 1024 * 1024;

function cloudinaryEnabled() {
  return Boolean(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );
}

function configureCloudinary() {
  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  } else {
    cloudinary.config({ secure: true });
  }
}

function looksLikeImage(buffer: Buffer) {
  if (buffer.length < 12) return false;
  const header = buffer.toString('hex', 0, 12);
  return header.startsWith('ffd8ff') ||
    header.startsWith('89504e47') ||
    header.startsWith('47494638') ||
    (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP');
}

function looksLikeVideo(buffer: Buffer) {
  if (buffer.length < 12) return false;
  const ascii = buffer.toString('ascii', 0, 12);
  return ascii.slice(4, 8) === 'ftyp' ||
    buffer.toString('hex', 0, 4) === '1a45dfa3' ||
    ascii.startsWith('OggS');
}

function uploadToCloudinary(buffer: Buffer, resourceType: 'image' | 'video') {
  configureCloudinary();
  const folder = process.env.CLOUDINARY_FOLDER || 'PerfectEvent4U';
  return new Promise<{ public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { asset_folder: folder, public_id_prefix: folder, resource_type: resourceType, unique_filename: true },
      (error, result) => {
        if (error || !result) reject(error || new Error('Upload failed.'));
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function writeLocal(buffer: Buffer, extension: string) {
  const uploadDirectory = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDirectory, { recursive: true });
  const filename = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}${extension}`;
  await writeFile(path.join(uploadDirectory, filename), buffer, { flag: 'wx', mode: 0o644 });
  return `/uploads/${filename}`;
}

export async function storeMedia(file: File): Promise<{ image: string; imagePublicId: string | null; mediaType: MediaType }> {
  const imageExtension = imageExtensions[file.type];
  const videoExtension = videoExtensions[file.type];
  const mediaType: MediaType = videoExtension ? 'video' : 'image';
  const extension = videoExtension || imageExtension;
  if (!extension) throw new Error('Only JPG, PNG, WebP, GIF images or MP4, WebM, MOV videos are allowed.');
  if (mediaType === 'image' && file.size > imageSizeLimit) throw new Error('That photo is too large (12 MB max).');
  if (mediaType === 'video' && file.size > videoSizeLimit) throw new Error('That video is too large (100 MB max).');

  const buffer = Buffer.from(await file.arrayBuffer());
  const valid = mediaType === 'video' ? looksLikeVideo(buffer) : looksLikeImage(buffer);
  if (!valid) throw new Error(mediaType === 'video' ? 'One of the files is not a valid video.' : 'One of the files is not a valid image.');

  if (cloudinaryEnabled()) {
    const result = await uploadToCloudinary(buffer, mediaType);
    const url = mediaType === 'video'
      ? cloudinary.url(result.public_id, { resource_type: 'video', secure: true })
      : cloudinary.url(result.public_id, { secure: true, fetch_format: 'auto', quality: 'auto' });
    return { image: url, imagePublicId: result.public_id, mediaType };
  }

  return { image: await writeLocal(buffer, extension), imagePublicId: null, mediaType };
}

export async function storeImage(file: File) {
  const result = await storeMedia(file);
  if (result.mediaType !== 'image') throw new Error('Only images are allowed here.');
  return { image: result.image, imagePublicId: result.imagePublicId };
}

export async function removeStoredMedia(image: string | null, imagePublicId: string | null, mediaType: string = 'image') {
  if (imagePublicId && cloudinaryEnabled()) {
    configureCloudinary();
    await cloudinary.uploader.destroy(imagePublicId, { resource_type: mediaType === 'video' ? 'video' : 'image' }).catch(() => undefined);
    return;
  }
  if (!image?.startsWith('/uploads/')) return;

  const filename = path.basename(image);
  const uploadDirectory = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
  await unlink(path.join(/* turbopackIgnore: true */ uploadDirectory, filename)).catch(() => undefined);
}

export async function removeStoredImage(image: string | null, imagePublicId: string | null) {
  await removeStoredMedia(image, imagePublicId, 'image');
}

export async function readStoredImage(filename: string) {
  if (!/^[a-z0-9-]+\.(jpg|png|webp|gif|mp4|webm|mov|ogv)$/i.test(filename)) return null;
  const uploadDirectory = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
  try {
    return await readFile(path.join(/* turbopackIgnore: true */ uploadDirectory, filename));
  } catch {
    return null;
  }
}

export function imageContentType(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return contentTypes[extension] || 'application/octet-stream';
}
