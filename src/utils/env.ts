const NODE_ENV = process.env.NODE_ENV || "development";

export const isProduction = NODE_ENV === "production";

type EnvKeys = {
  prod: string;
  dev?: string;
  fallback?: string;
};

export function envValue({ prod, dev, fallback }: EnvKeys): string | undefined {
  if (!isProduction && dev && process.env[dev]) return process.env[dev];
  return process.env[prod] ?? (dev ? process.env[dev] : undefined) ?? fallback;
}
