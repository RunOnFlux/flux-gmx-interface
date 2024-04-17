import { BigNumber } from "ethers";
import mapValues from "lodash/mapValues";
import pick from "lodash/pick";
import { SetStateAction, useCallback, useEffect, useMemo, useState } from "react";

import {
  getKeepLeverageKey,
  getLeverageEnabledKey,
  getLeverageKey,
  getSyntheticsTradeOptionsKey,
} from "config/localStorage";
import { createTradeFlags } from "context/SyntheticsStateContext/selectors/tradeSelectors";
import { getIsUnwrap, getIsWrap } from "domain/tokens";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import { getByKey } from "lib/objects";
import { useSafeState } from "lib/useSafeState";
import { MarketsInfoData } from "../markets";
import { OrderType } from "../orders/types";
import { PositionInfo } from "../positions";
import { TokensData } from "../tokens";
import { TradeMode, TradeType, TriggerThresholdType } from "./types";
import { useAvailableTokenOptions } from "./useAvailableTokenOptions";

type TradeStage = "trade" | "confirmation" | "processing";

type TradeOptions = {
  tradeType?: TradeType;
  tradeMode?: TradeMode;
  fromTokenAddress?: string;
  toTokenAddress?: string;
  marketAddress?: string;
  collateralAddress?: string;
};

export type TradeboxState = ReturnType<typeof useTradeboxState>;

type StoredTradeOptions = {
  tradeType: TradeType;
  tradeMode: TradeMode;
  tokens: {
    fromTokenAddress?: string;
    swapToTokenAddress?: string;
    indexTokenAddress?: string;
  };
  markets: {
    [indexTokenAddress: string]: {
      long: string;
      short: string;
    };
  };
  collateralAddress?: string;
};

const INITIAL_SYNTHETICS_TRADE_OPTIONS_STATE: StoredTradeOptions = {
  tradeType: TradeType.Long,
  tradeMode: TradeMode.Market,
  tokens: {},
  markets: {},
  collateralAddress: undefined,
};

export function useTradeboxState(
  chainId: number,
  p: {
    marketsInfoData?: MarketsInfoData;
    tokensData?: TokensData;
  }
) {
  const { marketsInfoData, tokensData } = p;

  const availableTokensOptions = useAvailableTokenOptions(chainId, { marketsInfoData, tokensData });

  // eslint-disable-next-line react/hook-use-state
  const [storedOptions, setStoredOptionsWithoutFallbacks] = useState<StoredTradeOptions | undefined>(() => {
    const raw = localStorage.getItem(JSON.stringify(getSyntheticsTradeOptionsKey(chainId)));

    if (!raw) {
      localStorage.setItem(JSON.stringify(getSyntheticsTradeOptionsKey(chainId)), "");
      return undefined;
    }

    return JSON.parse(raw);
  });

  const setStoredOptionsOnChain = useCallback(
    (args: SetStateAction<StoredTradeOptions | undefined>) => {
      setStoredOptionsWithoutFallbacks((oldState) => {
        const newState = typeof args === "function" ? args(oldState)! : args!;

        if (newState) {
          localStorage.setItem(JSON.stringify(getSyntheticsTradeOptionsKey(chainId)), JSON.stringify(newState));
        }

        return newState;
      });
    },
    [chainId]
  );

  //#region Manual useMemo zone begin
  // This ensures almost no reinitialization of all setters
  /* eslint-disable react-hooks/exhaustive-deps */
  const unstableRefAvailableSwapTokensAddresses = availableTokensOptions.swapTokens.map((t) => t.address);

  const availableSwapTokenAddresses = useMemo(() => {
    return unstableRefAvailableSwapTokensAddresses;
  }, [unstableRefAvailableSwapTokensAddresses.sort().join(",")]);

  const unstableRefAvailableIndexTokensAddresses = availableTokensOptions.indexTokens.map((t) => t.address);

  const availableIndexTokensAddresses = useMemo(() => {
    return unstableRefAvailableIndexTokensAddresses;
  }, [unstableRefAvailableIndexTokensAddresses.sort().join(",")]);

  const unstableRefStrippedMarketInfo = mapValues(marketsInfoData || {}, (info) =>
    pick(info, ["longTokenAddress", "shortTokenAddress"])
  );

  const strippedMarketInfo = useMemo(() => {
    return unstableRefStrippedMarketInfo;
  }, [JSON.stringify(unstableRefStrippedMarketInfo)]);
  /* eslint-enable react-hooks/exhaustive-deps */
  //#endregion Manual useMemo zone end

  const [syncedChainId, setSyncedChainId] = useState<number | undefined>(undefined);
  useEffect(
    function handleChainChange() {
      if (syncedChainId === chainId) {
        return;
      }

      const raw = localStorage.getItem(JSON.stringify(getSyntheticsTradeOptionsKey(chainId)));

      if (raw) {
        if (availableIndexTokensAddresses.length === 0) {
          return;
        }

        const saved = JSON.parse(raw) as StoredTradeOptions;

        if (saved.tokens.indexTokenAddress && availableIndexTokensAddresses.includes(saved.tokens.indexTokenAddress)) {
          setStoredOptionsOnChain(saved);
          setSyncedChainId(chainId);
          return;
        }
      }

      const market = availableTokensOptions.sortedAllMarkets?.at(0);

      if (!market) {
        return;
      }

      setStoredOptionsOnChain({
        ...INITIAL_SYNTHETICS_TRADE_OPTIONS_STATE,
        markets: {
          [market.marketTokenAddress]: {
            long: market.longTokenAddress,
            short: market.shortTokenAddress,
          },
        },
        tokens: {
          indexTokenAddress: market.indexTokenAddress,
          fromTokenAddress: market.shortTokenAddress,
        },
      });
      setSyncedChainId(chainId);
    },
    [
      syncedChainId,
      availableIndexTokensAddresses,
      chainId,
      setStoredOptionsOnChain,
      availableTokensOptions.sortedAllMarkets,
      marketsInfoData,
    ]
  );

  const setStoredOptions = useCallback(
    (args: SetStateAction<StoredTradeOptions | undefined>) => {
      setStoredOptionsOnChain((oldState) => {
        let newState = typeof args === "function" ? args(oldState)! : args!;

        if (newState && (newState.tradeType === TradeType.Long || newState.tradeType === TradeType.Short)) {
          newState = fallbackPositionTokens(newState);
        }

        return newState;
      });

      function fallbackPositionTokens(newState: StoredTradeOptions) {
        const needFromUpdate = !availableSwapTokenAddresses.find((t) => t === newState!.tokens.fromTokenAddress);
        const nextFromTokenAddress =
          needFromUpdate && availableSwapTokenAddresses.length
            ? availableSwapTokenAddresses[0]
            : newState.tokens.fromTokenAddress;

        if (nextFromTokenAddress && nextFromTokenAddress !== newState.tokens.fromTokenAddress) {
          newState = {
            ...newState,
            tokens: {
              ...newState.tokens,
              fromTokenAddress: nextFromTokenAddress,
            },
          };
        }

        const needIndexUpdateByAvailableTokens = !availableIndexTokensAddresses.find(
          (t) => t === newState!.tokens.indexTokenAddress
        );

        if (needIndexUpdateByAvailableTokens && availableIndexTokensAddresses.length) {
          const updater = setToTokenAddressUpdaterBuilder(
            newState.tradeType,
            availableIndexTokensAddresses[0],
            undefined
          );

          newState = updater(newState);
        }

        const toTokenAddress =
          newState.tradeType === TradeType.Swap
            ? newState.tokens.swapToTokenAddress
            : newState.tokens.indexTokenAddress;
        const marketAddress = toTokenAddress
          ? newState!.markets[toTokenAddress]?.[newState.tradeType === TradeType.Long ? "long" : "short"]
          : undefined;
        const marketInfo = getByKey(strippedMarketInfo, marketAddress);

        const currentCollateralIncludedInCurrentMarket =
          marketInfo &&
          (marketInfo.longTokenAddress === newState.collateralAddress ||
            marketInfo.shortTokenAddress === newState.collateralAddress);

        const needCollateralUpdate = !newState.collateralAddress || !currentCollateralIncludedInCurrentMarket;

        if (needCollateralUpdate && marketInfo) {
          newState = {
            ...newState,
            collateralAddress: marketInfo.shortTokenAddress,
          };
        }

        return newState;
      }
    },
    [availableIndexTokensAddresses, availableSwapTokenAddresses, setStoredOptionsOnChain, strippedMarketInfo]
  );

  const [fromTokenInputValue, setFromTokenInputValue] = useSafeState("");
  const [toTokenInputValue, setToTokenInputValue] = useSafeState("");
  const [stage, setStage] = useState<TradeStage>("trade");
  const [focusedInput, setFocusedInput] = useState<"from" | "to">();
  const [fixedTriggerThresholdType, setFixedTriggerThresholdType] = useState<TriggerThresholdType>();
  const [fixedTriggerOrderType, setFixedTriggerOrderType] = useState<
    OrderType.LimitDecrease | OrderType.StopLossDecrease
  >();
  const [defaultTriggerAcceptablePriceImpactBps, setDefaultTriggerAcceptablePriceImpactBps] = useState<BigNumber>();
  const [selectedTriggerAcceptablePriceImpactBps, setSelectedTriggerAcceptablePriceImpactBps] = useState<BigNumber>();
  const [closeSizeInputValue, setCloseSizeInputValue] = useState("");
  const [triggerPriceInputValue, setTriggerPriceInputValue] = useState<string>("");
  const [triggerRatioInputValue, setTriggerRatioInputValue] = useState<string>("");

  const { swapTokens } = availableTokensOptions;

  const tradeType = storedOptions?.tradeType;
  const tradeMode = storedOptions?.tradeMode;

  const [leverageOption, setLeverageOption] = useLocalStorageSerializeKey(getLeverageKey(chainId), 2);
  const [isLeverageEnabled, setIsLeverageEnabled] = useLocalStorageSerializeKey(getLeverageEnabledKey(chainId), true);
  const [keepLeverage, setKeepLeverage] = useLocalStorageSerializeKey(getKeepLeverageKey(chainId), true);

  const avaialbleTradeModes = useMemo(() => {
    if (!tradeType) {
      return [];
    }

    return {
      [TradeType.Long]: [TradeMode.Market, TradeMode.Limit, TradeMode.Trigger],
      [TradeType.Short]: [TradeMode.Market, TradeMode.Limit, TradeMode.Trigger],
      [TradeType.Swap]: [TradeMode.Market, TradeMode.Limit],
    }[tradeType];
  }, [tradeType]);

  const tradeFlags = useMemo(() => createTradeFlags(tradeType!, tradeMode!), [tradeType, tradeMode]);
  const { isSwap } = tradeFlags;

  const fromTokenAddress = storedOptions?.tokens.fromTokenAddress;
  const fromToken = getByKey(tokensData, fromTokenAddress);

  const toTokenAddress = tradeFlags.isSwap
    ? storedOptions?.tokens.swapToTokenAddress
    : storedOptions?.tokens.indexTokenAddress;
  const toToken = getByKey(tokensData, toTokenAddress);

  const isWrapOrUnwrap = Boolean(
    isSwap && fromToken && toToken && (getIsWrap(fromToken, toToken) || getIsUnwrap(fromToken, toToken))
  );

  const marketAddress = toTokenAddress
    ? storedOptions?.markets[toTokenAddress]?.[tradeFlags.isLong ? "long" : "short"]
    : undefined;
  const marketInfo = getByKey(marketsInfoData, marketAddress);

  const collateralAddress = storedOptions?.collateralAddress;
  const collateralToken = getByKey(tokensData, collateralAddress);

  const setTradeType = useCallback(
    (tradeType: TradeType) => {
      setStoredOptions((oldState) => {
        return {
          ...oldState!,
          tradeType,
        };
      });
    },
    [setStoredOptions]
  );

  const setTradeMode = useCallback(
    (tradeMode: TradeMode) => {
      setStoredOptions((oldState) => {
        return {
          ...oldState!,
          tradeMode,
        };
      });
    },
    [setStoredOptions]
  );

  const setFromTokenAddress = useCallback(
    (tokenAddress?: string) => {
      setStoredOptions((oldState) => {
        return {
          ...oldState!,
          tokens: {
            ...oldState!.tokens,
            fromTokenAddress: tokenAddress,
          },
        };
      });
    },
    [setStoredOptions]
  );

  const setToTokenAddress = useCallback(
    function setToTokenAddressCallback(tokenAddress: string, marketTokenAddress?: string, tradeType?: TradeType) {
      setStoredOptions(setToTokenAddressUpdaterBuilder(tradeType, tokenAddress, marketTokenAddress));
    },
    [setStoredOptions]
  );

  const switchTokenAddresses = useCallback(() => {
    setStoredOptions((oldState) => {
      const isSwap = oldState?.tradeType === TradeType.Swap;
      const fromTokenAddress = oldState?.tokens.fromTokenAddress;
      const toTokenAddress = oldState?.tokens.indexTokenAddress;

      if (isSwap) {
        return {
          ...oldState!,
          tokens: {
            ...oldState!.tokens,
            fromTokenAddress: toTokenAddress,
            swapToTokenAddress: fromTokenAddress,
          },
        };
      }

      return {
        ...oldState!,
        tokens: {
          ...oldState!.tokens,
          fromTokenAddress: toTokenAddress,
          indexTokenAddress: fromTokenAddress,
        },
      };
    });
  }, [setStoredOptions]);

  const setMarketAddress = useCallback(
    (marketAddress?: string) => {
      setStoredOptions((oldState) => {
        const toTokenAddress = oldState?.tokens.indexTokenAddress;
        const isLong = oldState?.tradeType === TradeType.Long;
        if (!toTokenAddress) {
          return oldState;
        }

        return {
          ...oldState!,
          markets: {
            ...oldState!.markets,
            [toTokenAddress]: {
              ...oldState!.markets[toTokenAddress],
              [isLong ? "long" : "short"]: marketAddress,
            },
          },
        };
      });
    },
    [setStoredOptions]
  );

  const setActivePosition = useCallback(
    (position?: PositionInfo, tradeMode?: TradeMode) => {
      setStoredOptions((oldState) => {
        if (!position) {
          return oldState;
        }

        const newState: StoredTradeOptions = JSON.parse(JSON.stringify(oldState));

        if (tradeMode) {
          newState.tradeMode = tradeMode;
        }

        newState.tradeType = position.isLong ? TradeType.Long : TradeType.Short;
        const newIndexTokenAddress = position.indexToken.address;
        newState.tokens.indexTokenAddress = newIndexTokenAddress;
        newState.markets[newIndexTokenAddress] = newState.markets[newIndexTokenAddress] || {};
        newState.markets[newIndexTokenAddress][position.isLong ? "long" : "short"] = position.marketAddress;
        newState.collateralAddress = position.collateralTokenAddress;

        return newState;
      });
    },
    [setStoredOptions]
  );

  const setCollateralAddress = useCallback(
    function setCollateralAddressCallback(tokenAddress?: string) {
      setStoredOptions(function setCollateralAddressUpdater(
        oldState: StoredTradeOptions | undefined
      ): StoredTradeOptions {
        return {
          ...oldState!,
          collateralAddress: tokenAddress,
        };
      });
    },
    [setStoredOptions]
  );

  const setTradeConfig = useCallback(
    function setTradeConfigCallback(tradeOptions: TradeOptions) {
      setStoredOptions(function setTradeConfigUpdater(oldState: StoredTradeOptions | undefined) {
        const { tradeType, tradeMode, fromTokenAddress, toTokenAddress, marketAddress, collateralAddress } =
          tradeOptions;

        if (!oldState) {
          return oldState;
        }

        const newState = JSON.parse(JSON.stringify(oldState)) as StoredTradeOptions;

        if (tradeType) {
          newState.tradeType = tradeType;
        }

        if (tradeMode) {
          newState.tradeMode = tradeMode;
        }

        if (fromTokenAddress) {
          newState.tokens.fromTokenAddress = fromTokenAddress;
        }

        if (toTokenAddress) {
          if (tradeType === TradeType.Swap) {
            newState.tokens.swapToTokenAddress = toTokenAddress;
          } else {
            newState.tokens.indexTokenAddress = toTokenAddress;
            if (toTokenAddress && marketAddress) {
              newState.markets[toTokenAddress] = newState.markets[toTokenAddress] || {};
              if (tradeType === TradeType.Long) {
                newState.markets[toTokenAddress].long = marketAddress;
              } else if (tradeType === TradeType.Short) {
                newState.markets[toTokenAddress].short = marketAddress;
              }
            }
          }
        }

        if (collateralAddress) {
          newState.collateralAddress = collateralAddress;
        }

        return newState;
      });
    },
    [setStoredOptions]
  );

  useEffect(
    function updateTradeMode() {
      if (tradeType && tradeMode && !avaialbleTradeModes.includes(tradeMode)) {
        setTradeMode(avaialbleTradeModes[0]);
      }
    },
    [tradeType, tradeMode, avaialbleTradeModes, setTradeMode]
  );

  useEffect(
    function updateSwapTokens() {
      if (!isSwap || !swapTokens.length) {
        return;
      }

      const needFromUpdate = !swapTokens.find((t) => t.address === fromTokenAddress);

      if (needFromUpdate) {
        setFromTokenAddress(swapTokens[0].address);
      }

      const needToUpdate = !swapTokens.find((t) => t.address === toTokenAddress);

      if (needToUpdate) {
        setToTokenAddress(swapTokens[0].address);
      }
    },
    [fromTokenAddress, isSwap, setFromTokenAddress, setToTokenAddress, swapTokens, toTokenAddress]
  );

  return {
    tradeType: tradeType!,
    tradeMode: tradeMode!,
    isWrapOrUnwrap,
    fromTokenAddress,
    toTokenAddress,
    marketAddress,
    marketInfo,
    collateralAddress,
    collateralToken,
    availableTokensOptions,
    avaialbleTradeModes,
    setActivePosition,
    setFromTokenAddress,
    setToTokenAddress,
    setMarketAddress,
    setCollateralAddress,
    setTradeType,
    setTradeMode,
    switchTokenAddresses,
    setTradeConfig,
    fromTokenInputValue,
    setFromTokenInputValue,
    toTokenInputValue,
    setToTokenInputValue,
    stage,
    setStage,
    focusedInput,
    setFocusedInput,
    fixedTriggerThresholdType,
    setFixedTriggerThresholdType,
    fixedTriggerOrderType,
    setFixedTriggerOrderType,
    defaultTriggerAcceptablePriceImpactBps,
    setDefaultTriggerAcceptablePriceImpactBps,
    selectedTriggerAcceptablePriceImpactBps,
    setSelectedAcceptablePriceImpactBps: setSelectedTriggerAcceptablePriceImpactBps,
    closeSizeInputValue,
    setCloseSizeInputValue,
    triggerPriceInputValue,
    setTriggerPriceInputValue,
    triggerRatioInputValue,
    setTriggerRatioInputValue,
    leverageOption,
    setLeverageOption,
    isLeverageEnabled,
    setIsLeverageEnabled,
    keepLeverage,
    setKeepLeverage,
  };
}

function setToTokenAddressUpdaterBuilder(
  tradeType: TradeType | undefined,
  tokenAddress: string,
  marketTokenAddress: string | undefined
): (oldState: StoredTradeOptions | undefined) => StoredTradeOptions {
  return function setToTokenAddressUpdater(oldState: StoredTradeOptions | undefined): StoredTradeOptions {
    const isSwap = oldState?.tradeType === TradeType.Swap;
    const newState = JSON.parse(JSON.stringify(oldState)) as StoredTradeOptions;
    if (!newState) {
      return newState;
    }

    if (tradeType) {
      newState.tradeType = tradeType;
    }

    if (isSwap) {
      newState.tokens.swapToTokenAddress = tokenAddress;
    } else {
      newState.tokens.indexTokenAddress = tokenAddress;
      if (tokenAddress && marketTokenAddress) {
        newState.markets[tokenAddress] = newState.markets[tokenAddress] || {};
        if (newState.tradeType === TradeType.Long) {
          newState.markets[tokenAddress].long = marketTokenAddress;
        } else if (newState.tradeType === TradeType.Short) {
          newState.markets[tokenAddress].short = marketTokenAddress;
        }
      }
    }

    return newState;
  };
}
