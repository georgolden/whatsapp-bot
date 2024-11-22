const required = (name: string): string => {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  };
  
  export const config = {
    DATABASE_URL: required('DATABASE_URL'),
    REDIS_URL: required('REDIS_URL'),
  } as const;
