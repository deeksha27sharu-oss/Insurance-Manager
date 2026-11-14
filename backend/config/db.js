import mongoose from "mongoose";

export async function connectDB(){
    if(mongoose.connection.readyState === 1) return mongoose.connection;

    const uri= process.env.MONGO_URI;
    if (!uri) {
        console.error("MONGO_URI is undefined. Check backend/.env");
        process.exit(1);
    }

    try{
        await mongoose.connect(uri);
        console.log(`MongoDB connected: ${mongoose.connection.name}`);
        return mongoose.connection;
    } catch(err){
        console.log("MongoDB connection error:", err);
        process.exit(1);
    }    
}

export function getDB(){
    if(mongoose.connection.readyState !== 1){
        throw new Error("DB not connected. ");
    }
    return mongoose.connection;
}

export async function closeDB() {
    await mongoose.connection.close();
    console.log("Mongoose connection closed");
}


