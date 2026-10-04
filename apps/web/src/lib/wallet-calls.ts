import { createPublicClient, formatUnits, http, parseUnits, type Address, type EIP1193Provider, type Hash, type Hex } from "viem";
import { robinhoodChain } from "@/lib/chains";

export type WalletCall = {
  to: Address;
  data: Hex;
  value: string;
};

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

function reader() {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(robinhoodChain.rpcUrls.default.http[0]),
  });
}

export async function readTokenHolding(token: Address, wallet: Address) {
  const client = reader();
  const [raw, decimals] = await Promise.all([
    client.readContract({
      address: token,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [wallet],
    }),
    client.readContract({
      address: token,
      abi: erc20BalanceAbi,
      functionName: "decimals",
    }),
  ]);
  const ui = Number(formatUnits(raw, decimals));
  return { raw, decimals, ui: Number.isFinite(ui) ? ui : 0 };
}

export function toRawAmount(amount: string, decimals: number) {
  const cleaned = amount.replace(/,/g, "").trim();
  if (!cleaned || Number(cleaned) <= 0) throw new Error("Enter an amount above 0.");
  return parseUnits(cleaned, decimals).toString();
}

function hexValue(value: string) {
  return `0x${BigInt(value).toString(16)}`;
}

function txValue(value: string): Hex | undefined {
  if (!value || value === "0" || value === "0x0" || value === "0x") return undefined;
  return hexValue(value) as Hex;
}

export function isUserRejection(err: unknown) {
  const text = providerErrorText(err);
  if (/reject|denied|cancel|user.?refus/i.test(text)) return true;
  if (err && typeof err === "object" && "code" in err) {
    const code = Number((err as { code: unknown }).code);
    if (code === 4001 || code === 5000) return true;
  }
  return false;
}

export function providerErrorText(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const extra = err as Error & { cause?: unknown; details?: unknown; shortMessage?: string };
    return extra.shortMessage || err.message || providerErrorText(extra.cause) || providerErrorText(extra.details);
  }
  if (typeof err === "object") {
    const record = err as { message?: unknown; shortMessage?: unknown };
    if (typeof record.shortMessage === "string") return record.shortMessage;
    if (typeof record.message === "string") return record.message;
  }
  return "";
}

export async function sendWalletCalls(provider: EIP1193Provider, from: Address, calls: WalletCall[]): Promise<Hash[]> {
  if (calls.length === 0) throw new Error("Nothing to send.");

  if (calls.length > 1) {
    for (const atomicRequired of [true, false] as const) {
      try {
        const sent = (await provider.request({
          method: "wallet_sendCalls",
          params: [
            {
              version: "2.0.0",
              from,
              chainId: `0x${robinhoodChain.id.toString(16)}` as Hex,
              atomicRequired,
              calls: calls.map((item) => {
                const value = txValue(item.value);
                return {
                  to: item.to,
                  data: (item.data || "0x") as Hex,
                  ...(value ? { value } : {}),
                };
              }),
            },
          ],
        } as never)) as { id?: string } | string;
        const id = typeof sent === "string" ? sent : sent.id;
        if (!id) continue;
        return waitForCallHashes(provider, id);
      } catch (err) {
        if (isUserRejection(err)) throw err;
      }
    }
  }

  const hashes: Hash[] = [];
  for (const call of calls) {
    try {
      const value = txValue(call.value);
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from,
            to: call.to,
            data: (call.data || "0x") as Hex,
            ...(value ? { value } : {}),
            chainId: `0x${robinhoodChain.id.toString(16)}`,
          },
        ],
      })) as Hash;
      hashes.push(hash);
    } catch (err) {
      if (hashes.length > 0) {
        throw new Error(`Partially sent (${hashes.length}/${calls.length}). ${providerErrorText(err)}`);
      }
      throw err;
    }
  }
  return hashes;
}

async function waitForCallHashes(provider: EIP1193Provider, id: string): Promise<Hash[]> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = (await provider.request({
      method: "wallet_getCallsStatus",
      params: [id],
    })) as { status?: number | string; receipts?: { transactionHash?: Hash }[] };
    const code = Number(status.status);
    if (code === 200 || status.status === "CONFIRMED") {
      const hashes = (status.receipts ?? [])
        .map((receipt) => receipt.transactionHash)
        .filter((hash): hash is Hash => Boolean(hash));
      if (hashes.length === 0) throw new Error("Transaction was not broadcast.");
      return hashes;
    }
    if (code >= 400) throw new Error("Transaction failed.");
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
  }
  throw new Error("Transaction is still pending.");
}

export function actionTxHash(hashes: Hash[]) {
  const hash = hashes[hashes.length - 1];
  if (!hash) throw new Error("Transaction was not broadcast.");
  return hash;
}
