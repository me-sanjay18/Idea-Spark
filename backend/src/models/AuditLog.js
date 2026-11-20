import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['idea', 'user', 'collaboration', 'agreement', 'report', 'admin', 'auth'],
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      default: '',
    },
    idea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Idea',
      default: null,
      index: true,
    },
    summary: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipHash: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ idea: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

