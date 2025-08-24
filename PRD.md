# Product Requirements Document (PRD)
# Speculate - TV Show Speculation App

## Executive Summary

Speculate is a mobile application that transforms TV watching into an interactive experience by allowing users to speculate plot twists, track their accuracy, and engage with a community of fellow TV enthusiasts. Users can make speculations about upcoming episodes, compete with others for accuracy rankings, and discover trending shows through community engagement.

## Product Vision

To create the ultimate companion app for TV show enthusiasts that gamifies the viewing experience through speculations, fostering deeper engagement with content and building vibrant communities around shared viewing experiences.

## Target Audience

### Primary Users
- TV show enthusiasts aged 18-35
- Binge-watchers who follow multiple series
- Users who engage in online TV show discussions
- Mystery and thriller genre fans who enjoy theorizing

### Secondary Users
- Casual viewers looking to discover new shows
- Social viewers who watch with friends/family
- Content creators and TV show reviewers

## Core Features

### 1. Home Screen Dashboard
**Purpose**: Central hub for user engagement and discovery

**Current Implementation**:
- **Hero Section**: Eye-catching banner with app tagline and call-to-action
- **Quick Stats Display**:
  - Active speculations count with animated shimmer effect
  - User's overall speculation accuracy percentage
  - User's accumulated points with animated display
- **Trending Shows Carousel**: Horizontal scroll of popular shows
- **Hot Speculations Feed**: Live speculations users can participate in
- **Pull-to-refresh functionality**: Update content dynamically

### 2. Show Discovery & Management

#### My Shows Tab
**Purpose**: Personal show tracking and management

**Features**:
- Search bar for filtering followed shows
- Filter options (all, airing, upcoming, ended)
- List of followed shows with:
  - Show poster image
  - Title and genre
  - Active speculations count
  - Next episode information
  - Community accuracy metrics
- Recommended shows section based on user preferences

#### All Shows Screen
**Purpose**: Comprehensive show browsing and discovery

**Features**:
- Dynamic title based on navigation context (Trending/Recommended/All)
- Search functionality by title or genre
- Filter chips (all, trending, new, ending soon)
- Results count display
- Show cards with follow/unfollow functionality
- Contextual filtering based on entry point

### 3. Show Details Page

**Purpose**: Deep dive into individual show information

**Layout Structure**:
1. **Hero Image Section**:
   - Show poster/banner
   - Title, genre, year, and rating overlay
   - Follow/Following toggle button

2. **Statistics Dashboard**:
   - Total speculations count
   - Follower count
   - Community accuracy percentage

3. **Top Speculators Section**:
   - Leaderboard of top 3 speculateors
   - Username, speculation count, and accuracy percentage
   - Numbered ranking badges

4. **Hot Speculations Section**:
   - Active speculations for the show
   - Speculation cards with voting interface
   - "View All Speculations" navigation button

5. **Episodes Section**:
   - Collapsible season listings
   - Episode titles with air dates
   - Speculation counts per episode
   - Live indicators for upcoming episodes

### 4. Speculation System

#### Speculation Card Component
**Purpose**: Core interaction element for making speculations

**Features**:
- **Question Types**:
  - Yes/No binary speculations
  - Multiple choice speculations (up to 4 options)

- **Visual Elements**:
  - Show name badge
  - Question text
  - Timer countdown for open speculations
  - Participant count
  - Vote distribution (shown after voting)
  - Percentage breakdowns

- **States**:
  - Open: Accepting speculations
  - Locked: No longer accepting, awaiting outcome
  - Resolved: Results revealed with accuracy metrics

#### Speculation Interaction
- Tap to select/deselect options
- Visual feedback for selected choices
- Real-time vote count updates
- Result visualization with success/failure indicators

### 5. User Profile & Stats

**Current Metrics Tracked**:
- Overall speculation accuracy percentage
- Total points accumulated
- Number of active speculations
- Shows followed count

### 6. Navigation & UI Components

#### Tab Navigation
- Home (Dashboard)
- My Shows
- Explore (placeholder)
- Leaderboard (placeholder)
- Profile (placeholder)

#### Common UI Elements
- Consistent card designs with dark theme
- Purple accent color (#a855f7) for primary actions
- Border-based card separation
- Responsive touch targets
- Smooth animations and transitions

## Technical Features

### Current Implementation
- React Native with Expo framework
- TypeScript for type safety
- Expo Router for navigation
- NativeWind for styling (Tailwind CSS)
- Lucide React Native for icons
- Component-based architecture
- Mock data structure (ready for API integration)

### Design System
- **Color Palette**:
  - Background: Dark (#0A0A0F)
  - Card backgrounds: Slightly lighter dark
  - Primary: Purple (#a855f7)
  - Success: Green
  - Text: White/Gray hierarchy

- **Typography**:
  - Clear hierarchy with size and weight
  - Consistent spacing and line heights
  - Readable contrast ratios

## Future Enhancements (Roadmap)

### Phase 1: Backend Integration
- User authentication system
- Real-time speculation API
- Show data from external APIs (TMDB, etc.)
- Push notifications for episode reminders

### Phase 2: Social Features
- User profiles with avatars
- Follow other speculateors
- Comments on speculations
- Share speculations on social media
- Group speculations with friends

### Phase 3: Gamification
- Achievement badges
- Speculation streaks
- Seasonal competitions
- Show-specific leaderboards
- Rewards system

### Phase 4: Advanced Features
- AI-powered show recommendations
- Speculation insights and analytics
- Episode discussion forums
- Live speculation events during premieres
- Creator/influencer partnerships

## Success Metrics

### User Engagement
- Daily Active Users (DAU)
- Average speculations per user per week
- User retention rate (Day 1, 7, 30)
- Average session duration

### Content Metrics
- Number of shows with active speculations
- Speculation participation rate
- Accuracy improvement over time
- Community size per show

### Business Metrics
- User acquisition cost
- Lifetime value (LTV)
- Viral coefficient (user referrals)
- Premium conversion rate (future)

## Constraints & Considerations

### Technical
- Cross-platform compatibility (iOS/Android)
- Offline capability for viewing speculations
- Performance optimization for large datasets
- Real-time synchronization requirements

### Legal & Compliance
- Content rights and show information usage
- User data privacy (GDPR, CCPA)
- Age restrictions for certain content
- Community guidelines and moderation

### Business
- Monetization strategy TBD (ads, premium, or hybrid)
- Partnership requirements with content providers
- Scalability of speculation verification system
- International expansion considerations

## Conclusion

Speculate aims to revolutionize the TV viewing experience by adding an interactive speculation layer that enhances engagement and builds community. The current MVP provides core functionality for show discovery, speculation making, and accuracy tracking, with a clear roadmap for social and gamification features that will drive long-term user retention and growth.
