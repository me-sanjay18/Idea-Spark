import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { hashIp } from '../utils/tokens.js';

export async function recordAudit({
  actor = null,
  action,
  entityType,
  entityId = '',
  idea = null,
  summary = '',
  metadata = {},
  ip = '',
}) {
  try {
    await AuditLog.create({
      actor: actor?._id || actor || null,
      action,
      entityType,
      entityId: entityId ? String(entityId) : '',
      idea: idea?._id || idea || null,
      summary,
      metadata,
      ipHash: ip ? hashIp(ip) : '',
    });
  } catch (error) {
    console.error('[AuditLog] Failed to persist audit record:', error.message);
  }
}

export async function recordSecurityEvent(userId, event, req = null) {
  try {
    const ipHash = req?.ip ? hashIp(req.ip) : '';
    const userAgent = String(req?.headers?.['user-agent'] || '').slice(0, 180);
    await User.findByIdAndUpdate(userId, {
      $push: {
        securityEvents: {
          $each: [{ event, ipHash, userAgent, createdAt: new Date() }],
          $slice: -30,
        },
      },
    });
  } catch (error) {
    console.error('[SecurityEvent] Failed to persist security event:', error.message);
  }
}

