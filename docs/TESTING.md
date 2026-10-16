# Testing Checklist (Phase 14)

Run these manually with Postman (see postman_collection.json) or in the UI, in this order.

## Student flow
- [ ] Register (role assigned as "student" automatically, no selector shown)
- [ ] Login
- [ ] Browse internships, apply to one
- [ ] Try applying to the same internship again → expect 409 "already applied"
- [ ] Check "My Applications" shows status "Applied"
- [ ] Join a community channel, send a message, confirm it appears in real time in a second browser tab logged in as another student
- [ ] Receive a notification when staff changes application status

## Staff flow
- [ ] Login with a staff account created with `node createStaffUser.js` (no public registration)
- [ ] Create / edit / delete an internship, confirm `orgLabel` always reads "Offered by Xentwin Technology" and cannot be changed
- [ ] View applications, change a status, confirm the student receives a notification
- [ ] Post an announcement, confirm every student gets a notification
- [ ] View a student's profile and resume link

## Authorization checks (critical)
- [ ] Student token calling `POST /api/internships` → expect 403
- [ ] Student token calling `GET /api/users/students` → expect 403
- [ ] No token calling any protected route → expect 401
- [ ] Expired/invalid token → expect 401

## Data integrity
- [ ] Duplicate workshop/event/hackathon registration → expect 409
- [ ] Resume upload over 5MB → expect 400
- [ ] Resume upload of a .exe or .zip → expect 400
