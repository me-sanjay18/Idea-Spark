import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['idea', 'user'],
      required: true,
      index: true,
    },
    targetIdea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Idea',
      default: null,
      index: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    reason: {
      type: String,
      enum: [
        'stolen_or_copied',
        'ip_infringement',
        'suspicious_account',
        'spam',
        'harassment',
        'inappropriate_content',
        'other',
      ],
      required: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide details about the report'],
      trim: true,
      minlength: [15, 'Description must be at least 15 characters'],
      maxlength: 3000,
    },
    evidenceUrl: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    actionTaken: {
      type: String,
      enum: ['none', 'warning', 'idea_removed', 'user_suspended', 'user_banned'],
      default: 'none',
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model('Report', reportSchema);

