import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { auth } = useAuth();
  return auth?.token ? children : <Navigate to="/login" replace />;
}
