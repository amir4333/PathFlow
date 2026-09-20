/**
 * Persistence & Data Layer Errors
 *
 * Provides a structured error hierarchy for repository operations,
 * invariant violations, and relational constraints.
 */

export class PersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistenceError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DomainValidationError extends PersistenceError {
  readonly validationErrors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Domain validation failed:\n - ${errors.join('\n - ')}`);
    this.name = 'DomainValidationError';
    this.validationErrors = errors;
  }
}

export class EntityNotFoundError extends PersistenceError {
  constructor(message: string) {
    super(message);
    this.name = 'EntityNotFoundError';
  }
}

export class DependencyConstraintError extends PersistenceError {
  constructor(message: string) {
    super(message);
    this.name = 'DependencyConstraintError';
  }
}

export class ActiveSessionConflictError extends PersistenceError {
  readonly activeTaskId?: string;

  constructor(message: string, activeTaskId?: string) {
    super(message);
    this.name = 'ActiveSessionConflictError';
    this.activeTaskId = activeTaskId;
  }
}

