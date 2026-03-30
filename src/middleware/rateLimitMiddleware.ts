import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const REDIS_URL = process.env.REDIS_URL;
const redis = REDIS_URL ? new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }) : null;
let redisReady = false;

function keyFrom(req: Request, suffix: string) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${ip}:${suffix}`;
}

async function checkRedisLimit(key: string, maxRequests: number, windowMs: number) {
  if (!redis) return null;
  try {
    if (!redisReady) {
      await redis.connect();
      redisReady = true;
    }
    const ttlSec = Math.ceil(windowMs / 1000);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSec);
    }
    const ttl = await redis.ttl(key);
    return { count, retryAfterSec: ttl > 0 ? ttl : ttlSec };
  } catch {
    return null;
  }
}

export function rateLimitAuth(maxRequests: number, windowMs: number, suffix: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyFrom(req, suffix);
    const redisKey = `rate:${suffix}:${key}`;
    const redisResult = await checkRedisLimit(redisKey, maxRequests, windowMs);
    if (redisResult) {
      if (redisResult.count > maxRequests) {
        res.setHeader("Retry-After", String(redisResult.retryAfterSec));
        return res.status(429).json({ error: "Too many requests, please try again later." });
      }
      return next();
    }

    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      const retryAfterSec = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: "Too many requests, please try again later." });
    }

    current.count += 1;
    buckets.set(key, current);
    return next();
  };
}
