import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  policyId: { type: String, required: true },
  clientId: { type: String, required: true },
  agentId: { type: String, required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  senderRole: { type: String, enum: ["user", "agent"], required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  readByAdmin: { type: Boolean, default: false },
  readByAgent: { type: Boolean, default: false },
  readByClient: { type: Boolean, default: false },
}, { timestamps: true });

export const Message = mongoose.model("Message", messageSchema);