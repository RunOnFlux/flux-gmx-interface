import { t } from "@lingui/macro";
import cx from "classnames";
import { useCallback, useMemo, useState } from "react";
import { BiChevronDown } from "react-icons/bi";

import { getNormalizedTokenSymbol } from "config/tokens";

import { useLocalizedMap } from "lib/i18n";
import { getByKey } from "lib/objects";

import SearchInput from "components/SearchInput/SearchInput";
import { useGlvGmMarketsWithComposition } from "components/Synthetics/MarketStats/hooks/useMarketGlvGmMarketsCompositions";
import Tab from "components/Tab/Tab";
import TokenIcon from "components/TokenIcon/TokenIcon";

import { MarketInfo, getMarketIndexName, getMarketPoolName } from "domain/synthetics/markets";
import { GlvMarketInfo } from "domain/synthetics/markets/useGlvMarkets";
import { convertToUsd } from "domain/synthetics/tokens";
import {
  gmTokensFavoritesTabOptionLabels,
  gmTokensFavoritesTabOptions,
} from "domain/synthetics/tokens/useGmTokensFavorites";

import Modal from "../Modal/Modal";
import { PoolListItem } from "./PoolListItem";
import { CommonPoolSelectorProps, MarketOption } from "./types";

import "./MarketSelector.scss";

type Props = Omit<CommonPoolSelectorProps, "onSelectMarket"> & {
  isDeposit: boolean;
  glvMarketInfo: GlvMarketInfo;
  onSelectGmMarket?: (market: MarketInfo) => void;
  disablePoolSelector?: boolean;
};

export function GmPoolsSelectorForGlvMarket({
  className,
  isDeposit,
  label,
  isSideMenu,
  marketTokensData,
  selectedMarketAddress,
  showBalances,
  onSelectGmMarket,
  getMarketState,
  showAllPools = false,
  showIndexIcon = false,
  favoriteTokens,
  glvMarketInfo,
  setFavoriteTokens,
  tab,
  setTab,
  disablePoolSelector,
}: Props) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  const markets = useGlvGmMarketsWithComposition(isDeposit, glvMarketInfo?.marketTokenAddress);

  const localizedTabOptionLabels = useLocalizedMap(gmTokensFavoritesTabOptionLabels);

  const marketsOptions: MarketOption[] = useMemo(() => {
    const allMarkets =
      markets
        .map((market) => {
          const gmMarketInfo = market.pool;

          if (!gmMarketInfo) {
            return null;
          }

          const gmMarketInfoInGlv = glvMarketInfo?.markets.find((m) => {
            return m.address === gmMarketInfo.marketTokenAddress;
          });

          const indexName = getMarketIndexName(gmMarketInfo);
          const marketToken = getByKey(marketTokensData, gmMarketInfo.marketTokenAddress);
          const gmBalance = gmMarketInfoInGlv?.gmBalance;
          const gmBalanceUsd = convertToUsd(marketToken?.balance, marketToken?.decimals, marketToken?.prices.minPrice);
          const state = getMarketState?.(gmMarketInfo);

          return {
            indexName,
            poolName: indexName,
            name: gmMarketInfo.name,
            marketInfo: gmMarketInfo,
            balance: gmBalance ?? 0n,
            balanceUsd: gmBalanceUsd ?? 0n,
            state,
          };
        })
        .filter(Boolean as unknown as FilterOutFalsy) ?? [];

    const marketsWithBalance: MarketOption[] = [];
    const marketsWithoutBalance: MarketOption[] = [];

    for (const market of allMarkets) {
      if (market.balance > 0) {
        marketsWithBalance.push(market);
      } else {
        marketsWithoutBalance.push(market);
      }
    }

    const sortedMarketsWithBalance = marketsWithBalance.sort((a, b) => {
      return (b.balanceUsd ?? 0n) > (a.balanceUsd ?? 0n) ? 1 : -1;
    });

    return [...sortedMarketsWithBalance, ...marketsWithoutBalance];
  }, [getMarketState, marketTokensData, markets, glvMarketInfo]);

  const selectedPool = useMemo(
    () => marketsOptions.find((option) => option.marketInfo.marketTokenAddress === selectedMarketAddress),
    [marketsOptions, selectedMarketAddress]
  );

  const marketInfo = selectedPool?.marketInfo;

  const filteredOptions = useMemo(() => {
    const lowercaseSearchKeyword = searchKeyword.toLowerCase();
    return marketsOptions.filter((option) => {
      const name = option.name.toLowerCase();
      const textSearchMatch = name.includes(lowercaseSearchKeyword);

      const favoriteMatch = tab === "favorites" ? favoriteTokens?.includes(option.marketInfo.marketTokenAddress) : true;

      return textSearchMatch && favoriteMatch;
    });
  }, [favoriteTokens, marketsOptions, searchKeyword, tab]);

  const onSelectGmPool = useCallback(
    function onSelectOption(option: MarketOption) {
      onSelectGmMarket?.(option.marketInfo);
      setIsModalVisible(false);
    },
    [onSelectGmMarket, setIsModalVisible]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (filteredOptions.length > 0) {
          onSelectGmPool(filteredOptions[0]);
        }
      }
    },
    [onSelectGmPool, filteredOptions]
  );

  const handleFavoriteClick = useCallback(
    (address: string): void => {
      if (favoriteTokens.includes(address)) {
        setFavoriteTokens(favoriteTokens.filter((token) => token !== address));
      } else {
        setFavoriteTokens([...favoriteTokens, address]);
      }
    },
    [favoriteTokens, setFavoriteTokens]
  );

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchKeyword(e.target.value);
  }, []);

  function displayPoolLabel(marketInfo: MarketInfo | undefined) {
    if (!marketInfo) return "...";

    return (
      <div
        className={cx("TokenSelector-box", {
          "pointer-events-none": disablePoolSelector,
        })}
        onClick={!disablePoolSelector ? () => setIsModalVisible(true) : undefined}
      >
        {getMarketIndexName(marketInfo)} [{getMarketPoolName(marketInfo)}]
        {!disablePoolSelector && <BiChevronDown className="TokenSelector-caret" />}
      </div>
    );
  }

  return (
    <div className={cx("TokenSelector", "MarketSelector", { "side-menu": isSideMenu }, className)}>
      <Modal
        isVisible={isModalVisible}
        setIsVisible={setIsModalVisible}
        label={label}
        headerContent={
          <SearchInput
            className="mt-15"
            value={searchKeyword}
            setValue={handleSearch}
            placeholder={t`Search Pool`}
            onKeyDown={handleKeyDown}
          />
        }
      >
        <Tab
          className="mb-10"
          options={gmTokensFavoritesTabOptions}
          optionLabels={localizedTabOptionLabels}
          type="inline"
          option={tab}
          setOption={setTab}
        />

        <div className="TokenSelector-tokens">
          {filteredOptions.map((option, marketIndex) => (
            <PoolListItem
              key={option.marketInfo.marketTokenAddress}
              {...option}
              marketToken={getByKey(marketTokensData, option.marketInfo.marketTokenAddress)}
              isFavorite={favoriteTokens?.includes(option.marketInfo.marketTokenAddress)}
              isInFirstHalf={marketIndex < filteredOptions.length / 2}
              showAllPools={showAllPools}
              showBalances={showBalances}
              onFavoriteClick={handleFavoriteClick}
              onSelectOption={onSelectGmPool}
            />
          ))}
        </div>
      </Modal>

      {marketInfo && (
        <div className="inline-flex items-center">
          {showIndexIcon && (
            <TokenIcon
              className="mr-5"
              symbol={
                marketInfo.isSpotOnly
                  ? getNormalizedTokenSymbol(marketInfo.longToken.symbol) +
                    getNormalizedTokenSymbol(marketInfo.shortToken.symbol)
                  : marketInfo?.indexToken.symbol
              }
              importSize={40}
              displaySize={20}
            />
          )}
          {displayPoolLabel(marketInfo)}
        </div>
      )}
    </div>
  );
}
