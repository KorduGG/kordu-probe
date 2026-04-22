export class InvalidTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTargetError";
  }
}

export class ProbeTimeoutError extends Error {
  constructor(message = "The TCP connection attempt timed out.") {
    super(message);
    this.name = "ProbeTimeoutError";
  }
}

export class OperationTimeoutError extends Error {
  constructor(message = "The operation timed out.") {
    super(message);
    this.name = "OperationTimeoutError";
  }
}

export class ProbeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProbeConfigurationError";
  }
}
