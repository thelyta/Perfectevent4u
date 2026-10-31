import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';

const extensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

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

function uploadToCloudinary(buffer: Buffer) {
  configureCloudinary();
  const folder = process.env.CLOUDINARY_FOLDER || 'PerfectEvent4U';
  return new Promise<{ public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { asset_folder: folder, public_id_prefix: folder, resource_type: 'image', unique_filename: true },
      (error, result) => {
        if (error || !result) reject(error || new Error('Image upload failed.'));
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

export async function storeImage(file: File) {
  const extension = extensions[file.type];
  if (!extension) throw new Error('Only JPG, PNG, WebP or GIF images are allowed.');
  if (file.size > 12 * 1024 * 1024) throw new Error('That photo is too large (12 MB max).');

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buffer)) throw new Error('One of the files is not a valid image.');

  if (cloudinaryEnabled()) {
    const result = await uploadToCloudinary(buffer);
    const image = cloudinary.url(result.public_id, {
      secure: true,
      fetch_format: 'auto',
      quality: 'auto'
    });
    return { image, imagePublicId: result.public_id };
  }

  const uploadDirectory = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDirectory, { recursive: true });
  const filename = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}${extension}`;
  await writeFile(path.join(uploadDirectory, filename), buffer, { flag: 'wx', mode: 0o644 });
  return { image: `/uploads/${filename}`, imagePublicId: null };
}

export async function removeStoredImage(image: string | null, imagePublicId: string | null) {
  if (imagePublicId && cloudinaryEnabled()) {
    configureCloudinary();
    await cloudinary.uploader.destroy(imagePublicId).catch(() => undefined);
    return;
  }
  if (!image?.startsWith('/uploads/')) return;

  const filename = path.basename(image);
  const uploadDirectory = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
  await unlink(path.join(/* turbopackIgnore: true */ uploadDirectory, filename)).catch(() => undefined);
}

export async function readStoredImage(filename: string) {
  if (!/^[a-z0-9-]+\.(jpg|png|webp|gif)$/i.test(filename)) return null;
  const uploadDirectory = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
  try {
    return await readFile(path.join(/* turbopackIgnore: true */ uploadDirectory, filename));
  } catch {
    return null;
  }
}

export function imageContentType(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return Object.entries(extensions).find(([, value]) => value === extension)?.[0] || 'application/octet-stream';
}