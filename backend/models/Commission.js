import mongoose from "mongoose";

const commissionSchema = new mongoose.Schema({
  agent: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Customer", 
    required: true 
  },
  userPolicy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "UserPolicy", 
    required: true 
  },
  policyName: { type: String, required: true },
  clientName: { type: String, required: true },
  
  premiumAmount: { type: Number, required: true }, 
  rateApplied: { type: Number, required: true },   
  commissionAmount: { type: Number, required: true },
  
  status: { 
    type: String, 
    enum: ["Pending", "Paid"], 
    default: "Pending" 
  },
  
  approvedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Customer" 
  },
  paidAt: { type: Date, default: null },
  paidBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Customer" 
  },
  payoutBatchId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "CommissionPayout" 
  } 
}, { timestamps: true });

export const Commission = mongoose.model("Commission", commissionSchema);