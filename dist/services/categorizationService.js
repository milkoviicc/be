"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categorizeMerchant = categorizeMerchant;
const keywordMap = [
    { keywords: ["ubereats", "deliveroo", "doordash", "just eat"], category: "food" },
    { keywords: ["mcdonald", "burger king", "kfc", "starbucks"], category: "food" },
    { keywords: ["tesco", "aldi", "lidl", "carrefour", "whole foods"], category: "groceries" },
    { keywords: ["rent", "landlord", "apartment", "property management"], category: "rent" },
    { keywords: ["netflix", "spotify", "hulu", "disney", "prime video"], category: "subscriptions" },
    { keywords: ["shell", "esso", "bp", "chevron", "petrol"], category: "gas" },
    { keywords: ["uber", "lyft", "taxi", "metro", "train"], category: "transport" },
    { keywords: ["amazon", "zalando", "etsy", "ikea"], category: "shopping" },
    { keywords: ["electric", "water", "gas bill", "utility"], category: "utilities" },
    { keywords: ["cinema", "movie", "theatre", "concert"], category: "entertainment" },
];
function categorizeMerchant(merchantRaw) {
    if (!merchantRaw) {
        return "other";
    }
    const merchant = merchantRaw.toLowerCase();
    for (const entry of keywordMap) {
        if (entry.keywords.some((k) => merchant.includes(k))) {
            return entry.category;
        }
    }
    return "other";
}
