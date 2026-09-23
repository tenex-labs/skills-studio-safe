import { startSkillStudioServer } from '../backend/api/server.ts';

const studio = startSkillStudioServer();

function stop(): void {
  void studio.close().then(() => {
    process.exitCode = 0;
  });
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
