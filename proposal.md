# Project Proposal

## 1. Motivation

Small events often do not have a clear-cut and efficient way of dealing with registration, participant information, and on-site check-in. In student clubs, campus events, and small community activities, these tasks often fall into spreadsheets, chat tools, and manual checking, leaving information scattered and making the check-in process less efficient during the day of the event. Specifically, when attendance grows beyond a small group, it becomes less clear to organizers who have registered and whether they have already checked in.

The main users of this project are the organizers who create events, staff members who check-in people, and attendees who need to register and look up event information for themselves. We think this project is worth pursuing because it is based on a real-world use case, and is part of the full-stack focus of this course so lends itself to frontend-backend integration, database design, file storage, access control, and real-time updates.

Many small events still rely on simple manual methods for registration and check-in. These methods may work for smaller events, but they become less clear and less efficient as more people are involved. Because of this we want to build a more complete and direct system for these workflows.

---

## 2. Objective and Key Features

### Objective

The goal of this project is to develop a complete full-stack event registration and check-in system for small events. The application should cover the workflow for creating an event, signing up for it, managing who has checked in at the event, and showing who has or has not already checked in. It should also improve usability by clarifying access control while making usable status updates more accessible to both organizers and attendees.

This is not just a general event info web page. We want a complete system with frontend, backend, database, and file storage parts, so that it works both as a useful application, and as a course project that satisfies the main technical requirements.

### Technical Implementation Approach

This augments the functionality created in the course assignments. The project will involve a separated frontend and backend. The frontend will be a separate application created using React and TypeScript. The backend will be built using Express.js and TypeScript, and the two parts will communicate over RESTful APIs (with simple API documentation for the main routes). We went with a separated design both because it follows best practices, but also because it clearer delineates responsibilities and makes for easier testing, and also because the course assignments have concentrated on having progressively introduced backend and frontend development in separate assignments.

### Database Schema and Relationships

PostgreSQL will be used to store users, events, registrations and check-in records. One organizer can have many events, and one event can have many registrations that are linked to check-in status.

### File Storage Requirements

Users should be able to upload event cover images, or other event related files. These files should be uploaded to cloud storage and associated with events in the database.

### User Interface and Experience Design

We will focus on the primary pages of the application - landing, login, event list, event detail, registration, check-in, organizer & staff management pages. Overall, we want the UI to be clear, contextually relevant, responsive.

### Planned Advanced Features

At this stage, we plan to implement the following two advanced features.

#### 1. User Authentication and Authorization

User registration/login, protected routes (organizers, staff, attendees will have different permissions), and backend enforces permissions via protected API routes and access checks. Planning to implement authentication as a session or JWT based (HTTP only cookie for token/session) and enforce role based access control via Express middleware that guards protected routes.

#### 2. Real-Time Functionality

The system will support live check-in status updates. For example, after one of the staff members checks in, the updated number of people who have checked in will be available on the organizer’s page onwards without them needing to refresh the page. We will do this for check-in updates so that the scope doesn’t get out of hand. We will do this using a backend driven push or update mechanism (eg. WebSocket) to push the check-in updates to the appropriate organizer views.

If there is time available, a possible further extension could be File Handling and Processing: e.g. processing ticket files or QR-based ticket records after registration, to go beyond simple upload and display of files.

### How These Features Fulfill the Course Requirements

This project satisfies the course requirements because it includes a complete frontend and backend structure, a relational database, cloud-based file storage, and clear frontend-backend data interaction. It also includes at least two advanced features, namely authentication and authorization, and real-time updates.

### Scope and Feasibility

In terms of scope, we want to keep it at a reasonable course-project level. We are not trying to build a full commercial ticketing platform. Instead, we will focus on the core workflows of creating events, registering for them, checking them in, and updating them on their check-in status. This scope is more realistic for a four-person team and more suitable for the course timeline.

---

## 3. Tentative Plan

Our timeline is four weeks to complete the project. We plan to implement the core event workflow first, then the real-time integration, and then the deployment and final testing. The work will be split out so team members can work on different parts of the system concurrently.

### Role Assignments

**Member A**  
Main pages (event list, event detail, registration, check-in interface)  
Frontend and backend integration  

**Member B**  
Database schema and migrations  
Backend APIs (events, registrations, check-in)  

**Member C**  
Authentication and authorization  
Protected routes and permissions  

**Member D**  
Real-time updates feature  
Testing and deployment  

### Week 1

Authenticate a user  
Create & migrate database  
Set up registration & login  
Event and registration APIs  

### Week 2

Event creation and registration workflow  
Integrate frontend & backend  
Integrate authentication and permission-based access control  
Verify and ensure core features are fully operational locally  

### Week 3

Add and refine real-time check-in notifications  
Improve frontend interaction and flow  
Set up temporary cloud storage  
Begin configuring deployment  

### Week 4

Finish deployment configuration  
Test system and fix bugs  
Test notifications and access control  
Prepare documentation and submit videos  

### Possible Risks and Mitigations

We intend to complete authentication and the main event workflow as soon as practical so that at least the minimum viable system is stable before any real-time features are added. There should be little difference between the final version and this proposal’s contents.

---

## 4. Initial Independent Reasoning (Before Using AI)

Early in the project, based on the course lectures and the project handout, we made the following decisions.

### Architecture Choices

**Tech Stack**  
We settled on using a separated frontend and backend structure (React + Express) as we were gradually introduced to backend APIs and how to integrate with them in this format, and it felt like a consistent extension of previous exercises we’ve done as well as a clear separation of responsibilities. Also wanting structured relationships between users, events, registrations, and check-in records, we chose a relational database (PostgreSQL).

### Anticipated Challenges

We thought integrating authentication flow and role-based access control would be tricky, especially in terms of coordinating frontend state with what the backend thinks is happening. We thought it would also be slightly tricky to integrate real-time updates.

### Risk Reduction

To minimize risk, we chose to implement real-time functionality only for users’ check-in status rather than synchronizing their entire state.

### Early Development

We would first implement a user registration/login flow and some rudimentary event workflows. Once we were able to run the core of the system locally, we would add the real-time updates and another round of deployment-related configuration.

---

## 5. AI Assistance Disclosure

In our project at first we independently decided on the overall architecture, such as the separated frontend–backend structure, the choice of PostgreSQL, RESTful APIs and role-based access control; most of these are things we learnt from the course in lectures and assignments.

AI was not used to determine the core architecture or feature scope.

We only consulted AI in limited contexts when visibility into what was going to be covered in future lectures let us ask about the feasibility of details not covered in our lectures, like possible approaches for WebSocket-based updates or token-based authentication mechanisms. We would evaluate the suggestions ourselves and simplify them where possible to keep them feasible relative to what we could realistically implement over the course of the project.

All major design and scope decisions were made independently by our team.
