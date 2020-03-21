import mongoose from "mongoose"

export async function connectToDB() {
  await mongoose.connect(process.env.MONGODB_URL || "", {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  })
}
