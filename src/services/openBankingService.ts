import { prisma } from "../utils/prismaClient";
import { categorizeMerchant } from "./categorizationService";

interface ProviderTransaction {
  id: string;
  amount: number;
  merchant: string | null;
  description?: string | null;
  date: string;
  currency?: string;
}

export async function syncMockTransactions(userId: string, accountId: string) {
  const now = new Date();
  const txs: ProviderTransaction[] = [
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
    const existing = await prisma.transaction.findFirst({
      where: { externalId: t.id, userId },
    });
    if (existing) continue;

    const categoryName = categorizeMerchant(t.merchant);

    const category =
      (await prisma.category.findUnique({ where: { name: categoryName } })) ||
      (await prisma.category.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName, displayName: categoryName },
      }));

    await prisma.transaction.create({
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

