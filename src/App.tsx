import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import ProfilesPage from './pages/profiles/ProfilesPage';
import ProfilesAppPage from './pages/profiles/ProfilesAppPage';
import ProfileEditPage from './pages/profiles/ProfileEditPage';
import HomePage from './pages/home/HomePage';
import DispensaPage from './pages/dispensa/DispensaPage';
import PianoPage from './pages/piano/PianoPage';
import RecipePage from './pages/piano/RecipePage';
import SpesaPage from './pages/spesa/SpesaPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore';

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/profiles" replace /> : <LoginPage />}
        />

        {/* Profile selection (family login) */}
        <Route
          path="/profiles"
          element={
            <ProtectedRoute>
              <ProfilesPage />
            </ProtectedRoute>
          }
        />

        {/* Profile edit/create */}
        <Route
          path="/profile/:profileId"
          element={
            <ProtectedRoute>
              <ProfileEditPage />
            </ProtectedRoute>
          }
        />

        {/* App routes (require profile) */}
        <Route
          path="/"
          element={
            <ProtectedRoute requireProfile>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profili-app"
          element={
            <ProtectedRoute requireProfile>
              <ProfilesAppPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dispensa"
          element={
            <ProtectedRoute requireProfile>
              <DispensaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/piano"
          element={
            <ProtectedRoute requireProfile>
              <PianoPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/piano/ricetta"
          element={
            <ProtectedRoute requireProfile>
              <RecipePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/spesa"
          element={
            <ProtectedRoute requireProfile>
              <SpesaPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
