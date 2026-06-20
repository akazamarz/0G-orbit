import "@/styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import "@/styles/rainbowkit-overrides.css";
import type { AppProps } from "next/app";
import { Michroma } from "next/font/google";
import { Web3Provider } from "@/components/Web3Provider";

const michroma = Michroma({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={michroma.variable}>
      <Web3Provider>
        <Component {...pageProps} />
      </Web3Provider>
    </div>
  );
}
