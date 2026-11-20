import crypto from 'node:crypto';
import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    url: { type: String, required: true },
    storageKey: { type: String, default: '' },
    publicId: { type: String, default: '' },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    isProtected: { type: Boolean, default: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const keyFeatureSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 600, default: '' },
  },
  { _id: true }
);

const referenceLinkSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 140, default: '' },
    url: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: true }
);

const editHistorySchema = new mongoose.Schema(
  {
    version: { type: Number, default: 1 },
    editor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    editedAt: { type: Date, default: Date.now },
    summary: { type: String, default: 'Idea updated' },
    changedFields: { type: [String], default: [] },
    snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: true }
);

const ownershipHistorySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    previousValue: { type: String, default: '' },
    newValue: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ideaSchema = new mongoose.Schema(
  {
    ideaCode: {
      type: String,
      unique: true,
      immutable: true,
      default: () => `ISP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },

    // Section 1: Basic Information & Problem
    title: {
      type: String,
      required: [
        function isTitleRequired() {
          return this.status !== 'draft';
        },
        'Idea title is required',
      ],
      trim: true,
      default: 'Untitled Idea Draft',
      maxlength: [140, 'Title cannot exceed 140 characters'],
    },
    shortSummary: {
      type: String,
      required: [
        function isSummaryRequired() {
          return this.status !== 'draft';
        },
        'Short summary is required',
      ],
      trim: true,
      default: '',
      maxlength: [320, 'Short summary cannot exceed 320 characters'],
    },
    problemStatement: {
      type: String,
      required: [
        function isProblemRequired() {
          return this.status !== 'draft';
        },
        'Problem statement is required',
      ],
      trim: true,
      default: '',
      maxlength: [4000, 'Problem statement cannot exceed 4000 characters'],
    },
    targetAudience: {
      type: String,
      trim: true,
      maxlength: [1500, 'Target audience cannot exceed 1500 characters'],
      default: '',
    },
    industryDomain: {
      type: String,
      trim: true,
      maxlength: [120, 'Industry / Domain cannot exceed 120 characters'],
      default: '',
      index: true,
    },
    existingAlternatives: {
      type: String,
      trim: true,
      maxlength: [3000, 'Existing alternatives cannot exceed 3000 characters'],
      default: '',
    },
    marketOpportunity: {
      type: String,
      trim: true,
      maxlength: [3000, 'Market opportunity cannot exceed 3000 characters'],
      default: '',
    },

    // Section 2: Solution & Product Specifications
    proposedSolution: {
      type: String,
      required: [
        function isSolutionRequired() {
          return this.status !== 'draft';
        },
        'Proposed solution is required',
      ],
      trim: true,
      default: '',
      maxlength: [6000, 'Proposed solution cannot exceed 6000 characters'],
    },
    detailedDescription: {
      type: String,
      required: [
        function isDescriptionRequired() {
          return this.status !== 'draft';
        },
        'Detailed description is required',
      ],
      trim: true,
      default: '',
      maxlength: [12000, 'Detailed description cannot exceed 12000 characters'],
    },
    uniqueSellingProposition: {
      type: String,
      trim: true,
      maxlength: [2000, 'Unique selling proposition cannot exceed 2000 characters'],
      default: '',
    },
    keyFeatures: {
      type: [keyFeatureSchema],
      default: [],
    },
    expectedOutcome: {
      type: String,
      trim: true,
      maxlength: [3000, 'Expected outcome cannot exceed 3000 characters'],
      default: '',
    },
    successMetrics: {
      type: String,
      trim: true,
      maxlength: [2000, 'Success metrics cannot exceed 2000 characters'],
      default: '',
    },
    referenceLinks: {
      type: [referenceLinkSchema],
      default: [],
    },

    // Section 3: Team, Skills & Collaboration
    category: {
      type: String,
      required: [
        function isCategoryRequired() {
          return this.status !== 'draft';
        },
        'Category is required',
      ],
      trim: true,
      default: 'AI & Machine Learning',
      index: true,
    },
    requiredSkills: {
      type: [String],
      default: [],
      index: true,
    },
    requiredRoles: {
      type: [String],
      default: [],
      index: true,
    },
    expectedDuration: {
      type: String,
      trim: true,
      default: '1 - 3 months',
    },
    teamSize: {
      type: Number,
      min: 1,
      max: 50,
      default: 4,
    },
    projectStage: {
      type: String,
      enum: ['concept', 'validation', 'prototype', 'mvp', 'launched'],
      default: 'concept',
      index: true,
    },
    collaborationType: {
      type: String,
      enum: ['', 'open_source', 'startup', 'academic', 'research', 'hackathon', 'personal'],
      default: 'startup',
      index: true,
    },
    workArrangement: {
      type: String,
      enum: ['', 'remote', 'onsite', 'hybrid'],
      default: 'remote',
    },
    weeklyCommitment: {
      type: String,
      enum: ['', '2-5', '5-10', '10-20', '20+'],
      default: '5-10',
    },
    compensationModel: {
      type: String,
      enum: ['', 'unpaid', 'paid', 'equity', 'revenue_share', 'open'],
      default: 'open',
    },
    collaborationRequirements: {
      type: String,
      trim: true,
      maxlength: [3000, 'Collaboration requirements cannot exceed 3000 characters'],
      default: '',
    },

    // Section 4: Privacy, NDA & Ownership Protection
    visibility: {
      type: String,
      enum: ['public', 'unlisted', 'private'],
      default: 'public',
      index: true,
    },
    shareToken: {
      type: String,
      default: () => crypto.randomBytes(18).toString('hex'),
      select: false,
    },
    shareLinkExpiresAt: {
      type: Date,
      default: null,
    },
    shareLinkRevoked: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived', 'removed'],
      default: 'active',
      index: true,
    },
    protectDetailsWithNDA: {
      type: Boolean,
      default: false,
    },
    ndaVersion: {
      type: Number,
      default: 1,
    },
    customNdaUrl: {
      type: String,
      default: '',
    },
    customNdaStorageKey: {
      type: String,
      default: '',
    },
    customNdaName: {
      type: String,
      default: '',
    },
    allowCollaborationRequests: {
      type: Boolean,
      default: true,
    },
    requireOwnerApproval: {
      type: Boolean,
      default: true,
    },
    maxCollaborators: {
      type: Number,
      min: 1,
      max: 50,
      default: 5,
    },

    // Section 5: Attachments
    attachments: {
      type: [attachmentSchema],
      default: [],
    },

    authorizedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    upvoteCount: {
      type: Number,
      default: 0,
      index: true,
    },
    bookmarkCount: {
      type: Number,
      default: 0,
    },
    collaboratorCount: {
      type: Number,
      default: 1,
      index: true,
    },
    viewsCount: {
      type: Number,
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    editHistory: {
      type: [editHistorySchema],
      default: [],
    },
    ownershipHistory: {
      type: [ownershipHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Prevent tampering with immutable creator or original creation timestamp
ideaSchema.pre('save', function enforcePublishRules(next) {
  if (!this.isNew && this.isModified('createdAt')) {
    this.unmarkModified('createdAt');
  }
  if (this.status === 'active') {
    if (!this.title || this.title.trim().length < 5) {
      return next(new Error('Title must be at least 5 characters to publish'));
    }
    if (!this.shortSummary || this.shortSummary.trim().length < 20) {
      return next(new Error('Short summary must be at least 20 characters to publish'));
    }
    if (!this.detailedDescription || this.detailedDescription.trim().length < 30) {
      return next(new Error('Detailed description must be at least 30 characters to publish'));
    }
  }
  return next();
});

ideaSchema.index({ creator: 1, status: 1, updatedAt: -1 });
ideaSchema.index({ visibility: 1, status: 1, createdAt: -1 });
ideaSchema.index({ visibility: 1, status: 1, upvoteCount: -1 });
ideaSchema.index({ visibility: 1, status: 1, collaboratorCount: -1 });
ideaSchema.index(
  {
    title: 'text',
    shortSummary: 'text',
    requiredSkills: 'text',
    requiredRoles: 'text',
    category: 'text',
    industryDomain: 'text',
  },
  {
    weights: {
      title: 10,
      requiredSkills: 5,
      requiredRoles: 4,
      shortSummary: 3,
      category: 2,
      industryDomain: 2,
    },
  }
);

export const Idea = mongoose.model('Idea', ideaSchema);
