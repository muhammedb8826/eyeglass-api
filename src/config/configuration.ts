import { getDatabaseConfig } from './database.config';

export default () => ({
  database: getDatabaseConfig(),
});
