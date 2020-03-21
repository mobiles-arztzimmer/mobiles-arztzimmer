import Telegraf from "telegraf"
import { NowRequest, NowResponse } from "@now/node"

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "")
bot.on("text", ({ reply }) =>
  reply(
    "Hallo, ich bin der freundliche Bot vom Mobilen Arztzimmer. Ich freue mich, wenn ich Dir helfen kann. ❤️",
  ),
)

export default async (req: NowRequest, res: NowResponse) => {
  const {
    query: { token },
  } = req

  // return if secret url does not match
  if (token !== process.env.TELEGRAM_SECRET_URL) {
    res.status(404).send("")
    return
  }

  await bot.handleUpdate(req.body, res)
}
