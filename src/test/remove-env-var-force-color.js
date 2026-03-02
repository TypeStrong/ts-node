// Eagerly load `expect` so it picks up the env var
require('expect');
delete process.env.FORCE_COLOR;
