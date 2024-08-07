import { useMemo } from "react";
import cx from "classnames";

import { selectChartHeaderInfo } from "context/SyntheticsStateContext/selectors/chartSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";

import { USD_DECIMALS } from "lib/legacy";
import { formatAmountHuman, formatPercentageDisplay, formatRatePercentage } from "lib/numbers";

import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";
import { use24hVolume } from "domain/synthetics/tokens/use24Volume";

import { AvailableLiquidityTooltip } from "./components/AvailableLiquidityTooltip";
import { NetRate1hTooltip } from "./components/NetRate1hTooltip";

import { ReactComponent as LongIcon } from "img/long.svg";
import { ReactComponent as ShortIcon } from "img/short.svg";

export function useChartHeaderFormattedValues() {
  const dailyVolumeValue = use24hVolume();
  const info = useSelector(selectChartHeaderInfo);

  const [longOIValue, longOIPercentage] = useMemo(() => {
    if (info?.longOpenInterestPercentage !== undefined && info.openInterestLong !== undefined) {
      return [
        <span key="long-oi-value" className="whitespace-nowrap">
          ${formatAmountHuman(info?.openInterestLong, USD_DECIMALS)}
        </span>,
        formatPercentageDisplay(info.longOpenInterestPercentage),
      ];
    }

    return ["...", null];
  }, [info?.longOpenInterestPercentage, info?.openInterestLong]);

  const [shortOIValue, shortOIPercentage] = useMemo(() => {
    if (info?.longOpenInterestPercentage !== undefined && info.openInterestShort !== undefined) {
      return [
        <span key="short-oi-value" className="whitespace-nowrap">
          ${formatAmountHuman(info?.openInterestShort, USD_DECIMALS)}
        </span>,
        formatPercentageDisplay(100 - info.longOpenInterestPercentage),
      ];
    }

    return ["...", null];
  }, [info?.longOpenInterestPercentage, info?.openInterestShort]);

  const liquidityLong = useMemo(() => {
    const liquidity = info?.liquidityLong;

    if (liquidity === undefined) {
      return "...";
    }

    return (
      <TooltipWithPortal
        disableHandleStyle
        handle={`$${formatAmountHuman(liquidity, USD_DECIMALS)}`}
        position="bottom-end"
        content={<AvailableLiquidityTooltip isLong />}
      />
    );
  }, [info?.liquidityLong]);

  const liquidityShort = useMemo(() => {
    const liquidity = info?.liquidityShort;

    if (liquidity === undefined) {
      return "...";
    }

    return (
      <TooltipWithPortal
        disableHandleStyle
        handle={`$${formatAmountHuman(liquidity, USD_DECIMALS)}`}
        position="bottom-end"
        content={<AvailableLiquidityTooltip isLong={false} />}
      />
    );
  }, [info?.liquidityShort]);

  const netRateLong = useMemo(() => {
    const netRate = info?.netRateHourlyLong;

    if (netRate === undefined) {
      return "...";
    }

    return (
      <TooltipWithPortal
        disableHandleStyle
        handle={
          <span
            className={cx("flex flex-row items-center gap-4", {
              positive: netRate >= 0n,
              negative: netRate < 0n,
            })}
          >
            <LongIcon />
            {formatRatePercentage(netRate)}
          </span>
        }
        position="bottom-end"
        content={<NetRate1hTooltip isLong info={info} />}
      />
    );
  }, [info]);

  const netRateShort = useMemo(() => {
    const netRate = info?.netRateHourlyShort;

    if (netRate === undefined) {
      return "...";
    }

    return (
      <TooltipWithPortal
        disableHandleStyle
        handle={
          <span
            className={cx("flex flex-row items-center gap-4", {
              positive: netRate >= 0n,
              negative: netRate < 0n,
            })}
          >
            <ShortIcon />
            {formatRatePercentage(netRate)}
          </span>
        }
        position="bottom-end"
        content={<NetRate1hTooltip isLong={false} info={info} />}
      />
    );
  }, [info]);

  const dailyVolume = dailyVolumeValue ? `$${formatAmountHuman(dailyVolumeValue, USD_DECIMALS)}` : "...";

  return {
    longOIValue,
    shortOIValue,
    longOIPercentage,
    shortOIPercentage,
    liquidityLong,
    liquidityShort,
    netRateLong,
    netRateShort,
    dailyVolume,
  };
}
