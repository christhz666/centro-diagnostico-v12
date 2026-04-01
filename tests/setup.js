// Setup file for Jest tests
const mongoose = require('mongoose');

// Close DB connections after all tests
afterAll(async () => {
  await mongoose.connection.close();
});

// Global test utilities
global.testUtils = {
  createMockUser: () => ({
    _id: '507f1f77bcf86cd799439011',
    email: 'test@test.com',
    nombre: 'Test',
    apellido: 'User',
    role: 'admin'
  }),
  
  createMockToken: () => 'mock-jwt-token',
  
  mockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides
  }),
  
  mockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
  }
};
