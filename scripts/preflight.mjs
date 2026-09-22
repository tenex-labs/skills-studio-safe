#!/usr/bin/env node

import { runDoctor } from './doctor.mjs';

runDoctor()
  .then(({ ok }) => {
    if (!ok) process.exitCode = 1;
  })
  .catch(() => {
    console.error('✗ Preflight diagnostics failed unexpectedly.');
    process.exitCode = 1;
  });
