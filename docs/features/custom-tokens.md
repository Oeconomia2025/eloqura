# Custom Token Import

Import any ERC-20 token by pasting its contract address.

## Overview

The swap interface supports importing custom tokens that aren't in the default token list. Users paste an ERC-20 contract address and the app reads the token's metadata directly from the blockchain.

## How It Works

1. User pastes a contract address into the token selector search field
2. Frontend queries the contract on-chain:
   - `name()` → display name
   - `symbol()` → ticker symbol
   - `decimals()` → decimal places
3. Token is validated and displayed with a warning badge: **"Unverified token — trade at your own risk"**
4. Imported tokens are saved to localStorage (`eloqura-custom-tokens`)
5. Custom tokens persist across sessions

## Storage

```
localStorage key: eloqura-custom-tokens
Format: JSON array of { address, name, symbol, decimals }
```

{% hint style="warning" %}
**No Scam Protection:** Custom token import does not validate token legitimacy. Users are responsible for verifying the contract address before trading.
{% endhint %}
