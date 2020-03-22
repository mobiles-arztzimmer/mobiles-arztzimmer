import Telegraf, { Telegram, ContextMessageUpdate } from "telegraf"
import { NowRequest, NowResponse } from "@now/node"
import session from "telegraf/session"

interface Session {
  state: State
}

interface ContextWithSession extends ContextMessageUpdate {
  session: Session
}

enum State {
  NutzerUnbekannt,
  HatNutzerAlleVierCoronaSymptome,
  NutzerIstArzt,
  NutzerHatAlleVierCoronaSymptome,
  NutzerHatNichtAlleVierCoronaSymptome,
  HilftErholungUndTrinken,
  NutzerWurdeGeholfen,
  KontaktAufnehmen,
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "")
bot.use(session())

bot.use(async (ctx, next: any) => {
  console.log(ctx.updateType)
  console.log(ctx.callbackQuery?.data)
  await next()
})

// Prüfungen des Zustandes & Übergang
const hatNutzerAlleVierCoronaSymptome = (ctx: ContextWithSession) =>
  ctx.session.state === State.HatNutzerAlleVierCoronaSymptome &&
  ctx.callbackQuery?.data === "ja"

// Aktionen
const frageNutzerNachWeiterenRisikoMerkmalen = async (
  ctx: ContextWithSession,
) => {
  await ctx.reply("Was trifft auf Dich zu?", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Ich habe Atemnot/Lungenprobleme.",
            callback_data: "atemnot",
          },
        ],
        [
          {
            text: "Ich war in einem Risikogebiet.",
            callback_data: "risikogebiet",
          },
        ],
        [
          {
            text: "Ich hatte Kontakt mit Erkrankten.",
            callback_data: "kontakt",
          },
        ],
        [{ text: "Nichts von alledem.", callback_data: "nichts" }],
      ],
    },
  })
}

const stelleJaNeinFrage = async (ctx: ContextWithSession, frage: string) =>
  await ctx.reply(frage, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Ja", callback_data: "ja" },
          { text: "Nein", callback_data: "nein" },
        ],
      ],
    },
  })

const entsprichtAntwort = (
  ctx: ContextWithSession,
  state: State,
  data: string,
) => ctx.session.state === state && ctx.callbackQuery?.data === data

const entsprichtAntwortNicht = (
  ctx: ContextWithSession,
  state: State,
  data: string,
) => ctx.session.state === state && ctx.callbackQuery?.data !== data

bot.on("callback_query", async ctxWithoutSession => {
  const ctx = ctxWithoutSession as ContextWithSession
  const { reply, answerCbQuery, session } = ctx
  answerCbQuery()

  if (hatNutzerAlleVierCoronaSymptome(ctx)) {
    session.state = State.NutzerHatAlleVierCoronaSymptome
    frageNutzerNachWeiterenRisikoMerkmalen(ctx)
    return
  }

  if (entsprichtAntwort(ctx, State.NutzerHatAlleVierCoronaSymptome, "nichts")) {
    session.state = State.HilftErholungUndTrinken
    await stelleJaNeinFrage(ctx, "Hilft viel Trinken und Erholung?")
    return
  }

  if (entsprichtAntwort(ctx, State.HilftErholungUndTrinken, "ja")) {
    session.state = State.NutzerWurdeGeholfen
    await reply("Kein Grund zur Sorge. 🎉")
  }

  if (
    entsprichtAntwort(ctx, State.HilftErholungUndTrinken, "nein") ||
    entsprichtAntwortNicht(ctx, State.NutzerHatAlleVierCoronaSymptome, "nichts")
  ) {
    session.state = State.KontaktAufnehmen
    await reply("Bitte nehmen Sie Kontakt auf. 🆘")
  }

  if (entsprichtAntwort(ctx, State.HatNutzerAlleVierCoronaSymptome, "nein")) {
    session.state = State.NutzerHatNichtAlleVierCoronaSymptome
    await reply(
      "Super, dann kann ich Dir vielleicht ein anderes Mal weiterhelfen.",
    )
    return
  }
})

bot.on("message", async ctxWithoutSession => {
  const ctx = ctxWithoutSession as ContextWithSession
  const { reply, message, session } = ctx
  const text = message?.text
  session.state = session.state || State.NutzerUnbekannt

  if (text?.startsWith("/ichbinpatient")) {
    session.state = State.HatNutzerAlleVierCoronaSymptome
    await stelleJaNeinFrage(ctx, "Hast Du alle vier Corona-Symptome?")
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
