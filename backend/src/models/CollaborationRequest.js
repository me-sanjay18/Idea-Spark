import mongoose from 'mongoose';

const collaborationRequestSchema = new mongoose.Schema(
  {
    idea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Idea',
      required: true,
      index: true,
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    desiredRole: {
      type: String,
      required: [true, 'Desired role is required'],
      trim: true,
      maxlength: 80,
    },
    message: {
      type: String,
      required: [true, 'Personalized message is required'],
      trim: true,
      minlength: [15, 'Please write at least 15 characters introducing yourself'],
      maxlength: 2000,
    },
    skills: {
      type: [String],
      default: [],
    },
    experience: {
      type: String,
      required: [true, 'Relevant experience is required'],
      trim: true,
      maxlength: 2000,
    },
    contributionPlan: {
      type: String,
      required: [true, 'Please explain how you can contribute'],
      trim: true,
      maxlength: 2000,
    },
    ndaAccepted: {
      type: Boolean,
      required: true,
      default: false,
    },
    agreement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agreement',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
      index: true,
    },
    ownerNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

collaborationRequestSchema.index({ idea: 1, applicant: 1, status: 1 });
collaborationRequestSchema.index({ owner: 1, status: 1, createdAt: -1 });
collaborationRequestSchema.index({ applicant: 1, createdAt: -1 });

export const CollaborationRequest = mongoose.model('CollaborationRequest', collaborationRequestSchema);

