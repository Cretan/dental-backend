/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/', '.tmp', '.cache', '/dist/'],
  testMatch: ['**/tests/**/*.test.{js,ts}'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/admin/**',
    '!src/plugins/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  // Avoid interference between test suites
  forceExit: true,
  detectOpenHandles: true,
  // Integration tests require fresh module resolution (Strapi config loading)
  cache: false,
};
