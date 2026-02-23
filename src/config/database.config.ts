import * as dotenv from 'dotenv';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { DatabaseConfig } from './config.interface';
import * as entities from '../entities';

// Load env so config works in standalone scripts (seed, typeorm CLI)
dotenv.config();

/** Single source of truth - reads from process.env */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'mame',
    database: process.env.DB_DATABASE || 'eyeglass',
    synchronize: process.env.DB_SYNCHRONIZE !== 'false',
    logging: process.env.DB_LOGGING === 'true' ? true : ['error'],
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
    ssl: process.env.DB_SSL === 'true',
  };
}

/** Build TypeORM DataSource options from config + overrides */
export function getDataSourceOptions(
  overrides: Partial<PostgresConnectionOptions> = {},
): PostgresConnectionOptions {
  const config = getDatabaseConfig();
  return {
    type: 'postgres',
    host: config.host ?? 'localhost',
    port: config.port ?? 5432,
    username: config.username ?? 'postgres',
    password: config.password ?? '',
    database: config.database ?? 'eyeglass',
    synchronize: config.synchronize ?? true,
    logging: config.logging ?? ['error'],
    extra: { max: config.poolSize ?? 10 },
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    ...overrides,
  };
}

/** NestJS TypeORM config - used by AppModule */
export const createDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const config = configService.get<DatabaseConfig>('database') ?? getDatabaseConfig();
  return {
    type: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    entities: Object.values(entities),
    synchronize: config.synchronize ?? true,
    logging: config.logging ?? ['error'],
    extra: { max: config.poolSize || 10 },
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  };
};
