import { NextPage } from "next"
import { AppProps } from "next/app"
import Head from "next/head"
import "../css/tailwind.css"

interface MyAppProps extends AppProps {
  token: string
}

const App: NextPage<MyAppProps> = ({ Component, pageProps }) => {
  return (
    <>
      <Head>
        <title>Mobiles Arztzimmer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}

export default App
