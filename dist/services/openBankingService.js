"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncMockTransactions = syncMockTransactions;
const prismaClient_1 = require("../utils/prismaClient");
const categorizationService_1 = require("./categorizationService");
async function syncMockTransactions(userId, accountId) {
    const now = new Date();
    const txs = [
        {
            id: `mock-${accountId}-1`,
            amount: -24.5,
            merchant: "Tesco",
            description: "Groceries",
            date: now.toISOString(),
        },
        {
            id: `mock-${accountId}-2`,
            amount: -12.9,
            merchant: "Uber",
            description: "Ride home",
            date: now.toISOString(),
        },
    ];
    for (const t of txs) {
        const existing = await prismaClient_1.prisma.transaction.findFirst({
            where: { externalId: t.id, userId },
        });
        if (existing)
            continue;
        const categoryName = (0, categorizationService_1.categorizeMerchant)(t.merchant);
        const category = (await prismaClient_1.prisma.category.findUnique({ where: { name: categoryName } })) ||
            (await prismaClient_1.prisma.category.upsert({
                where: { name: categoryName },
                update: {},
                create: { name: categoryName, displayName: categoryName },
            }));
        await prismaClient_1.prisma.transaction.create({
            data: {
                userId,
                accountId,
                externalId: t.id,
                amount: t.amount,
                merchant: t.merchant ?? undefined,
                description: t.description ?? undefined,
                date: new Date(t.date),
                currency: t.currency ?? "EUR",
                categoryId: category.id,
            },
        });
    }
}
