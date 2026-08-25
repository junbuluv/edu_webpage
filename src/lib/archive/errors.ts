export class ArchiveServiceUnavailableError extends Error {
  constructor(operation: string) {
    super(`Archive service unavailable during ${operation}.`);
    this.name = 'ArchiveServiceUnavailableError';
  }
}

export class QuizUnavailableError extends Error {
  constructor() {
    super('Quiz service is temporarily unavailable.');
    this.name = 'QuizUnavailableError';
  }
}

export class QuizInvalidError extends Error {
  constructor() {
    super('Stored quiz data is invalid.');
    this.name = 'QuizInvalidError';
  }
}
