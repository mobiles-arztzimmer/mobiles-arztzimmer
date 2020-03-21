const Intro = () => {
  return (
    <section className="intro flex flex-col justify-center items-center p-8">
      <h1 className="text-4xl">Mobiles Arztzimmer</h1>
      <span className="text-2xl">👩‍⚕️ + 🚗 = 🤗</span>
      <style jsx>{`
        .intro {
          min-height: 30em;
        }
      `}</style>
    </section>
  )
}

const Footer = () => {
  return (
    <footer className="py-10 px-8 flex justify-center">
      <p>Mit ❤️ gemacht von ...</p>
    </footer>
  )
}

export default () => (
  <div className="min-h-screen flex flex-col max-w-screen-lg mx-auto">
    <header />
    <Intro />
    <main className="flex-grow">
      <div className="grid grid-cols-3 gap-4 p-8">
        <img
          src="/img/undraw_social_distancing_2g0u.svg"
          alt="social distancing"
        />
        <div className="col-span-2 flex flex-col justify-center p-4">
          <p>
            Lorem, ipsum dolor sit amet consectetur adipisicing elit. Voluptate
            nesciunt amet iusto cum. Eaque quis voluptatibus sapiente, repellat
            tenetur eos iure architecto dolor cumque sit tempore accusamus
            reprehenderit ipsum molestias?
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 p-8">
        <div className="col-span-2 flex flex-col justify-center p-4">
          <p>
            Lorem ipsum, dolor sit amet consectetur adipisicing elit. Ipsum
            molestiae, necessitatibus qui porro molestias ea velit officiis
            fugiat, ipsa ipsam, tempore culpa architecto quam perferendis a
            veritatis tenetur. Magnam, quaerat?
          </p>
        </div>
        <img src="/img/undraw_doctor_kw5l.svg" alt="doctor with patient" />
      </div>
    </main>
    <Footer />
  </div>
)
