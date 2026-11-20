import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    idea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Idea',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

voteSchema.index({ user: 1, idea: 1 }, { unique: true });
voteSchema.index({ idea: 1 });

export const Vote = mongoose.model('Vote', voteSchema);

