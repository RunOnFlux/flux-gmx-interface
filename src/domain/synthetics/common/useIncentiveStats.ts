import { addDays, set, startOfWeek } from "date-fns";
import { useChainId } from "lib/chains";
import { mapValues } from "lodash";
import { useMemo } from "react";
import useSWR from "swr";
import { RawIncentivesStats, useOracleKeeperFetcher } from "../tokens";

export default function useIncentiveStats(overrideChainId?: number) {
  const { chainId: defaultChainId } = useChainId();
  const chainId = overrideChainId ?? defaultChainId;
  const oracleKeeperFetcher = useOracleKeeperFetcher(chainId);

  return (
    useSWR<RawIncentivesStats | null>(["incentiveStats", chainId], async () => {
      if (!oracleKeeperFetcher) {
        return null;
      }
      const res = await oracleKeeperFetcher.fetchIncentivesRewards();
      return res;
    }).data ?? null
  );
}

export const useLiquidityProvidersIncentives = (chainId: number) => {
  const lpStats = useIncentiveStats(chainId)?.lp;

  return useMemo(() => {
    if (!lpStats || !lpStats.isActive) return null;
    return {
      totalRewards: BigInt(lpStats.totalRewards),
      period: lpStats.period,
      rewardsPerMarket: mapValues(lpStats.rewardsPerMarket, (x) => BigInt(x)),
      token: lpStats.token,
      excludeHolders: lpStats.excludeHolders,
    };
  }, [lpStats]);
};

export type TradingIncentives = ReturnType<typeof useTradingIncentives>;

export const useTradingIncentives = (chainId: number) => {
  const incentiveStats = useIncentiveStats(chainId);

  const startOfPeriod = useMemo(() => {
    const currentDate = new Date();
    const thisWeekWednesday = addDays(startOfWeek(currentDate), 3);
    const wednesday =
      currentDate.valueOf() > thisWeekWednesday.valueOf() ? thisWeekWednesday : addDays(thisWeekWednesday, -7);
    const timezoneOffset = currentDate.getTimezoneOffset() * 60;

    return (
      Math.floor(set(wednesday, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }).valueOf() / 1000) -
      timezoneOffset
    );
  }, []);

  return useMemo(() => {
    const raw = incentiveStats?.trading;
    if (!raw || !raw.isActive) {
      return null;
    }

    const rebatePercent = BigInt(raw.rebatePercent);
    if (rebatePercent == 0n) return null;

    const allocation = BigInt(raw.allocation);
    const nextPeriodStart = addDays(new Date(startOfPeriod * 1000), 7);

    const tokenAddress = raw.token ?? (incentiveStats?.lp.isActive ? incentiveStats.lp.token : null);

    return {
      allocation,
      period: raw.period,
      nextPeriodStart,
      rebatePercent,
      token: tokenAddress,
    };
  }, [incentiveStats, startOfPeriod]);
};
