import path from 'node:path';
import multer from 'multer';
import { AppError } from '../utils/AppError.js';

const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AVATAR_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);
const ATTACHMENT_EXTS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.txt']);

const memoryStorage = multer.memoryStorage();

export function validateAttachmentBufferSignature(file) {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new AppError('Uploaded file is empty.', 400, 'EMPTY_FILE');
  }

  const buf = file.buffer;
  const mime = file.mimetype;

  if (mime === 'application/pdf') {
    const header = buf.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw new AppError('Invalid PDF file signature.', 400, 'INVALID_FILE_SIGNATURE');
    }
    return true;
  }

  if (mime === 'image/png') {
    const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buf.length < 8 || !buf.subarray(0, 8).equals(pngSig)) {
      throw new AppError('Invalid PNG image file signature.', 400, 'INVALID_FILE_SIGNATURE');
    }
    return true;
  }

  if (mime === 'image/jpeg') {
    if (buf.length < 3 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
      throw new AppError('Invalid JPG image file signature.', 400, 'INVALID_FILE_SIGNATURE');
    }
    return true;
  }

  if (mime === 'image/webp') {
    const riff = buf.length >= 12 ? buf.subarray(0, 4).toString('ascii') : '';
    const webp = buf.length >= 12 ? buf.subarray(8, 12).toString('ascii') : '';
    if (riff !== 'RIFF' || webp !== 'WEBP') {
      throw new AppError('Invalid WEBP image file signature.', 400, 'INVALID_FILE_SIGNATURE');
    }
    return true;
  }

  if (mime === 'text/plain') {
    // Reject binary files disguised as .txt by checking for null bytes in sample
    const sample = buf.subarray(0, Math.min(buf.length, 4096));
    if (sample.includes(0x00)) {
      throw new AppError('Invalid plain text file content.', 400, 'INVALID_FILE_SIGNATURE');
    }
    return true;
  }

  throw new AppError(
    'Permitted file types are PDF, JPG, PNG, WEBP, or TXT (max 8MB).',
    400,
    'INVALID_FILE_TYPE'
  );
}

export const uploadAvatarMiddleware = multer({
  storage: memoryStorage,
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!AVATAR_MIME_TYPES.has(file.mimetype) || !AVATAR_EXTS.has(ext)) {
      return cb(new AppError('Avatar must be a JPG, PNG, or WEBP image under 3MB.', 400, 'INVALID_FILE_TYPE'));
    }
    return cb(null, true);
  },
}).single('avatar');

export const uploadDocumentMiddleware = multer({
  storage: memoryStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ATTACHMENT_MIME_TYPES.has(file.mimetype) || !ATTACHMENT_EXTS.has(ext)) {
      return cb(
        new AppError('Permitted file types are PDF, JPG, PNG, WEBP, or TXT (max 8MB).', 400, 'INVALID_FILE_TYPE')
      );
    }
    return cb(null, true);
  },
}).single('file');
