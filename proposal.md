# Project Proposal

## 1. Motivation

Small events often do not have a clear-cut and efficient way of dealing with registration, participant information, and on-site check-in. In student clubs, campus events, and small community activities, these tasks often fall into spreadsheets, chat tools, and manual checking, leaving information scattered and making the check-in process less efficient during the day of the event. Specifically, when attendance grows beyond a small group, it becomes less clear to organizers who have registered and whether they have already checked in. In practice, this leads to duplicated or outdated attendee lists, slow on-site verification, and confusion when multiple staff members check in attendees in parallel. A centralized system can act as a single source of truth for registration and check-in status, reducing bottlenecks and making attendance tracking auditable.

The main users of this project are the organizers who create events, staff members who check-in people, and attendees who need to register and look up event information for themselves. We think this project is worth pursuing because it is based on a real-world use case, and is part of the full-stack focus of this course so lends itself to frontend-backend integration, database design, file storage, access control, and real-time updates.

Many small events still rely on simple manual methods for registration and check-in. These methods may work for smaller events, but they become less clear and less efficient as more people are involved. Because of this we want to build a more complete and direct system for these workflows. Our expected outcome is a clearer workflow that reduces manual coordination effort and shortens on-site check-in bottlenecks, especially when attendance scales beyond a small group.

---

## 2. Objective and Key Features

### Objective

The goal of this project is to develop a complete full-stack event registration and check-in system for small events. The application should cover the workflow for creating an event, signing up for it, managing who has checked in at the event, and showing who has or has not already checked in. It should also improve usability by clarifying access control while making usable status updates more accessible to both organizers and attendees.

This is not just a general event info web page. We want a complete system with frontend, backend, database, and file storage parts, so that it works both as a useful application, and as a course project that satisfies the main technical requirements.

### Technical Implementation Approach

This augments the functionality created in the course assignments. The project will involve a separated frontend and backend. The frontend will be a separate application created using React and TypeScript. The backend will be built using Express.js and TypeScript, and the two parts will communicate over RESTful APIs (with simple API documentation for the main routes). We went with a separated design both because it follows best practices, but also because it clearer delineates responsibilities and makes for easier testing, and also because the course assignments have concentrated on having progressively introduced backend and frontend development in separate assignments.

### Database Schema and Relationships

PostgreSQL will store users, events, registrations, and check-in records. At a minimum, we will maintain: (1) Users with a role field (Organizer/Staff/Attendee), (2) Events owned by an organizer, (3) Registrations that link an attendee to an event with a uniqueness constraint on (eventId, attendeeId), and (4) Check-in records that reference a registration (or ticket) and prevent duplicate check-ins via a uniqueness constraint (e.g., unique(registrationId)). This keeps the workflow consistent and queryable while remaining feasible within the course timeline.

### File Storage Requirements

Users will be able to upload event cover images and other event-related files to cloud object storage. The backend will provide an upload mechanism (e.g., generating a pre-signed upload URL), and file metadata (object key, MIME type, size, and owning event) will be stored in the relational database. The system will also support basic file download by issuing a download link (e.g., pre-signed GET) so that uploaded assets can be retrieved reliably during grading and demos.

### User Interface and Experience Design

We will focus on the primary pages of the application - landing, login, event list, event detail, registration, check-in, organizer & staff management pages. Overall, we want the UI to be clear, contextually relevant, responsive.

### Planned Advanced Features

At this stage, we plan to implement the following two advanced features.

#### 1. User Authentication and Authorization

User registration/login, protected routes (organizers, staff, attendees will have different permissions), and backend enforces permissions via protected API routes and access checks. Planning to implement authentication as a session or JWT based (HTTP only cookie for token/session) and enforce role based access control via Express middleware that guards protected routes.

#### 2. Real-Time Functionality

The system will support live check-in status updates for organizer dashboards without a page refresh. Concretely, when a staff member checks in an attendee, the backend will emit an event (e.g., checkin:created) over Socket.IO/WebSocket to clients viewing that event’s dashboard. The payload will include the event identifier, updated attendance counts, and a small recent check-in feed (e.g., last N check-ins) so organizers can monitor progress in real time while keeping scope controlled.

If there is time available, a possible further extension could be File Handling and Processing: e.g. processing ticket files or QR-based ticket records after registration, to go beyond simple upload and display of files.

### How These Features Fulfill the Course Requirements

This project satisfies the course requirements because it includes a complete frontend and backend structure, a relational database, cloud-based file storage, and clear frontend-backend data interaction. It also includes at least two advanced features, namely authentication and authorization, and real-time updates. During the presentation, we will demonstrate the end-to-end flow (event creation → registration → check-in) and show real-time dashboard updates triggered by staff check-ins, along with a cloud-stored event asset that can be uploaded and downloaded.

### Scope and Feasibility

In terms of scope, we want to keep it at a reasonable course-project level. We are not trying to build a full commercial ticketing platform. Instead, we will focus on the core workflows of creating events, registering for them, checking them in, and updating them on their check-in status. This scope is more realistic for a four-person team and more suitable for the course timeline.

---

## 3. Tentative Plan

Our timeline is four weeks to complete the project. We plan to implement the core event workflow first, then the real-time integration, and then the deployment and final testing. The work will be split out so team members can work on different parts of the system concurrently.

### Role Assignments

Member A – Shuanglong Zhu  
Member B – Nairui Tian  
Member C – Cunming Liu  
Member D – Ruogu Xu  


### Week 1

Member A
- Implement core frontend structure (landing page, login page skeleton)
- Connect frontend to authentication endpoints

Member B
- Design database schema (users, events, registrations, check-in)
- Create and run migrations
- Implement basic event and registration APIs

Member C
- Implement authentication logic (register/login)
- Set up session or JWT handling
- Create protected route middleware

Member D
- Prepare development environment and project setup
- Assist backend API testing
- Research deployment and real-time infrastructure setup


### Week 2

Member A
- Implement event list and event detail pages
- Build registration interface
- Integrate frontend with backend APIs

Member B
- Finalize event creation and registration APIs
- Implement check-in API endpoints
- Enforce database constraints

Member C
- Integrate authentication with frontend
- Implement role-based access control (Organizer/Staff/Attendee)
- Verify protected routes and permissions

Member D
- Begin implementing real-time infrastructure (Socket.IO/WebSocket setup)
- Assist integration testing


### Week 3

Member A
- Refine UI/UX interactions
- Implement check-in dashboard interface

Member B
- Support backend event emission for real-time updates
- Ensure data consistency during check-in operations

Member C
- Add authorization validation for real-time events
- Assist debugging authentication and integration issues

Member D
- Implement real-time check-in updates
- Emit and receive check-in events
- Connect organizer dashboard to real-time updates


### Week 4

Member A
- Final UI polishing
- Prepare demo interface and presentation flow

Member B
- Final database testing and backend bug fixes
- Optimize query performance if needed

Member C
- Perform security testing (authentication & authorization validation)
- Ensure protected routes behave correctly

Member D
- Finalize deployment configuration
- Perform end-to-end system testing
- Assist documentation and video preparation

### Possible Risks and Mitigations

We intend to complete authentication and the main event workflow as soon as practical so that at least the minimum viable system is stable before any real-time features are added. There should be little difference between the final version and this proposal’s contents.

---

## 4. Initial Independent Reasoning (Before Using AI)

Early in the project, based on the course lectures and the project handout, we made the following decisions.

### Architecture Choices

**Tech Stack**  
We settled on using a separated frontend and backend structure (React + Express) as we were gradually introduced to backend APIs and how to integrate with them in this format, and it felt like a consistent extension of previous exercises we’ve done as well as a clear separation of responsibilities. Also wanting structured relationships between users, events, registrations, and check-in records, we chose a relational database (PostgreSQL).

**Data & State Design**
We expect the server to be the source of truth for registrations and check-in status. On the frontend, we plan to use query-based state (e.g., TanStack Query) for caching and invalidation of server data, so that pages remain consistent after mutations (register/check-in) without requiring complex global state.

### Anticipated Challenges

We thought integrating authentication flow and role-based access control would be tricky, especially in terms of coordinating frontend state with what the backend thinks is happening. We thought it would also be slightly tricky to integrate real-time updates.

### Risk Reduction

To minimize risk, we chose to implement real-time functionality only for users’ check-in status rather than synchronizing their entire state. 

## Feature selection and tradeoffs 
We intentionally avoid payment processing and other high-risk integrations to keep scope feasible. We also limit real-time updates to check-in events (rather than synchronizing all client state) to reduce complexity while still demonstrating meaningful real-time functionality.

### Early Development

We would first implement a user registration/login flow and some rudimentary event workflows. To reduce integration risk, we will define shared DTOs and route contracts early so the frontend and backend can develop in parallel with fewer mismatches. Once we were able to run the core of the system locally, we would add the real-time updates and another round of deployment-related configuration.

---

## 5. AI Assistance Disclosure

In our project at first we independently decided on the overall architecture, such as the separated frontend–backend structure, the choice of PostgreSQL, RESTful APIs and role-based access control; most of these are things we learnt from the course in lectures and assignments.

AI was not used to determine the core architecture or feature scope.

We only consulted AI in limited contexts when visibility into what was going to be covered in future lectures let us ask about the feasibility of details not covered in our lectures, like possible approaches for WebSocket-based updates or token-based authentication mechanisms. We would evaluate the suggestions ourselves and simplify them where possible to keep them feasible relative to what we could realistically implement over the course of the project.

All major design and scope decisions were made independently by our team.
