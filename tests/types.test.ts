/**
 * Tests for types and utility functions
 */

import { StatusCode, StatusUtils, SpayaError, SpayaConnectionError } from '../src/types';

describe('StatusUtils', () => {
  describe('isFinished', () => {
    it('should return true for finished statuses', () => {
      expect(StatusUtils.isFinished(StatusCode.DONE)).toBe(true);
      expect(StatusUtils.isFinished(StatusCode.ERROR)).toBe(true);
      expect(StatusUtils.isFinished(StatusCode.INVALID_SMILES)).toBe(true);
      expect(StatusUtils.isFinished(StatusCode.QUOTA_EXCEEDED)).toBe(true);
    });

    it('should return false for non-finished statuses', () => {
      expect(StatusUtils.isFinished(StatusCode.NOT_SENT)).toBe(false);
      expect(StatusUtils.isFinished(StatusCode.SUBMITTED)).toBe(false);
      expect(StatusUtils.isFinished(StatusCode.RUNNING)).toBe(false);
      expect(StatusUtils.isFinished(StatusCode.QUEUE_FULL)).toBe(false);
      expect(StatusUtils.isFinished(StatusCode.KILLED)).toBe(false);
    });
  });

  describe('canBeRetried', () => {
    it('should return true for retryable statuses', () => {
      expect(StatusUtils.canBeRetried(StatusCode.ERROR)).toBe(true);
      expect(StatusUtils.canBeRetried(StatusCode.QUOTA_EXCEEDED)).toBe(true);
    });

    it('should return false for non-retryable statuses', () => {
      expect(StatusUtils.canBeRetried(StatusCode.DONE)).toBe(false);
      expect(StatusUtils.canBeRetried(StatusCode.INVALID_SMILES)).toBe(false);
      expect(StatusUtils.canBeRetried(StatusCode.RUNNING)).toBe(false);
    });
  });

  describe('needsRetry', () => {
    it('should return true for statuses that need retry', () => {
      expect(StatusUtils.needsRetry(StatusCode.QUEUE_FULL)).toBe(true);
    });

    it('should return false for statuses that do not need retry', () => {
      expect(StatusUtils.needsRetry(StatusCode.DONE)).toBe(false);
      expect(StatusUtils.needsRetry(StatusCode.ERROR)).toBe(false);
      expect(StatusUtils.needsRetry(StatusCode.RUNNING)).toBe(false);
    });
  });
});

describe('Error classes', () => {
  describe('SpayaError', () => {
    it('should create error with message', () => {
      const message = 'Test error message';
      const error = new SpayaError(message);
      
      expect(error.message).toBe(message);
      expect(error.name).toBe('SpayaError');
      expect(error.statusCode).toBeUndefined();
    });

    it('should create error with message and status code', () => {
      const message = 'Test error message';
      const statusCode = 400;
      const error = new SpayaError(message, statusCode);
      
      expect(error.message).toBe(message);
      expect(error.name).toBe('SpayaError');
      expect(error.statusCode).toBe(statusCode);
    });
  });

  describe('SpayaConnectionError', () => {
    it('should create connection error', () => {
      const message = 'Connection failed';
      const error = new SpayaConnectionError(message);
      
      expect(error.message).toBe(message);
      expect(error.name).toBe('SpayaConnectionError');
      expect(error).toBeInstanceOf(SpayaError);
    });
  });
});
