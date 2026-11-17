import STCWallet from "@/components/lifestyle/STCWallet";
import "@/components/wallet/wallet.css";
export default function Wallet() {
  return <div className="stage-wallet-page"><header className="wallet-page-heading"><p>STAGE / YOUR PERSONAL FINANCES</p><h1>Wallet<span>.</span></h1><div>Your earnings. Your activity. Your next move.</div></header><STCWallet /></div>;
}
