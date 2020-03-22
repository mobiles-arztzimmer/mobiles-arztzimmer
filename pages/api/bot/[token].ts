import Telegraf, { ContextMessageUpdate, Context } from "telegraf"
import { TelegrafMongoSession } from "telegraf-session-mongodb"
import { NowRequest, NowResponse } from "@now/node"
import { Message } from "telegraf/typings/telegram-types"

interface Session {
  state: State
  username: string
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
  FachkraftHatKontaktAufgenommen,
  FachkraftHatPatientGeantwortet,
  PatientStelltFrage,
  PatientBedanktSich,
  DemoAbgeschlossen,
  FachkraftNenntHintergrund,
  HatFachkraftKlinischeErfahrung,
  FachkraftNenntMonateAnErfahrung,
  FachkraftNenntArtDerErfahrungen,
  KannFachkraftAbstricheDurchfuehren,
  FachkraftNenntWeitereQualifikationen,
  FachkraftNenntVorname,
  FachkraftNenntNachname,
  FachkraftNenntAlter,
  FachkraftSendetStandort,
  FachkraftNenntUmkreis,
  HatFachkraftEigenesFahrzeug,
}

let telegraf: Telegraf<ContextMessageUpdate>

const loadBot = async () => {
  if (telegraf) {
    return telegraf
  }

  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "")
  await TelegrafMongoSession.setup(
    bot,
    process.env.MONGODB_URL,
  ).catch((err: any) => console.log(err))

  bot.use(async (ctx, next: any) => {
    console.log(ctx.updateType)
    console.log(ctx.callbackQuery?.data)
    await next()
  })

  bot.on("callback_query", queryCallback)
  bot.on("message", messageCallback)

  return bot
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

const queryCallback = async (ctxWithoutSession: Context): Promise<Message> => {
  const ctx = ctxWithoutSession as ContextWithSession
  const { reply, answerCbQuery, session } = ctx
  answerCbQuery()

  if (entsprichtAntwort(ctx, State.HatPatientSymptome, "ja")) {
    session.state = State.KenntPatientCovid19Erkrankte
    return await stelleJaNeinFrage(
      ctx,
      "Kennst du jemanden, die oder der nachweislich Covid-19 🦠hat oder hatte?",
    )
  }

  if (entsprichtAntwort(ctx, State.KenntPatientCovid19Erkrankte, "ja")) {
    session.state = State.WarPatientNahBeiCovid19Erkranktem
    return await stelleJaNeinFrage(
      ctx,
      "Hast du dich in der Zeit, in der die Person krank war oder maximal zwei Tage vor Beginn der ersten Symptome (insbesondere Fieber und Husten) in deiner Nähe befunden?",
    )
  }

  if (entsprichtAntwort(ctx, State.WarPatientNahBeiCovid19Erkranktem, "ja")) {
    session.state = State.HattePatientDirektenKontakt
    return await stelleJaNeinFrage(
      ctx,
      "Hattest du mindestens 15 Minuten direkten Kontakt zu der Person, etwa in einem persönlichen Gespräch?",
    )
  }

  if (entsprichtAntwort(ctx, State.HattePatientDirektenKontakt, "nein")) {
    session.state = State.HattePatientKontaktMitKoerperFluessigkeit
    return await stelleJaNeinFrage(
      ctx,
      "Hast du eine Körperflüssigkeit der Person berührt, etwa durch Küssen, Anniesen oder Husten?",
    )
  }

  if (
    entsprichtAntwort(
      ctx,
      State.HattePatientKontaktMitKoerperFluessigkeit,
      "nein",
    )
  ) {
    session.state = State.HattePatientSitzplatzInNaehe
    return await stelleJaNeinFrage(
      ctx,
      "Hattest du einen Sitzplatz in einem Zug oder Flugzeug zwei Reihen vor, hinter oder in derselben Reihe wie die Person?",
    )
  }

  if (entsprichtAntwort(ctx, State.HattePatientSitzplatzInNaehe, "ja")) {
    session.state = State.HattePatientKontaktMitGesundheitsamt
    ;(ctx as any).webhookReply = false
    await reply(
      "⚠️ Du wirst als Kontaktperson Kategorie I höheres Infektionsrisiko eingestuft.",
    )
    ;(ctx as any).webhookReply = true
    await sleep(1500)
    return await stelleJaNeinFrage(
      ctx,
      "Hast du bereits mit dem Gesundheitsamt Kontakt aufgenommen, oder hat dich das Gesundheitsamt kontaktiert? ",
    )
  }

  if (
    entsprichtAntwort(ctx, State.HattePatientKontaktMitGesundheitsamt, "nein")
  ) {
    session.state = State.NutzerSendetKontakt
    ;(ctx as any).webhookReply = false
    await reply(
      "Ok, kein Problem! Wir übernehmen das für dich und veranlassen, dass ein mobiles Testteam 👩‍⚕️ zu dir kommt, um einen Covid-19 Test duchzuführen.",
    )
    ;(ctx as any).webhookReply = true
    return await reply(
      "Sag uns doch bitte, wie du mit Vor- und Nachname heißt.",
    )
  }

  if (
    entsprichtAntwort(ctx, State.WarPatientNahBeiCovid19Erkranktem, "nein") ||
    entsprichtAntwortNicht(ctx, State.KenntPatientCovid19Erkrankte, "nichts")
  ) {
    session.state = State.KontaktAufnehmen
    return await reply("Bitte nehmen Sie Kontakt auf. 🆘")
  }

  if (entsprichtAntwort(ctx, State.HatPatientSymptome, "nein")) {
    session.state = State.NutzerHatNichtAlleVierCoronaSymptome
    return await reply(
      "Super, dann kann ich Dir vielleicht ein anderes Mal weiterhelfen.",
    )
  }

  // Fachkraft

  if (entsprichtAntwort(ctx, State.HatFachkraftKlinischeErfahrung, "ja")) {
    session.state = State.FachkraftNenntMonateAnErfahrung
    return await reply("Wie viele Monate?")
  }

  if (entsprichtAntwort(ctx, State.KannFachkraftAbstricheDurchfuehren, "ja")) {
    session.state = State.FachkraftNenntVorname
    ;(ctx as any).webhookReply = false
    await reply("Super, das klingt gut. Kommen wir zu den allgemeinen Daten.")
    ;(ctx as any).webhookReply = true
    return await reply("Bitte gib uns deinen Vornamen?")
  }

  if (entsprichtAntwort(ctx, State.HatFachkraftEigenesFahrzeug, "nein")) {
    session.state = State.DemoAbgeschlossen
    ;(ctx as any).webhookReply = false
    await reply(
      "Kein Problem, wir arbeiten mit vielen Partnern zusammen und können dir ein Fahrzeug zur Verfügung stellen.",
    )
    ;(ctx as any).webhookReply = true
    return await reply(
      "Vielen Dank für deine Angaben ❤️. Wir melden uns zeitnah bei dir telefonisch und besprechen alle weiteren Fragen (wie Einsatzzeiten, Einweisung, etc.)  und wie es los geht! Bei allen weiteren Fragen, schau gern in unser FAQ, oder frage uns hier im Chat.",
    )
  }

  throw new Error("bitte in jedem if-Statement ein Promis zurückgeben")
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const messageCallback = async (
  ctxWithoutSession: Context,
): Promise<Message> => {
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
    return await stelleJaNeinFrage(
      ctx,
      "Hast du Symptome wie Fieber 🌡 oder Husten 😷?",
    )
  }

  if (session.state === State.NutzerSendetKontakt) {
    session.username = (message?.text || "").split(" ")[0]
    session.state = State.NutzerSendetStandort
    return await reply(
      "Vielen Dank! Als nächstes benötigen wir deine Adresse 🏠, bitte übermittle uns deinen Standort (Tippe auf 📎 und wähle Standort aus. Oder teile uns deine vollständige Adresse als Text mit).",
    )
  }

  if (session.state === State.NutzerSendetStandort) {
    session.state = State.FachkraftHatKontaktAufgenommen
    ;(ctx as any).webhookReply = false
    await reply(
      "Vielen Dank! Wir haben deine Daten erfasst und ermitteln jetzt für dich eine medizinische Fachkraft 👨‍⚕️, um dich für den Test zu besuchen.",
    )
    await sleep(800)
    await reply(
      "⚠️ Dein persönlicher Testtermin 🗓 ist noch heute! Unsere Fahrerin Marion kommt heute gegen 16:30h zu dir. Marion wird sich vorher nochmal hier im Chat bei dir melden. Bitte halte dein Smartphone bereit 📲.",
    )
    await reply("⚠️ Bitte bleib zu Hause!")
    ;(ctx as any).webhookReply = true
    return await reply(
      `Hallo ${session.username}, hier ist Marion, ich bin auf dem Weg zu dir und voraussichtlich 5 Minuten eher da. Wie kann ich dich am besten finden?`,
    )
  }

  if (session.state === State.FachkraftHatKontaktAufgenommen) {
    session.state = State.FachkraftHatPatientGeantwortet
    return await reply("Perfekt, vielen Dank. Dann bis gleich!")
  }

  if (session.state === State.FachkraftHatPatientGeantwortet) {
    session.state = State.PatientStelltFrage
    await sleep(1500)
    ;(ctx as any).webhookReply = false
    await reply(
      "⚠️ Dein Test wurde ins Labor 🔬geschickt. Sobald wir das Ergebnis vorliegen haben, werden wir dich informieren!",
    )
    await reply(
      "⚠️ Beschränke den Kontakt zu anderen Personen auf das Nötige. Versuche Abstand zu deinen Mitbewohnern zu halten, beispielsweise indem du dich in einem separaten Raum aufhältst und zu unterschiedlichen Zeiten isst.",
    )
    await reply(
      "⚠️ Beobachte außerdem zwei Wochen lang deinen Gesundheitszustand: Messe zweimal täglich Fieber, führe ein Tagebuch, in dem du deine Temperaur, auftretende Symptome, deine Aktivitätund Kontakt zu anderen Personen notierst.",
    )
    await sleep(1000)
    await reply(
      `⚠️ Hallo ${session.username}, deine Ergebnisse sind da. Du wurdest positiv auf Covid-19 🦠getestet.`,
    )
    await reply(
      "⚠️ Bitte bleibe in häuslicher Quarantäne und beachte die nachfolgende Hinweise und wende weiterhin alle Maßnahmen, wie beschrieben, an.",
    )
    await reply(
      "http://multimedia.gsb.bund.de/RKI/Flowcharts/covid19-quarantaene/",
    )
    await reply("Wir wünschen dir eine gute Besserung. ❤️")
    await sleep(700)
    ;(ctx as any).webhookReply = true
    return await reply("Hast du noch Fragen?")
  }

  if (session.state === State.PatientStelltFrage) {
    session.state = State.PatientBedanktSich
    return await reply(
      "Bitte wende dich in solchen Fällen direkt an einen Notarzt (112) 🆘",
    )
  }

  if (session.state === State.PatientBedanktSich) {
    session.state = State.DemoAbgeschlossen
    return await reply(
      "Wir danken dir, dass du dich hier gemeldet hast und wünschen dir baldige Genesung ❤️",
    )
  }

  if (message?.text?.startsWith("/ichbinarzt")) {
    return await reply("Schön, dass Du unterstützen möchtest!")
  }

  if (message?.text?.startsWith("/ichbinfachkraft")) {
    session.state = State.FachkraftNenntHintergrund
    ;(ctx as any).webhookReply = false
    await reply(
      "Guten Tag! Du bist eine medizinische Fachkraft und möchtest im Kampf gegen Sars-CoV-2 🦠 helfen?",
    )
    ;(ctx as any).webhookReply = true
    return await reply(
      "Bitte nenne uns zuerst deinen Hintergrund (Medizinstudent / Ausbildung als Rettungssanitäter oder Krankenschwester / Arzt / ...). Auch Ausbildungen, in denen Du aktuell nicht mehr tätig bist, sind wertvoll! Die Erfahrung zählt!",
    )
  }

  if (session.state === State.FachkraftNenntHintergrund) {
    session.state = State.HatFachkraftKlinischeErfahrung
    return await stelleJaNeinFrage(ctx, "Hast du klinische Erfahrung?")
  }

  if (session.state === State.FachkraftNenntMonateAnErfahrung) {
    session.state = State.FachkraftNenntArtDerErfahrungen
    return await reply("Bitte beschreibe uns kurz etwas zu deinen Erfahrungen.")
  }

  if (session.state === State.FachkraftNenntArtDerErfahrungen) {
    session.state = State.FachkraftNenntWeitereQualifikationen
    return await reply("Weitere Qualifikationen?")
  }

  if (session.state === State.FachkraftNenntWeitereQualifikationen) {
    session.state = State.KannFachkraftAbstricheDurchfuehren
    return await stelleJaNeinFrage(
      ctx,
      "Traust du dir es zu, Abstriche auf Sars-CoV-2 Virus durchzuführen? (Eine Einweisung durch uns wird selbstverständlich erfolgen).",
    )
  }

  if (session.state === State.FachkraftNenntVorname) {
    session.state = State.FachkraftNenntNachname
    return await reply("Dein Nachname?")
  }

  if (session.state === State.FachkraftNenntNachname) {
    session.state = State.FachkraftNenntAlter
    return await reply("Dein Alter?")
  }

  if (session.state === State.FachkraftNenntAlter) {
    session.state = State.FachkraftSendetStandort
    return await reply(
      "Vielen Dank! Als nächstes benötigen wir deine Adresse 🏠, bitte übermittle uns deinen Standort (Tippe auf 📎 und wähle den Standort, von dem du deinen Einsatz beginnen möchtest).",
    )
  }

  if (session.state === State.FachkraftSendetStandort) {
    session.state = State.FachkraftNenntUmkreis
    return await reply(
      "In welchem Umkreis km möchtest du eingesetzt werden? 🎯",
    )
  }

  if (session.state === State.FachkraftNenntUmkreis) {
    session.state = State.HatFachkraftEigenesFahrzeug
    return await stelleJaNeinFrage(ctx, "Hast du ein eigenes Fahrzeug? 🚗")
  }

  return await reply("Ich verstehe dich nicht 🤷")
}

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
  const bot = await loadBot()
  await bot.handleUpdate(req.body, res)
}
