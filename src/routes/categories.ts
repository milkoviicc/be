import { Router } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { prisma } from "../utils/prismaClient";

const router = Router();

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: List spending categories
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories
 *       401:
 *         description: Unauthorized
 */
router.get("/", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });
  return res.json(categories);
});

export const categoriesRouter = router;

