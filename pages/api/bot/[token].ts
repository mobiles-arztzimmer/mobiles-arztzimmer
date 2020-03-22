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
  HatPatientSymptome,
  NutzerIstArzt,
  KenntPatientCovid19Erkrankte,
  NutzerHatNichtAlleVierCoronaSymptome,
  WarPatientNahBeiCovid19Erkranktem,
  HattePatientDirektenKontakt,
  KontaktAufnehmen,
  HattePatientKontaktMitKoerperFluessigkeit,
  HattePatientSitzplatzInNaehe,
  HattePatientKontaktMitGesundheitsamt,
  NutzerSendetKontakt,
  NutzerSendetStandort,
  NutzerWartetAufTerminbestätigung,
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "")
bot.use(session())

bot.use(async (ctx, next: any) => {
  console.log(ctx.updateType)
  console.log(ctx.callbackQuery?.data)
  await next()
})

// Prüfungen des Zustandes & Übergang
const hatNutzerSymptome = (ctx: ContextWithSession) =>
  ctx.session.state === State.HatPatientSymptome &&
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

  if (entsprichtAntwort(ctx, State.HatPatientSymptome, "ja")) {
    session.state = State.KenntPatientCovid19Erkrankte
    await stelleJaNeinFrage(
      ctx,
      "Kennst du jemanden, die oder der nachweislich Covid-19 🦠hat oder hatte?",
    )
    return
  }

  if (entsprichtAntwort(ctx, State.KenntPatientCovid19Erkrankte, "ja")) {
    session.state = State.WarPatientNahBeiCovid19Erkranktem
    await stelleJaNeinFrage(
      ctx,
      "Hast du dich in der Zeit, in der die Person krank war oder maximal zwei Tage vor Beginn der ersten Symptome (insbesondere Fieber und Husten) in deiner Nähe befunden?",
    )
    return
  }

  if (entsprichtAntwort(ctx, State.WarPatientNahBeiCovid19Erkranktem, "ja")) {
    session.state = State.HattePatientDirektenKontakt
    await stelleJaNeinFrage(
      ctx,
      "Hattest du mindestens 15 Minuten direkten Kontakt zu der Person, etwa in einem persönlichen Gespräch?",
    )
    return
  }

  if (entsprichtAntwort(ctx, State.HattePatientDirektenKontakt, "nein")) {
    session.state = State.HattePatientKontaktMitKoerperFluessigkeit
    await stelleJaNeinFrage(
      ctx,
      "Hast du eine Körperflüssigkeit der Person berührt, etwa durch Küssen, Anniesen oder Husten?",
    )
    return
  }

  if (
    entsprichtAntwort(
      ctx,
      State.HattePatientKontaktMitKoerperFluessigkeit,
      "nein",
    )
  ) {
    session.state = State.HattePatientSitzplatzInNaehe
    await stelleJaNeinFrage(
      ctx,
      "Hattest du einen Sitzplatz in einem Zug oder Flugzeug zwei Reihen vor, hinter oder in derselben Reihe wie die Person?",
    )
    return
  }

  if (entsprichtAntwort(ctx, State.HattePatientSitzplatzInNaehe, "ja")) {
    session.state = State.HattePatientKontaktMitGesundheitsamt
    ;(ctx as any).webhookReply = false
    await reply(
      "⚠️ Du wirst als Kontaktperson Kategorie I höheres Infektionsrisiko eingestuft.",
    )
    ;(ctx as any).webhookReply = true
    await sleep(1500)
    await stelleJaNeinFrage(
      ctx,
      "Hast du bereits mit dem Gesundheitsamt Kontakt aufgenommen, oder hat dich das Gesundheitsamt kontaktiert? ",
    )
    return
  }

  if (
    entsprichtAntwort(ctx, State.HattePatientKontaktMitGesundheitsamt, "nein")
  ) {
    session.state = State.NutzerSendetKontakt
    ;(ctx as any).webhookReply = false
    await reply(
      "Ok, kein Problem! Wir übernehmen das für dich und veranlassen, dass ein mobiles Testteam(Doctor Icon/ oder ähnlich) zu dir kommt, um einen Covid-19 Test duchzuführen.",
    )
    ;(ctx as any).webhookReply = true
    await reply("Sag uns doch bitte, wie du mit Vor- und Nachname heißt.")
    return
  }

  if (
    entsprichtAntwort(ctx, State.WarPatientNahBeiCovid19Erkranktem, "nein") ||
    entsprichtAntwortNicht(ctx, State.KenntPatientCovid19Erkrankte, "nichts")
  ) {
    session.state = State.KontaktAufnehmen
    await reply("Bitte nehmen Sie Kontakt auf. 🆘")
    return
  }

  if (entsprichtAntwort(ctx, State.HatPatientSymptome, "nein")) {
    session.state = State.NutzerHatNichtAlleVierCoronaSymptome
    await reply(
      "Super, dann kann ich Dir vielleicht ein anderes Mal weiterhelfen.",
    )
    return
  }
})

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

bot.on("message", async ctxWithoutSession => {
  const ctx = ctxWithoutSession as ContextWithSession
  const { reply, message, session } = ctx
  const text = message?.text
  session.state = session.state || State.NutzerUnbekannt

  if (text?.startsWith("/ichbinpatient")) {
    // TODO in Methode auslagern
    ;(ctx as any).webhookReply = false
    await reply(
      "Guten Tag! Du möchtest wissen ob du dich mit dem Sars-CoV-2 Virus infiziert hast? Dann beantworte bitte folgende Fragen. Sollte sich ein Verdacht ergeben, können wir dir medizinische Hilfe anbieten",
    )
    await sleep(1000)
    ;(ctx as any).webhookReply = true
    session.state = State.HatPatientSymptome
    await stelleJaNeinFrage(
      ctx,
      "Hast du Symptome wie Fieber 🌡 oder Husten 😷?",
    )
    return
  }

  if (session.state === State.NutzerSendetKontakt) {
    session.state = State.NutzerSendetStandort
    await reply(
      "Vielen Dank! Als nächstes benötigen wir deine Adresse 🏠, bitte übermittle uns deinen Standort (Tippe auf 📎 und wähle Standort aus. Oder teile uns deinen vollständigen Adresse im Text mit).",
    )
    return
  }

  if (session.state === State.NutzerSendetStandort) {
    session.state = State.NutzerWartetAufTerminbestätigung
    await reply(
      "Vielen Dank! Wir haben deine Daten erfasst und ermitteln jetzt für dich eine medizinische Fachkraft 👨‍⚕️, um dich für den Test zu besuchen.",
    )
    return
  }

  if (message?.text?.startsWith("/ichbinarzt")) {
    await reply("Schön, dass Du unterstützen möchtest!")
    return
  }

  await reply("Ich verstehe dich nicht 🤷")
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
