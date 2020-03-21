import mongoose, { Schema, Model } from "mongoose"

interface User extends mongoose.Document {
  name: string
}

const UserSchema = new Schema({
  name: { type: String },
})

export const User: Model<User> =
  mongoose.models.users || mongoose.model<User>("users", UserSchema)
