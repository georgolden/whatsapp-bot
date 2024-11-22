import dotenv from 'dotenv';

// Load from project root where the application starts
dotenv.config();

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

interface Config {
  DATABASE_URL: string;
  REDIS_URL: string;
}

export const config: Config = {
  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: required('REDIS_URL'),
} as const;
