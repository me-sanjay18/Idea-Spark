import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'team'],
      required: true,
      default: 'direct',
    },
    title: {
      type: String,
      trim: true,
      maxlength: 140,
      default: '',
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    collaboration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Collaboration',
      default: null,
      index: true,
    },
    idea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Idea',
      default: null,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);

