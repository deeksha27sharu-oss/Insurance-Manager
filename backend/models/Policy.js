import mongoose from "mongoose";

const policySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, 
  name: { type: String, required: true },
  category: { type: String, required: true },
  premium: { type: String, required: true },
  premiumValue:{type: Number, default: 0, min: 0},
  coverage: { type: String },
  coverageValue: {type: Number, default: 0, min: 0},
  description: { type: String },
  tagline: { type: String },
  tenure: { type: String },
  eligibility: { type: String },
  keyFeatures: [{ type: String }],
  isActive: {type: Boolean, default: true},
  isExternal: {type: Boolean, default: false},
  logo: {
    type: String,
    default: "",
    validate: {
      validator: (v) => !v || (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 400000),
      message: "Logo must be a PNG, JPEG or WEBP image under ~300KB",
    },
  },
}, { timestamps: true });

export const Policy = mongoose.model("Policy", policySchema);