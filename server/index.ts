import { startCollector } from './collector.ts';

const collector = startCollector();

function stop(): void {
  collector.server.close(() => {
    process.exitCode = 0;
  });
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
