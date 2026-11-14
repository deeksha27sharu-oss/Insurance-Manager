import mongoose from "mongoose";

const nomineeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  relation: { type: String, required: true },
}, { _id: false });

const userPolicySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  policyId: { type: String, required: true }, 
  policyName: { type: String, required: true },
  category: { type: String, required: true },
  premium: { type: String, required: true },
  startDate: { type: Date, required: true },
  renewalDate: { type: Date, required: true },
  status: { type: String, enum: ["Active", "Expired"], default: "Active" },
  nominees: [nomineeSchema],

  sales_agent_id:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    default: null,
  },
  sale_date: {type: Date, default: Date.now},

  workflowStage:{
    type: String,
    enum:[
      "Pending Technical Review",
      "Relationship Active",
      "Rejected",
      "Expired",
    ],
    default: "Pending Technical Review",
  },

  reviewed_by:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    default: null,
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    default: null,
  },
  reviewed_at: {type: Date, default: null},
  review_notes: { type: String, default: ""},

  renewalReminderSent: { type: Boolean, default: false },

  assigned_relationship_agent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    default: null,
  },
}, { timestamps: true });

export const UserPolicy = mongoose.model("UserPolicy", userPolicySchema);

// claims schema
const claimSchema = new mongoose.Schema({
  userPolicy: { type: mongoose.Schema.Types.ObjectId, ref: "UserPolicy", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  claimAmount: { type: Number, required: true },
  reason: { type: String, required: true },
  status: { 
    type: String, 
    enum: ["Pending", "Approved", "Rejected"], 
    default: "Pending" 
  },
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
  approved_by:{ type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null,},
  reviewed_at: { type: Date, default: null },
  review_notes: { type: String, default: "" },
  filedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const Claim = mongoose.model("Claim", claimSchema);

// payout schema
const commissionPayoutSchema = new mongoose.Schema({
  agent: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  amount: { type: Number, required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" }, 
  paidAt: { type: Date, default: Date.now },
  month: { type: String }, 
}, { timestamps: true });

export const CommissionPayout = mongoose.model("CommissionPayout", commissionPayoutSchema);