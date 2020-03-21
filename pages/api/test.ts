import { User } from "../../lib/models/user"
import { NowRequest, NowResponse } from "@now/node"
import { connectToDB } from "../../lib/db"

export default async (req: NowRequest, res: NowResponse) => {
  await connectToDB()
  const user = new User({ name: "Stefan" })
  user.save()

  let users = await User.find({})
  res.json(users)
}
