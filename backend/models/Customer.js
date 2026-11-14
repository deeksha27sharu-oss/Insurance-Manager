
import mongoose from "mongoose";

const nomineeSchema = new mongoose.Schema(
    {
        name: {type: String,trim: true,},
        relation: {type: String,trim: true,},
    },
    { _id: false }
);

const customerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Full name is required"],
            trim: true,
            minlength: [5, "Name must be at least 5 characters"],
            match: [
                /^[a-zA-Z\s.]+$/,
                "Name can only contain letters, spaces and dots",
            ],
        },

        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\S+@\S+\.\S+$/,
                "Enter a valid email address",
            ],
        },

        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [
                8,
                "Password must be at least 8 characters",
            ],
            validate: {
                validator(v) {
                    return (
                        /[A-Z]/.test(v) &&
                        /[a-z]/.test(v) &&
                        /\d/.test(v) &&
                        /[@.#$!%*?&]/.test(v)
                    );
                },
                message:
                    "Password must contain uppercase, lowercase, number and special character",
            },
            select: false,
        },
        phone: {
            type: String,
            required: [true, "Phone number is required"],
            trim: true,
            match: [
                /^[6-9]\d{9}$/,
                "Enter a valid 10-digits Indian mobile number.",
            ],
        },
        city: {type: String,trim: true,default: "",},
        age: {type: Number,default: null,min: 0,max: 120,},
        nominees: {type: [nomineeSchema],default: [],},
        role:{
            type: String,
            enum:[
                "admin",
                "super_agent",
                "captive_agent",
                "independent_agent",
                "technical_agent",
                "relationship_agent",
                "user",
            ],
            default: "user",
        },

        commissionRate: {type: Number, default: 0, min: 0, max: 100},

        assigned_agent_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            default: null,
        },
        team_id:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

customerSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const bcrypt = (await import("bcryptjs")).default;
    this.password = await bcrypt.hash(this.password, 10);
});

// Compare password
customerSchema.methods.comparePassword = async function (candidate) {
    const bcrypt = (await import("bcryptjs")).default;
    return bcrypt.compare(candidate, this.password);
};

// Remove password 
customerSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};
const Customer = mongoose.model("Customer", customerSchema);
export default Customer;
