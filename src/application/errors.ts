/**
 * Application Layer Errors
 *
 * Defines domain-friendly application error classes for workflow failures,
 * entity lookups, invariant violations, and constraint checks.
 * Completely decoupled from React and database engines (Dexie/IndexedDB).
 */

export class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApplicationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends ApplicationError {
  readonly validationErrors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Validation failed:\n - ${errors.join('\n - ')}`);
    this.name = 'ValidationError';
    this.validationErrors = errors;
  }
}

export class NotFoundError extends ApplicationError {
  readonly entityType: string;
  readonly entityId: string;

  constructor(entityType: string, entityId: string) {
    super(`${entityType} with ID "${entityId}" not found.`);
    this.name = 'NotFoundError';
    this.entityType = entityType;
    this.entityId = entityId;
  }
}

export class DependencyConstraintError extends ApplicationError {
  constructor(message: string) {
    super(message);
    this.name = 'DependencyConstraintError';
  }
}

export class ActiveSessionConflictError extends ApplicationError {
  readonly activeTaskId?: string;

  constructor(message: string, activeTaskId?: string) {
    super(message);
    this.name = 'ActiveSessionConflictError';
    this.activeTaskId = activeTaskId;
  }
}

export class InvalidStateTransitionError extends ApplicationError {
  readonly currentStatus: string;
  readonly targetStatus: string;

  constructor(currentStatus: string, targetStatus: string, message?: string) {
    super(message ?? `Cannot transition from "${currentStatus}" to "${targetStatus}".`);
    this.name = 'InvalidStateTransitionError';
    this.currentStatus = currentStatus;
    this.targetStatus = targetStatus;
  }
}

export class ApplicationPersistenceError extends ApplicationError {
  readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'ApplicationPersistenceError';
    this.originalError = originalError;
  }
}

/**
 * Normalizes lower-level repository errors into uniform ApplicationError instances.
 */
export function handleRepositoryError(
  err: unknown,
  fallbackMessage = 'An unexpected persistence error occurred.'
): never {
  if (err instanceof ApplicationError) {
    throw err;
  }

  if (err && typeof err === 'object') {
    const e = err as {
      name?: string;
      message?: string;
      validationErrors?: readonly string[];
      activeTaskId?: string;
    };

    if (e.name === 'DomainValidationError' && Array.isArray(e.validationErrors)) {
      throw new ValidationError(e.validationErrors);
    }
    if (e.name === 'EntityNotFoundError') {
      throw new NotFoundError('Entity', e.message ?? 'Unknown');
    }
    if (e.name === 'DependencyConstraintError') {
      throw new DependencyConstraintError(e.message ?? 'Dependency constraint violated.');
    }
    if (e.name === 'ActiveSessionConflictError') {
      throw new ActiveSessionConflictError(
        e.message ?? 'An active session is already running.',
        e.activeTaskId
      );
    }
  }

  const message = err instanceof Error ? err.message : fallbackMessage;
  throw new ApplicationPersistenceError(message, err);
}
