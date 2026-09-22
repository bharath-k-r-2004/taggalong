# TagAlong - IIM Rohtak Ride Sharing Platform

**Find Your Ride. Trust Your Community.**

A modern, mobile-first ride-sharing application built exclusively for IIM Rohtak students. Connect with fellow students traveling on the same routes and split costs transparently.

## 🚀 Features

- **Google OAuth Authentication** - Sign in with your IIM Rohtak Gmail
- **Automatic Batch Extraction** - Batch automatically extracted from email (PGP17, IPM04, etc.)
- **Smart Ride Matching** - Occupancy-first algorithm matches you with best available rides
- **Real-time Chat** - Communicate with co-travellers instantly
- **Cost Splitting** - Transparent cost breakdown and payment tracking
- **Live Trip Tracking** - See real-time location during trips
- **Driver Profiles** - View driver ratings and vehicle details
- **Travel History** - Track your completed and upcoming trips

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Shadcn/UI
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Google OAuth + Supabase Auth
- **Real-time**: Supabase Realtime
- **Maps**: Google Maps API
- **Hosting**: Vercel

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Git
- GitHub account
- Supabase account (you have this)
- Google OAuth credentials (we'll set up)

## 🔧 Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/bharath-k-r-2004/taggalong.git
cd taggalong
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_SUPABASE_URL=https://tjuyeqorhhrppislcmlf.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

Get your Supabase anon key:
1. Go to https://supabase.com → Your Project
2. Settings → API → `public (anon)` key
3. Copy and paste in `.env.local`

### 4. Set Up Supabase Database

Run these SQL queries in Supabase SQL Editor:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  course VARCHAR(10),
  batch VARCHAR(2),
  full_batch VARCHAR(10),
  phone_number VARCHAR(15),
  profile_picture_url TEXT,
  verified BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Rides table
CREATE TABLE rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id),
  origin VARCHAR(100),
  destination VARCHAR(100),
  date DATE,
  departure_time TIME,
  total_cost DECIMAL(10, 2),
  max_seats INTEGER,
  current_participants INTEGER DEFAULT 1,
  driver_name VARCHAR(255),
  driver_phone VARCHAR(15),
  vehicle_type VARCHAR(50),
  vehicle_number VARCHAR(20),
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ride participants table
CREATE TABLE ride_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES rides(id),
  user_id UUID REFERENCES users(id),
  status VARCHAR(20),
  contribution_amount DECIMAL(10, 2),
  joined_at TIMESTAMP DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES rides(id),
  user_id UUID REFERENCES users(id),
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Drivers table
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  added_by_user_id UUID REFERENCES users(id),
  name VARCHAR(255),
  phone VARCHAR(15),
  vehicle_type VARCHAR(50),
  vehicle_number VARCHAR(20),
  seats INTEGER,
  rating DECIMAL(3, 2),
  total_trips INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📱 Using the App

### Registration
1. Click "Sign in with Google"
2. Select your IIM Rohtak Gmail account
3. Your batch is automatically extracted from your email
4. Done! You're in

### Finding a Ride
1. Go to Home
2. Enter destination, date, and time
3. Choose time flexibility
4. See matching rides sorted by occupancy
5. Click ride to view details
6. Click "Join Ride" to request

### Posting a Ride
1. Click "I have a driver"
2. Fill in ride details
3. Enter driver information
4. Set total cost and seats
5. Post!

### Chat & Communication
1. Join a ride
2. Go to ride details
3. Click "Message Group"
4. Chat with co-travellers

## 🚀 Deployment to Vercel

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Initial TagAlong commit"
git push origin main
```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Select your GitHub repo
4. Add environment variables:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
   - `VITE_GOOGLE_CLIENT_ID` = your Google Client ID
5. Click "Deploy"

Your app will be live at `https://taggalong.vercel.app`

## 🔐 Setting Up Google OAuth

### For Development:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: "TagAlong"
3. Enable "Google+ API"
4. Go to Credentials → "Create OAuth 2.0 Client ID"
5. Choose "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:5173/auth/callback`
   - `http://localhost:5173`
7. Copy Client ID to `.env.local`

### For Production:

Add to authorized redirect URIs:
- `https://taggalong.vercel.app/auth/callback`
- `https://taggalong.vercel.app`
- `https://yourdomain.com/auth/callback` (if using custom domain)

## 📊 Testing with Mock Data

Seeds 10 test users and 5 test rides for demo:

```bash
npm run seed
```

Test emails:
- `pgp17test1@iimrohtak.ac.in` / password: `test123`
- `ipm04test2@iimrohtak.ac.in` / password: `test123`

## 🐛 Troubleshooting

### "Supabase connection failed"
- Check `.env.local` has correct URL and keys
- Verify Supabase project is active

### "Google auth not working"
- Verify Client ID in `.env.local`
- Check redirect URI matches exactly in Google Cloud Console
- Clear browser cache and cookies

### "Rides not showing"
- Ensure database tables created
- Check RLS policies (if enabled, may need adjustment)
- Verify rides exist in Supabase

### "Maps not loading"
- Get Google Maps API key
- Enable Maps API in Google Cloud Console
- Add API key to environment variables

## 📱 Mobile Responsive

App is fully responsive and works on:
- Mobile (375px+)
- Tablet (768px+)
- Desktop (1024px+)

## 🔄 Real-time Features

Uses Supabase Realtime for:
- Live chat messages
- Ride updates (new participants, status changes)
- Location updates

## 📈 Performance

- Vite for fast dev server (<100ms rebuilds)
- Optimized bundle size (~80KB gzipped)
- Server-side rendering with SSG
- Automatic code splitting

## 🔒 Security

- Google OAuth for auth (no passwords stored)
- Row-level security on database
- Environment variables for secrets
- HTTPS on all connections
- SQL injection protection via Supabase

## 📝 API Reference

### User Registration
```typescript
POST /auth/signup
Body: { email, password, name }
Response: { user, session }
```

### Create Ride
```typescript
POST /rides
Body: { origin, destination, date, time, cost, seats, driver_info }
Response: { ride_id, created_at }
```

### Get Matching Rides
```typescript
GET /rides/search?origin=...&destination=...&date=...
Response: { rides[], match_scores[] }
```

### Join Ride
```typescript
POST /rides/:id/join
Body: { user_id }
Response: { request_id, status: 'pending' }
```

## 🤝 Contributing

To contribute:
1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 📄 License

MIT License - See LICENSE file

## 📞 Support

- **Email**: bharath@taggalong.app
- **Issues**: GitHub Issues
- **Chat**: In-app messaging

## 🎉 Roadmap

- [ ] Push notifications
- [ ] Driver rating system
- [ ] SMS notifications
- [ ] Admin dashboard
- [ ] Payment integration
- [ ] Advanced analytics
- [ ] Referral program
- [ ] Multi-city expansion

## 🏗️ Architecture

```
Frontend (React)
    ↓
Vercel CDN
    ↓
Supabase API
    ↓
PostgreSQL Database
    ↓
Google OAuth / Google Maps
```

## 📚 Learning Resources

- [React Documentation](https://react.dev)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [Vite Guide](https://vitejs.dev)

---

**Built with ❤️ for IIM Rohtak Students**

Version: 0.1.0  
Last Updated: September 2026
