import { Route, Routes } from 'react-router'
import Navbar from './components/Navbar.tsx'
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
import TryLine from './pages/TryLine.tsx'

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/openings" element={<Openings />} />
        <Route path="/course/:slug" element={<CoursePage />} />
        <Route path="/course/:slug/try" element={<TryLine />} />
        <Route path="/train/learn/:courseId" element={<Learn />} />
        <Route path="/train/human/:courseId" element={<HumanMoves />} />
        <Route path="/train/review" element={<Review />} />
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
    </div>
  )
}
