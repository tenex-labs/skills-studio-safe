// The routes map these errors to HTTP statuses. Any other error becomes a generic 500 so internal
// details never reach the browser.

export class StudioValidationError extends Error {}

export class StudioNotFoundError extends Error {}

export class RevisionConflictError extends Error {
  constructor(readonly currentRevision: string) {
    super('The skill changed since this draft was created.');
  }
}
