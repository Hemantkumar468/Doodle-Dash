import mongoose from 'mongoose';

const wordSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, unique: true },
  category: { type: String, required: true, trim: true, index: true }
}, { timestamps: true });

export const Word = mongoose.models.Word || mongoose.model('Word', wordSchema);
