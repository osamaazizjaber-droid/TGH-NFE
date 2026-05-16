# NFE Management Platform

A modern full-stack web platform for managing a Non-Formal Education (NFE) program.

## Features
- **Public Student Registration:** Mobile-friendly form for students to enroll, generating unique Student Codes.
- **Teacher Assessment Portal:** Interface for teachers to record pre/post-test results, with automatic improvement metrics calculation.
- **Admin Dashboard:** Comprehensive dashboard with overall statistics, interactive charts, and CRUD interfaces for managing Students and Teachers. Includes Excel Import/Export for students.
- **Modern UI:** Built with a custom Vanilla CSS design system featuring glassmorphism, responsive design, dark mode, and RTL support.

## Tech Stack
- **Frontend:** React (Vite)
- **Styling:** Custom Vanilla CSS Design System
- **Routing:** React Router v6
- **Backend/Database:** Supabase
- **Charts:** Recharts
- **Icons:** Lucide React
- **Excel Export/Import:** xlsx

## Setup Instructions

### 1. Supabase Configuration
The application relies on Supabase for Auth and Database. 
In your Supabase project, execute the SQL schema to create the required tables:
\`\`\`sql
-- Run this in your Supabase SQL Editor
CREATE TABLE students (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_code TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  second_name TEXT NOT NULL,
  third_name TEXT NOT NULL,
  fourth_name TEXT NOT NULL,
  gender TEXT,
  phone_number TEXT UNIQUE NOT NULL,
  class_grade TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE teachers (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE assessments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id),
  subject_id TEXT NOT NULL,
  max_degree NUMERIC NOT NULL,
  pre_test_result NUMERIC NOT NULL,
  post_test_result NUMERIC NOT NULL,
  improvement_percentage NUMERIC,
  difference_score NUMERIC,
  performance_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

### 2. Local Setup
1. Run \`npm install\` to install dependencies.
2. The Supabase connection is pre-configured in \`src/lib/supabase.js\`.
3. Run \`npm run dev\` to start the Vite development server.

### 3. Authentication Configuration
Since teacher accounts are managed by Admins, Admins should use the Supabase Auth dashboard (or an implemented Invite flow) to create user accounts for teachers, and insert their IDs into the \`teachers\` table. Admins must also insert their own User ID into the \`admins\` table to access the Admin Dashboard.
