import mongoose from "mongoose";

async function checkUsers() {
    await mongoose.connect("mongodb://127.0.0.1:27017/forgenet");
    const db = mongoose.connection.db;
    const users = await db.collection("users").find({}).toArray();
    console.log(`Total users: ${users.length}`);
    const withoutPassword = users.filter(u => !u.password);
    console.log(`Users without password: ${withoutPassword.length}`);
    for (const u of withoutPassword) {
        console.log(`- User ID: ${u._id}, Email: ${u.email}`);
    }
    process.exit(0);
}

checkUsers().catch(console.error);
