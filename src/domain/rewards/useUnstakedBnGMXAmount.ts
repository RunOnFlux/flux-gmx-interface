import useSWR from "swr";

import { useChainId } from "lib/chains";
import { contractFetcher } from "lib/contracts";
import useWallet from "lib/wallets/useWallet";
import { getContract } from "config/contracts";
import Token from "abis/Token.json";
import { PLACEHOLDER_ACCOUNT } from "lib/legacy";

export function useUnstakedBnGMXAmount() {
  const { signer, active, account } = useWallet();
  const { chainId } = useChainId();
  const bnGmxAddress = getContract(chainId, "BN_GMX");

  const { data: unstakedBnGmx } = useSWR(
    [`unstakedBnGMXAmount:${active}`, chainId, bnGmxAddress, "balanceOf", account ?? PLACEHOLDER_ACCOUNT],
    {
      fetcher: contractFetcher(signer, Token),
    }
  );

  return unstakedBnGmx;
}
