import mapValues from "lodash/mapValues";
import { ARBITRUM, AVALANCHE, BSС_MAINNET } from "./chains";
import { isDevelopment } from "config/env";

export const ENABLED_MARKETS = {
  [ARBITRUM]: [
    "0x47c031236e19d024b42f8AE6780E44A573170703", // BTC/USD [BTC-USDC]
    "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336", // ETH/USD [WETH-USDC]
    "0x6853EA96FF216fAb11D2d930CE3C508556A4bdc4", // DOGE/USD [WETH-USDC]
    "0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9", // SOL/USD [SOL-USDC]
    "0xD9535bB5f58A1a75032416F2dFe7880C30575a41", // LTC/USD [WETH-USDC]
    "0xc7Abb2C5f3BF3CEB389dF0Eecd6120D451170B50", // UNI/USD [UNI-USDC]
    "0x7f1fa204bb700853D36994DA19F830b6Ad18455C", // LINK/USD [LINK-USDC]
    "0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407", // ARB/USD [ARB-USDC]
    "0x0CCB4fAa6f1F1B30911619f1184082aB4E25813c", // XRP/USD [WETH-USDC]
    "0x2d340912Aa47e33c90Efb078e69E70EFe2B34b9B", // BNB/USD [BNB-USDC]
    "0x63Dc80EE90F26363B3FCD609007CC9e14c8991BE", // NEAR [WETH-USDC]
    "0x248C35760068cE009a13076D573ed3497A47bCD4", // ATOM [WETH-USDC]
    "0x1CbBa6346F110c8A5ea739ef2d1eb182990e4EB2", // AAVE [AAVE-USDC]
    "0x9C2433dFD71096C435Be9465220BB2B189375eA7", // SWAP-ONLY [USDC-USDC.e]
    "0xB686BcB112660343E6d15BDb65297e110C8311c4", // SWAP-ONLY [USDC-USDT]
    "0xe2fEDb9e6139a182B98e7C2688ccFa3e9A53c665", // SWAP-ONLY [USDC-DAI]
  ],
  [AVALANCHE]: [
    "0xFb02132333A79C8B5Bd0b64E3AbccA5f7fAf2937", // BTC/USD [BTC-USDC]
    "0xB7e69749E3d2EDd90ea59A4932EFEa2D41E245d7", // ETH/USD [ETH-USDC]
    "0x8970B527E84aA17a33d38b65e9a5Ab5817FC0027", // DOGE/USD [WAVAX-USDC]
    "0xd2eFd1eA687CD78c41ac262B3Bc9B53889ff1F70", // SOL/USD [SOL-USDC]
    "0xA74586743249243D3b77335E15FE768bA8E1Ec5A", // LTC/USD [WAVAX-USDC]
    "0x913C1F46b48b3eD35E7dc3Cf754d4ae8499F31CF", // AVAX/USD [WAVAX-USDC]
    "0xD1cf931fa12783c1dd5AbB77a0706c27CF352f25", // XRP/USD [WAVAX-USDC]
    "0xf3652Eba45DC761e7ADd4091627d5Cda21F61613", // SWAP-ONLY [USDC-USDT.e]
    "0x297e71A931C5825867E8Fb937Ae5cda9891C2E99", // SWAP-ONLY [USDC-USDC.e]
    "0xA7b768d6a1f746fd5a513D440DF2970ff099B0fc", // SWAP-ONLY [USDT-USDT.e]
    "0xDf8c9BD26e7C1A331902758Eb013548B2D22ab3b", // SWAP-ONLY [USDC-DAI.e]
  ],
  [BSС_MAINNET]: [],
};

export const ENABLED_MARKETS_INDEX = mapValues<Record<number, string[]>>(ENABLED_MARKETS, (markets) =>
  markets.reduce((acc, market) => ({ ...acc, [market]: true }), {})
);

export function isMarketEnabled(chainId: number, marketAddress: string) {
  if (isDevelopment()) return true;

  return ENABLED_MARKETS_INDEX[chainId]?.[marketAddress] ?? false;
}
