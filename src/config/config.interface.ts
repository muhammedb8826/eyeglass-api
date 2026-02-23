export interface DatabaseConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  synchronize?: boolean;
  logging?: boolean | ('query' | 'error' | 'schema')[];
  migrations?: boolean;
  migrationsRun?: boolean;
  poolSize?: number;
  ssl?: boolean;
}