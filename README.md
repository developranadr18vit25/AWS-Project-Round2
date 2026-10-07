# Event Registration API

A MERN-stack REST API for an event platform where users register for events and admins manage them. The project demonstrates three things a serious API must get right: **real data relationships**, **role-based authorization**, and **concurrency safety**.

---

## Overview

The system models three entities:

- **User** — identity, hashed password, and role (`admin` or `member`)
- **Event** — title, capacity, date, and a live `registeredCount`
- **Registration** — a join record linking a user to an event

A registration is the many-to-many bridge between users and events. It is enforced at the database level with foreign key references and a **unique compound index** on `(user, event)`, so the database itself refuses to store duplicate registrations. No flattening, no duplicated fields, no trusting the application layer to keep data clean.

---

## Problem Statement

Two problems appear the moment an event platform has limited seats:

1. **Who is allowed to do what?** A normal user must not be able to create or delete events — only admins should. This requires role-based access control, not just "is the user logged in."
2. **What happens when 100 people click Register in the same second for an event with 5 seats?** A naive check-then-write reads the count, checks capacity, then writes — and under concurrency two requests can both read the same old count and both write, pushing the event over capacity. This is a **race condition**, and it silently corrupts data.

This project solves both at the database layer.

---

## Authentication

The API does not issue one long-lived JWT. If that token leaks, an attacker has access until it expires — potentially days.

Instead, the system uses **two tokens**:

- **Access token** — expires in 15 minutes, sent on every request as `Authorization: Bearer <token>`.
- **Refresh token** — lasts 7 days, used only at `/api/auth/refresh` to get a new access token.

When the access token expires, the client exchanges the refresh token for a fresh one. The blast radius of a leaked access token is therefore 15 minutes, not a week. Passwords are hashed with bcrypt before storage.

---

## Role-Based Access Control

Authentication answers *who you are*; authorization answers *what you may do*. They are separate concerns, and this project treats them separately.

The JWT payload carries the user's role. A middleware called `auth(requiredRole)` verifies the token and, when a role is specified, checks that the user matches. A mismatch returns `403 Forbidden` — distinct from `401 Unauthorized`, which means the token itself is missing or invalid.

Concretely:

- Anyone can browse events.
- Only `admin` can create or delete events.
- Only `admin` can list who has registered for an event.
- Any authenticated user can register for an event.

This is role-based access, not login-based.

---

## Concurrency Safety

This is the most important part of the project.

### The Race

Consider an event with capacity 2. Three users hit Register at the same millisecond. A naive implementation:

```js
const event = await Event.findById(id);
if (event.registeredCount < event.capacity) {
  event.registeredCount += 1;
  await event.save();
}
