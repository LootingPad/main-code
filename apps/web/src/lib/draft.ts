export const DRAFT_KEY = "looting-draft";

export type CoinDraft = {
  name: string;
  symbol: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  farcaster: string;
  creatorFee: number;
  luckyShare: number;
  initialBuy: string;
  pair: string;
  image: string;
  holderShare: boolean;
  creatorWallet: string;
  exemptions: string[];
};
