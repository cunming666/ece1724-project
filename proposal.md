# Project Proposal
## 1. Motivation

Small events often do not have a very clear or efficient way to handle registration, participant information, and on-site check-in. In student clubs, campus events, and small community activities, these tasks are often managed with spreadsheets, chat tools, or manual checking. This can make information scattered and make the check-in process less convenient during the event.

The main users of this project are organizers, staff members, and attendees. Organizers need a way to create and manage events, staff members need a simple way to complete check-in, and attendees need to register and view their event information. We think this project is worth doing because it is based on a practical use case and also fits the full-stack focus of this course. It can include frontend-backend integration, database design, file storage, access control, and real-time updates in a natural way.

Right now, many small events still use simple manual methods for registration and check-in. These methods may work when the event is small, but they become less clear and less efficient when more people are involved. Because of this, we want to build a more complete and direct system for these workflows.

---

## 2. Objective and Key Features

### Objective

The objective of this project is to build a full-stack event registration and check-in system for small events. The system will support event creation, registration, check-in management, and check-in status display. It will also improve usability through clearer access control and real-time status updates.

This project is not just a simple event information website. We want it to be a complete system with frontend, backend, database, and file storage parts, so that it works both as a practical application and as a course project that meets the main technical requirements.

---

### Technical Implementation Approach

The system will use a separate frontend and backend structure. The frontend will be built with React and TypeScript, while the backend will use Express.js and TypeScript. The two parts will communicate through RESTful APIs, with basic API documentation for the main routes.

---

### Database Schema and Relationships

We plan to use PostgreSQL to store users, events, registrations, and check-in records. One organizer can manage multiple events, and one event can have multiple registrations connected to check-in status.

---

### File Storage Requirements

The project will support uploads of event cover images or related event files. These files will be stored in cloud storage and linked to the corresponding event records in the database.

---

### User Interface and Experience Design

The interface will focus on the main pages of the system, including login, event list, event detail, registration, check-in, and organizer/staff management pages. We want the layout to stay clear, practical, and responsive.

---

### Planned Advanced Features

At this stage, we plan to implement the following two advanced features.

**1. User Authentication and Authorization**  
The system will support user registration, login, protected routes, and role-based access control. Different users such as organizers, staff members, and attendees will have different permissions, and the backend will enforce these permissions through protected API routes and access checks.

**2. Real-Time Functionality**  
The system will support live updates of check-in status. For example, after a staff member completes a check-in, the organizer’s page can show the updated attendance count or status without requiring a manual refresh. We plan to keep this part focused on check-in updates only, so the scope stays reasonable.

If time permits, we may also consider one optional extension: **File Handling and Processing**, such as generating ticket files or QR-based ticket records after registration, so that file-related functionality goes beyond basic upload and display.

---

### How These Features Fulfill the Course Requirements

This project satisfies the course requirements because it includes a complete frontend and backend structure, a relational database, cloud-based file storage, and clear frontend-backend data interaction. It also includes at least two advanced features, namely authentication and authorization, and real-time updates.

---

### Scope and Feasibility

In terms of scope, we want to keep the system within a realistic course-project scale. We are not trying to build a full commercial ticketing platform. Instead, we will focus on the core workflows of event creation, registration, check-in, and check-in status updates. This scope is more realistic for a four-person team and more suitable for the course timeline.
