import Telegraf, { Telegram, ContextMessageUpdate } from "telegraf"
import { NowRequest, NowResponse } from "@now/node"
import session from "telegraf/session"

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "")

bot.use(session())

bot.use(async (ctx, next: any) => {
  console.log(ctx)
  console.log(ctx.updateType)
  console.log(ctx.callbackQuery?.data)
  await next()
})

bot.on("callback_query", async ctx => {
  const { reply, answerCbQuery, session } = ctx as ContextWithSession
  answerCbQuery()

  if (
    session.state === State.NutzerIstPatient &&
    ctx.callbackQuery?.data === "ja"
  ) {
    session.state = State.NutzerHatAlleVierCoronaSymptome
    await reply(
      "Oh, dann werden wir Dir noch weitere Fragen stellen. Bis bald. 👋🏻",
    )
    return
  }

  if (
    session.state === State.NutzerIstPatient &&
    ctx.callbackQuery?.data === "nein"
  ) {
    session.state = State.NutzerHatNichtAlleVierCoronaSymptome
    await reply(
      "Super, dann kann ich Dir vielleicht ein anderes Mal weiterhelfen.",
    )
    return
  }
})

enum State {
  NutzerUnbekannt,
  NutzerIstPatient,
  NutzerIstArzt,
  NutzerHatAlleVierCoronaSymptome,
  NutzerHatNichtAlleVierCoronaSymptome,
}

interface Session {
  state: State
}

interface ContextWithSession extends ContextMessageUpdate {
  session: Session
}

bot.on("message", async ctx => {
  const { reply, message, session } = ctx as ContextWithSession
  const text = message?.text
  session.state = session.state || State.NutzerUnbekannt

  if (
    // Von einem bestimmten State aus mit einer gewissen Übergangsbedingung
    // (Command, kann aber auch leer sein) geht es mit einer Antwort in den nächsten State
    // session.state === State.NutzerUnbekannt &&
    text?.startsWith("/ichbinpatient")
  ) {
    session.state = State.NutzerIstPatient
    await reply("Hast Du alle vier Corona-Symptome?", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Ja", callback_data: "ja" },
            { text: "Nein", callback_data: "nein" },
          ],
        ],
      },
    })
    return
  }

  if (message?.text?.startsWith("/ichbinarzt")) {
    reply("Schön, dass Du unterstützen möchtest!")
    return
  }

  reply("Ich verstehe dich nicht 🤷")
})

export default async (req: NowRequest, res: NowResponse) => {
  const {
    query: { token },
  } = req

  // return if secret url does not match
  if (token !== process.env.TELEGRAM_SECRET_URL) {
    res.status(404).send("")
    return
  }

  res.statusCode = 200
  await bot.handleUpdate(req.body, res)
}
