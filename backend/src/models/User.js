import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const securityEventSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, trim: true },
    ipHash: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [32, 'Username cannot exceed 32 characters'],
      match: [/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, underscores, and hyphens'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      select: false,
      default: null,
    },
    githubId: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    googleId: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
      default: null,
    },
    resetPasswordTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
      default: null,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    avatarPublicId: {
      type: String,
      default: '',
    },
    headline: {
      type: String,
      trim: true,
      maxlength: [140, 'Headline cannot exceed 140 characters'],
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [1500, 'Bio cannot exceed 1500 characters'],
      default: '',
    },
    skills: {
      type: [String],
      default: [],
      index: true,
    },
    interests: {
      type: [String],
      default: [],
    },
    socialLinks: {
      github: { type: String, trim: true, default: '' },
      linkedin: { type: String, trim: true, default: '' },
      portfolio: { type: String, trim: true, default: '' },
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'banned'],
      default: 'active',
      index: true,
    },
    suspensionReason: {
      type: String,
      default: '',
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    allowDirectMessagesFromPublic: {
      type: Boolean,
      default: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    securityEvents: {
      type: [securityEventSchema],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.statics.hashPassword = async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainPassword, salt);
};

userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.emailVerificationTokenHash;
    delete ret.emailVerificationExpires;
    delete ret.resetPasswordTokenHash;
    delete ret.resetPasswordExpires;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);

