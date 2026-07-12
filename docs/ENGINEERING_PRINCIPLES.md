# Engineering Constitution & Principles

## 1. Do Not Break Working Features
Before writing code or editing files, trace dependencies. Never refactor or clean up code unless it is required to complete the task.

## 2. Database-First Design
The database is the single source of truth. Schema structures, constraints, and triggers should enforce data validity rather than relying on application code.

## 3. Configuration Over Hardcoding
Keep configurations database-driven. For example, prompt templates must be loaded from database tables rather than written as hardcoded text.

## 4. Mobile-First Premium Experience
Showroom designs must be responsive, look premium, and load quickly. Optimize asset delivery using Cloudinary transformations and lazy loading.

## 5. Deployment Stability First
Keep the project in a buildable state. Test modifications locally before committing and pushing code.
