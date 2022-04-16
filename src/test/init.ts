// Initialize runtime for tests
delete process.env.FORCE_COLOR;
process.chdir(require('./helpers').TEST_DIR);
