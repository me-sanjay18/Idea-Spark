import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const PRIVATE_UPLOADS_DIR = path.resolve(__dirname, '../../private_uploads');

export function signPreviewKey(uploaderId, storageKey) {
  return crypto
    .createHmac('sha256', env.jwtSecret)
    .update(`${String(uploaderId)}:${String(storageKey)}`)
    .digest('hex');
}

export function verifyPreviewKey(uploaderId, storageKey, signature) {
  if (!uploaderId || !storageKey || !signature) return false;
  const expected = signPreviewKey(uploaderId, storageKey);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(String(signature), 'hex'));
  } catch {
    return false;
  }
}

export async function storeUploadedFile(
  file,
  { folder = 'ideaspark', resourceType = 'auto', isPrivate = false, uploaderId = '' } = {}
) {
  if (!file || !file.buffer) {
    throw new Error('No file buffer provided');
  }

  if (isCloudinaryConfigured && !isPrivate) {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
        },
        (err, uploaded) => {
          if (err) return reject(err);
          return resolve(uploaded);
        }
      );
      uploadStream.end(file.buffer);
    });

    return {
      url: result.secure_url,
      storageKey: '',
      publicId: result.public_id,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
  const safeFilename = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;

  if (isPrivate) {
    await fs.mkdir(PRIVATE_UPLOADS_DIR, { recursive: true });
    const fullPath = path.join(PRIVATE_UPLOADS_DIR, safeFilename);
    await fs.writeFile(fullPath, file.buffer);

    const sig = uploaderId ? signPreviewKey(uploaderId, safeFilename) : '';
    const previewUrl = `/api/ideas/uploads/preview?key=${encodeURIComponent(safeFilename)}&sig=${sig}`;

    return {
      url: previewUrl,
      storageKey: safeFilename,
      publicId: safeFilename,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  await fs.mkdir(PUBLIC_UPLOADS_DIR, { recursive: true });
  const fullPath = path.join(PUBLIC_UPLOADS_DIR, safeFilename);
  await fs.writeFile(fullPath, file.buffer);

  return {
    url: `/uploads/${safeFilename}`,
    storageKey: '',
    publicId: safeFilename,
    name: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

export async function resolveStoredDocumentPath({ storageKey = '', legacyUrl = '' } = {}) {
  if (storageKey) {
    const safeBase = path.basename(storageKey);
    const candidate = path.join(PRIVATE_UPLOADS_DIR, safeBase);
    if (fsSync.existsSync(candidate)) {
      return { localPath: candidate };
    }
  }

  if (legacyUrl && legacyUrl.startsWith('/uploads/')) {
    const safeBase = path.basename(legacyUrl);
    const legacyPath = path.join(PUBLIC_UPLOADS_DIR, safeBase);
    if (fsSync.existsSync(legacyPath)) {
      return { localPath: legacyPath };
    }
  }

  if (legacyUrl && /^https?:\/\//i.test(legacyUrl)) {
    return { redirectUrl: legacyUrl };
  }

  return null;
}
