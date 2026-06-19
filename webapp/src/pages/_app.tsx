import "@/styles/globals.css";
import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { Michroma } from "next/font/google";

const michroma = Michroma({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const Web3Provider = dynamic(
  () => import("@/components/Web3Provider").then((m) => m.Web3Provider),
  { ssr: false },
);

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={michroma.variable}>
      <Web3Provider>
        <Component {...pageProps} />
      </Web3Provider>
    </div>
  );
}
