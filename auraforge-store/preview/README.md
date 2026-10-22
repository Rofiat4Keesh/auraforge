# Storefront preview

`storefront-preview.html` is a single-file, clickable preview of the AuraForge shop. It has all 119 catalog products (94 with their images), search, department filters, quick view, cart, and a demo checkout (Delivery → Payment → Confirmation).

**To open it:** download the file and double-click it. It opens in your web browser. It needs an internet connection to load its fonts and layout library.

**What it is not:** the payment step is a demo. No card details are collected and no money moves. Real payments happen in the actual store (`npm run dev`), where the Pay button opens Paystack's secure window. See README section 5 in the main project to test with Paystack test keys.

The preview is rebuilt separately from the store, so editing products in `src/data/` does not change this file.
