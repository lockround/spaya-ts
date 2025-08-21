/**
 * Tests for authorization classes
 */

import { BearerToken, CustomBearerToken } from '../src/authorization';

describe('Authorization', () => {
  describe('BearerToken', () => {
    it('should create proper authorization header', () => {
      const token = 'test-token-123';
      const auth = new BearerToken(token);
      
      const headers = auth.headers();
      
      expect(headers).toEqual({
        'Authorization': `Bearer ${token}`
      });
    });
  });

  describe('CustomBearerToken', () => {
    it('should create custom authorization header', () => {
      const token = 'test-token-456';
      const headerKey = 'X-Custom-Auth';
      const auth = new CustomBearerToken(token, headerKey);
      
      const headers = auth.headers();
      
      expect(headers).toEqual({
        [headerKey]: `Bearer ${token}`
      });
    });

    it('should use default header key when not specified', () => {
      const token = 'test-token-789';
      const auth = new CustomBearerToken(token);
      
      const headers = auth.headers();
      
      expect(headers).toEqual({
        'X-Iktos-Authorization': `Bearer ${token}`
      });
    });
  });
});
