import { BigNumber, constants } from "ethers";
import { BASIS_POINTS_DIVISOR } from "config/factors";
import { getBorrowingFactorPerPeriod, getFundingFactorPerPeriod } from "domain/synthetics/fees";
import { getUsedLiquidity, MarketInfo, MarketsInfoData } from "domain/synthetics/markets";
import { getMidPrice, TokenData } from "domain/synthetics/tokens";
import { CHART_PERIODS } from "lib/legacy";
import { BN_ZERO } from "lib/numbers";

export type MarketStat = {
  marketInfo: MarketInfo;
  poolValueUsd: BigNumber;
  usedLiquidity: BigNumber;
  maxLiquidity: BigNumber;
  netFeeLong: BigNumber;
  netFeeShort: BigNumber;
  utilization: BigNumber;
};

export type IndexTokenStat = {
  token: TokenData;
  price: BigNumber;
  totalPoolValue: BigNumber;
  totalUtilization: BigNumber;
  totalUsedLiquidity: BigNumber;
  totalMaxLiquidity: BigNumber;
  bestNetFeeLong: BigNumber;
  bestNetFeeShort: BigNumber;
  /**
   * Sorted by poolValueUsd descending
   */
  marketsStats: MarketStat[];
};

export type IndexTokensStats = {
  [address: string]: IndexTokenStat;
};

export function bnMax(...args: BigNumber[]): BigNumber {
  let max = args[0];
  for (let i = 1; i < args.length; i++) {
    if (args[i].gt(max)) {
      max = args[i];
    }
  }

  return max;
}

export function marketsInfoDataToIndexTokensStats(marketsInfoData: MarketsInfoData): IndexTokenStat[] {
  const markets = Object.values(marketsInfoData || {}).sort((a, b) => {
    return a.indexToken.symbol.localeCompare(b.indexToken.symbol);
  });

  const indexMap: IndexTokensStats = {};

  for (const marketInfo of markets) {
    if (marketInfo.isSpotOnly || marketInfo.isDisabled) {
      continue;
    }

    const { indexToken } = marketInfo;

    if (!indexMap[indexToken.address]) {
      const price = getMidPrice(indexToken.prices)!;

      indexMap[marketInfo.indexTokenAddress] = {
        token: indexToken,
        price,
        totalPoolValue: BN_ZERO,
        totalUtilization: BN_ZERO,
        totalUsedLiquidity: BN_ZERO,
        totalMaxLiquidity: BN_ZERO,
        marketsStats: [],
        bestNetFeeLong: constants.MinInt256,
        bestNetFeeShort: constants.MinInt256,
      };
    }

    const indexTokenStats = indexMap[marketInfo.indexTokenAddress];

    const poolValueUsd = marketInfo.poolValueMax;

    const fundingRateLong = getFundingFactorPerPeriod(marketInfo, true, CHART_PERIODS["1h"]);
    const fundingRateShort = getFundingFactorPerPeriod(marketInfo, false, CHART_PERIODS["1h"]);
    const borrowingRateLong = getBorrowingFactorPerPeriod(marketInfo, true, CHART_PERIODS["1h"]).mul(-1);
    const borrowingRateShort = getBorrowingFactorPerPeriod(marketInfo, false, CHART_PERIODS["1h"]).mul(-1);

    const [longUsedLiquidity, longMaxLiquidity] = getUsedLiquidity(marketInfo, true);

    const [shortUsedLiquidity, shortMaxLiquidity] = getUsedLiquidity(marketInfo, false);

    const usedLiquidity = longUsedLiquidity.add(shortUsedLiquidity);
    const maxLiquidity = longMaxLiquidity.add(shortMaxLiquidity);

    const utilization = maxLiquidity.gt(0)
      ? usedLiquidity.mul(BASIS_POINTS_DIVISOR).div(maxLiquidity)
      : BigNumber.from(0);

    const netFeeLong = borrowingRateLong.add(fundingRateLong);
    const netFeeShort = borrowingRateShort.add(fundingRateShort);

    indexTokenStats.totalPoolValue = indexTokenStats.totalPoolValue.add(poolValueUsd);
    indexTokenStats.totalUsedLiquidity = indexTokenStats.totalUsedLiquidity.add(usedLiquidity);
    indexTokenStats.totalMaxLiquidity = indexTokenStats.totalMaxLiquidity.add(maxLiquidity);
    indexTokenStats.bestNetFeeLong = bnMax(indexTokenStats.bestNetFeeLong, netFeeLong);
    indexTokenStats.bestNetFeeShort = bnMax(indexTokenStats.bestNetFeeShort, netFeeShort);
    indexTokenStats.marketsStats.push({
      marketInfo,
      utilization,
      netFeeLong,
      netFeeShort,
      usedLiquidity,
      poolValueUsd,
      maxLiquidity,
    });
  }

  for (const indexTokenStats of Object.values(indexMap)) {
    indexTokenStats.totalUtilization = indexTokenStats.totalMaxLiquidity.gt(0)
      ? indexTokenStats.totalUsedLiquidity.mul(BASIS_POINTS_DIVISOR).div(indexTokenStats.totalMaxLiquidity)
      : BigNumber.from(0);

    indexTokenStats.marketsStats.sort((a, b) => {
      return b.poolValueUsd.gt(a.poolValueUsd) ? 1 : -1;
    });
  }

  return Object.values(indexMap).sort((a, b) => {
    return b.totalPoolValue.gt(a.totalPoolValue) ? 1 : -1;
  });
}
