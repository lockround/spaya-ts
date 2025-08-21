/**
 * @fileoverview Authorization classes for Spaya API access
 */

/**
 * Abstract base class for authorization
 */
export abstract class Authorization {
  /**
   * Get authorization headers for requests
   * @returns Headers object with authorization information
   */
  abstract headers(): Record<string, string>;
}

/**
 * Custom Bearer Token Authorization with configurable header key
 */
export class CustomBearerToken extends Authorization {
  private readonly token: string;
  private readonly headerKey: string;

  /**
   * Create a custom bearer token authorization
   * @param token - The bearer token
   * @param headerKey - The header key to use (defaults to 'X-Iktos-Authorization')
   */
  constructor(token: string, headerKey: string = 'X-Iktos-Authorization') {
    super();
    this.token = token;
    this.headerKey = headerKey;
  }

  /**
   * Get authorization headers
   * @returns Headers object with custom authorization header
   */
  headers(): Record<string, string> {
    return {
      [this.headerKey]: `Bearer ${this.token}`
    };
  }
}

/**
 * Standard Bearer Token Authorization using 'Authorization' header
 */
export class BearerToken extends CustomBearerToken {
  /**
   * Create a standard bearer token authorization
   * @param token - The bearer token
   */
  constructor(token: string) {
    super(token, 'Authorization');
  }
}
