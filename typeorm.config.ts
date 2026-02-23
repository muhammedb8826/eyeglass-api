import { DataSource } from 'typeorm';
import { getDataSourceOptions } from './src/config/database.config';

export const AppDataSource = new DataSource(
  getDataSourceOptions({
    entities: ['dist/src/entities/*.js'],
  }),
);
