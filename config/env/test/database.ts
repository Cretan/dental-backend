import path from 'path';

export default ({ env }) => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: env('DATABASE_FILENAME', ':memory:'),
    },
    useNullAsDefault: true,
  },
});
