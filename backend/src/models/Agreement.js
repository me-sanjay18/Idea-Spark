import mongoose from 'mongoose';

const agreementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    idea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Idea',
      required: true,
      index: true,
    },
    ideaOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    agreementVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    agreementType: {
      type: String,
      enum: ['standard_confidentiality', 'custom_nda'],
      default: 'standard_confidentiality',
    },
    ndaDocumentUrl: {
      type: String,
      default: '',
    },
    signerFullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    statementText: {
      type: String,
      required: true,
    },
    ipHash: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    acceptedAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    lastAcceptedAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    revokeReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

agreementSchema.index({ user: 1, idea: 1, agreementVersion: 1 }, { unique: true });

export const Agreement = mongoose.model('Agreement', agreementSchema);

