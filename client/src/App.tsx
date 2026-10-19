import { Route, Routes, useLocation } from 'react-router'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import Footer from './components/Footer.tsx'
import Navbar from './components/Navbar.tsx'
import ServerWaking from './components/ServerWaking.tsx'
import Analysis from './pages/Analysis.tsx'
import AuthPage from './pages/AuthPage.tsx'
import Community from './pages/Community.tsx'
import CoursePage from './pages/CoursePage.tsx'
import CreatorEdit from './pages/CreatorEdit.tsx'
import CreatorNew from './pages/CreatorNew.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Home from './pages/Home.tsx'
import HumanMoves from './pages/HumanMoves.tsx'
import Leaderboards from './pages/Leaderboards.tsx'
import Learn from './pages/Learn.tsx'
import NotFound from './pages/NotFound.tsx'
import Openings from './pages/Openings.tsx'
import Review from './pages/Review.tsx'
import TrainLines from './pages/TrainLines.tsx'
import TryLine from './pages/TryLine.tsx'

export default function App() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <ErrorBoundary key={pathname}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/openings" element={<Openings />} />
            <Route path="/course/:slug" element={<CoursePage />} />
            <Route path="/course/:slug/try" element={<TryLine />} />
            <Route path="/train/learn/:courseId" element={<Learn />} />
            <Route path="/train/human/:courseId" element={<HumanMoves />} />
            <Route path="/train/review" element={<Review />} />
            <Route path="/train/lines/:courseId" element={<TrainLines />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leaderboards" element={<Leaderboards />} />
            <Route path="/creator/new" element={<CreatorNew />} />
            <Route path="/creator/:id" element={<CreatorEdit />} />
            <Route path="/community" element={<Community />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </div>
      <Footer />
      <ServerWaking />
    </div>
  )
}
