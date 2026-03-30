"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesRouter = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../utils/prismaClient");
const router = (0, express_1.Router)();
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
router.get("/", async (req, res) => {
    if (!req.userId)
        return res.status(401).json({ error: "Unauthorized" });
    const categories = await prismaClient_1.prisma.category.findMany({
        orderBy: { name: "asc" },
    });
    return res.json(categories);
});
exports.categoriesRouter = router;
