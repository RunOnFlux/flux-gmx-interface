import { Trans, t } from "@lingui/macro";
import { addDays, formatDistanceToNowStrict } from "date-fns";
import { useCallback, useMemo } from "react";

import { getIncentivesV2Url } from "config/links";
import { ENOUGH_DAYS_SINCE_LISTING_FOR_APY, getMarketListingDate } from "config/markets";
import { useLiquidityProvidersIncentives } from "domain/synthetics/common/useIncentiveStats";
import { getIsBaseApyReadyToBeShown } from "domain/synthetics/markets/getIsBaseApyReadyToBeShown";
import { useLpAirdroppedTokenTitle } from "domain/synthetics/tokens/useAirdroppedTokenTitle";
import { useChainId } from "lib/chains";
import { formatAmount } from "lib/numbers";

import ExternalLink from "components/ExternalLink/ExternalLink";
import StatsTooltipRow from "components/StatsTooltip/StatsTooltipRow";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import sparkleIcon from "img/sparkle.svg";

function getApyReadyToBeShownDate(listingDate: Date): Date {
  return addDays(listingDate, ENOUGH_DAYS_SINCE_LISTING_FOR_APY);
}

export function AprInfo({
  apy,
  incentiveApr,
  showTooltip = true,
  tokenAddress,
}: {
  apy: bigint | undefined;
  incentiveApr: bigint | undefined;
  showTooltip?: boolean;
  tokenAddress: string;
}) {
  const { chainId } = useChainId();

  const listingDate = getMarketListingDate(chainId, tokenAddress);
  const { isBaseAprReadyToBeShown, apyReadyToBeShownDate } = useMemo(
    () => ({
      isBaseAprReadyToBeShown: getIsBaseApyReadyToBeShown(listingDate),
      apyReadyToBeShownDate: getApyReadyToBeShownDate(listingDate),
    }),
    [listingDate]
  );

  let totalApr = 0n;
  if (!isBaseAprReadyToBeShown) {
    totalApr = incentiveApr ?? 0n;
  } else {
    totalApr = (apy ?? 0n) + (incentiveApr ?? 0n);
  }
  const incentivesData = useLiquidityProvidersIncentives(chainId);
  const isIncentiveActive = !!incentivesData;
  const isIncentiveActiveForToken = incentivesData?.rewardsPerMarket[tokenAddress] !== undefined;
  const airdropTokenTitle = useLpAirdroppedTokenTitle();

  const renderTooltipContent = useCallback(() => {
    if (!isIncentiveActive || !isIncentiveActiveForToken) {
      return (
        <>
          <StatsTooltipRow
            showDollar={false}
            label={t`Base APY`}
            value={isBaseAprReadyToBeShown ? `${formatAmount(apy, 28, 2)}%` : t`NA`}
          />
          {!isBaseAprReadyToBeShown && (
            <>
              <br />
              <Trans>
                The base APY estimate will be available{" "}
                {formatDistanceToNowStrict(apyReadyToBeShownDate as Date, { addSuffix: true })} to ensure accurate data
                display.
              </Trans>
            </>
          )}
        </>
      );
    }

    return (
      <>
        <StatsTooltipRow
          showDollar={false}
          label={t`Base APY`}
          value={isBaseAprReadyToBeShown ? `${formatAmount(apy, 28, 2)}%` : t`NA`}
        />
        <StatsTooltipRow showDollar={false} label={t`Bonus APR`} value={`${formatAmount(incentiveApr, 28, 2)}%`} />
        <br />
        {!isBaseAprReadyToBeShown && (
          <>
            <Trans>
              The base APY estimate will be available{" "}
              {formatDistanceToNowStrict(apyReadyToBeShownDate as Date, { addSuffix: true })} to ensure accurate data
              display.
            </Trans>
            <br />
            <br />
          </>
        )}
        <Trans>
          The Bonus APR will be airdropped as {airdropTokenTitle} tokens.{" "}
          <ExternalLink href={getIncentivesV2Url(chainId)}>Read more</ExternalLink>.
        </Trans>
      </>
    );
  }, [
    airdropTokenTitle,
    apy,
    apyReadyToBeShownDate,
    chainId,
    incentiveApr,
    isBaseAprReadyToBeShown,
    isIncentiveActive,
    isIncentiveActiveForToken,
  ]);

  const aprNode = useMemo(() => {
    const node = <>{apy !== undefined ? `${formatAmount(totalApr, 28, 2)}%` : "..."}</>;

    if (incentiveApr !== undefined && incentiveApr > 0) {
      return (
        <div className="inline-flex flex-nowrap">
          {node}
          <img className="relative -top-3 h-10" src={sparkleIcon} alt="sparkle" />
        </div>
      );
    } else {
      return node;
    }
  }, [apy, incentiveApr, totalApr]);

  return showTooltip && (isIncentiveActive || !isBaseAprReadyToBeShown) ? (
    <TooltipWithPortal
      maxAllowedWidth={280}
      handle={aprNode}
      position="bottom-end"
      renderContent={renderTooltipContent}
    />
  ) : (
    aprNode
  );
}
