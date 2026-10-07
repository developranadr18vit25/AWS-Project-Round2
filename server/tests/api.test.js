const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.ACCESS_SECRET = 'test_access';
process.env.REFRESH_SECRET = 'test_refresh';
process.env.ACCESS_EXPIRES = '15m';
process.env.REFRESH_EXPIRES = '7d';

let mongo;
let app;

beforeAll(async () => {

  mongo = await MongoMemoryServer.create();

  await mongoose.connect(mongo.getUri());

  app = require('../app');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

async function makeUser(role) {
  const email = `${role}-${Date.now()}-${Math.random()}@test.com`;

  const reg = await request(app).post('/api/auth/register')

    .send({ name: role, email, password: 'pass1234', role });

  const login = await request(app).post('/api/auth/login').send({ email, password: 'pass1234' });

  return { id: reg.body.id, access: login.body.accessToken, refresh: login.body.refreshToken };
}

test('admin can create event, member cannot', async () => {

  const admin = await makeUser('admin');
  const member = await makeUser('member');


  const ok = await request(app).post('/api/events')
    .set('Authorization', `Bearer ${admin.access}`)

    .send({ title: 'Conf', capacity: 2, date: new Date() });

  expect(ok.status).toBe(201);

  const forbidden = await request(app).post('/api/events')

    .set('Authorization', `Bearer ${member.access}`)
    .send({ title: 'Nope', capacity: 2, date: new Date() });

  expect(forbidden.status).toBe(403);
});

test('concurrency: 5 parallel registrations on capacity=2 → only 2 succeed', async () => {

  const admin = await makeUser('admin');

  const users = await Promise.all([1,2,3,4,5].map(() => makeUser('member')));

  const ev = await request(app).post('/api/events')
    .set('Authorization', `Bearer ${admin.access}`)
    .send({ title: 'Limited', capacity: 2, date: new Date() });


  const results = await Promise.all(users.map(u =>
    request(app).post(`/api/registrations/${ev.body._id}`)
      .set('Authorization', `Bearer ${u.access}`)
  ));

  const successes = results.filter(r => r.status === 201).length;

  expect(successes).toBe(2);
});


test('refresh flow issues new access token', async () => {

  const u = await makeUser('member');
  const r = await request(app).post('/api/auth/refresh').send({ refreshToken: u.refresh });
  expect(r.status).toBe(200);

  expect(r.body.accessToken).toBeDefined();

});

test('pagination returns correct page size', async () => {

  const admin = await makeUser('admin');

  for (let i = 0; i < 7; i++) {

    await request(app).post('/api/events')
      .set('Authorization', `Bearer ${admin.access}`)
      .send({ title: `E${i}`, capacity: 5, date: new Date() });

  }
  const res = await request(app).get('/api/events?page=1&limit=3');

  expect(res.body.items.length).toBe(3);
  expect(res.body.total).toBeGreaterThanOrEqual(7);
});

test('short-lived access token rejects tampered token', async () => {
    
  const res = await request(app).get('/api/events')
    .set('Authorization', 'Bearer notarealtoken');
  expect(res.status).toBe(401);
});