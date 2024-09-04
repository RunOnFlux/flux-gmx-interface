import { t } from "@lingui/macro";
import { useCallback, useState } from "react";

import { HIGH_PRICE_IMPACT_BPS } from "config/factors";
import { useSettings } from "context/SettingsContext/SettingsContextProvider";
import { useTokensData, useUiFeeFactor } from "context/SyntheticsStateContext/hooks/globalsHooks";
import {
  selectGlvAndGmMarketsData,
  selectChainId,
  selectGasLimits,
  selectGasPrice,
} from "context/SyntheticsStateContext/selectors/globalSelectors";
import { selectShiftAvailableMarkets } from "context/SyntheticsStateContext/selectors/shiftSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { MarketInfo, getMarketIndexName } from "domain/synthetics/markets";
import { useMarketTokensData } from "domain/synthetics/markets/useMarketTokensData";
import { useGmTokensFavorites } from "domain/synthetics/tokens/useGmTokensFavorites";
import useSortedPoolsWithIndexToken from "domain/synthetics/trade/useSortedPoolsWithIndexToken";
import { bigMath } from "lib/bigmath";
import { formatAmountFree, formatTokenAmount, formatUsd } from "lib/numbers";
import { getByKey } from "lib/objects";
import { Mode, Operation } from "../types";

import { useUpdateByQueryParams } from "../useUpdateByQueryParams";
import { useShiftAmounts } from "./useShiftAmounts";
import { useShiftAvailableRelatedMarkets } from "./useShiftAvailableRelatedMarkets";
import { useShiftFees } from "./useShiftFees";
import { useShiftSubmitState } from "./useShiftSubmitState";
import { useUpdateMarkets } from "./useUpdateMarkets";
import { useUpdateTokens } from "./useUpdateTokens";

import { ApproveTokenButton } from "components/ApproveTokenButton/ApproveTokenButton";
import { getContract } from "config/contracts";
import { getTokenData } from "domain/synthetics/tokens";
import { useHighExecutionFeeConsent } from "domain/synthetics/trade/useHighExecutionFeeConsent";
import Button from "components/Button/Button";
import BuyInputSection from "components/BuyInputSection/BuyInputSection";
import { ExchangeInfo } from "components/Exchange/ExchangeInfo";
import { PoolSelector } from "components/MarketSelector/PoolSelector";
import { NetworkFeeRow } from "components/Synthetics/NetworkFeeRow/NetworkFeeRow";
import { GmFees } from "../../GmFees/GmFees";
import { HighPriceImpactRow } from "../HighPriceImpactRow";
import { Swap } from "../Swap";
import { useDepositWithdrawalSetFirstTokenAddress } from "../useDepositWithdrawalSetFirstTokenAddress";
import { GlvMarketInfo } from "domain/synthetics/markets/useGlvMarkets";
import { isGlv } from "domain/synthetics/markets/glv";
import { MarketState } from "components/MarketSelector/types";

export function GmShiftBox({
  selectedMarketAddress,
  onSelectMarket,
  onSelectGlvGmMarket,
  onSetMode,
  onSetOperation,
}: {
  selectedMarketAddress: string | undefined;
  onSelectMarket: (marketAddress: string) => void;
  onSetMode: (mode: Mode) => void;
  onSetOperation: (operation: Operation) => void;
  onSelectGlvGmMarket?: (marketAddress: string) => void;
}) {
  const [toMarketAddress, setToMarketAddress] = useState<string | undefined>(undefined);
  const [selectedMarketText, setSelectedMarketText] = useState("");
  const [toMarketText, setToMarketText] = useState("");
  const gmTokenFavoritesContext = useGmTokensFavorites();
  const [focusedInput, setFocusedInput] = useState<"selectedMarket" | "toMarket" | undefined>(undefined);
  const [isHighPriceImpactAccepted, setIsHighPriceImpactAccepted] = useState(false);

  const chainId = useSelector(selectChainId);
  const uiFeeFactor = useUiFeeFactor();
  const gasLimits = useSelector(selectGasLimits);
  const gasPrice = useSelector(selectGasPrice);
  const marketsInfoData = useSelector(selectGlvAndGmMarketsData);
  const tokensData = useTokensData();
  const { marketTokensData: depositMarketTokensData } = useMarketTokensData(chainId, { isDeposit: true });
  const { marketsInfo: sortedMarketsInfoByIndexToken } = useSortedPoolsWithIndexToken(
    marketsInfoData,
    depositMarketTokensData
  );

  const shiftAvailableMarkets = useSelector(selectShiftAvailableMarkets);
  const shiftAvailableRelatedMarkets = useShiftAvailableRelatedMarkets(
    marketsInfoData,
    sortedMarketsInfoByIndexToken,
    selectedMarketAddress
  );
  const { shouldDisableValidationForTesting } = useSettings();

  const selectedMarketInfo = getByKey(marketsInfoData, selectedMarketAddress);
  const selectedIndexName = selectedMarketInfo ? getMarketIndexName(selectedMarketInfo) : "...";
  const selectedToken = getByKey(depositMarketTokensData, selectedMarketAddress);
  const toMarketInfo = getByKey(marketsInfoData, toMarketAddress);
  const toIndexName = toMarketInfo ? getMarketIndexName(toMarketInfo) : "...";
  const toToken = getByKey(depositMarketTokensData, toMarketAddress);

  const amounts = useShiftAmounts({
    selectedMarketInfo,
    selectedToken,
    toMarketInfo,
    toToken,
    selectedMarketText,
    toMarketText,
    focusedInput,
    uiFeeFactor,
  });

  const { fees, executionFee } = useShiftFees({ gasLimits, gasPrice, tokensData, amounts, chainId });

  const isHighPriceImpact =
    (fees?.swapPriceImpact?.deltaUsd ?? 0) < 0 &&
    bigMath.abs(fees?.swapPriceImpact?.bps ?? 0n) >= HIGH_PRICE_IMPACT_BPS;

  const noAmountSet = amounts?.fromTokenAmount === undefined;
  const balanceNotEqualToAmount = selectedToken?.balance !== amounts?.fromTokenAmount;
  const hasBalance = selectedToken?.balance !== undefined && selectedToken.balance > 0n;
  const selectedTokenShowMaxButton = hasBalance && (noAmountSet || balanceNotEqualToAmount);

  const selectedTokenDollarAmount =
    amounts?.fromTokenUsd !== undefined && amounts.fromTokenUsd > 0n ? formatUsd(amounts.fromTokenUsd) : "";
  const toTokenShowDollarAmount =
    amounts?.toTokenUsd !== undefined && amounts.toTokenUsd > 0n ? formatUsd(amounts.toTokenUsd) : "";

  const routerAddress = getContract(chainId, "SyntheticsRouter");
  const { element: highExecutionFeeAcknowledgement, isHighFeeConsentError } = useHighExecutionFeeConsent(
    executionFee?.feeUsd
  );

  const submitState = useShiftSubmitState({
    selectedMarketInfo,
    selectedToken,
    amounts,
    toMarketInfo,
    toToken,
    fees,
    isHighPriceImpact,
    isHighPriceImpactAccepted,
    shouldDisableValidationForTesting,
    tokensData,
    marketTokenUsd: amounts?.fromTokenUsd,
    executionFee,
    routerAddress,
    payTokenAddresses: [selectedToken?.address ?? ""],
    isHighFeeConsentError,
  });

  useUpdateMarkets({
    marketsInfoData,
    selectedMarketAddress,
    shiftAvailableMarkets,
    onSelectMarket,
    toMarketAddress,
    toMarketInfo,
    selectedMarketInfo,
    setToMarketAddress,
  });

  useUpdateTokens({ amounts, selectedToken, toToken, focusedInput, setToMarketText, setSelectedMarketText });

  const [, setFirstTokenAddressForDeposit] = useDepositWithdrawalSetFirstTokenAddress(true, toMarketAddress);

  useUpdateByQueryParams({
    operation: Operation.Shift,
    onSelectMarket,
    setMode: onSetMode,
    setOperation: onSetOperation,
  });

  const handleFormSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submitState.onSubmit?.();
    },
    [submitState]
  );

  const handleClearValues = useCallback(() => {
    setSelectedMarketText("");
    setToMarketText("");
  }, []);

  const handleSelectedTokenClickMax = useCallback(() => {
    if (!selectedToken || selectedToken.balance === undefined) return;
    setFocusedInput("selectedMarket");
    setSelectedMarketText(formatAmountFree(selectedToken.balance, selectedToken.decimals));
  }, [selectedToken]);
  const handleSelectedTokenInputValueChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setSelectedMarketText(event.target.value),
    []
  );
  const handleSelectedTokenFocus = useCallback(() => setFocusedInput("selectedMarket"), []);
  const handleSelectedTokenSelectMarket = useCallback(
    (marketInfo: MarketInfo): void => {
      onSelectMarket(marketInfo.marketTokenAddress);
      handleClearValues();
    },
    [handleClearValues, onSelectMarket]
  );

  const handleToTokenInputValueChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setToMarketText(event.target.value),
    []
  );
  const handleToTokenFocus = useCallback(() => setFocusedInput("toMarket"), []);
  const handleToTokenSelectMarket = useCallback(
    (marketInfo: MarketInfo): void => {
      if (isGlv(marketInfo) && selectedMarketInfo?.marketTokenAddress) {
        onSelectMarket(marketInfo.marketTokenAddress);
        setFirstTokenAddressForDeposit(selectedMarketInfo.marketTokenAddress);
        onSetOperation(Operation.Deposit);
        onSelectGlvGmMarket?.(selectedMarketInfo.marketTokenAddress);
      } else {
        setToMarketAddress(marketInfo.marketTokenAddress);
        handleClearValues();
      }
    },
    [
      handleClearValues,
      onSelectGlvGmMarket,
      onSelectMarket,
      onSetOperation,
      selectedMarketInfo,
      setFirstTokenAddressForDeposit,
    ]
  );

  const getShiftReceiveMarketState = useCallback((marketInfo: MarketInfo | GlvMarketInfo): MarketState => {
    if (isGlv(marketInfo)) {
      return {
        warning:
          "Shifting From GM to GLV is similar to buying GLV with a GM token. You will be redirected to the buy GLV tab when selected.",
      };
    }

    return {};
  }, []);

  return (
    <>
      <form className="flex flex-col" onSubmit={handleFormSubmit}>
        <BuyInputSection
          topLeftLabel={t`Pay`}
          topLeftValue={selectedTokenDollarAmount}
          topRightLabel={t`Balance`}
          topRightValue={formatTokenAmount(selectedToken?.balance, selectedToken?.decimals, "", {
            useCommas: true,
          })}
          onClickTopRightLabel={handleSelectedTokenClickMax}
          showMaxButton={selectedTokenShowMaxButton}
          onClickMax={handleSelectedTokenClickMax}
          inputValue={selectedMarketText}
          onInputValueChange={handleSelectedTokenInputValueChange}
          onFocus={handleSelectedTokenFocus}
        >
          <PoolSelector
            selectedMarketAddress={selectedMarketAddress}
            markets={shiftAvailableMarkets}
            onSelectMarket={handleSelectedTokenSelectMarket}
            selectedIndexName={selectedIndexName}
            showAllPools
            isSideMenu
            showIndexIcon
            showBalances
            marketTokensData={depositMarketTokensData}
            {...gmTokenFavoritesContext}
          />
        </BuyInputSection>
        <Swap />
        <BuyInputSection
          topLeftLabel={t`Receive`}
          topLeftValue={toTokenShowDollarAmount}
          topRightLabel={t`Balance`}
          topRightValue={formatTokenAmount(toToken?.balance, toToken?.decimals, "", {
            useCommas: true,
          })}
          inputValue={toMarketText}
          onInputValueChange={handleToTokenInputValueChange}
          onFocus={handleToTokenFocus}
        >
          <PoolSelector
            selectedMarketAddress={toMarketAddress}
            markets={shiftAvailableRelatedMarkets}
            onSelectMarket={handleToTokenSelectMarket}
            selectedIndexName={toIndexName}
            getMarketState={getShiftReceiveMarketState}
            showAllPools
            isSideMenu
            showIndexIcon
            showBalances
            marketTokensData={depositMarketTokensData}
            {...gmTokenFavoritesContext}
          />
        </BuyInputSection>
        <ExchangeInfo className={isHighPriceImpact ? undefined : "mb-10"} dividerClassName="App-card-divider">
          <ExchangeInfo.Group>
            <GmFees
              isDeposit={true}
              totalFees={fees?.totalFees}
              swapPriceImpact={fees?.swapPriceImpact}
              uiFee={fees?.uiFee}
              shiftFee={fees?.shiftFee}
            />
            <NetworkFeeRow executionFee={executionFee} />
          </ExchangeInfo.Group>
          {isHighPriceImpact && (
            <HighPriceImpactRow
              isHighPriceImpactAccepted={isHighPriceImpactAccepted}
              setIsHighPriceImpactAccepted={setIsHighPriceImpactAccepted}
              isSingle={false}
            />
          )}
        </ExchangeInfo>

        {submitState.tokensToApprove && submitState.tokensToApprove.length > 0 && (
          <div>
            {submitState.tokensToApprove.map((address) => {
              const token = getTokenData(tokensData, address)!;
              let marketTokenData =
                address === selectedToken?.address && getByKey(marketsInfoData, selectedToken?.address);
              return (
                <div key={address}>
                  <ApproveTokenButton
                    key={address}
                    tokenAddress={address}
                    tokenSymbol={marketTokenData ? `GM: ${marketTokenData.name}` : token.assetSymbol ?? token.symbol}
                    spenderAddress={routerAddress}
                  />
                </div>
              );
            })}
          </div>
        )}

        {highExecutionFeeAcknowledgement ? (
          <div className="GmConfirmationBox-high-fee">{highExecutionFeeAcknowledgement}</div>
        ) : null}

        <Button className="w-full" variant="primary-action" type="submit" disabled={submitState.disabled}>
          {submitState.text}
        </Button>
      </form>
    </>
  );
}
