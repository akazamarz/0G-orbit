export class OrbitError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "OrbitError";
  }
}

export class ExternalApiError extends OrbitError {
  constructor(message: string, cause?: unknown) {
    super(message, "EXTERNAL_API", cause);
    this.name = "ExternalApiError";
  }
}

export class StorageError extends OrbitError {
  constructor(message: string, cause?: unknown) {
    super(message, "STORAGE", cause);
    this.name = "StorageError";
  }
}

export class AuthError extends OrbitError {
  constructor(message: string, cause?: unknown) {
    super(message, "AUTH", cause);
    this.name = "AuthError";
  }
}
